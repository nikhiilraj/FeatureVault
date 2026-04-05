import type { FastifyInstance } from 'fastify'
import { eq, and, lt } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../lib/db/client.js'
import { auditLogs } from '../../lib/db/schema.js'
import { authenticate } from '../../middleware/authenticate.js'
import { success, error } from '../../utils/response.js'

const querySchema = z.object({
  limit:        z.coerce.number().int().min(1).max(100).default(50),
  cursor:       z.string().optional(),
  resourceType: z.string().optional(),
})

export async function auditRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)

  // GET /v1/workspaces/me/audit-logs — cursor-paginated
  app.get('/', async (request, reply) => {
    const { workspaceId } = request.user
    const parsed = querySchema.safeParse(request.query)
    if (!parsed.success) return error(reply, 400, 'VALIDATION_ERROR', parsed.error.errors[0].message)

    const { limit, cursor, resourceType } = parsed.data

    const conditions = [eq(auditLogs.workspaceId, workspaceId)]
    if (resourceType) conditions.push(eq(auditLogs.resourceType, resourceType))
    if (cursor) {
      const cursorDate = new Date(Buffer.from(cursor, 'base64url').toString())
      conditions.push(lt(auditLogs.createdAt, cursorDate))
    }

    const logs = await db.select().from(auditLogs)
      .where(and(...conditions))
      .orderBy(auditLogs.createdAt)
      .limit(limit + 1) // fetch one extra to check hasMore

    const hasMore = logs.length > limit
    const items   = hasMore ? logs.slice(0, limit) : logs
    const nextCursor = hasMore
      ? Buffer.from(items[items.length - 1].createdAt.toISOString()).toString('base64url')
      : undefined

    return success(reply, {
      logs:       items,
      nextCursor,
      hasMore,
    })
  })
}
