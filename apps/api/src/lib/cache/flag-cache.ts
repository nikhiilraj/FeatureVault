import { redisClient, REDIS_KEYS } from '../redis/client.js'

const CACHE_TTL_SECONDS = 300 // 5 minutes — safety net, pubsub handles real-time

export const flagCache = {
  async get(projectId: string): Promise<unknown[] | null> {
    const cached = await redisClient.get(REDIS_KEYS.flagCache(projectId))
    if (!cached) return null
    try {
      return JSON.parse(cached)
    } catch {
      return null
    }
  },

  async set(projectId: string, flags: unknown[]): Promise<void> {
    await redisClient.setex(
      REDIS_KEYS.flagCache(projectId),
      CACHE_TTL_SECONDS,
      JSON.stringify(flags),
    )
  },

  async invalidate(projectId: string): Promise<void> {
    await redisClient.del(REDIS_KEYS.flagCache(projectId))
  },

  async publish(projectId: string, message: object): Promise<void> {
    await redisClient.publish(
      REDIS_KEYS.pubsubFlags(projectId),
      JSON.stringify(message),
    )
  },
}
