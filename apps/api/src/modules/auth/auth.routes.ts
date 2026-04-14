import type { FastifyInstance } from 'fastify'
import { authService } from './auth.service.js'
import { signupSchema, loginSchema, verifyEmailSchema } from './auth.schemas.js'
import { authenticate } from '../../middleware/authenticate.js'
import { success, error } from '../../utils/response.js'

const REFRESH_COOKIE = 'refreshToken'
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000

export async function authRoutes(app: FastifyInstance) {

  // POST /v1/auth/signup
  app.post('/signup', async (request, reply) => {
    const parsed = signupSchema.safeParse(request.body)
    if (!parsed.success) {
      const firstError = parsed.error.errors[0]
      return error(reply, 400, 'VALIDATION_ERROR', firstError.message, firstError.path[0] as string)
    }
    try {
      const result = await authService.signup(parsed.data, request.ip)
      return success(reply, result, 201)
    } catch (err: any) {
      return error(reply, err.status ?? 500, err.code ?? 'INTERNAL_ERROR', err.message)
    }
  })

  // GET /v1/auth/verify-email?token=...
  app.get('/verify-email', async (request, reply) => {
    const webUrl = process.env.WEB_URL ?? 'http://localhost:3000'
    const parsed = verifyEmailSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.redirect(`${webUrl}/login?verified=error&reason=missing_token`)
    }
    try {
      await authService.verifyEmail(parsed.data.token)
      return reply.redirect(`${webUrl}/login?verified=true`)
    } catch (err: any) {
      const reason = err.code === 'TOKEN_EXPIRED' ? 'expired' : 'invalid'
      return reply.redirect(`${webUrl}/login?verified=error&reason=${reason}`)
    }
  })

  // POST /v1/auth/login
  app.post('/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body)
    if (!parsed.success) {
      return error(reply, 400, 'VALIDATION_ERROR', 'Invalid email or password')
    }
    try {
      const result = await authService.login(
        parsed.data,
        request.ip,
        request.headers['user-agent'],
      )

      // Sign JWT access token
      const accessToken = app.jwt.sign({
        userId:      result.userId,
        workspaceId: result.workspaceId,
        role:        result.role,
        email:       result.email,
      })

      // Set refresh token as HttpOnly cookie
      reply.setCookie(REFRESH_COOKIE, result.rawRefreshToken, {
        httpOnly: true,
        secure:   process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path:     '/v1/auth',
        expires:  result.refreshExpiresAt,
      })

      return success(reply, {
        accessToken,
        user: {
          id:        result.userId,
          email:     result.email,
          firstName: result.firstName,
          lastName:  result.lastName,
          role:      result.role,
          workspaceId: result.workspaceId,
        },
      })
    } catch (err: any) {
      if (err.code === 'RATE_LIMITED') {
        reply.header('Retry-After', String(err.retryAfter ?? 900))
      }
      return error(reply, err.status ?? 500, err.code ?? 'INTERNAL_ERROR', err.message)
    }
  })

  // POST /v1/auth/refresh
  app.post('/refresh', async (request, reply) => {
    const rawToken = request.cookies?.[REFRESH_COOKIE]
    if (!rawToken) {
      return error(reply, 401, 'MISSING_REFRESH_TOKEN', 'Refresh token cookie not found')
    }
    try {
      const result = await authService.refresh(rawToken, request.ip, request.headers['user-agent'])

      const accessToken = app.jwt.sign({
        userId:      result.userId,
        workspaceId: result.workspaceId,
        role:        result.role,
        email:       result.email,
      })

      reply.setCookie(REFRESH_COOKIE, result.rawRefreshToken, {
        httpOnly: true,
        secure:   process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path:     '/v1/auth',
        expires:  result.refreshExpiresAt,
      })

      return success(reply, { accessToken })
    } catch (err: any) {
      return error(reply, err.status ?? 401, err.code ?? 'INVALID_REFRESH_TOKEN', err.message)
    }
  })

  // POST /v1/auth/logout
  app.post('/logout', async (request, reply) => {
    const rawToken = request.cookies?.[REFRESH_COOKIE]
    if (rawToken) {
      await authService.logout(rawToken).catch(console.error)
    }
    reply.clearCookie(REFRESH_COOKIE, { path: '/v1/auth' })
    return success(reply, { loggedOut: true })
  })

  // GET /v1/auth/me — protected
  app.get('/me', { preHandler: authenticate }, async (request, reply) => {
    const user = await authService.getUserById(request.user.userId)
    if (!user) return error(reply, 404, 'USER_NOT_FOUND', 'User not found')
    return success(reply, { ...user, role: request.user.role, workspaceId: request.user.workspaceId })
  })
}
