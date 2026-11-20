import {
  DEFAULT_GRACE_MINUTES,
  DEFAULT_WORKFORCE_TIMEZONE,
  ENTITY_ACTIVE_STATUSES,
} from '../../constants/workforce.js'
import {
  findActiveAssignmentForDate,
  findAssignmentById,
  findShiftById,
  findWorkScheduleById,
  insertScheduleAssignment,
  insertScheduleHistory,
  insertShiftDefinition,
  insertWorkSchedule,
  listAssignments,
  listShifts,
  listWorkSchedules,
  updateAssignment,
  updateShift,
  updateWorkSchedule,
  type EmployeeScheduleAssignmentRecord,
  type ShiftDefinitionRecord,
  type WorkScheduleRecord,
} from '../../repositories/workforce/workforce.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import { conflict, invalidField, notFound } from '../../utils/httpErrors.js'
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  recordAuditEvent,
} from '../audit/audit.service.js'
import { parseHmToMinutes } from './attendance-timezone.js'
import { publishWorkforceEvent } from './workforce-notifications.js'
import {
  assertBranchInOrg,
  assertEmployeeActive,
  branchScopeForList,
  loadAccessibleEmployee,
  requireWorkforceOrganization,
} from './workforce-access.js'
import { parseWorkforcePage } from './workforce-paging.js'

export async function createWorkSchedule(
  ctx: AccessContext,
  body: {
    organizationId?: string
    legalEntityId?: string
    code: string
    name: string
    nameAr?: string
    description?: string
    timezone?: string
    workingDays: string[]
    startTime: string
    endTime: string
    breaks?: Array<{ startTime: string; endTime: string; type?: string }>
    graceMinutes?: number
  },
  meta?: RequestMeta,
) {
  const organizationId = await requireWorkforceOrganization(ctx, body.organizationId)
  const schedule = await insertWorkSchedule({
    organizationId,
    legalEntityId: body.legalEntityId,
    code: body.code.toUpperCase(),
    name: body.name,
    nameAr: body.nameAr,
    description: body.description,
    timezone: body.timezone?.trim() || DEFAULT_WORKFORCE_TIMEZONE,
    workingDays: body.workingDays,
    startTime: body.startTime,
    endTime: body.endTime,
    breaks: body.breaks ?? [],
    graceMinutes: body.graceMinutes ?? DEFAULT_GRACE_MINUTES,
    status: ENTITY_ACTIVE_STATUSES.ACTIVE,
    createdBy: ctx.userId,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.SCHEDULE_CREATED,
    entityType: AUDIT_ENTITY_TYPES.WORK_SCHEDULE,
    entityId: schedule.id,
    organizationId,
    meta,
  })
  return schedule
}

export async function updateWorkScheduleService(
  ctx: AccessContext,
  id: string,
  body: Record<string, unknown>,
  meta?: RequestMeta,
) {
  const existing = await findWorkScheduleById(id)
  if (!existing) throw notFound('Work schedule was not found.')
  await requireWorkforceOrganization(ctx, existing.organizationId)
  const updated = await updateWorkSchedule(id, { ...body, updatedBy: ctx.userId })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.SCHEDULE_UPDATED,
    entityType: AUDIT_ENTITY_TYPES.WORK_SCHEDULE,
    entityId: id,
    organizationId: existing.organizationId,
    meta,
  })
  return updated
}

export async function listWorkSchedulesService(
  ctx: AccessContext,
  query: { organizationId?: string; status?: string; page?: number; pageSize?: number },
) {
  const organizationId = await requireWorkforceOrganization(ctx, query.organizationId)
  const { skip, pageSize } = parseWorkforcePage(query)
  return listWorkSchedules({
    organizationId,
    status: query.status,
    skip,
    limit: pageSize,
  })
}

