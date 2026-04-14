import type { FastifyRequest, FastifyReply } from 'fastify'
import crypto from 'crypto'

const CSRF_COOKIE  = 'csrf-token'
const CSRF_HEADER  = 'x-csrf-token'
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * Double-submit cookie CSRF protection.
 *
 * On every GET: set a non-HttpOnly csrf-token cookie.
 * On every state-changing request: verify the cookie matches the header.
 *
 * Attackers can't read cookies cross-origin so they can't forge the header.
 */
export async function csrfProtection(request: FastifyRequest, reply: FastifyReply) {
  // Safe methods — just ensure the cookie exists
  if (SAFE_METHODS.has(request.method)) {
    if (!request.cookies?.[CSRF_COOKIE]) {
      const token = crypto.randomBytes(32).toString('base64url')
      reply.setCookie(CSRF_COOKIE, token, {
        httpOnly: false,   // intentionally readable by JS
        secure:   process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path:     '/',
      })
    }
    return
  }

  // Mutation — verify token
  const cookieToken = request.cookies?.[CSRF_COOKIE]
  const headerToken = request.headers[CSRF_HEADER] as string | undefined

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return reply.status(403).send({
      success: false,
      error: { code: 'CSRF_TOKEN_INVALID', message: 'CSRF token mismatch' },
      meta:  { requestId: request.id, timestamp: new Date().toISOString() },
    })
  }
}
