import Fastify from 'fastify'
import { env } from './lib/env.js'

const app = Fastify({
  logger: {
    level: env.LOG_LEVEL,
    transport: env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  },
  genReqId: () => crypto.randomUUID(),
})

import helmet    from '@fastify/helmet'
import cors      from '@fastify/cors'
import cookie    from '@fastify/cookie'
import rateLimit from '@fastify/rate-limit'
import websocket from '@fastify/websocket'
import jwtPlugin from './plugins/jwt.js'
import { redisClient } from './lib/redis/client.js'

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

// ─── Routes ─────────────────────────────────────────────────
import { authRoutes }      from './modules/auth/auth.routes.js'
import { workspaceRoutes } from './modules/workspace/workspace.routes.js'
import { flagRoutes }      from './modules/flags/flags.routes.js'
import { sdkKeyRoutes }    from './modules/sdk/sdk-keys.routes.js'
import { sdkApiRoutes }    from './modules/sdk/sdk-api.routes.js'
import { auditRoutes }     from './modules/audit/audit.routes.js'

app.get('/health', async () => ({
  status:    'ok',
  timestamp: new Date().toISOString(),
  version:   process.env.npm_package_version ?? '0.1.0',
}))

await app.register(authRoutes,      { prefix: '/v1/auth' })
await app.register(workspaceRoutes, { prefix: '/v1/workspaces' })
await app.register(auditRoutes,     { prefix: '/v1/workspaces/me/audit-logs' })

// Project-scoped routes — flags and SDK keys
await app.register(async (instance) => {
  await instance.register(flagRoutes,   { prefix: '/:projectId/flags' })
  await instance.register(sdkKeyRoutes, { prefix: '/:projectId/sdk-keys' })
}, { prefix: '/v1/projects' })

// SDK routes — different auth mechanism (API key, not JWT)
await app.register(sdkApiRoutes, { prefix: '/sdk/v1' })

const shutdown = async (signal: string) => {
  app.log.info(`Received ${signal}, shutting down...`)
  await app.close()
  process.exit(0)
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT',  () => shutdown('SIGINT'))

try {
  await app.listen({ port: env.API_PORT, host: '0.0.0.0' })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
