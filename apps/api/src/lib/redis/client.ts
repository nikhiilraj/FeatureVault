import Redis from 'ioredis'
import { env } from '../env.js'

export const redisClient = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
})

export const redisSub = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null, // subscriber connections should retry forever
  lazyConnect: true,
})

redisClient.on('error', (err) => console.error('[Redis]', err.message))
redisSub.on('error',    (err) => console.error('[Redis Sub]', err.message))

export const REDIS_KEYS = {
  flagCache:       (projectId: string) => `fv:flags:${projectId}`,
  pubsubFlags:     (projectId: string) => `fv:pubsub:flags:${projectId}`,
  rateLimitLogin:  (email: string)     => `fv:rl:login:${email}`,
  wsConnections:   (instanceId: string)=> `fv:ws:connections:${instanceId}`,
  wsProjectConns:  (projectId: string) => `fv:ws:project:${projectId}:connections`,
  sessionId:       (sessionId: string) => `fv:session:${sessionId}`,
} as const
