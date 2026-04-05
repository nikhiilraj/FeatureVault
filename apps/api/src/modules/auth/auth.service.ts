import { eq, and, gt, isNull } from 'drizzle-orm'
import { db } from '../../lib/db/client.js'
import {
  users, sessions, emailVerificationTokens,
  workspaces, workspaceMembers, projects,
} from '../../lib/db/schema.js'
import { hashPassword, verifyPassword } from '../../lib/crypto/password.js'
import { sha256, generateToken } from '../../lib/crypto/hash.js'
import { redisClient, REDIS_KEYS } from '../../lib/redis/client.js'
import { emailService } from '../../lib/email/email.service.js'
import type { SignupInput, LoginInput } from './auth.schemas.js'

const RATE_LIMIT_MAX      = 5
const RATE_LIMIT_WINDOW   = 15 * 60   // 15 minutes in seconds
const ACCESS_TOKEN_TTL    = 15 * 60   // 15 minutes in seconds
const REFRESH_TOKEN_TTL   = 7 * 24 * 60 * 60  // 7 days in seconds
const VERIFY_TOKEN_TTL    = 24 * 60 * 60       // 24 hours in seconds

// ─── Helper: slugify a string ────────────────────────────────
function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100)
}

// ─── Helper: make workspace slug unique ─────────────────────
async function makeUniqueSlug(base: string): Promise<string> {
  let slug = slugify(base)
  let attempt = 0
  while (true) {
    const candidate = attempt === 0 ? slug : `${slug}-${attempt}`
    const existing = await db.select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.slug, candidate))
      .limit(1)
    if (existing.length === 0) return candidate
    attempt++
  }
}

