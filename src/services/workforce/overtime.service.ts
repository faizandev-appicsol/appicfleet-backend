import { PAYROLL_INPUT_STATUSES } from '../../constants/payroll.js'
import { OVERTIME_REQUEST_STATUSES } from '../../constants/workforce.js'
import { insertOvertime } from '../../repositories/payroll/payroll.repository.js'
import {
  findAttendanceOvertimeById,
  insertAttendanceOvertime,
  listAttendanceOvertime,
  updateAttendanceOvertime,
} from '../../repositories/workforce/workforce.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import { conflict, invalidField, notFound } from '../../utils/httpErrors.js'
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  recordAuditEvent,
} from '../audit/audit.service.js'
import { minutesToHoursDecimal } from './attendance-calculation.js'
import { emitWorkforceNotificationIntent, publishWorkforceEvent } from './workforce-notifications.js'
import {
  assertEmployeeActive,
  branchScopeForList,
  loadAccessibleEmployee,
  requireWorkforceOrganization,
} from './workforce-access.js'
import { parseWorkforcePage } from './workforce-paging.js'

/**
 * Attendance owns overtime hours. On approval, a payroll_overtime input is created
 * with hours and placeholder rate/amount (0.00). Payroll remains responsible for
 * monetary calculation; historical paid payroll is never mutated here.
 */
export async function createOvertimeRequest(
  ctx: AccessContext,
  body: {
    organizationId?: string
    employeeId: string
    attendanceRecordId?: string
    workDate: string
    minutes: number
    reason?: string
  },
  meta?: RequestMeta,
) {
  const employee = await loadAccessibleEmployee(ctx, body.employeeId, body.organizationId)
  assertEmployeeActive(employee)
  if (!Number.isInteger(body.minutes) || body.minutes <= 0) {
    throw invalidField('minutes', 'Overtime minutes must be a positive integer.')
  }
  const ot = await insertAttendanceOvertime({
    organizationId: employee.organizationId,
    legalEntityId: employee.legalEntityId,
    branchId: employee.branchId,
    employeeId: employee.id,
    attendanceRecordId: body.attendanceRecordId,
    workDate: body.workDate,
    minutes: body.minutes,
    hours: minutesToHoursDecimal(body.minutes),
    reason: body.reason,
    status: OVERTIME_REQUEST_STATUSES.PENDING_APPROVAL,
    createdBy: ctx.userId,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.OVERTIME_CREATED,
    entityType: AUDIT_ENTITY_TYPES.ATTENDANCE_OVERTIME,
    entityId: ot.id,
    organizationId: employee.organizationId,
    branchId: employee.branchId,
    metadata: { hours: ot.hours },
    meta,
  })
  return ot
}

export async function approveOvertimeRequest(
  ctx: AccessContext,
  id: string,
  body: { currency?: string },
  meta?: RequestMeta,
) {
  const ot = await findAttendanceOvertimeById(id)
  if (!ot) throw notFound('Overtime request was not found.')
  await requireWorkforceOrganization(ctx, ot.organizationId)

  if (ot.status === OVERTIME_REQUEST_STATUSES.APPROVED && ot.payrollOvertimeId) {
    return ot
  }

  const currency = (body.currency ?? 'AED').toUpperCase()
  const payrollOt = await insertOvertime({
    organizationId: ot.organizationId,
    legalEntityId: ot.legalEntityId,
    branchId: ot.branchId,
    employeeId: ot.employeeId,
    workDate: new Date(`${ot.workDate}T00:00:00.000Z`),
    hours: ot.hours,
    rate: '0.00',
    amount: '0.00',
    currency,
    reason: `Attendance overtime ${ot.id}${ot.reason ? `: ${ot.reason}` : ''}`,
    status: PAYROLL_INPUT_STATUSES.APPROVED,
    approvedBy: ctx.userId,
    approvedAt: new Date(),
    createdBy: ctx.userId,
  })

  const updated = await updateAttendanceOvertime(
    id,
    {
      status: OVERTIME_REQUEST_STATUSES.APPROVED,
      approvedBy: ctx.userId,
      approvedAt: new Date(),
      payrollOvertimeId: payrollOt.id,
    },
    [OVERTIME_REQUEST_STATUSES.PENDING_APPROVAL, OVERTIME_REQUEST_STATUSES.DRAFT],
  )
  if (!updated) {
    // Concurrent approve — return current if already approved.
    const current = await findAttendanceOvertimeById(id)
    if (current?.status === OVERTIME_REQUEST_STATUSES.APPROVED) return current
    throw conflict('Overtime request cannot be approved.')
  }

  await emitWorkforceNotificationIntent({
    organizationId: ot.organizationId,
    employeeId: ot.employeeId,
    kind: 'overtime.approved',
    intentKey: `overtime.approved:${ot.id}`,
    entityType: AUDIT_ENTITY_TYPES.ATTENDANCE_OVERTIME,
    entityId: ot.id,
    payload: { hours: ot.hours, payrollOvertimeId: payrollOt.id },
    meta,
  })
  await publishWorkforceEvent({
    organizationId: ot.organizationId,
    eventKey: `attendance.overtime.approved:${ot.id}`,
    eventType: 'attendance.overtime.approved',
    payload: {
      attendanceOvertimeId: ot.id,
      payrollOvertimeId: payrollOt.id,
      employeeId: ot.employeeId,
      hours: ot.hours,
    },
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.OVERTIME_APPROVED,
    entityType: AUDIT_ENTITY_TYPES.ATTENDANCE_OVERTIME,
    entityId: ot.id,
    organizationId: ot.organizationId,
    meta,
  })
  return updated
}

export async function rejectOvertimeRequest(ctx: AccessContext, id: string) {
  const ot = await findAttendanceOvertimeById(id)
  if (!ot) throw notFound('Overtime request was not found.')
  await requireWorkforceOrganization(ctx, ot.organizationId)
  const updated = await updateAttendanceOvertime(
    id,
    { status: OVERTIME_REQUEST_STATUSES.REJECTED },
    [OVERTIME_REQUEST_STATUSES.PENDING_APPROVAL, OVERTIME_REQUEST_STATUSES.DRAFT],
  )
  if (!updated) throw conflict('Overtime request cannot be rejected.')
  return updated
}

export async function listOvertimeService(
  ctx: AccessContext,
  query: {
    organizationId?: string
    employeeId?: string
    status?: string
    page: number
    pageSize: number
  },
) {
  const organizationId = await requireWorkforceOrganization(ctx, query.organizationId)
  const { skip, pageSize } = parseWorkforcePage(query)
  return listAttendanceOvertime({
    organizationId,
    employeeId: query.employeeId,
    status: query.status,
    branchIds: branchScopeForList(ctx),
    skip,
    limit: pageSize,
  })
}
