import { eq, and, isNull, ilike, sql } from 'drizzle-orm'
import { db } from '../../lib/db/client.js'
import { flags, targetingRules, flagVersions, projects, workspaceMembers } from '../../lib/db/schema.js'
import { flagCache } from '../../lib/cache/flag-cache.js'
import { auditService } from '../../lib/audit/audit.service.js'
import { cacheHitsTotal, cacheMissesTotal } from '../../lib/metrics.js'
import type {
  CreateFlagInput, UpdateFlagInput,
  UpdateFlagStatusInput, UpsertTargetingRulesInput,
  ListFlagsQuery,
} from './flags.schemas.js'

// ─── Helper: get workspace ID from project ───────────────────
async function getWorkspaceId(projectId: string): Promise<string> {
  const [project] = await db.select({ workspaceId: projects.workspaceId })
    .from(projects).where(eq(projects.id, projectId)).limit(1)
  if (!project) throw Object.assign(new Error('Project not found'), { code: 'PROJECT_NOT_FOUND', status: 404 })
  return project.workspaceId
}

// ─── Helper: get full flag config (for cache) ────────────────
async function getFlagConfig(projectId: string) {
  const flagList = await db.select().from(flags)
    .where(and(eq(flags.projectId, projectId), isNull(flags.deletedAt)))

  const rules = flagList.length > 0
    ? await db.select().from(targetingRules)
        .where(sql`${targetingRules.flagId} IN ${flagList.map(f => f.id)}`)
    : []

  return flagList.map(flag => ({
    id:               flag.id,
    key:              flag.key,
    type:             flag.type,
    status:           flag.status,
    defaultValue:     flag.defaultValue,
    targetingEnabled: flag.targetingEnabled,
    version:          flag.version,
    updatedAt:        flag.updatedAt,
    targetingRules:   rules
      .filter(r => r.flagId === flag.id)
      .sort((a, b) => a.ruleOrder - b.ruleOrder)
      .map(r => ({
        id:                r.id,
        name:              r.name,
        conditions:        r.conditions,
        serveValue:        r.serveValue,
        rolloutPercentage: r.rolloutPercentage,
        ruleOrder:         r.ruleOrder,
      })),
  }))
}

