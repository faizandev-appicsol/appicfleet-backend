import { PERMISSIONS } from '../../constants/permissions.js'
import {
  ATTENDANCE_EXCEPTION_CODES,
  ATTENDANCE_SOURCES,
  ATTENDANCE_STATUSES,
  CORRECTION_STATUSES,
} from '../../constants/workforce.js'
import {
  atomicClockIn,
  atomicClockOut,
  findAttendanceByEmployeeDate,
  findAttendanceById,
  findCorrectionById,
  findHolidayForDate,
  findApprovedLeaveCoveringDate,
  insertAttendance,
  insertCorrection,
  insertException,
  listAttendance,
  listCorrections,
  listExceptions,
  tryInsertImportBatch,
  updateAttendance,
  updateCorrection,
  type AttendanceRecord,
} from '../../repositories/workforce/workforce.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import { conflict, forbiddenError, invalidField, notFound } from '../../utils/httpErrors.js'
import { hasPermission } from '../authorization/authorization.service.js'
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  recordAuditEvent,
} from '../audit/audit.service.js'
import { calculateAttendance } from './attendance-calculation.js'
import {
  getZonedWeekday,
  resolveBusinessDate,
  scheduledWindowUtc,
  zonedLocalToUtc,
} from './attendance-timezone.js'
import { resolveEmployeeScheduleContext } from './schedule.service.js'
import { emitWorkforceNotificationIntent, publishWorkforceEvent } from './workforce-notifications.js'
import {
  assertEmployeeActive,
  assertSelfOrScopedEmployee,
  branchScopeForList,
  loadAccessibleEmployee,
  loadSelfEmployee,
  requireWorkforceOrganization,
} from './workforce-access.js'
import { parseWorkforcePage } from './workforce-paging.js'

function calcPatchFromResult(
  record: AttendanceRecord,
  calc: ReturnType<typeof calculateAttendance>,
) {
  return {
    scheduledDurationMinutes: calc.scheduledDurationMinutes,
    breakDurationMinutes: calc.breakDurationMinutes,
    workedDurationMinutes: calc.workedDurationMinutes,
    lateDurationMinutes: calc.lateDurationMinutes,
    earlyLeaveDurationMinutes: calc.earlyLeaveDurationMinutes,
    overtimeDurationMinutes: calc.overtimeDurationMinutes,
    status: calc.status,
    scheduledStart: record.scheduledStart,
    scheduledEnd: record.scheduledEnd,
  }
}

async function ensureAttendanceShell(input: {
  ctx: AccessContext
  employeeId: string
  at: Date
  source: string
  organizationId?: string
}): Promise<AttendanceRecord> {
  const employee = await loadAccessibleEmployee(input.ctx, input.employeeId, input.organizationId)
  assertEmployeeActive(employee)
  const branch = await (
    await import('../../repositories/branches/branch.repository.js')
  ).findBranchById(employee.branchId)
  const ctxSched = await resolveEmployeeScheduleContext(
    employee.organizationId,
    employee.id,
    input.at,
    branch?.timezone,
  )
  const businessDate = resolveBusinessDate({
    at: input.at,
    timeZone: ctxSched.timezone,
    startTime: ctxSched.startTime,
    endTime: ctxSched.endTime,
  })

  const existing = await findAttendanceByEmployeeDate(
    employee.organizationId,
    employee.id,
    businessDate,
  )
  if (existing) return existing

  const window = scheduledWindowUtc({
    businessDate,
    startTime: ctxSched.startTime,
    endTime: ctxSched.endTime,
    timeZone: ctxSched.timezone,
  })
  const weekday = getZonedWeekday(
    zonedLocalToUtc(businessDate, '12:00', ctxSched.timezone),
    ctxSched.timezone,
  )
  const isRestDay = !ctxSched.workingDays.includes(weekday)
  const leave = await findApprovedLeaveCoveringDate(
    employee.organizationId,
    employee.id,
    businessDate,
  )
  const holiday = await findHolidayForDate(
    employee.organizationId,
    businessDate,
    employee.branchId,
    employee.legalEntityId,
  )

  const calc = calculateAttendance({
    scheduledStart: window.scheduledStart,
    scheduledEnd: window.scheduledEnd,
    onLeave: Boolean(leave),
    isHoliday: Boolean(holiday),
    isRestDay,
  })

  const created = await insertAttendance({
    organizationId: employee.organizationId,
    legalEntityId: employee.legalEntityId,
    branchId: employee.branchId,
    employeeId: employee.id,
    businessDate,
    timezone: ctxSched.timezone,
    workScheduleId: ctxSched.schedule?.id,
    shiftDefinitionId: ctxSched.shift?.id,
    scheduleAssignmentId: ctxSched.assignment?.id,
    scheduledStart: window.scheduledStart,
    scheduledEnd: window.scheduledEnd,
    ...calcPatchFromResult(
      {
        scheduledStart: window.scheduledStart,
        scheduledEnd: window.scheduledEnd,
      } as AttendanceRecord,
      calc,
    ),
    source: input.source,
    leaveRequestId: leave?.id,
    holidayId: holiday?.id,
    createdBy: input.ctx.userId,
  })
  if (!created) {
    const raced = await findAttendanceByEmployeeDate(
      employee.organizationId,
      employee.id,
      businessDate,
    )
    if (!raced) throw conflict('Could not create attendance record.')
    return raced
  }
  return created
}