export const authService = {

  // ─── Signup ────────────────────────────────────────────────
  async signup(input: SignupInput, ipAddress?: string) {
    // Check duplicate email
    const existing = await db.select({ id: users.id })
      .from(users)
      .where(eq(users.email, input.email.toLowerCase()))
      .limit(1)

    if (existing.length > 0) {
      throw Object.assign(new Error('Email already registered'), { code: 'EMAIL_ALREADY_EXISTS', status: 409 })
    }

    const passwordHash = await hashPassword(input.password)

    // Create user
    const [user] = await db.insert(users).values({
      email:        input.email.toLowerCase(),
      passwordHash,
      firstName:    input.firstName,
      lastName:     input.lastName,
    }).returning({ id: users.id, email: users.email })

    // Create workspace
    const emailLocal   = input.email.split('@')[0]
    const workspaceSlug = await makeUniqueSlug(emailLocal)
    const workspaceName = input.firstName
      ? `${input.firstName}'s Workspace`
      : `${emailLocal}'s Workspace`

    const [workspace] = await db.insert(workspaces).values({
      name: workspaceName,
      slug: workspaceSlug,
    }).returning({ id: workspaces.id })

    // Add user as owner
    await db.insert(workspaceMembers).values({
      workspaceId: workspace.id,
      userId:      user.id,
      role:        'owner',
    })

    // Create default project
    await db.insert(projects).values({
      workspaceId: workspace.id,
      name:        'Default Project',
      slug:        'default',
      createdBy:   user.id,
    })

    // Email verification token
    const rawToken  = generateToken(32)
    const tokenHash = sha256(rawToken)
    const expiresAt = new Date(Date.now() + VERIFY_TOKEN_TTL * 1000)

    await db.insert(emailVerificationTokens).values({
      userId:    user.id,
      tokenHash,
      expiresAt,
    })

    // Send verification email (fire and forget — don't fail signup if email fails)
    emailService.sendVerificationEmail(user.email, rawToken).catch(console.error)

    return { userId: user.id, workspaceId: workspace.id }
  },

  // ─── Verify email ──────────────────────────────────────────
  async verifyEmail(rawToken: string) {
    const tokenHash = sha256(rawToken)

    const [record] = await db.select()
      .from(emailVerificationTokens)
      .where(
        and(
          eq(emailVerificationTokens.tokenHash, tokenHash),
          isNull(emailVerificationTokens.usedAt),
          gt(emailVerificationTokens.expiresAt, new Date()),
        )
      )
      .limit(1)

    if (!record) {
      throw Object.assign(new Error('Invalid or expired verification token'), { code: 'INVALID_TOKEN', status: 400 })
    }

    // Mark token as used + verify user in a single transaction
    await db.transaction(async (tx) => {
      await tx.update(emailVerificationTokens)
        .set({ usedAt: new Date() })
        .where(eq(emailVerificationTokens.id, record.id))

      await tx.update(users)
        .set({ emailVerifiedAt: new Date() })
        .where(eq(users.id, record.userId))
    })

    return { verified: true }
  },

  // ─── Login ─────────────────────────────────────────────────
  async login(input: LoginInput, ipAddress?: string, userAgent?: string) {
    const rateLimitKey = REDIS_KEYS.rateLimitLogin(input.email.toLowerCase())

    // Check rate limit
    const attempts = await redisClient.get(rateLimitKey)
    if (attempts && parseInt(attempts) >= RATE_LIMIT_MAX) {
      const ttl = await redisClient.ttl(rateLimitKey)
      throw Object.assign(
        new Error('Too many login attempts. Please try again later.'),
        { code: 'RATE_LIMITED', status: 429, retryAfter: ttl }
      )
    }

    // Look up user
    const [user] = await db.select()
      .from(users)
      .where(eq(users.email, input.email.toLowerCase()))
      .limit(1)

    // Always verify password (even if user not found) to prevent timing attacks
    const dummyHash = '$argon2id$v=19$m=65536,t=3,p=4$dummydummydummy$dummydummydummydummydummydumm'
    const passwordValid = user
      ? await verifyPassword(user.passwordHash, input.password)
      : await verifyPassword(dummyHash, input.password).then(() => false).catch(() => false)

    if (!user || !passwordValid) {
      // Increment rate limit counter
      const pipe = redisClient.pipeline()
      pipe.incr(rateLimitKey)
      pipe.expire(rateLimitKey, RATE_LIMIT_WINDOW)
      await pipe.exec()
      throw Object.assign(new Error('Invalid email or password'), { code: 'INVALID_CREDENTIALS', status: 401 })
    }

    if (!user.emailVerifiedAt) {
      throw Object.assign(new Error('Please verify your email before logging in'), { code: 'EMAIL_NOT_VERIFIED', status: 403 })
    }

    // Clear rate limit on successful login
    await redisClient.del(rateLimitKey)

    // Get workspace membership
    const [membership] = await db.select({
      workspaceId: workspaceMembers.workspaceId,
      role:        workspaceMembers.role,
    })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.userId, user.id))
      .limit(1)

    if (!membership) {
      throw Object.assign(new Error('No workspace found for user'), { code: 'NO_WORKSPACE', status: 500 })
    }

    // Generate refresh token
    const rawRefreshToken  = generateToken(32)
    const refreshTokenHash = sha256(rawRefreshToken)
    const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL * 1000)

    await db.insert(sessions).values({
      userId:    user.id,
      tokenHash: refreshTokenHash,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
      expiresAt: refreshExpiresAt,
    })

    // Update last login
    await db.update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id))

    return {
      userId:           user.id,
      workspaceId:      membership.workspaceId,
      role:             membership.role,
      email:            user.email,
      firstName:        user.firstName,
      lastName:         user.lastName,
      rawRefreshToken,
      refreshExpiresAt,
    }
  },

  // ─── Refresh token ─────────────────────────────────────────
  async refresh(rawRefreshToken: string, ipAddress?: string, userAgent?: string) {
    const tokenHash = sha256(rawRefreshToken)

    const [session] = await db.select()
      .from(sessions)
      .where(
        and(
          eq(sessions.tokenHash, tokenHash),
          gt(sessions.expiresAt, new Date()),
        )
      )
      .limit(1)

    if (!session) {
      // Could be a replay attack — check if ANY session exists for this hash
      // If the hash was previously valid but now deleted, that means it was already used
      // In that case: nuke all sessions for the user (we can't know userId here without the session)
      // Safe response: just return 401
      throw Object.assign(new Error('Invalid or expired refresh token'), { code: 'INVALID_REFRESH_TOKEN', status: 401 })
    }

    // Get user + workspace
    const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1)
    const [membership] = await db.select({
      workspaceId: workspaceMembers.workspaceId,
      role:        workspaceMembers.role,
    })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.userId, session.userId))
      .limit(1)

    if (!user || !membership) {
      throw Object.assign(new Error('User not found'), { code: 'USER_NOT_FOUND', status: 401 })
    }

    // Rotate: delete old session, create new one
    const newRawToken      = generateToken(32)
    const newRefreshHash   = sha256(newRawToken)
    const newExpiresAt     = new Date(Date.now() + REFRESH_TOKEN_TTL * 1000)

    await db.transaction(async (tx) => {
      await tx.delete(sessions).where(eq(sessions.id, session.id))
      await tx.insert(sessions).values({
        userId:    user.id,
        tokenHash: newRefreshHash,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
        expiresAt: newExpiresAt,
        lastSeenAt: new Date(),
      })
    })

    return {
      userId:           user.id,
      workspaceId:      membership.workspaceId,
      role:             membership.role,
      email:            user.email,
      firstName:        user.firstName,
      lastName:         user.lastName,
      rawRefreshToken:  newRawToken,
      refreshExpiresAt: newExpiresAt,
    }
  },

  // ─── Logout ────────────────────────────────────────────────
  async logout(rawRefreshToken: string) {
    if (!rawRefreshToken) return
    const tokenHash = sha256(rawRefreshToken)
    await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash))
  },

  // ─── Get user by ID ────────────────────────────────────────
  async getUserById(userId: string) {
    const [user] = await db.select({
      id:              users.id,
      email:           users.email,
      firstName:       users.firstName,
      lastName:        users.lastName,
      emailVerifiedAt: users.emailVerifiedAt,
      createdAt:       users.createdAt,
    })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    return user ?? null
  },
}
