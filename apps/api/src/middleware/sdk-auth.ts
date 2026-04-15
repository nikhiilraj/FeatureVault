import type { FastifyRequest, FastifyReply } from 'fastify'
import { eq, isNull } from 'drizzle-orm'
import { db } from '../lib/db/client.js'
import { sdkKeys, projects } from '../lib/db/schema.js'
import { sha256 } from '../lib/crypto/hash.js'
import { sdkKeyAuthFailuresTotal } from '../lib/metrics.js'

export interface SDKKeyContext {
  projectId:   string
  keyId:       string
  environment: string
  keyType:     string
}

declare module 'fastify' {
  interface FastifyRequest {
    sdkContext: SDKKeyContext
  }
}

export async function authenticateSDKKey(request: FastifyRequest, reply: FastifyReply) {
  const apiKey = (request.headers['x-api-key'] || (request.query as any)?.apiKey) as string | undefined

  if (!apiKey) {
    sdkKeyAuthFailuresTotal.labels('missing').inc()
    return reply.status(401).send({
      success: false,
      error: { code: 'MISSING_API_KEY', message: 'X-API-Key header required' },
      meta:  { requestId: request.id, timestamp: new Date().toISOString() },
    })
  }

  const keyHash = sha256(apiKey)

  const [keyRecord] = await db
    .select({
      id:          sdkKeys.id,
      projectId:   sdkKeys.projectId,
      environment: sdkKeys.environment,
      keyType:     sdkKeys.keyType,
      revokedAt:   sdkKeys.revokedAt,
    })
    .from(sdkKeys)
    .where(eq(sdkKeys.keyHash, keyHash))
    .limit(1)

  if (!keyRecord || keyRecord.revokedAt) {
    sdkKeyAuthFailuresTotal.labels(keyRecord?.revokedAt ? 'revoked' : 'invalid').inc()
    return reply.status(401).send({
      success: false,
      error: { code: 'INVALID_API_KEY', message: 'Invalid or revoked API key' },
      meta:  { requestId: request.id, timestamp: new Date().toISOString() },
    })
  }

  // Check project not deleted
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.id, keyRecord.projectId))
    .limit(1)

  if (!project) {
    return reply.status(401).send({
      success: false,
      error: { code: 'PROJECT_NOT_FOUND', message: 'Project not found' },
      meta:  { requestId: request.id, timestamp: new Date().toISOString() },
    })
  }

  // Update last used (fire and forget)
  db.update(sdkKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(sdkKeys.id, keyRecord.id))
    .catch(console.error)

  request.sdkContext = {
    projectId:   keyRecord.projectId,
    keyId:       keyRecord.id,
    environment: keyRecord.environment,
    keyType:     keyRecord.keyType,
  }
}
