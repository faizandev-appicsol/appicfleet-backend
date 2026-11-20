import type { AuditResult } from '../../interfaces/audit-event.interface.js'
import { AuditEvent } from '../../models/audit-event.model.js'
import { toObjectId } from '../object-id.js'

export type NewAuditEvent = {
  actorUserId?: string
  action: string
  entityType: string
  entityId?: string
  organizationId?: string
  branchId?: string
  requestId?: string
  correlationId?: string
  result: AuditResult
  metadata: Record<string, unknown>
  ip?: string
  userAgent?: string
}

export async function insertAuditEvent(event: NewAuditEvent): Promise<void> {
  await AuditEvent.create({
    actorUserId: event.actorUserId ? (toObjectId(event.actorUserId) ?? undefined) : undefined,
    action: event.action,
    entityType: event.entityType,
    entityId: event.entityId,
    organizationId: event.organizationId ? (toObjectId(event.organizationId) ?? undefined) : undefined,
    branchId: event.branchId ? (toObjectId(event.branchId) ?? undefined) : undefined,
    requestId: event.requestId,
    correlationId: event.correlationId,
    result: event.result,
    metadata: event.metadata,
    ip: event.ip,
    userAgent: event.userAgent,
  })
}

export async function listAuditEventsByEntity(entityType: string, entityId: string, limit = 50) {
  const docs = await AuditEvent.find({ entityType, entityId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean()
  return docs.map((doc) => ({
    id: doc._id.toString(),
    action: String(doc.action),
    result: String(doc.result),
    actorUserId: doc.actorUserId ? String(doc.actorUserId) : null,
    createdAt: (doc.createdAt as Date).toISOString(),
    metadata: (doc.metadata ?? {}) as Record<string, unknown>,
  }))
}
