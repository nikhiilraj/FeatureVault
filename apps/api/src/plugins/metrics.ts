import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import { apiRequestDurationSeconds } from '../lib/metrics.js'

export const metricsPlugin: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', (request, reply, done) => {
    // Attach a highly accurate start time using Node's process.hrtime
    request.startTime = process.hrtime()
    done()
  })

  app.addHook('onResponse', (request, reply, done) => {
    if (request.startTime) {
      const hrTime = process.hrtime(request.startTime)
      const durationSeconds = hrTime[0] + hrTime[1] / 1e9

      // Only record duration if route is known (to prevent vast cardinality explosions if a user fuzzes paths)
      const routePath = request.routeOptions?.url ?? 'unknown_route'

      apiRequestDurationSeconds.labels(
        request.method,
        routePath,
        reply.statusCode.toString()
      ).observe(durationSeconds)
    }
    done()
  })
}

// Ensure TypeScript is aware of request.startTime
declare module 'fastify' {
  interface FastifyRequest {
    startTime?: [number, number]
  }
}

export default fp(metricsPlugin)