export async function clockIn(
  ctx: AccessContext,
  body: {
    organizationId?: string
    employeeId?: string
    at?: string
    source?: string
    notes?: string
  },
  meta?: RequestMeta,
) {
  const canManage = hasPermission(ctx, PERMISSIONS.ATTENDANCE_MANAGE)
  const self = await loadSelfEmployee(ctx, body.organizationId).catch(() => null)
  const employeeId = body.employeeId ?? self?.id
  if (!employeeId) throw invalidField('employeeId', 'Employee is required.')
  const employee = await loadAccessibleEmployee(ctx, employeeId, body.organizationId)
  assertSelfOrScopedEmployee(ctx, employee, self?.id, canManage)

  const at = body.at ? new Date(body.at) : new Date()
  const source =
    body.source ??
    (canManage && body.employeeId && body.employeeId !== self?.id
      ? ATTENDANCE_SOURCES.ADMIN
      : ATTENDANCE_SOURCES.EMPLOYEE)

  const record = await ensureAttendanceShell({
    ctx,
    employeeId: employee.id,
    at,
    source,
    organizationId: body.organizationId,
  })

  if (record.clockInAt) {
    // Idempotent retry: same clock-in already applied.
    return record
  }

  if (
    record.status === ATTENDANCE_STATUSES.ON_LEAVE ||
    record.status === ATTENDANCE_STATUSES.HOLIDAY ||
    record.status === ATTENDANCE_STATUSES.REST_DAY
  ) {
    // Allow unexpected attendance but raise an exception for admins.
    await insertException({
      organizationId: record.organizationId,
      legalEntityId: record.legalEntityId,
      branchId: record.branchId,
      employeeId: record.employeeId,
      attendanceRecordId: record.id,
      businessDate: record.businessDate,
      code: ATTENDANCE_EXCEPTION_CODES.UNEXPECTED_ATTENDANCE,
      message: `Clock-in on ${record.status} day`,
    })
  }

  const calc = calculateAttendance({
    scheduledStart: record.scheduledStart ?? at,
    scheduledEnd: record.scheduledEnd ?? at,
    clockIn: at,
    graceMinutes: (
      await resolveEmployeeScheduleContext(record.organizationId, record.employeeId, at)
    ).graceMinutes,
  })

  const updated = await atomicClockIn(record.id, {
    clockInAt: at,
    source,
    notes: body.notes,
    updatedBy: ctx.userId,
    ...calc,
  })
  if (!updated) {
    const current = await findAttendanceById(record.id)
    if (current?.clockInAt) return current
    throw conflict('Duplicate clock-in is not allowed.')
  }

  if (calc.lateDurationMinutes > 0) {
    await emitWorkforceNotificationIntent({
      organizationId: updated.organizationId,
      employeeId: updated.employeeId,
      kind: 'attendance.late',
      intentKey: `attendance.late:${updated.id}`,
      entityType: AUDIT_ENTITY_TYPES.ATTENDANCE_RECORD,
      entityId: updated.id,
      payload: { businessDate: updated.businessDate, lateMinutes: calc.lateDurationMinutes },
      meta,
    })
  }

  await emitWorkforceNotificationIntent({
    organizationId: updated.organizationId,
    employeeId: updated.employeeId,
    kind: 'attendance.clocked_in',
    intentKey: `attendance.clocked_in:${updated.id}`,
    entityType: AUDIT_ENTITY_TYPES.ATTENDANCE_RECORD,
    entityId: updated.id,
    payload: { businessDate: updated.businessDate },
    meta,
  })
  await publishWorkforceEvent({
    organizationId: updated.organizationId,
    eventKey: `attendance.clocked_in:${updated.id}`,
    eventType: 'attendance.clocked_in',
    payload: { attendanceId: updated.id, employeeId: updated.employeeId },
  })
  return updated
}

