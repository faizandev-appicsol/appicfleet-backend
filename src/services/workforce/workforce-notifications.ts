import {
  tryInsertWorkforceNotificationIntent,
  tryInsertWorkforceOutboxEvent,
} from '../../repositories/workforce/workforce.repository.js'
import type { RequestMeta } from '../../types/access.js'
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  recordAuditEvent,
  type AuditAction,
} from '../audit/audit.service.js'

const KIND_AUDIT: Record<string, AuditAction> = {
  'attendance.clocked_in': AUDIT_ACTIONS.ATTENDANCE_CLOCKED_IN,
  'attendance.clocked_out': AUDIT_ACTIONS.ATTENDANCE_CLOCKED_OUT,
  'attendance.correction.approved': AUDIT_ACTIONS.ATTENDANCE_CORRECTION_APPROVED,
  'attendance.correction.rejected': AUDIT_ACTIONS.ATTENDANCE_CORRECTION_REJECTED,
  'leave.requested': AUDIT_ACTIONS.LEAVE_REQUESTED,
  'leave.approved': AUDIT_ACTIONS.LEAVE_APPROVED,
  'leave.rejected': AUDIT_ACTIONS.LEAVE_REJECTED,
  'leave.cancelled': AUDIT_ACTIONS.LEAVE_CANCELLED,
  'overtime.approved': AUDIT_ACTIONS.OVERTIME_APPROVED,
}

/**
 * Module 15 notification providers are not wired yet.
 * Persist idempotent intents + outbox events for a future worker.
 * Do not put leave reasons or precise locations in notification payloads.
 */
export async function emitWorkforceNotificationIntent(input: {
  organizationId: string
  employeeId?: string
  kind: string
  intentKey: string
  payload?: Record<string, unknown>
  meta?: RequestMeta
  entityType?: string
  entityId?: string
}) {
  const inserted = await tryInsertWorkforceNotificationIntent({
    organizationId: input.organizationId,
    employeeId: input.employeeId,
    intentKey: input.intentKey,
    kind: input.kind,
    payload: input.payload,
  })
  if (!inserted) return false

  await tryInsertWorkforceOutboxEvent({
    organizationId: input.organizationId,
    eventKey: `evt:${input.intentKey}`,
    eventType: input.kind,
    payload: {
      employeeId: input.employeeId,
      ...input.payload,
    },
  })

  const action = KIND_AUDIT[input.kind]
  if (action) {
    await recordAuditEvent({
      action,
      entityType: input.entityType ?? AUDIT_ENTITY_TYPES.ATTENDANCE_RECORD,
      entityId: input.entityId ?? input.employeeId,
      organizationId: input.organizationId,
      metadata: {
        intentKey: input.intentKey,
        kind: input.kind,
        notificationPending: true,
      },
      meta: input.meta,
    })
  }
  return true
}

export async function publishWorkforceEvent(input: {
  organizationId: string
  eventKey: string
  eventType: string
  payload?: Record<string, unknown>
}) {
  return tryInsertWorkforceOutboxEvent(input)
}