export async function createShift(
  ctx: AccessContext,
  body: {
    organizationId?: string
    legalEntityId?: string
    code: string
    name: string
    nameAr?: string
    description?: string
    timezone?: string
    startTime: string
    endTime: string
    breaks?: Array<{ startTime: string; endTime: string; type?: string }>
    graceMinutes?: number
  },
  meta?: RequestMeta,
) {
  const organizationId = await requireWorkforceOrganization(ctx, body.organizationId)
  const crossesMidnight = parseHmToMinutes(body.endTime) <= parseHmToMinutes(body.startTime)
  const shift = await insertShiftDefinition({
    organizationId,
    legalEntityId: body.legalEntityId,
    code: body.code.toUpperCase(),
    name: body.name,
    nameAr: body.nameAr,
    description: body.description,
    timezone: body.timezone?.trim() || DEFAULT_WORKFORCE_TIMEZONE,
    startTime: body.startTime,
    endTime: body.endTime,
    breaks: body.breaks ?? [],
    graceMinutes: body.graceMinutes ?? DEFAULT_GRACE_MINUTES,
    crossesMidnight,
    status: ENTITY_ACTIVE_STATUSES.ACTIVE,
    createdBy: ctx.userId,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.SHIFT_CREATED,
    entityType: AUDIT_ENTITY_TYPES.SHIFT_DEFINITION,
    entityId: shift.id,
    organizationId,
    meta,
  })
  return shift
}

export async function updateShiftService(
  ctx: AccessContext,
  id: string,
  body: Record<string, unknown>,
  meta?: RequestMeta,
) {
  const existing = await findShiftById(id)
  if (!existing) throw notFound('Shift was not found.')
  await requireWorkforceOrganization(ctx, existing.organizationId)
  const patch = { ...body, updatedBy: ctx.userId }
  if (typeof body.startTime === 'string' && typeof body.endTime === 'string') {
    patch.crossesMidnight =
      parseHmToMinutes(body.endTime) <= parseHmToMinutes(body.startTime)
  }
  const updated = await updateShift(id, patch)
  await recordAuditEvent({
    action: AUDIT_ACTIONS.SHIFT_UPDATED,
    entityType: AUDIT_ENTITY_TYPES.SHIFT_DEFINITION,
    entityId: id,
    organizationId: existing.organizationId,
    meta,
  })
  return updated
}

export async function listShiftsService(
  ctx: AccessContext,
  query: { organizationId?: string; status?: string; page?: number; pageSize?: number },
) {
  const organizationId = await requireWorkforceOrganization(ctx, query.organizationId)
  const { skip, pageSize } = parseWorkforcePage(query)
  return listShifts({
    organizationId,
    status: query.status,
    skip,
    limit: pageSize,
  })
}

export type ResolvedScheduleContext = {
  assignment: EmployeeScheduleAssignmentRecord | null
  schedule: WorkScheduleRecord | null
  shift: ShiftDefinitionRecord | null
  startTime: string
  endTime: string
  workingDays: string[]
  graceMinutes: number
  timezone: string
}

export async function resolveEmployeeScheduleContext(
  organizationId: string,
  employeeId: string,
  at: Date,
  branchTimezone?: string,
): Promise<ResolvedScheduleContext> {
  const assignment = await findActiveAssignmentForDate(organizationId, employeeId, at)
  const schedule = assignment?.workScheduleId
    ? await findWorkScheduleById(assignment.workScheduleId)
    : null
  const shift = assignment?.shiftDefinitionId
    ? await findShiftById(assignment.shiftDefinitionId)
    : null

  const startTime = shift?.startTime ?? schedule?.startTime ?? '09:00'
  const endTime = shift?.endTime ?? schedule?.endTime ?? '18:00'
  const workingDays = schedule?.workingDays?.length
    ? schedule.workingDays
    : ['MON', 'TUE', 'WED', 'THU', 'FRI']
  const graceMinutes = shift?.graceMinutes ?? schedule?.graceMinutes ?? DEFAULT_GRACE_MINUTES
  const timezone =
    shift?.timezone || schedule?.timezone || branchTimezone || DEFAULT_WORKFORCE_TIMEZONE

  return {
    assignment,
    schedule,
    shift,
    startTime,
    endTime,
    workingDays,
    graceMinutes,
    timezone,
  }
}

