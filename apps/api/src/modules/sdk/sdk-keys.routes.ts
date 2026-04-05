import type { FastifyInstance } from 'fastify'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import crypto from 'crypto'
import { db } from '../../lib/db/client.js'
import { sdkKeys } from '../../lib/db/schema.js'
import { sha256 } from '../../lib/crypto/hash.js'
import { authenticate, requireRole } from '../../middleware/authenticate.js'
import { success, error } from '../../utils/response.js'

const createKeySchema = z.object({
  name:        z.string().min(1).max(255),
  keyType:     z.enum(['server', 'client']),
  environment: z.enum(['production', 'staging', 'development', 'test']),
})

function generateSDKKey(environment: string): string {
  const prefix = environment === 'production' ? 'fv_live_' : 'fv_test_'
  const random = crypto.randomBytes(24).toString('base64url')
  return `${prefix}${random}`
}

export async function sdkKeyRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)

  // GET /v1/projects/:projectId/sdk-keys
  app.get('/', async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    const keys = await db.select({
      id:          sdkKeys.id,
      name:        sdkKeys.name,
      keyPrefix:   sdkKeys.keyPrefix,
      keyPreview:  sdkKeys.keyPreview,
      keyType:     sdkKeys.keyType,
      environment: sdkKeys.environment,
      lastUsedAt:  sdkKeys.lastUsedAt,
      revokedAt:   sdkKeys.revokedAt,
      createdAt:   sdkKeys.createdAt,
    })
      .from(sdkKeys)
      .where(eq(sdkKeys.projectId, projectId))
    return success(reply, keys)
  })

  // POST /v1/projects/:projectId/sdk-keys — admin+
  app.post('/', { preHandler: requireRole('admin', 'owner') }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    const parsed = createKeySchema.safeParse(request.body)
    if (!parsed.success) return error(reply, 400, 'VALIDATION_ERROR', parsed.error.errors[0].message)

    const { name, keyType, environment } = parsed.data
    const rawKey    = generateSDKKey(environment)
    const keyHash   = sha256(rawKey)
    const keyPrefix = environment === 'production' ? 'fv_live_' : 'fv_test_'
    const keyPreview = `...${rawKey.slice(-4)}`

    const [key] = await db.insert(sdkKeys).values({
      projectId,
      name,
      keyPrefix,
      keyHash,
      keyPreview,
      keyType,
      environment,
      createdBy: request.user.userId,
    }).returning({
      id:          sdkKeys.id,
      name:        sdkKeys.name,
      keyPrefix:   sdkKeys.keyPrefix,
      keyPreview:  sdkKeys.keyPreview,
      keyType:     sdkKeys.keyType,
      environment: sdkKeys.environment,
      createdAt:   sdkKeys.createdAt,
    })

    // Return raw key ONCE — it will never be shown again
    return success(reply, { ...key, key: rawKey }, 201)
  })

  // DELETE /v1/projects/:projectId/sdk-keys/:keyId — admin+
  app.delete('/:keyId', { preHandler: requireRole('admin', 'owner') }, async (request, reply) => {
    const { projectId, keyId } = request.params as { projectId: string; keyId: string }
    const [key] = await db.select({ id: sdkKeys.id })
      .from(sdkKeys)
      .where(and(eq(sdkKeys.id, keyId), eq(sdkKeys.projectId, projectId)))
      .limit(1)

    if (!key) return error(reply, 404, 'SDK_KEY_NOT_FOUND', 'SDK key not found')

    await db.update(sdkKeys)
      .set({ revokedAt: new Date() })
      .where(eq(sdkKeys.id, keyId))

    return success(reply, { revoked: true })
  })
}
