import { tryInsertPayrollNotificationIntent } from '../../repositories/payroll/payroll.repository.js'
import type { RequestMeta } from '../../types/access.js'
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  recordAuditEvent,
  type AuditAction,
} from '../audit/audit.service.js'

const KIND_AUDIT: Record<string, AuditAction> = {
  'payroll.period.created': AUDIT_ACTIONS.PAYROLL_PERIOD_CREATED,
  'payroll.run.created': AUDIT_ACTIONS.PAYROLL_RUN_CREATED,
  'payroll.run.calculated': AUDIT_ACTIONS.PAYROLL_RUN_CALCULATED,
  'payroll.run.pending_approval': AUDIT_ACTIONS.PAYROLL_RUN_SUBMITTED,
  'payroll.run.approved': AUDIT_ACTIONS.PAYROLL_RUN_APPROVED,
  'payroll.payslip.available': AUDIT_ACTIONS.PAYROLL_PAYSLIP_GENERATED,
  'payroll.payment.completed': AUDIT_ACTIONS.PAYROLL_PAYMENT_COMPLETED,
  'payroll.compensation.changed': AUDIT_ACTIONS.PAYROLL_COMPENSATION_CHANGED,
}

/**
 * Module 15 notification infrastructure is not present yet.
 * Record idempotent intents + audit so a future worker can deliver
 * without putting salary amounts in notification previews.
 */
export async function emitPayrollNotificationIntent(input: {
  organizationId: string
  employeeId?: string
  payrollRunId?: string
  payslipId?: string
  kind: string
  intentKey: string
  payload?: Record<string, unknown>
  meta?: RequestMeta
}) {
  const inserted = await tryInsertPayrollNotificationIntent({
    organizationId: input.organizationId,
    employeeId: input.employeeId,
    payrollRunId: input.payrollRunId,
    payslipId: input.payslipId,
    intentKey: input.intentKey,
    kind: input.kind,
    payload: input.payload,
  })
  if (!inserted) return false

  const action = KIND_AUDIT[input.kind]
  if (action) {
    await recordAuditEvent({
      action,
      entityType: input.payslipId
        ? AUDIT_ENTITY_TYPES.PAYSLIP
        : input.payrollRunId
          ? AUDIT_ENTITY_TYPES.PAYROLL_RUN
          : AUDIT_ENTITY_TYPES.PAYROLL_COMPENSATION,
      entityId: input.payslipId ?? input.payrollRunId ?? input.employeeId,
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