export const flagsService = {

  // ─── List flags ────────────────────────────────────────────
  async list(projectId: string, query: ListFlagsQuery) {
    const conditions = [
      eq(flags.projectId, projectId),
      isNull(flags.deletedAt),
    ]
    if (query.status) conditions.push(eq(flags.status, query.status))
    if (query.search) conditions.push(ilike(flags.name, `%${query.search}%`))

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(flags)
      .where(and(...conditions))

    const total = countResult?.count ?? 0
    const offset = (query.page - 1) * query.limit

    const flagList = await db.select().from(flags)
      .where(and(...conditions))
      .orderBy(flags.createdAt)
      .limit(query.limit)
      .offset(offset)

    return {
      flags:      flagList,
      total,
      page:       query.page,
      limit:      query.limit,
      hasMore:    offset + flagList.length < total,
    }
  },

  // ─── Get single flag ───────────────────────────────────────
  async getById(projectId: string, flagId: string) {
    const [flag] = await db.select().from(flags)
      .where(and(
        eq(flags.id, flagId),
        eq(flags.projectId, projectId),
        isNull(flags.deletedAt),
      ))
      .limit(1)

    if (!flag) throw Object.assign(new Error('Flag not found'), { code: 'FLAG_NOT_FOUND', status: 404 })

    const rules = await db.select().from(targetingRules)
      .where(eq(targetingRules.flagId, flagId))
      .orderBy(targetingRules.ruleOrder)

    return { ...flag, targetingRules: rules }
  },

  // ─── Create flag ───────────────────────────────────────────
  async create(projectId: string, input: CreateFlagInput, actorId: string, actorEmail: string, ipAddress?: string) {
    const workspaceId = await getWorkspaceId(projectId)

    // Check key uniqueness within project
    const [existing] = await db.select({ id: flags.id }).from(flags)
      .where(and(
        eq(flags.projectId, projectId),
        eq(flags.key, input.key),
        isNull(flags.deletedAt),
      ))
      .limit(1)

    if (existing) {
      throw Object.assign(
        new Error(`A flag with key '${input.key}' already exists in this project`),
        { code: 'FLAG_KEY_ALREADY_EXISTS', status: 409 }
      )
    }

    const [flag] = await db.insert(flags).values({
      projectId,
      key:          input.key,
      name:         input.name,
      description:  input.description,
      type:         input.type,
      defaultValue: input.defaultValue as object,
      tags:         input.tags,
      createdBy:    actorId,
    }).returning()

    // Write initial version snapshot
    await db.insert(flagVersions).values({
      flagId:    flag.id,
      version:   1,
      snapshot:  flag as object,
      changedBy: actorId,
      changeReason: 'Initial creation',
    })

    // Audit log
    await auditService.log({
      workspaceId, actorId, actorEmail,
      action:       'flag.created',
      resourceType: 'flag',
      resourceId:   flag.id,
      after:        flag,
      ipAddress,
    })

    // Invalidate cache + publish
    await flagCache.invalidate(projectId)
    await flagCache.publish(projectId, {
      type:       'flag_created',
      projectId,
      flagId:     flag.id,
      flagKey:    flag.key,
      changeType: 'created',
    })

    return flag
  },

  // ─── Update flag ───────────────────────────────────────────
  async update(projectId: string, flagId: string, input: UpdateFlagInput, actorId: string, actorEmail: string, ipAddress?: string) {
    const workspaceId = await getWorkspaceId(projectId)
    const existing = await flagsService.getById(projectId, flagId)

    const updates: Partial<typeof flags.$inferInsert> = {
      updatedAt: new Date(),
    }
    if (input.name             !== undefined) updates.name             = input.name
    if (input.description      !== undefined) updates.description      = input.description
    if (input.defaultValue     !== undefined) updates.defaultValue     = input.defaultValue as object
    if (input.tags             !== undefined) updates.tags             = input.tags
    if (input.targetingEnabled !== undefined) updates.targetingEnabled = input.targetingEnabled
    updates.version = (existing.version ?? 1) + 1

    const [updated] = await db.update(flags)
      .set(updates)
      .where(and(eq(flags.id, flagId), eq(flags.projectId, projectId)))
      .returning()

    // Immutable version snapshot
    await db.insert(flagVersions).values({
      flagId:       flagId,
      version:      updated.version,
      snapshot:     updated as object,
      changedBy:    actorId,
      changeReason: input.changeReason,
    })

    await auditService.log({
      workspaceId, actorId, actorEmail,
      action:       'flag.updated',
      resourceType: 'flag',
      resourceId:   flagId,
      before:       existing,
      after:        updated,
      ipAddress,
    })

    await flagCache.invalidate(projectId)
    await flagCache.publish(projectId, {
      type: 'flag_updated', projectId, flagId, flagKey: updated.key, changeType: 'updated',
    })

    return updated
  },

  // ─── Update flag status (the kill switch) ─────────────────
  async updateStatus(projectId: string, flagId: string, input: UpdateFlagStatusInput, actorId: string, actorEmail: string, ipAddress?: string) {
    const workspaceId = await getWorkspaceId(projectId)
    const existing = await flagsService.getById(projectId, flagId)

    const [updated] = await db.update(flags)
      .set({ status: input.status, updatedAt: new Date(), version: existing.version + 1 })
      .where(and(eq(flags.id, flagId), eq(flags.projectId, projectId)))
      .returning()

    await db.insert(flagVersions).values({
      flagId, version: updated.version,
      snapshot:     updated as object,
      changedBy:    actorId,
      changeReason: `Status changed to ${input.status}`,
    })

    await auditService.log({
      workspaceId, actorId, actorEmail,
      action:       `flag.${input.status}`,
      resourceType: 'flag',
      resourceId:   flagId,
      before:       { status: existing.status },
      after:        { status: input.status },
      ipAddress,
    })

    // Invalidate + publish — this is the kill switch broadcast
    await flagCache.invalidate(projectId)
    await flagCache.publish(projectId, {
      type: 'flag_updated', projectId, flagId,
      flagKey:    updated.key,
      changeType: input.status,
    })

    return updated
  },

  // ─── Soft delete flag ─────────────────────────────────────
  async delete(projectId: string, flagId: string, actorId: string, actorEmail: string, ipAddress?: string) {
    const workspaceId = await getWorkspaceId(projectId)
    const existing = await flagsService.getById(projectId, flagId)

    await db.update(flags)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(flags.id, flagId), eq(flags.projectId, projectId)))

    await auditService.log({
      workspaceId, actorId, actorEmail,
      action:       'flag.deleted',
      resourceType: 'flag',
      resourceId:   flagId,
      before:       existing,
      ipAddress,
    })

    await flagCache.invalidate(projectId)
    await flagCache.publish(projectId, {
      type: 'flag_deleted', projectId, flagId, flagKey: existing.key, changeType: 'deleted',
    })

    return { deleted: true }
  },

  // ─── Upsert targeting rules ────────────────────────────────
  async upsertTargetingRules(projectId: string, flagId: string, input: UpsertTargetingRulesInput, actorId: string, actorEmail: string, ipAddress?: string) {
    const workspaceId = await getWorkspaceId(projectId)
    const flag = await flagsService.getById(projectId, flagId)
    const before = flag.targetingRules

    // Delete existing rules and reinsert (simpler than diffing)
    await db.delete(targetingRules).where(eq(targetingRules.flagId, flagId))

    const newRules = input.rules.length > 0
      ? await db.insert(targetingRules).values(
          input.rules.map((rule, index) => ({
            flagId,
            ruleOrder:         index,
            name:              rule.name,
            conditions:        rule.conditions as object,
            serveValue:        rule.serveValue as object,
            rolloutPercentage: rule.rolloutPercentage,
          }))
        ).returning()
      : []

    // Bump flag version
    const newVersion = flag.version + 1
    await db.update(flags)
      .set({ version: newVersion, updatedAt: new Date() })
      .where(eq(flags.id, flagId))

    await db.insert(flagVersions).values({
      flagId, version: newVersion,
      snapshot:     { ...flag, targetingRules: newRules } as object,
      changedBy:    actorId,
      changeReason: 'Targeting rules updated',
    })

    await auditService.log({
      workspaceId, actorId, actorEmail,
      action:       'flag.rules_updated',
      resourceType: 'flag',
      resourceId:   flagId,
      before:       before,
      after:        newRules,
      ipAddress,
    })

    await flagCache.invalidate(projectId)
    await flagCache.publish(projectId, {
      type: 'flag_updated', projectId, flagId, flagKey: flag.key, changeType: 'rules_updated',
    })

    return newRules
  },

  // ─── Get flag versions (history) ──────────────────────────
  async getVersions(projectId: string, flagId: string) {
    await flagsService.getById(projectId, flagId) // validates ownership
    return db.select().from(flagVersions)
      .where(eq(flagVersions.flagId, flagId))
      .orderBy(sql`${flagVersions.version} DESC`)
  },

  async getSDKConfig(projectId: string) {
    const cached = await flagCache.get(projectId)
    if (cached) {
      cacheHitsTotal.labels('redis').inc()
      return cached
    }

    cacheMissesTotal.labels('redis').inc()
    const config = await getFlagConfig(projectId)
    await flagCache.set(projectId, config)
    return config
  },
}
