import './lib/opentelemetry.js'
import { Worker, Queue } from 'bullmq'
import { eq, and, sql } from 'drizzle-orm'
import { db } from './lib/db/client.js'
import {
  experiments, experimentVariants,
  experimentImpressions, experimentEvents, experimentResults,
} from './lib/db/schema.js'
import { welchTTest } from './lib/stats/welch.js'
import { assignVariant } from './lib/stats/variant-assign.js'
import { env } from './lib/env.js'
import { trace } from '@opentelemetry/api'

const tracer = trace.getTracer('fv-worker')

const redisUrl = new URL(env.REDIS_URL)
const connection = {
  host:     redisUrl.hostname,
  port:     Number(redisUrl.port) || 6379,
  password: redisUrl.password || undefined,
}

console.log('🔧  FeatureVault worker starting...')

const eventsWorker = new Worker('sdk-events', async (job) => {
  const { projectId, events } = job.data as {
    projectId: string
    events: Array<{
      eventName:      string
      userId:         string
      experimentKey?: string
      properties?:    Record<string, unknown>
      timestamp:      string
    }>
  }

  for (const event of events) {
    if (!event.experimentKey) continue

    const [exp] = await db.select({
      id: experiments.id, status: experiments.status,
      primaryMetric: experiments.primaryMetric,
    })
      .from(experiments)
      .where(and(
        eq(experiments.projectId, projectId),
        eq(experiments.key, event.experimentKey),
        eq(experiments.status, 'running'),
      ))
      .limit(1)

    if (!exp) continue

    const variants = await db.select()
      .from(experimentVariants)
      .where(eq(experimentVariants.experimentId, exp.id))

    if (variants.length === 0) continue

    const variantKey = assignVariant(event.userId, event.experimentKey, variants)
    const variant    = variants.find(v => v.key === variantKey)
    if (!variant) continue

    await db.insert(experimentImpressions).values({
      experimentId: exp.id,
      variantId:    variant.id,
      userId:       event.userId,
    })

    if (event.eventName === exp.primaryMetric) {
      await db.insert(experimentEvents).values({
        experimentId: exp.id,
        variantId:    variant.id,
        userId:       event.userId,
        eventName:    event.eventName,
        properties:   (event.properties as object) ?? null,
      })
    }
  }
}, { connection, concurrency: 5 })

const aggregationWorker = new Worker('aggregation', async (_job) => {
  console.log('[Aggregation] Running stats...')

  const runningExps = await db.select({
    id: experiments.id,
    primaryMetric: experiments.primaryMetric,
    confidenceLevel: experiments.confidenceLevel,
  }).from(experiments).where(eq(experiments.status, 'running'))

  for (const exp of runningExps) {
    const variants = await db.select().from(experimentVariants)
      .where(eq(experimentVariants.experimentId, exp.id))
    if (variants.length < 2) continue

    const impressions = await db
      .select({ variantId: experimentImpressions.variantId, count: sql<number>`count(*)::int` })
      .from(experimentImpressions)
      .where(eq(experimentImpressions.experimentId, exp.id))
      .groupBy(experimentImpressions.variantId)

    const conversions = await db
      .select({ variantId: experimentEvents.variantId, count: sql<number>`count(*)::int` })
      .from(experimentEvents)
      .where(and(
        eq(experimentEvents.experimentId, exp.id),
        eq(experimentEvents.eventName, exp.primaryMetric),
      ))
      .groupBy(experimentEvents.variantId)

    const control   = variants[0]
    const ctrlN     = impressions.find(i => i.variantId === control.id)?.count ?? 0
    const ctrlConv  = conversions.find(c => c.variantId === control.id)?.count ?? 0
    const confLevel = Number(exp.confidenceLevel)

    for (const variant of variants) {
      const n    = impressions.find(i => i.variantId === variant.id)?.count ?? 0
      const conv = conversions.find(c => c.variantId === variant.id)?.count ?? 0
      const rate = n > 0 ? conv / n : 0

      let pValue = 1; let uplift = 0; let isSig = false
      if (variant.id !== control.id && ctrlN > 1 && n > 1) {
        tracer.startActiveSpan('compute-welch-ttest', (span) => {
          span.setAttribute('experiment.id', exp.id)
          span.setAttribute('variant.id', variant.id)
          try {
            const r = welchTTest(
              { n: ctrlN, conversions: ctrlConv },
              { n, conversions: conv },
              confLevel,
            )
            pValue = r.pValue; uplift = r.uplift; isSig = r.isSignificant
          } finally {
            span.end()
          }
        })
      }

      await tracer.startActiveSpan('upsert-experiment-results', async (span) => {
        span.setAttribute('experiment.id', exp.id)
        try {
          await db.insert(experimentResults).values({
        experimentId:   exp.id,
        variantId:      variant.id,
        metricName:     exp.primaryMetric,
        impressions:    n,
        conversions:    conv,
        conversionRate: String(rate),
        uplift:         String(uplift),
        pValue:         String(pValue),
        isSignificant:  isSig,
        computedAt:     new Date(),
      })
      .onConflictDoUpdate({
        target: [
          experimentResults.experimentId,
          experimentResults.variantId,
          experimentResults.metricName,
        ],
        set: {
          impressions:    sql`excluded.impressions`,
          conversions:    sql`excluded.conversions`,
          conversionRate: sql`excluded.conversion_rate`,
          uplift:         sql`excluded.uplift`,
          pValue:         sql`excluded.p_value`,
          isSignificant:  sql`excluded.is_significant`,
          computedAt:     sql`excluded.computed_at`,
          updatedAt:      new Date(),
        },
      })
      } finally {
        span.end()
      }
    })
    }
  }
}, { connection, concurrency: 1 })

eventsWorker.on('failed',      (job, err) => console.error(`[Events] ${job?.id} failed:`, err.message))
aggregationWorker.on('failed', (job, err) => console.error(`[Aggregation] ${job?.id} failed:`, err.message))

const aggQueue = new Queue('aggregation', { connection })
await aggQueue.add('hourly-stats', {}, {
  repeat: { pattern: '0 * * * *' },
  jobId:  'hourly-aggregation',
})

process.on('SIGTERM', async () => { await eventsWorker.close(); await aggregationWorker.close(); process.exit(0) })
process.on('SIGINT',  async () => { await eventsWorker.close(); await aggregationWorker.close(); process.exit(0) })

console.log('✅  Worker running')
