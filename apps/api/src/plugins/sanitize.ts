import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'

const MAX_STRING_LENGTH = 10_000
const NULL_BYTE_RE      = /\0/g

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > 10) return value
  if (typeof value === 'string') {
    return value.replace(NULL_BYTE_RE, '').slice(0, MAX_STRING_LENGTH)
  }
  if (Array.isArray(value)) {
    return value.slice(0, 1000).map(v => sanitizeValue(v, depth + 1))
  }
  if (value !== null && typeof value === 'object') {
    const sanitized: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      sanitized[k.replace(NULL_BYTE_RE, '').slice(0, 256)] = sanitizeValue(v, depth + 1)
    }
    return sanitized
  }
  return value
}

export default fp(async (app: FastifyInstance) => {
  app.addHook('preHandler', async (request) => {
    if (request.body) {
      request.body = sanitizeValue(request.body)
    }
  })
})
