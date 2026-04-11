import type { FastifyInstance } from 'fastify'
import { experimentsService } from './experiments.service.js'
import { createExperimentSchema, updateExperimentSchema, listExperimentsQuerySchema } from './experiments.schemas.js'
import { authenticate, requireRole } from '../../middleware/authenticate.js'
import { success, error, paginated } from '../../utils/response.js'

export async function experimentRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)

  // GET /v1/projects/:projectId/experiments
  app.get('/', async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    const parsed = listExperimentsQuerySchema.safeParse(request.query)
    if (!parsed.success) return error(reply, 400, 'VALIDATION_ERROR', parsed.error.errors[0].message)
    try {
      const result = await experimentsService.list(projectId, parsed.data)
      return paginated(reply, result.experiments, { total: result.total, page: result.page, limit: result.limit, hasMore: result.hasMore })
    } catch (err: any) { return error(reply, err.status ?? 500, err.code ?? 'INTERNAL_ERROR', err.message) }
  })

  // GET /v1/projects/:projectId/experiments/:experimentId
  app.get('/:experimentId', async (request, reply) => {
    const { projectId, experimentId } = request.params as { projectId: string; experimentId: string }
    try {
      return success(reply, await experimentsService.getById(projectId, experimentId))
    } catch (err: any) { return error(reply, err.status ?? 500, err.code ?? 'INTERNAL_ERROR', err.message) }
  })

  // POST /v1/projects/:projectId/experiments — editor+
  app.post('/', { preHandler: requireRole('editor', 'admin', 'owner') }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    const parsed = createExperimentSchema.safeParse(request.body)
    if (!parsed.success) {
      const e = parsed.error.errors[0]
      return error(reply, 400, 'VALIDATION_ERROR', e.message, e.path.join('.'))
    }
    try {
      const exp = await experimentsService.create(projectId, parsed.data, request.user.userId, request.user.email, request.ip)
      return success(reply, exp, 201)
    } catch (err: any) { return error(reply, err.status ?? 500, err.code ?? 'INTERNAL_ERROR', err.message) }
  })

  // POST /v1/projects/:projectId/experiments/:experimentId/launch — editor+
  app.post('/:experimentId/launch', { preHandler: requireRole('editor', 'admin', 'owner') }, async (request, reply) => {
    const { projectId, experimentId } = request.params as { projectId: string; experimentId: string }
    try {
      return success(reply, await experimentsService.launch(projectId, experimentId, request.user.userId, request.user.email, request.ip))
    } catch (err: any) { return error(reply, err.status ?? 500, err.code ?? 'INTERNAL_ERROR', err.message) }
  })

  // POST /v1/projects/:projectId/experiments/:experimentId/pause — editor+
  app.post('/:experimentId/pause', { preHandler: requireRole('editor', 'admin', 'owner') }, async (request, reply) => {
    const { projectId, experimentId } = request.params as { projectId: string; experimentId: string }
    try {
      return success(reply, await experimentsService.pause(projectId, experimentId, request.user.userId, request.user.email, request.ip))
    } catch (err: any) { return error(reply, err.status ?? 500, err.code ?? 'INTERNAL_ERROR', err.message) }
  })

  // POST /v1/projects/:projectId/experiments/:experimentId/stop — admin+
  app.post('/:experimentId/stop', { preHandler: requireRole('admin', 'owner') }, async (request, reply) => {
    const { projectId, experimentId } = request.params as { projectId: string; experimentId: string }
    const { winnerVariantId } = (request.body as any) ?? {}
    try {
      return success(reply, await experimentsService.stop(projectId, experimentId, winnerVariantId, request.user.userId, request.user.email, request.ip))
    } catch (err: any) { return error(reply, err.status ?? 500, err.code ?? 'INTERNAL_ERROR', err.message) }
  })

  // GET /v1/projects/:projectId/experiments/:experimentId/results
  app.get('/:experimentId/results', async (request, reply) => {
    const { projectId, experimentId } = request.params as { projectId: string; experimentId: string }
    try {
      return success(reply, await experimentsService.getResults(projectId, experimentId))
    } catch (err: any) { return error(reply, err.status ?? 500, err.code ?? 'INTERNAL_ERROR', err.message) }
  })
}
