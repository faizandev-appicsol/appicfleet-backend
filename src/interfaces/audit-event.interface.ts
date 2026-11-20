import type { Types } from 'mongoose'

export type AuditResult = 'success' | 'failure'

export interface IAuditEvent {
  actorUserId?: Types.ObjectId
  action: string
  entityType: string
  entityId?: string
  organizationId?: Types.ObjectId
  branchId?: Types.ObjectId
  requestId?: string
  correlationId?: string
  result: AuditResult
  /** Never contains secrets: the audit service strips credential-like keys before saving. */
  metadata: Record<string, unknown>
  ip?: string
  userAgent?: string
  createdAt: Date
}
