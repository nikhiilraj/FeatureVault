import type { FastifyReply } from 'fastify'

export function success<T>(reply: FastifyReply, data: T, statusCode = 200) {
  return reply.status(statusCode).send({
    success: true,
    data,
    meta: {
      requestId: reply.request.id as string,
      timestamp: new Date().toISOString(),
    },
  })
}

export function error(
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string,
  field?: string,
) {
  return reply.status(statusCode).send({
    success: false,
    error: { code, message, ...(field && { field }) },
    meta: {
      requestId: reply.request.id as string,
      timestamp: new Date().toISOString(),
    },
  })
}

export function paginated<T>(
  reply: FastifyReply,
  data: T[],
  pagination: { total: number; page: number; limit: number; hasMore: boolean; nextCursor?: string },
) {
  return reply.status(200).send({
    success: true,
    data,
    pagination,
    meta: {
      requestId: reply.request.id as string,
      timestamp: new Date().toISOString(),
    },
  })
}
