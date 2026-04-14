import type { FastifyRequest, FastifyReply } from 'fastify'
import { redisClient } from './redis/client.js'

interface RateLimitOptions {
  key:        (req: FastifyRequest) => string
  max:        number
  windowSecs: number
  errorCode:  string
  message:    string
}

export function rateLimit(opts: RateLimitOptions) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const key     = `fv:rl:${opts.key(request)}`
    const current = await redisClient.incr(key)

    if (current === 1) {
      await redisClient.expire(key, opts.windowSecs)
    }

    if (current > opts.max) {
      const ttl = await redisClient.ttl(key)
      reply.header('Retry-After', String(ttl))
      return reply.status(429).send({
        success: false,
        error: { code: opts.errorCode, message: opts.message },
        meta:  { requestId: request.id, timestamp: new Date().toISOString() },
      })
    }
  }
}

// Pre-built rate limiters for common endpoints
export const signupRateLimit = rateLimit({
  key:        (req) => req.ip,
  max:        5,
  windowSecs: 3600, // 5 signups per IP per hour
  errorCode:  'SIGNUP_RATE_LIMITED',
  message:    'Too many signups from this IP. Try again in an hour.',
})

export const verifyEmailRateLimit = rateLimit({
  key:        (req) => req.ip,
  max:        10,
  windowSecs: 3600,
  errorCode:  'VERIFY_RATE_LIMITED',
  message:    'Too many verification attempts. Try again later.',
})
