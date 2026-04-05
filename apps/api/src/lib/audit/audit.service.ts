import { db } from '../db/client.js'
import { auditLogs } from '../db/schema.js'

export interface AuditEntry {
  workspaceId:  string
  actorId?:     string
  actorEmail?:  string
  action:       string
  resourceType: string
  resourceId?:  string
  before?:      unknown
  after?:       unknown
  metadata?:    unknown
  ipAddress?:   string
}

export const auditService = {
  async log(entry: AuditEntry): Promise<void> {
    await db.insert(auditLogs).values({
      workspaceId:  entry.workspaceId,
      actorId:      entry.actorId,
      actorEmail:   entry.actorEmail,
      action:       entry.action,
      resourceType: entry.resourceType,
      resourceId:   entry.resourceId as string | undefined,
      before:       entry.before ?? null,
      after:        entry.after ?? null,
      metadata:     entry.metadata ?? null,
      ipAddress:    entry.ipAddress,
    }).catch((err) => {
      // Audit log failure should never crash the request
      console.error('[AuditLog] Failed to write entry:', err.message)
    })
  },
}
