import { eq, and, isNull, sql } from 'drizzle-orm'
import { db } from '../../lib/db/client.js'
import {
  experiments, experimentVariants, experimentResults,
  experimentImpressions, experimentEvents, projects,
} from '../../lib/db/schema.js'
import { auditService } from '../../lib/audit/audit.service.js'
import type { CreateExperimentInput, UpdateExperimentInput, ListExperimentsQuery } from './experiments.schemas.js'

async function getWorkspaceId(projectId: string): Promise<string> {
  const [p] = await db.select({ workspaceId: projects.workspaceId })
    .from(projects).where(eq(projects.id, projectId)).limit(1)
  if (!p) throw Object.assign(new Error('Project not found'), { code: 'PROJECT_NOT_FOUND', status: 404 })
  return p.workspaceId
}

export const experimentsService = {

  async list(projectId: string, query: ListExperimentsQuery) {
    const conditions = [eq(experiments.projectId, projectId), isNull(experiments.deletedAt)]
    if (query.status) conditions.push(eq(experiments.status, query.status))

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(experiments).where(and(...conditions))

    const offset = (query.page - 1) * query.limit
    const list   = await db.select().from(experiments)
      .where(and(...conditions))
      .orderBy(experiments.createdAt)
      .limit(query.limit).offset(offset)

    return { experiments: list, total: count, page: query.page, limit: query.limit, hasMore: offset + list.length < count }
  },

  async getById(projectId: string, experimentId: string) {
    const [exp] = await db.select().from(experiments)
      .where(and(eq(experiments.id, experimentId), eq(experiments.projectId, projectId), isNull(experiments.deletedAt)))
      .limit(1)
    if (!exp) throw Object.assign(new Error('Experiment not found'), { code: 'EXPERIMENT_NOT_FOUND', status: 404 })

    const variants = await db.select().from(experimentVariants)
      .where(eq(experimentVariants.experimentId, experimentId))

    return { ...exp, variants }
  },

  async create(projectId: string, input: CreateExperimentInput, actorId: string, actorEmail: string, ip?: string) {
    const workspaceId = await getWorkspaceId(projectId)

    const [existing] = await db.select({ id: experiments.id }).from(experiments)
      .where(and(eq(experiments.projectId, projectId), eq(experiments.key, input.key), isNull(experiments.deletedAt)))
      .limit(1)
    if (existing) throw Object.assign(
      new Error(`Experiment with key '${input.key}' already exists`),
      { code: 'EXPERIMENT_KEY_EXISTS', status: 409 }
    )

    const [exp] = await db.insert(experiments).values({
      projectId,
      key:               input.key,
      name:              input.name,
      hypothesis:        input.hypothesis,
      primaryMetric:     input.primaryMetric,
      secondaryMetrics:  input.secondaryMetrics,
      trafficAllocation: input.trafficAllocation,
      confidenceLevel:   String(input.confidenceLevel),
      createdBy:         actorId,
    }).returning()

    const variantRows = await db.insert(experimentVariants).values(
      input.variants.map(v => ({
        experimentId: exp.id,
        key:          v.key,
        name:         v.name,
        weight:       v.weight,
        value:        v.value as object,
      }))
    ).returning()

    await auditService.log({
      workspaceId, actorId, actorEmail,
      action: 'experiment.created', resourceType: 'experiment',
      resourceId: exp.id, after: { ...exp, variants: variantRows }, ipAddress: ip,
    })

    return { ...exp, variants: variantRows }
  },

  async launch(projectId: string, experimentId: string, actorId: string, actorEmail: string, ip?: string) {
    const workspaceId = await getWorkspaceId(projectId)
    const exp = await experimentsService.getById(projectId, experimentId)

    if (exp.status !== 'draft' && exp.status !== 'paused') {
      throw Object.assign(new Error('Only draft or paused experiments can be launched'), { code: 'INVALID_STATUS_TRANSITION', status: 400 })
    }

    const [updated] = await db.update(experiments)
      .set({ status: 'running', startedAt: new Date(), updatedAt: new Date() })
      .where(eq(experiments.id, experimentId))
      .returning()

    await auditService.log({
      workspaceId, actorId, actorEmail,
      action: 'experiment.launched', resourceType: 'experiment',
      resourceId: experimentId, before: { status: exp.status }, after: { status: 'running' }, ipAddress: ip,
    })

    return updated
  },

  async pause(projectId: string, experimentId: string, actorId: string, actorEmail: string, ip?: string) {
    const workspaceId = await getWorkspaceId(projectId)
    const exp = await experimentsService.getById(projectId, experimentId)
    if (exp.status !== 'running') throw Object.assign(new Error('Only running experiments can be paused'), { code: 'INVALID_STATUS_TRANSITION', status: 400 })

    const [updated] = await db.update(experiments)
      .set({ status: 'paused', updatedAt: new Date() })
      .where(eq(experiments.id, experimentId)).returning()

    await auditService.log({ workspaceId, actorId, actorEmail, action: 'experiment.paused', resourceType: 'experiment', resourceId: experimentId, ipAddress: ip })
    return updated
  },

  async stop(projectId: string, experimentId: string, winnerVariantId: string | undefined, actorId: string, actorEmail: string, ip?: string) {
    const workspaceId = await getWorkspaceId(projectId)
    const exp = await experimentsService.getById(projectId, experimentId)
    if (exp.status === 'stopped') throw Object.assign(new Error('Experiment already stopped'), { code: 'INVALID_STATUS_TRANSITION', status: 400 })

    const [updated] = await db.update(experiments)
      .set({ status: 'stopped', stoppedAt: new Date(), winnerVariantId: winnerVariantId ?? null, updatedAt: new Date() })
      .where(eq(experiments.id, experimentId)).returning()

    await auditService.log({ workspaceId, actorId, actorEmail, action: 'experiment.stopped', resourceType: 'experiment', resourceId: experimentId, ipAddress: ip })
    return updated
  },

  async getResults(projectId: string, experimentId: string) {
    await experimentsService.getById(projectId, experimentId)

    const results = await db.select().from(experimentResults)
      .where(eq(experimentResults.experimentId, experimentId))
      .orderBy(experimentResults.computedAt)

    const variants = await db.select().from(experimentVariants)
      .where(eq(experimentVariants.experimentId, experimentId))

    // Summary stats per variant
    const [impressionCounts] = await db
      .select({ variantId: experimentImpressions.variantId, count: sql<number>`count(*)::int` })
      .from(experimentImpressions)
      .where(eq(experimentImpressions.experimentId, experimentId))
      .groupBy(experimentImpressions.variantId)
      .then(rows => [rows])

    return { variants, results, impressionSummary: impressionCounts }
  },
}