export async function clockOut(
  ctx: AccessContext,
  body: {
    organizationId?: string
    employeeId?: string
    at?: string
    notes?: string
  },
  meta?: RequestMeta,
) {
  const canManage = hasPermission(ctx, PERMISSIONS.ATTENDANCE_MANAGE)
  const self = await loadSelfEmployee(ctx, body.organizationId).catch(() => null)
  const employeeId = body.employeeId ?? self?.id
  if (!employeeId) throw invalidField('employeeId', 'Employee is required.')
  const employee = await loadAccessibleEmployee(ctx, employeeId, body.organizationId)
  assertSelfOrScopedEmployee(ctx, employee, self?.id, canManage)

  const at = body.at ? new Date(body.at) : new Date()
  const record = await ensureAttendanceShell({
    ctx,
    employeeId: employee.id,
    at,
    source: ATTENDANCE_SOURCES.EMPLOYEE,
    organizationId: body.organizationId,
  })

  if (record.clockOutAt) return record
  if (!record.clockInAt) {
    await insertException({
      organizationId: record.organizationId,
      legalEntityId: record.legalEntityId,
      branchId: record.branchId,
      employeeId: record.employeeId,
      attendanceRecordId: record.id,
      businessDate: record.businessDate,
      code: ATTENDANCE_EXCEPTION_CODES.MISSING_CLOCK_IN,
      message: 'Clock-out attempted without clock-in',
    })
    throw conflict('Clock-in is required before clock-out.')
  }

  const sched = await resolveEmployeeScheduleContext(
    record.organizationId,
    record.employeeId,
    at,
  )
  const calc = calculateAttendance({
    scheduledStart: record.scheduledStart ?? record.clockInAt,
    scheduledEnd: record.scheduledEnd ?? at,
    clockIn: record.clockInAt,
    clockOut: at,
    breaks: (record.breaks ?? []).map((b) => ({ start: b.startAt, end: b.endAt })),
    graceMinutes: sched.graceMinutes,
  })

  const updated = await atomicClockOut(record.id, {
    clockOutAt: at,
    notes: body.notes,
    updatedBy: ctx.userId,
    ...calc,
  })
  if (!updated) {
    const current = await findAttendanceById(record.id)
    if (current?.clockOutAt) return current
    throw conflict('Duplicate clock-out is not allowed.')
  }

  if (calc.overtimeDurationMinutes > 0) {
    // Overtime hours are recorded separately for approval → payroll.
  }

  await emitWorkforceNotificationIntent({
    organizationId: updated.organizationId,
    employeeId: updated.employeeId,
    kind: 'attendance.clocked_out',
    intentKey: `attendance.clocked_out:${updated.id}`,
    entityType: AUDIT_ENTITY_TYPES.ATTENDANCE_RECORD,
    entityId: updated.id,
    payload: { businessDate: updated.businessDate },
    meta,
  })
  await publishWorkforceEvent({
    organizationId: updated.organizationId,
    eventKey: `attendance.clocked_out:${updated.id}`,
    eventType: 'attendance.clocked_out',
    payload: { attendanceId: updated.id, employeeId: updated.employeeId },
  })
  return updated
}

export async function getTodayAttendance(ctx: AccessContext, organizationId?: string) {
  const self = await loadSelfEmployee(ctx, organizationId)
  const at = new Date()
  return ensureAttendanceShell({
    ctx,
    employeeId: self.id,
    at,
    source: ATTENDANCE_SOURCES.SYSTEM,
    organizationId,
  })
}

