import { HR_DOCUMENT_STATUSES } from '../../constants/hr.js'
import {
  tryInsertNotificationIntent,
  type HrDocumentRecord,
  type EmployeeRecord,
} from '../../repositories/hr/hr.repository.js'
import type { RequestMeta } from '../../types/access.js'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, recordAuditEvent } from '../audit/audit.service.js'

/**
 * Module 15 notification infrastructure is not present in this workspace yet.
 * These hooks record idempotent intents + audit events so a future notifications
 * worker can deliver email/in-app without duplicate sends.
 */
export async function emitDocumentExpiryIntent(
  employee: EmployeeRecord,
  document: HrDocumentRecord,
  meta?: RequestMeta,
) {
  if (!document.expiresOn) return
  if (
    document.status !== HR_DOCUMENT_STATUSES.EXPIRING_SOON &&
    document.status !== HR_DOCUMENT_STATUSES.EXPIRED
  ) {
    return
  }

  const week = isoWeekKey(document.expiresOn)
  const kind =
    document.status === HR_DOCUMENT_STATUSES.EXPIRED
      ? 'hr.employee.document.expired'
      : 'hr.employee.document.expiring'
  const intentKey = `${kind}:${document.id}:${week}`
  const inserted = await tryInsertNotificationIntent({
    organizationId: employee.organizationId,
    employeeId: employee.id,
    documentId: document.id,
    intentKey,
    kind,
    payload: {
      employeeNumber: employee.employeeNumber,
      documentType: document.documentType,
      expiresOn: document.expiresOn.toISOString(),
      status: document.status,
    },
  })
  if (!inserted) return

  await recordAuditEvent({
    action:
      document.status === HR_DOCUMENT_STATUSES.EXPIRED
        ? AUDIT_ACTIONS.HR_DOCUMENT_EXPIRED
        : AUDIT_ACTIONS.HR_DOCUMENT_EXPIRING,
    entityType: AUDIT_ENTITY_TYPES.HR_DOCUMENT,
    entityId: document.id,
    organizationId: employee.organizationId,
    metadata: {
      employeeId: employee.id,
      intentKey,
      notificationPending: true,
    },
    meta,
  })
}

function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}
