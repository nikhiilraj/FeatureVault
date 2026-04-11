import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticateSDKKey } from '../../middleware/sdk-auth.js'
import { eventsQueue } from '../../lib/queue/queues.js'
import { success, error } from '../../utils/response.js'

const trackEventSchema = z.object({
  eventName:     z.string().min(1).max(128),
  userId:        z.string().min(1).max(255),
  experimentKey: z.string().max(128).optional(),
  properties:    z.record(z.unknown()).optional(),
  timestamp:     z.string().datetime().optional(),
})

const batchSchema = z.object({
  events: z.array(trackEventSchema).min(1).max(100),
})

export async function sdkEventsRoutes(app: FastifyInstance) {

  // POST /sdk/v1/events — receives batched events from SDK
  app.post('/events', { preHandler: authenticateSDKKey }, async (request, reply) => {
    const parsed = batchSchema.safeParse(request.body)
    if (!parsed.success) {
      return error(reply, 400, 'VALIDATION_ERROR', parsed.error.errors[0].message)
    }

    const { projectId } = request.sdkContext

    // Enqueue for async processing — never block on DB writes
    await eventsQueue.add('process-sdk-events', {
      projectId,
      events: parsed.data.events.map(e => ({
        ...e,
        timestamp: e.timestamp ?? new Date().toISOString(),
      })),
    })

    return success(reply, { queued: parsed.data.events.length })
  })
}