export async function assignEmployeeSchedule(
  ctx: AccessContext,
  body: {
    organizationId?: string
    employeeId: string
    workScheduleId?: string
    shiftDefinitionId?: string
    effectiveFrom: string
    effectiveTo?: string
    reason?: string
  },
  meta?: RequestMeta,
) {
  if (!body.workScheduleId && !body.shiftDefinitionId) {
    throw invalidField('workScheduleId', 'Provide a work schedule and/or shift.')
  }
  const employee = await loadAccessibleEmployee(ctx, body.employeeId, body.organizationId)
  assertEmployeeActive(employee)
  await assertBranchInOrg(employee.branchId, employee.organizationId)

  if (body.workScheduleId) {
    const schedule = await findWorkScheduleById(body.workScheduleId)
    if (!schedule || schedule.organizationId !== employee.organizationId) {
      throw invalidField('workScheduleId', 'Work schedule was not found.')
    }
  }
  if (body.shiftDefinitionId) {
    const shift = await findShiftById(body.shiftDefinitionId)
    if (!shift || shift.organizationId !== employee.organizationId) {
      throw invalidField('shiftDefinitionId', 'Shift was not found.')
    }
  }

  const effectiveFrom = new Date(body.effectiveFrom)
  const previous = await findActiveAssignmentForDate(
    employee.organizationId,
    employee.id,
    effectiveFrom,
  )
  if (previous) {
    const closed = await updateAssignment(previous.id, {
      effectiveTo: new Date(effectiveFrom.getTime() - 1),
      status: ENTITY_ACTIVE_STATUSES.INACTIVE,
      updatedBy: ctx.userId,
    })
    if (!closed) throw conflict('Could not close the previous schedule assignment.')
  }

  const assignment = await insertScheduleAssignment({
    organizationId: employee.organizationId,
    legalEntityId: employee.legalEntityId,
    branchId: employee.branchId,
    employeeId: employee.id,
    workScheduleId: body.workScheduleId,
    shiftDefinitionId: body.shiftDefinitionId,
    effectiveFrom,
    effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : undefined,
    status: ENTITY_ACTIVE_STATUSES.ACTIVE,
    reason: body.reason,
    previousAssignmentId: previous?.id,
    createdBy: ctx.userId,
  })

  await insertScheduleHistory({
    organizationId: employee.organizationId,
    employeeId: employee.id,
    previousAssignmentId: previous?.id,
    newAssignmentId: assignment.id,
    previousWorkScheduleId: previous?.workScheduleId,
    previousShiftDefinitionId: previous?.shiftDefinitionId,
    newWorkScheduleId: body.workScheduleId,
    newShiftDefinitionId: body.shiftDefinitionId,
    effectiveFrom,
    reason: body.reason,
    changedBy: ctx.userId,
  })

  await recordAuditEvent({
    action: AUDIT_ACTIONS.SCHEDULE_ASSIGNED,
    entityType: AUDIT_ENTITY_TYPES.EMPLOYEE_SCHEDULE,
    entityId: assignment.id,
    organizationId: employee.organizationId,
    branchId: employee.branchId,
    metadata: { employeeId: employee.id },
    meta,
  })
  await publishWorkforceEvent({
    organizationId: employee.organizationId,
    eventKey: `schedule.assigned:${assignment.id}`,
    eventType: 'schedule.assigned',
    payload: { assignmentId: assignment.id, employeeId: employee.id },
  })
  return assignment
}

export async function listEmployeeSchedulesService(
  ctx: AccessContext,
  query: {
    organizationId?: string
    employeeId?: string
    page?: number
    pageSize?: number
  },
) {
  const organizationId = await requireWorkforceOrganization(ctx, query.organizationId)
  const { skip, pageSize } = parseWorkforcePage(query)
  return listAssignments({
    organizationId,
    employeeId: query.employeeId,
    branchIds: branchScopeForList(ctx),
    skip,
    limit: pageSize,
  })
}

export async function getAssignment(ctx: AccessContext, id: string) {
  const assignment = await findAssignmentById(id)
  if (!assignment) throw notFound('Schedule assignment was not found.')
  await requireWorkforceOrganization(ctx, assignment.organizationId)
  return assignment
}