export async function listAttendanceService(
  ctx: AccessContext,
  query: {
    organizationId?: string
    employeeId?: string
    status?: string
    source?: string
    fromDate?: string
    toDate?: string
    page?: number
    pageSize?: number
  },
) {
  const organizationId = await requireWorkforceOrganization(ctx, query.organizationId)
  const canManage = hasPermission(ctx, PERMISSIONS.ATTENDANCE_MANAGE) ||
    hasPermission(ctx, PERMISSIONS.ATTENDANCE_VIEW)
  const self = await loadSelfEmployee(ctx, organizationId).catch(() => null)
  let employeeId = query.employeeId
  if (!hasPermission(ctx, PERMISSIONS.ATTENDANCE_MANAGE) && !hasPermission(ctx, PERMISSIONS.ATTENDANCE_APPROVE)) {
    if (!self) throw forbiddenError('Employee profile required.')
    employeeId = self.id
  }
  void canManage
  const { skip, pageSize } = parseWorkforcePage(query)
  return listAttendance({
    organizationId,
    employeeId,
    branchIds: branchScopeForList(ctx),
    status: query.status,
    source: query.source,
    fromDate: query.fromDate,
    toDate: query.toDate,
    skip,
    limit: pageSize,
  })
}

export async function getAttendance(ctx: AccessContext, id: string) {
  const record = await findAttendanceById(id)
  if (!record) throw notFound('Attendance record was not found.')
  await requireWorkforceOrganization(ctx, record.organizationId)
  const self = await loadSelfEmployee(ctx, record.organizationId).catch(() => null)
  const canManage = hasPermission(ctx, PERMISSIONS.ATTENDANCE_MANAGE)
  if (!canManage && self?.id !== record.employeeId) {
    throw notFound('Attendance record was not found.')
  }
  return record
}

export async function requestCorrection(
  ctx: AccessContext,
  attendanceId: string,
  body: {
    requestedClockInAt?: string
    requestedClockOutAt?: string
    requestedStatus?: string
    reason: string
  },
  meta?: RequestMeta,
) {
  const record = await getAttendance(ctx, attendanceId)
  const correction = await insertCorrection({
    organizationId: record.organizationId,
    legalEntityId: record.legalEntityId,
    branchId: record.branchId,
    employeeId: record.employeeId,
    attendanceRecordId: record.id,
    originalClockInAt: record.clockInAt,
    originalClockOutAt: record.clockOutAt,
    originalStatus: record.status,
    requestedClockInAt: body.requestedClockInAt ? new Date(body.requestedClockInAt) : undefined,
    requestedClockOutAt: body.requestedClockOutAt ? new Date(body.requestedClockOutAt) : undefined,
    requestedStatus: body.requestedStatus,
    reason: body.reason,
    status: CORRECTION_STATUSES.REQUESTED,
    requestedBy: ctx.userId,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.ATTENDANCE_CORRECTED,
    entityType: AUDIT_ENTITY_TYPES.ATTENDANCE_CORRECTION,
    entityId: correction.id,
    organizationId: record.organizationId,
    branchId: record.branchId,
    metadata: { attendanceId: record.id },
    meta,
  })
  await emitWorkforceNotificationIntent({
    organizationId: record.organizationId,
    employeeId: record.employeeId,
    kind: 'attendance.correction.submitted',
    intentKey: `attendance.correction.submitted:${correction.id}`,
    entityType: AUDIT_ENTITY_TYPES.ATTENDANCE_CORRECTION,
    entityId: correction.id,
    meta,
  })
  return correction
}

