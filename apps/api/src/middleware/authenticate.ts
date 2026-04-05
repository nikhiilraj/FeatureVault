import type { FastifyRequest, FastifyReply } from 'fastify'

export interface JWTPayload {
  userId:      string
  workspaceId: string
  role:        'owner' | 'admin' | 'editor' | 'viewer'
  email:       string
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: JWTPayload
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify()
    request.user = request.user as JWTPayload
  } catch {
    return reply.status(401).send({
      success: false,
      error: {
        code:    'UNAUTHORIZED',
        message: 'Valid authentication token required',
      },
      meta: {
        requestId: request.id as string,
        timestamp: new Date().toISOString(),
      },
    })
  }
}

export function requireRole(...roles: JWTPayload['role'][]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        meta: { requestId: request.id as string, timestamp: new Date().toISOString() },
      })
    }
    if (!roles.includes(request.user.role)) {
      return reply.status(403).send({
        success: false,
        error: { code: 'INSUFFICIENT_PERMISSIONS', message: `This action requires role: ${roles.join(' or ')}` },
        meta: { requestId: request.id as string, timestamp: new Date().toISOString() },
      })
    }
  }
}
