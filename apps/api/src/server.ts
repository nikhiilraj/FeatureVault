import './lib/opentelemetry.js'
import Fastify from 'fastify'
import { env } from './lib/env.js'

const app = Fastify({
  logger: {
    level: env.LOG_LEVEL ?? 'info',
  },
  genReqId: () => crypto.randomUUID(),
})

import helmet    from '@fastify/helmet'
import cors      from '@fastify/cors'
import cookie    from '@fastify/cookie'
import rateLimit from '@fastify/rate-limit'
import websocket from '@fastify/websocket'
import jwtPlugin from './plugins/jwt.js'
import metricsPlugin from './plugins/metrics.js'
import { register as promRegister, pgPoolActiveConnections, pgPoolIdleConnections, pgPoolWaitingCount, bullmqJobsWaiting, bullmqJobsActive, bullmqJobsFailed } from './lib/metrics.js'
import { redisClient } from './lib/redis/client.js'
import { pool } from './lib/db/client.js'
import { eventsQueue, aggregationQueue } from './lib/queue/queues.js'

await app.register(helmet, { contentSecurityPolicy: false })
await app.register(cors,   { origin: env.CORS_ORIGIN, credentials: true })
await app.register(cookie, { secret: env.COOKIE_SECRET })
await app.register(rateLimit, {
  redis: redisClient,
  max: 120,
  timeWindow: '1 minute',
  keyGenerator: (req) => req.headers['authorization'] ?? req.ip,
})
await app.register(websocket)
await app.register(jwtPlugin)
await app.register(metricsPlugin)

import { authRoutes }       from './modules/auth/auth.routes.js'
import { workspaceRoutes }  from './modules/workspace/workspace.routes.js'
import { flagRoutes }       from './modules/flags/flags.routes.js'
import { sdkKeyRoutes }     from './modules/sdk/sdk-keys.routes.js'
import { sdkApiRoutes }     from './modules/sdk/sdk-api.routes.js'
import { sdkEventsRoutes }  from './modules/sdk/sdk-events.routes.js'
import { auditRoutes }      from './modules/audit/audit.routes.js'
import { experimentRoutes } from './modules/experiments/experiments.routes.js'

app.get('/health', async () => ({
  status:    'ok',
  timestamp: new Date().toISOString(),
  version:   process.env.npm_package_version ?? '0.1.0',
}))

app.get('/metrics', async (request, reply) => {
  reply.header('Content-Type', promRegister.contentType)
  return promRegister.metrics()
})

await app.register(authRoutes,      { prefix: '/v1/auth' })
await app.register(workspaceRoutes, { prefix: '/v1/workspaces' })
await app.register(auditRoutes,     { prefix: '/v1/workspaces/me/audit-logs' })

await app.register(async (instance) => {
  await instance.register(flagRoutes,       { prefix: '/:projectId/flags' })
  await instance.register(sdkKeyRoutes,     { prefix: '/:projectId/sdk-keys' })
  await instance.register(experimentRoutes, { prefix: '/:projectId/experiments' })
}, { prefix: '/v1/projects' })

await app.register(sdkApiRoutes,   { prefix: '/sdk/v1' })
await app.register(sdkEventsRoutes, { prefix: '/sdk/v1' })

const shutdown = async (signal: string) => {
  app.log.info(`Received ${signal}, shutting down...`)
  await app.close()
  process.exit(0)
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT',  () => shutdown('SIGINT'))

// ─── Heavy Infrastructure Telemetry Hook ────────────────────
setInterval(async () => {
  // Sync Postgres connection pool status limits
  pgPoolActiveConnections.set(pool.totalCount - pool.idleCount)
  pgPoolIdleConnections.set(pool.idleCount)
  pgPoolWaitingCount.set(pool.waitingCount)

  try {
    // Sync BullMQ depths securely avoiding Redis blocks
    const counts = await eventsQueue.getJobCounts('waiting', 'active', 'failed')
    bullmqJobsWaiting.labels('sdk-events').set(counts.waiting ?? 0)
    bullmqJobsActive.labels('sdk-events').set(counts.active ?? 0)
    bullmqJobsFailed.labels('sdk-events').set(counts.failed ?? 0)
  } catch(e) {
    // fast fail on network interruptions
  }
}, 10_000)

try {
  // Schedule production hourly significance calculations securely
  await aggregationQueue.add('hourly-stats', {}, {
    repeat: { pattern: '0 * * * *' },
    jobId: 'system-aggregation-cron', // Guarantees cluster-safe uniqueness
  })

  // development UX: trigger instantly on boot so dashboard numbers calculate natively
  if (env.NODE_ENV === 'development') {
    await aggregationQueue.add('dev-instant-compute', {})
  }

  await app.listen({ port: env.API_PORT, host: '0.0.0.0' })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