export async function reviewCorrection(
  ctx: AccessContext,
  correctionId: string,
  body: { approve: boolean; reviewNotes?: string },
  meta?: RequestMeta,
) {
  const correction = await findCorrectionById(correctionId)
  if (!correction) throw notFound('Correction was not found.')
  await requireWorkforceOrganization(ctx, correction.organizationId)

  if (body.approve) {
    const record = await findAttendanceById(correction.attendanceRecordId)
    if (!record) throw notFound('Attendance record was not found.')
    const clockIn = correction.requestedClockInAt ?? record.clockInAt
    const clockOut = correction.requestedClockOutAt ?? record.clockOutAt
    const calc = calculateAttendance({
      scheduledStart: record.scheduledStart ?? clockIn ?? new Date(),
      scheduledEnd: record.scheduledEnd ?? clockOut ?? new Date(),
      clockIn: clockIn ?? undefined,
      clockOut: clockOut ?? undefined,
      breaks: (record.breaks ?? []).map((b) => ({ start: b.startAt, end: b.endAt })),
    })
    await updateAttendance(record.id, {
      clockInAt: clockIn,
      clockOutAt: clockOut,
      status: correction.requestedStatus ?? calc.status,
      ...calc,
      source: ATTENDANCE_SOURCES.ADMIN,
      updatedBy: ctx.userId,
    })
    const updated = await updateCorrection(correctionId, {
      status: CORRECTION_STATUSES.APPROVED,
      reviewedBy: ctx.userId,
      reviewedAt: new Date(),
      reviewNotes: body.reviewNotes,
    })
    if (!updated) throw conflict('Correction was already reviewed.')
    await emitWorkforceNotificationIntent({
      organizationId: correction.organizationId,
      employeeId: correction.employeeId,
      kind: 'attendance.correction.approved',
      intentKey: `attendance.correction.approved:${correctionId}`,
      entityType: AUDIT_ENTITY_TYPES.ATTENDANCE_CORRECTION,
      entityId: correctionId,
      meta,
    })
    await publishWorkforceEvent({
      organizationId: correction.organizationId,
      eventKey: `attendance.correction.approved:${correctionId}`,
      eventType: 'attendance.correction.approved',
      payload: { correctionId, attendanceId: record.id },
    })
    return updated
  }

  const updated = await updateCorrection(correctionId, {
    status: CORRECTION_STATUSES.REJECTED,
    reviewedBy: ctx.userId,
    reviewedAt: new Date(),
    reviewNotes: body.reviewNotes,
  })
  if (!updated) throw conflict('Correction was already reviewed.')
  await emitWorkforceNotificationIntent({
    organizationId: correction.organizationId,
    employeeId: correction.employeeId,
    kind: 'attendance.correction.rejected',
    intentKey: `attendance.correction.rejected:${correctionId}`,
    entityType: AUDIT_ENTITY_TYPES.ATTENDANCE_CORRECTION,
    entityId: correctionId,
    meta,
  })
  return updated
}

export async function listCorrectionsService(
  ctx: AccessContext,
  query: {
    organizationId?: string
    status?: string
    employeeId?: string
    page?: number
    pageSize?: number
  },
) {
  const organizationId = await requireWorkforceOrganization(ctx, query.organizationId)
  const { skip, pageSize } = parseWorkforcePage(query)
  return listCorrections({
    organizationId,
    status: query.status,
    employeeId: query.employeeId,
    branchIds: branchScopeForList(ctx),
    skip,
    limit: pageSize,
  })
}

export async function listExceptionsService(
  ctx: AccessContext,
  query: {
    organizationId?: string
    resolved?: boolean
    page?: number
    pageSize?: number
  },
) {
  const organizationId = await requireWorkforceOrganization(ctx, query.organizationId)
  const { skip, pageSize } = parseWorkforcePage(query)
  return listExceptions({
    organizationId,
    resolved: query.resolved,
    branchIds: branchScopeForList(ctx),
    skip,
    limit: pageSize,
  })
}

export async function importAttendanceBatch(
  ctx: AccessContext,
  body: {
    organizationId?: string
    source: string
    externalBatchId: string
    rows: Array<{
      employeeNumber: string
      businessDate: string
      clockInAt?: string
      clockOutAt?: string
      externalReference?: string
    }>
  },
) {
  const organizationId = await requireWorkforceOrganization(ctx, body.organizationId)
  const batch = await tryInsertImportBatch({
    organizationId,
    source: body.source,
    externalBatchId: body.externalBatchId,
    status: 'PENDING',
    rowCount: body.rows.length,
    createdBy: ctx.userId,
  })
  if (!batch) {
    return { duplicate: true, externalBatchId: body.externalBatchId, successCount: 0, errorCount: 0 }
  }
  // Foundation only: batch is tracked; row processing can be expanded by integrations.
  return {
    duplicate: false,
    batchId: batch.id,
    externalBatchId: batch.externalBatchId,
    rowCount: body.rows.length,
    status: 'PENDING',
  }
}
