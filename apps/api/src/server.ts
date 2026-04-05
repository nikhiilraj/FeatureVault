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

// ─── Plugins ────────────────────────────────────────────────
import helmet     from '@fastify/helmet'
import cors       from '@fastify/cors'
import cookie     from '@fastify/cookie'
import rateLimit  from '@fastify/rate-limit'
import websocket  from '@fastify/websocket'
import { redisClient } from './lib/redis/client.js'

await app.register(helmet, { contentSecurityPolicy: false })
await app.register(cors, {
  origin: env.CORS_ORIGIN,
  credentials: true,
})
await app.register(cookie, { secret: env.COOKIE_SECRET })
await app.register(rateLimit, {
  redis: redisClient,
  max: 120,
  timeWindow: '1 minute',
  keyGenerator: (req) => req.headers['authorization'] ?? req.ip,
})
await app.register(websocket)

// ─── Health check ────────────────────────────────────────────
app.get('/health', async () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
  version: process.env.npm_package_version ?? '0.1.0',
}))

// ─── Graceful shutdown ───────────────────────────────────────
const shutdown = async (signal: string) => {
  app.log.info(`Received ${signal}, shutting down...`)
  await app.close()
  process.exit(0)
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT',  () => shutdown('SIGINT'))

// ─── Start ───────────────────────────────────────────────────
try {
  await app.listen({ port: env.API_PORT, host: '0.0.0.0' })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
