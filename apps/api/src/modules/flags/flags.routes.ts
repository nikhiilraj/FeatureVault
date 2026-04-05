import type { FastifyInstance } from 'fastify'
import { flagsService } from './flags.service.js'
import {
  createFlagSchema, updateFlagSchema, updateFlagStatusSchema,
  upsertTargetingRulesSchema, listFlagsQuerySchema,
} from './flags.schemas.js'
import { authenticate, requireRole } from '../../middleware/authenticate.js'
import { success, error, paginated } from '../../utils/response.js'

export async function flagRoutes(app: FastifyInstance) {
  // All flag routes require authentication
  app.addHook('preHandler', authenticate)

  // GET /v1/projects/:projectId/flags
  app.get('/', async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    const parsed = listFlagsQuerySchema.safeParse(request.query)
    if (!parsed.success) return error(reply, 400, 'VALIDATION_ERROR', parsed.error.errors[0].message)

    try {
      const result = await flagsService.list(projectId, parsed.data)
      return paginated(reply, result.flags, {
        total:   result.total,
        page:    result.page,
        limit:   result.limit,
        hasMore: result.hasMore,
      })
    } catch (err: any) {
      return error(reply, err.status ?? 500, err.code ?? 'INTERNAL_ERROR', err.message)
    }
  })

  // GET /v1/projects/:projectId/flags/:flagId
  app.get('/:flagId', async (request, reply) => {
    const { projectId, flagId } = request.params as { projectId: string; flagId: string }
    try {
      const flag = await flagsService.getById(projectId, flagId)
      return success(reply, flag)
    } catch (err: any) {
      return error(reply, err.status ?? 500, err.code ?? 'INTERNAL_ERROR', err.message)
    }
  })

  // POST /v1/projects/:projectId/flags — editor+
  app.post('/', { preHandler: requireRole('editor', 'admin', 'owner') }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    const parsed = createFlagSchema.safeParse(request.body)
    if (!parsed.success) {
      const e = parsed.error.errors[0]
      return error(reply, 400, 'VALIDATION_ERROR', e.message, e.path[0] as string)
    }
    try {
      const flag = await flagsService.create(
        projectId, parsed.data,
        request.user.userId, request.user.email, request.ip,
      )
      return success(reply, flag, 201)
    } catch (err: any) {
      return error(reply, err.status ?? 500, err.code ?? 'INTERNAL_ERROR', err.message)
    }
  })

  // PATCH /v1/projects/:projectId/flags/:flagId — editor+
  app.patch('/:flagId', { preHandler: requireRole('editor', 'admin', 'owner') }, async (request, reply) => {
    const { projectId, flagId } = request.params as { projectId: string; flagId: string }
    const parsed = updateFlagSchema.safeParse(request.body)
    if (!parsed.success) {
      const e = parsed.error.errors[0]
      return error(reply, 400, 'VALIDATION_ERROR', e.message, e.path[0] as string)
    }
    try {
      const flag = await flagsService.update(
        projectId, flagId, parsed.data,
        request.user.userId, request.user.email, request.ip,
      )
      return success(reply, flag)
    } catch (err: any) {
      return error(reply, err.status ?? 500, err.code ?? 'INTERNAL_ERROR', err.message)
    }
  })

  // PATCH /v1/projects/:projectId/flags/:flagId/status — admin+ for kill, editor+ for toggle
  app.patch('/:flagId/status', async (request, reply) => {
    const { projectId, flagId } = request.params as { projectId: string; flagId: string }
    const parsed = updateFlagStatusSchema.safeParse(request.body)
    if (!parsed.success) return error(reply, 400, 'VALIDATION_ERROR', parsed.error.errors[0].message)

    // Killing a flag requires admin+
    if (parsed.data.status === 'killed' && !['admin', 'owner'].includes(request.user.role)) {
      return error(reply, 403, 'INSUFFICIENT_PERMISSIONS', 'Killing a flag requires admin or owner role')
    }

    try {
      const flag = await flagsService.updateStatus(
        projectId, flagId, parsed.data,
        request.user.userId, request.user.email, request.ip,
      )
      return success(reply, flag)
    } catch (err: any) {
      return error(reply, err.status ?? 500, err.code ?? 'INTERNAL_ERROR', err.message)
    }
  })

  // PUT /v1/projects/:projectId/flags/:flagId/rules — editor+
  app.put('/:flagId/rules', { preHandler: requireRole('editor', 'admin', 'owner') }, async (request, reply) => {
    const { projectId, flagId } = request.params as { projectId: string; flagId: string }
    const parsed = upsertTargetingRulesSchema.safeParse(request.body)
    if (!parsed.success) return error(reply, 400, 'VALIDATION_ERROR', parsed.error.errors[0].message)

    try {
      const rules = await flagsService.upsertTargetingRules(
        projectId, flagId, parsed.data,
        request.user.userId, request.user.email, request.ip,
      )
      return success(reply, rules)
    } catch (err: any) {
      return error(reply, err.status ?? 500, err.code ?? 'INTERNAL_ERROR', err.message)
    }
  })

  // GET /v1/projects/:projectId/flags/:flagId/versions
  app.get('/:flagId/versions', async (request, reply) => {
    const { projectId, flagId } = request.params as { projectId: string; flagId: string }
    try {
      const versions = await flagsService.getVersions(projectId, flagId)
      return success(reply, versions)
    } catch (err: any) {
      return error(reply, err.status ?? 500, err.code ?? 'INTERNAL_ERROR', err.message)
    }
  })

  // DELETE /v1/projects/:projectId/flags/:flagId — admin+
  app.delete('/:flagId', { preHandler: requireRole('admin', 'owner') }, async (request, reply) => {
    const { projectId, flagId } = request.params as { projectId: string; flagId: string }
    try {
      const result = await flagsService.delete(
        projectId, flagId,
        request.user.userId, request.user.email, request.ip,
      )
      return success(reply, result)
    } catch (err: any) {
      return error(reply, err.status ?? 500, err.code ?? 'INTERNAL_ERROR', err.message)
    }
  })
}
