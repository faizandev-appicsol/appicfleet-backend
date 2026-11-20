import { PERMISSIONS } from '../../constants/permissions.js'
import {
  ENTITY_ACTIVE_STATUSES,
  LEAVE_BALANCE_TX_TYPES,
  LEAVE_DAY_PARTS,
  LEAVE_REQUEST_STATUSES,
} from '../../constants/workforce.js'
import {
  findLeaveBalance,
  findLeavePolicyById,
  findLeaveRequestById,
  findLeaveTypeById,
  insertLeaveApproval,
  insertLeaveBalance,
  insertLeaveBalanceTx,
  insertLeavePolicy,
  insertLeaveRequest,
  insertLeaveType,
  listLeaveBalances,
  listLeavePolicies,
  listLeaveRequests,
  listLeaveTypes,
  updateLeaveBalanceOptimistic,
  updateLeaveRequest,
  updateLeaveType,
} from '../../repositories/workforce/workforce.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import { conflict, forbiddenError, invalidField, notFound } from '../../utils/httpErrors.js'
import {
  addLeaveDays,
  compareLeaveDays,
  divideLeaveDays,
  minLeaveDays,
  normalizeLeaveDays,
  subtractLeaveDays,
} from '../../utils/leave-days.js'
import { hasPermission } from '../authorization/authorization.service.js'
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  recordAuditEvent,
} from '../audit/audit.service.js'
import { computeLeaveDaysRequested } from './leave-days-request.js'
import { emitWorkforceNotificationIntent, publishWorkforceEvent } from './workforce-notifications.js'

export { computeLeaveDaysRequested } from './leave-days-request.js'
import {
  assertEmployeeActive,
  assertSelfOrScopedEmployee,
  branchScopeForList,
  loadAccessibleEmployee,
  loadSelfEmployee,
  requireWorkforceOrganization,
} from './workforce-access.js'
import { parseWorkforcePage } from './workforce-paging.js'

function computeAvailable(parts: {
  openingDays: string
  accruedDays: string
  adjustedDays: string
  usedDays: string
  pendingDays: string
}) {
  return subtractLeaveDays(
    addLeaveDays(parts.openingDays, parts.accruedDays, parts.adjustedDays),
    addLeaveDays(parts.usedDays, parts.pendingDays),
  )
}

export async function createLeaveType(
  ctx: AccessContext,
  body: {
    organizationId?: string
    legalEntityId?: string
    code: string
    name: string
    nameAr?: string
    description?: string
    paid?: boolean
    requiresApproval?: boolean
    requiresDocument?: boolean
  },
  meta?: RequestMeta,
) {
  const organizationId = await requireWorkforceOrganization(ctx, body.organizationId)
  const type = await insertLeaveType({
    organizationId,
    legalEntityId: body.legalEntityId,
    code: body.code.toUpperCase(),
    name: body.name,
    nameAr: body.nameAr,
    description: body.description,
    paid: body.paid ?? true,
    requiresApproval: body.requiresApproval ?? true,
    requiresDocument: body.requiresDocument ?? false,
    status: ENTITY_ACTIVE_STATUSES.ACTIVE,
    createdBy: ctx.userId,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.LEAVE_BALANCE_ADJUSTED,
    entityType: AUDIT_ENTITY_TYPES.LEAVE_TYPE,
    entityId: type.id,
    organizationId,
    metadata: { created: true, code: type.code },
    meta,
  })
  return type
}

export async function updateLeaveTypeService(
  ctx: AccessContext,
  id: string,
  body: Record<string, unknown>,
) {
  const existing = await findLeaveTypeById(id)
  if (!existing) throw notFound('Leave type was not found.')
  await requireWorkforceOrganization(ctx, existing.organizationId)
  return updateLeaveType(id, { ...body, updatedBy: ctx.userId })
}

export async function listLeaveTypesService(
  ctx: AccessContext,
  query: { organizationId?: string; status?: string; page: number; pageSize: number },
) {
  const organizationId = await requireWorkforceOrganization(ctx, query.organizationId)
  return listLeaveTypes({
    organizationId,
    status: query.status,
    skip: parseWorkforcePage(query).skip,
    limit: parseWorkforcePage(query).pageSize,
  })
}

export async function createLeavePolicy(
  ctx: AccessContext,
  body: {
    organizationId?: string
    legalEntityId?: string
    leaveTypeId: string
    name: string
    accrualMethod: string
    annualEntitlementDays: string
    carryForwardAllowed?: boolean
    maxCarryForwardDays?: string
    expiryMonths?: number
    effectiveFrom: string
    effectiveTo?: string
  },
) {
  const organizationId = await requireWorkforceOrganization(ctx, body.organizationId)
  const leaveType = await findLeaveTypeById(body.leaveTypeId)
  if (!leaveType || leaveType.organizationId !== organizationId) {
    throw invalidField('leaveTypeId', 'Leave type was not found.')
  }
  return insertLeavePolicy({
    organizationId,
    legalEntityId: body.legalEntityId,
    leaveTypeId: body.leaveTypeId,
    name: body.name,
    accrualMethod: body.accrualMethod,
    annualEntitlementDays: normalizeLeaveDays(body.annualEntitlementDays),
    carryForwardAllowed: body.carryForwardAllowed ?? false,
    maxCarryForwardDays: body.maxCarryForwardDays
      ? normalizeLeaveDays(body.maxCarryForwardDays)
      : undefined,
    expiryMonths: body.expiryMonths,
    effectiveFrom: new Date(body.effectiveFrom),
    effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : undefined,
    status: ENTITY_ACTIVE_STATUSES.ACTIVE,
    createdBy: ctx.userId,
  })
}

export async function listLeavePoliciesService(
  ctx: AccessContext,
  query: {
    organizationId?: string
    leaveTypeId?: string
    status?: string
    page: number
    pageSize: number
  },
) {
  const organizationId = await requireWorkforceOrganization(ctx, query.organizationId)
  return listLeavePolicies({
    organizationId,
    leaveTypeId: query.leaveTypeId,
    status: query.status,
    skip: parseWorkforcePage(query).skip,
    limit: parseWorkforcePage(query).pageSize,
  })
}

async function getOrCreateBalance(input: {
  organizationId: string
  legalEntityId: string
  branchId: string
  employeeId: string
  leaveTypeId: string
  periodYear: number
  leavePolicyId?: string
  openingDays?: string
}) {
  const existing = await findLeaveBalance(
    input.organizationId,
    input.employeeId,
    input.leaveTypeId,
    input.periodYear,
  )
  if (existing) return existing
  return insertLeaveBalance({
    organizationId: input.organizationId,
    legalEntityId: input.legalEntityId,
    branchId: input.branchId,
    employeeId: input.employeeId,
    leaveTypeId: input.leaveTypeId,
    leavePolicyId: input.leavePolicyId,
    periodYear: input.periodYear,
    openingDays: normalizeLeaveDays(input.openingDays ?? '0.00'),
    accruedDays: '0.00',
    usedDays: '0.00',
    pendingDays: '0.00',
    adjustedDays: '0.00',
    availableDays: normalizeLeaveDays(input.openingDays ?? '0.00'),
    version: 1,
  })
}

export async function listLeaveBalancesService(
  ctx: AccessContext,
  query: {
    organizationId?: string
    employeeId?: string
    periodYear?: number
    page: number
    pageSize: number
  },
) {
  const organizationId = await requireWorkforceOrganization(ctx, query.organizationId)
  const self = await loadSelfEmployee(ctx, organizationId).catch(() => null)
  let employeeId = query.employeeId
  if (!hasPermission(ctx, PERMISSIONS.LEAVE_BALANCE_MANAGE) && !hasPermission(ctx, PERMISSIONS.LEAVE_MANAGE)) {
    if (!self) throw forbiddenError('Employee profile required.')
    employeeId = self.id
  }
  return listLeaveBalances({
    organizationId,
    employeeId,
    branchIds: branchScopeForList(ctx),
    periodYear: query.periodYear,
    skip: parseWorkforcePage(query).skip,
    limit: parseWorkforcePage(query).pageSize,
  })
}

export async function adjustLeaveBalance(
  ctx: AccessContext,
  body: {
    organizationId?: string
    employeeId: string
    leaveTypeId: string
    periodYear: number
    days: string
    note?: string
  },
  meta?: RequestMeta,
) {
  const employee = await loadAccessibleEmployee(ctx, body.employeeId, body.organizationId)
  const balance = await getOrCreateBalance({
    organizationId: employee.organizationId,
    legalEntityId: employee.legalEntityId,
    branchId: employee.branchId,
    employeeId: employee.id,
    leaveTypeId: body.leaveTypeId,
    periodYear: body.periodYear,
  })
  if (!balance) throw conflict('Could not load leave balance.')

  const days = normalizeLeaveDays(body.days.replace(/^-/, '') || '0')
  const signed = body.days.trim().startsWith('-')
    ? subtractLeaveDays('0.00', days, true)
    : days
  const adjustedDays = addLeaveDays(balance.adjustedDays, signed)
  const availableDays = computeAvailable({
    openingDays: balance.openingDays,
    accruedDays: balance.accruedDays,
    adjustedDays,
    usedDays: balance.usedDays,
    pendingDays: balance.pendingDays,
  })
  const updated = await updateLeaveBalanceOptimistic(balance.id, balance.version, {
    adjustedDays,
    availableDays,
  })
  if (!updated) throw conflict('Leave balance was modified concurrently. Retry.')

  await insertLeaveBalanceTx({
    organizationId: employee.organizationId,
    employeeId: employee.id,
    leaveTypeId: body.leaveTypeId,
    leaveBalanceId: balance.id,
    type: LEAVE_BALANCE_TX_TYPES.ADJUSTMENT,
    days: signed,
    balanceAfter: availableDays,
    idempotencyKey: `adj:${balance.id}:${balance.version}:${signed}`,
    note: body.note,
    createdBy: ctx.userId,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.LEAVE_BALANCE_ADJUSTED,
    entityType: AUDIT_ENTITY_TYPES.LEAVE_BALANCE,
    entityId: balance.id,
    organizationId: employee.organizationId,
    meta,
  })
  return updated
}

export async function accrueLeaveMonthly(
  ctx: AccessContext,
  body: {
    organizationId?: string
    employeeId: string
    leavePolicyId: string
    periodYear: number
    monthKey: string
  },
) {
  const employee = await loadAccessibleEmployee(ctx, body.employeeId, body.organizationId)
  const policy = await findLeavePolicyById(body.leavePolicyId)
  if (!policy || policy.organizationId !== employee.organizationId) {
    throw invalidField('leavePolicyId', 'Leave policy was not found.')
  }
  const monthly = divideLeaveDays(policy.annualEntitlementDays, 12)
  const balance = await getOrCreateBalance({
    organizationId: employee.organizationId,
    legalEntityId: employee.legalEntityId,
    branchId: employee.branchId,
    employeeId: employee.id,
    leaveTypeId: policy.leaveTypeId,
    periodYear: body.periodYear,
    leavePolicyId: policy.id,
  })
  if (!balance) throw conflict('Could not load leave balance.')

  const tx = await insertLeaveBalanceTx({
    organizationId: employee.organizationId,
    employeeId: employee.id,
    leaveTypeId: policy.leaveTypeId,
    leaveBalanceId: balance.id,
    type: LEAVE_BALANCE_TX_TYPES.ACCRUAL,
    days: monthly,
    balanceAfter: addLeaveDays(balance.availableDays, monthly),
    idempotencyKey: `accrual:${balance.id}:${body.monthKey}`,
    createdBy: ctx.userId,
  })
  if (!tx) return balance

  const accruedDays = addLeaveDays(balance.accruedDays, monthly)
  const availableDays = computeAvailable({
    openingDays: balance.openingDays,
    accruedDays,
    adjustedDays: balance.adjustedDays,
    usedDays: balance.usedDays,
    pendingDays: balance.pendingDays,
  })
  const updated = await updateLeaveBalanceOptimistic(balance.id, balance.version, {
    accruedDays,
    availableDays,
  })
  if (!updated) throw conflict('Leave balance was modified concurrently. Retry.')
  return updated
}

export async function carryForwardLeave(
  ctx: AccessContext,
  body: {
    organizationId?: string
    employeeId: string
    leavePolicyId: string
    fromYear: number
    toYear: number
  },
) {
  const employee = await loadAccessibleEmployee(ctx, body.employeeId, body.organizationId)
  const policy = await findLeavePolicyById(body.leavePolicyId)
  if (!policy || !policy.carryForwardAllowed) {
    throw invalidField('leavePolicyId', 'Carry-forward is not allowed for this policy.')
  }
  const from = await findLeaveBalance(
    employee.organizationId,
    employee.id,
    policy.leaveTypeId,
    body.fromYear,
  )
  if (!from) throw notFound('Source leave balance was not found.')
  const unused = from.availableDays
  const max = policy.maxCarryForwardDays ?? unused
  const carry = minLeaveDays(unused, max)

  const to = await getOrCreateBalance({
    organizationId: employee.organizationId,
    legalEntityId: employee.legalEntityId,
    branchId: employee.branchId,
    employeeId: employee.id,
    leaveTypeId: policy.leaveTypeId,
    periodYear: body.toYear,
    leavePolicyId: policy.id,
    openingDays: carry,
  })
  if (!to) throw conflict('Could not create target balance.')

  await insertLeaveBalanceTx({
    organizationId: employee.organizationId,
    employeeId: employee.id,
    leaveTypeId: policy.leaveTypeId,
    leaveBalanceId: to.id,
    type: LEAVE_BALANCE_TX_TYPES.CARRY_FORWARD,
    days: carry,
    balanceAfter: to.availableDays,
    idempotencyKey: `cf:${from.id}:${to.id}`,
    createdBy: ctx.userId,
  })
  return to
}

export async function expireLeaveBalance(
  ctx: AccessContext,
  body: {
    organizationId?: string
    employeeId: string
    leaveTypeId: string
    periodYear: number
    days: string
  },
) {
  const employee = await loadAccessibleEmployee(ctx, body.employeeId, body.organizationId)
  const balance = await findLeaveBalance(
    employee.organizationId,
    employee.id,
    body.leaveTypeId,
    body.periodYear,
  )
  if (!balance) throw notFound('Leave balance was not found.')
  const days = normalizeLeaveDays(body.days)
  const adjustedDays = subtractLeaveDays(balance.adjustedDays, days, true)
  const availableDays = computeAvailable({
    openingDays: balance.openingDays,
    accruedDays: balance.accruedDays,
    adjustedDays,
    usedDays: balance.usedDays,
    pendingDays: balance.pendingDays,
  })
  const updated = await updateLeaveBalanceOptimistic(balance.id, balance.version, {
    adjustedDays,
    availableDays,
  })
  if (!updated) throw conflict('Leave balance was modified concurrently. Retry.')
  await insertLeaveBalanceTx({
    organizationId: employee.organizationId,
    employeeId: employee.id,
    leaveTypeId: body.leaveTypeId,
    leaveBalanceId: balance.id,
    type: LEAVE_BALANCE_TX_TYPES.EXPIRY,
    days: subtractLeaveDays('0.00', days, true),
    balanceAfter: availableDays,
    idempotencyKey: `exp:${balance.id}:${days}`,
    createdBy: ctx.userId,
  })
  return updated
}

export async function submitLeaveRequest(
  ctx: AccessContext,
  body: {
    organizationId?: string
    employeeId?: string
    leaveTypeId: string
    startDate: string
    endDate: string
    dayPart?: string
    partialHours?: string
    reason?: string
    documentStorageKey?: string
    idempotencyKey?: string
    submit?: boolean
  },
  meta?: RequestMeta,
) {
  const canManage = hasPermission(ctx, PERMISSIONS.LEAVE_MANAGE)
  const self = await loadSelfEmployee(ctx, body.organizationId).catch(() => null)
  const employeeId = body.employeeId ?? self?.id
  if (!employeeId) throw invalidField('employeeId', 'Employee is required.')
  const employee = await loadAccessibleEmployee(ctx, employeeId, body.organizationId)
  assertEmployeeActive(employee)
  assertSelfOrScopedEmployee(ctx, employee, self?.id, canManage)

  const leaveType = await findLeaveTypeById(body.leaveTypeId)
  if (!leaveType || leaveType.organizationId !== employee.organizationId) {
    throw invalidField('leaveTypeId', 'Leave type was not found.')
  }
  if (leaveType.requiresDocument && !body.documentStorageKey) {
    throw invalidField('documentStorageKey', 'Supporting document is required.')
  }

  const dayPart = body.dayPart ?? LEAVE_DAY_PARTS.FULL_DAY
  const daysRequested = computeLeaveDaysRequested({
    startDate: body.startDate,
    endDate: body.endDate,
    dayPart,
    partialHours: body.partialHours,
  })

  const status =
    body.submit === false
      ? LEAVE_REQUEST_STATUSES.DRAFT
      : LEAVE_REQUEST_STATUSES.SUBMITTED

  const request = await insertLeaveRequest({
    organizationId: employee.organizationId,
    legalEntityId: employee.legalEntityId,
    branchId: employee.branchId,
    employeeId: employee.id,
    leaveTypeId: body.leaveTypeId,
    startDate: body.startDate,
    endDate: body.endDate,
    dayPart,
    partialHours: body.partialHours,
    daysRequested,
    reason: body.reason,
    documentStorageKey: body.documentStorageKey,
    status,
    submittedAt: status === LEAVE_REQUEST_STATUSES.SUBMITTED ? new Date() : undefined,
    idempotencyKey: body.idempotencyKey,
    createdBy: ctx.userId,
  })
  if (!request) throw conflict('Leave request could not be created.')

  if (status === LEAVE_REQUEST_STATUSES.SUBMITTED) {
    const year = Number(body.startDate.slice(0, 4))
    const balance = await getOrCreateBalance({
      organizationId: employee.organizationId,
      legalEntityId: employee.legalEntityId,
      branchId: employee.branchId,
      employeeId: employee.id,
      leaveTypeId: body.leaveTypeId,
      periodYear: year,
    })
    if (balance && compareLeaveDays(balance.availableDays, daysRequested) < 0) {
      // Soft warning path: still allow submit; approval will enforce.
    } else if (balance) {
      const pendingDays = addLeaveDays(balance.pendingDays, daysRequested)
      const availableDays = computeAvailable({
        openingDays: balance.openingDays,
        accruedDays: balance.accruedDays,
        adjustedDays: balance.adjustedDays,
        usedDays: balance.usedDays,
        pendingDays,
      })
      const updated = await updateLeaveBalanceOptimistic(balance.id, balance.version, {
        pendingDays,
        availableDays,
      })
      if (updated) {
        await insertLeaveBalanceTx({
          organizationId: employee.organizationId,
          employeeId: employee.id,
          leaveTypeId: body.leaveTypeId,
          leaveBalanceId: balance.id,
          leaveRequestId: request.id,
          type: LEAVE_BALANCE_TX_TYPES.PENDING,
          days: daysRequested,
          balanceAfter: availableDays,
          idempotencyKey: `pending:${request.id}`,
          createdBy: ctx.userId,
        })
      }
    }

    await emitWorkforceNotificationIntent({
      organizationId: employee.organizationId,
      employeeId: employee.id,
      kind: 'leave.requested',
      intentKey: `leave.requested:${request.id}`,
      entityType: AUDIT_ENTITY_TYPES.LEAVE_REQUEST,
      entityId: request.id,
      payload: { startDate: request.startDate, endDate: request.endDate },
      meta,
    })
    await recordAuditEvent({
      action: AUDIT_ACTIONS.LEAVE_REQUESTED,
      entityType: AUDIT_ENTITY_TYPES.LEAVE_REQUEST,
      entityId: request.id,
      organizationId: employee.organizationId,
      branchId: employee.branchId,
      meta,
    })
  }
  return request
}

async function releasePendingAndApplyUsage(input: {
  request: Awaited<ReturnType<typeof findLeaveRequestById>>
  actorUserId: string
  approve: boolean
}) {
  const request = input.request
  if (!request) return
  const year = Number(request.startDate.slice(0, 4))
  const balance = await findLeaveBalance(
    request.organizationId,
    request.employeeId,
    request.leaveTypeId,
    year,
  )
  if (!balance) return

  let pendingDays = balance.pendingDays
  let usedDays = balance.usedDays
  const releaseTx = await insertLeaveBalanceTx({
    organizationId: request.organizationId,
    employeeId: request.employeeId,
    leaveTypeId: request.leaveTypeId,
    leaveBalanceId: balance.id,
    leaveRequestId: request.id,
    type: LEAVE_BALANCE_TX_TYPES.PENDING_RELEASE,
    days: subtractLeaveDays('0.00', request.daysRequested, true),
    balanceAfter: balance.availableDays,
    idempotencyKey: `pending_release:${request.id}`,
    createdBy: input.actorUserId,
  })
  if (releaseTx) {
    pendingDays = subtractLeaveDays(pendingDays, request.daysRequested, true)
  }

  if (input.approve) {
    const usageTx = await insertLeaveBalanceTx({
      organizationId: request.organizationId,
      employeeId: request.employeeId,
      leaveTypeId: request.leaveTypeId,
      leaveBalanceId: balance.id,
      leaveRequestId: request.id,
      type: LEAVE_BALANCE_TX_TYPES.USAGE,
      days: subtractLeaveDays('0.00', request.daysRequested, true),
      balanceAfter: '0.00',
      idempotencyKey: `usage:${request.id}`,
      createdBy: input.actorUserId,
    })
    if (usageTx) {
      usedDays = addLeaveDays(usedDays, request.daysRequested)
    }
  }

  const availableDays = computeAvailable({
    openingDays: balance.openingDays,
    accruedDays: balance.accruedDays,
    adjustedDays: balance.adjustedDays,
    usedDays,
    pendingDays,
  })
  await updateLeaveBalanceOptimistic(balance.id, balance.version, {
    pendingDays,
    usedDays,
    availableDays,
  })
}

export async function approveLeaveRequest(
  ctx: AccessContext,
  id: string,
  body: { notes?: string },
  meta?: RequestMeta,
) {
  const request = await findLeaveRequestById(id)
  if (!request) throw notFound('Leave request was not found.')
  await requireWorkforceOrganization(ctx, request.organizationId)

  const year = Number(request.startDate.slice(0, 4))
  const balance = await findLeaveBalance(
    request.organizationId,
    request.employeeId,
    request.leaveTypeId,
    year,
  )
  if (balance && compareLeaveDays(addLeaveDays(balance.availableDays, request.daysRequested), request.daysRequested) < 0) {
    // available already deducted pending; check pending covers request
  }
  if (balance) {
    const free = addLeaveDays(balance.availableDays, balance.pendingDays)
    if (compareLeaveDays(free, request.daysRequested) < 0) {
      throw conflict('Insufficient leave balance for approval.')
    }
  }

  const updated = await updateLeaveRequest(
    id,
    {
      status: LEAVE_REQUEST_STATUSES.APPROVED,
      reviewedBy: ctx.userId,
      reviewedAt: new Date(),
      reviewNotes: body.notes,
      updatedBy: ctx.userId,
    },
    [LEAVE_REQUEST_STATUSES.SUBMITTED, LEAVE_REQUEST_STATUSES.UNDER_REVIEW],
  )
  if (!updated) throw conflict('Leave request is not awaiting approval.')

  await releasePendingAndApplyUsage({ request: updated, actorUserId: ctx.userId, approve: true })
  await insertLeaveApproval({
    organizationId: updated.organizationId,
    leaveRequestId: updated.id,
    step: 1,
    actorUserId: ctx.userId,
    action: 'APPROVE',
    notes: body.notes,
  })
  await emitWorkforceNotificationIntent({
    organizationId: updated.organizationId,
    employeeId: updated.employeeId,
    kind: 'leave.approved',
    intentKey: `leave.approved:${updated.id}`,
    entityType: AUDIT_ENTITY_TYPES.LEAVE_REQUEST,
    entityId: updated.id,
    meta,
  })
  await publishWorkforceEvent({
    organizationId: updated.organizationId,
    eventKey: `leave.approved:${updated.id}`,
    eventType: 'leave.approved',
    payload: { leaveRequestId: updated.id, employeeId: updated.employeeId },
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.LEAVE_APPROVED,
    entityType: AUDIT_ENTITY_TYPES.LEAVE_REQUEST,
    entityId: updated.id,
    organizationId: updated.organizationId,
    meta,
  })
  return updated
}

export async function rejectLeaveRequest(
  ctx: AccessContext,
  id: string,
  body: { notes?: string },
  meta?: RequestMeta,
) {
  const request = await findLeaveRequestById(id)
  if (!request) throw notFound('Leave request was not found.')
  await requireWorkforceOrganization(ctx, request.organizationId)

  const updated = await updateLeaveRequest(
    id,
    {
      status: LEAVE_REQUEST_STATUSES.REJECTED,
      reviewedBy: ctx.userId,
      reviewedAt: new Date(),
      reviewNotes: body.notes,
      updatedBy: ctx.userId,
    },
    [LEAVE_REQUEST_STATUSES.SUBMITTED, LEAVE_REQUEST_STATUSES.UNDER_REVIEW],
  )
  if (!updated) throw conflict('Leave request is not awaiting approval.')

  await releasePendingAndApplyUsage({ request: updated, actorUserId: ctx.userId, approve: false })
  await insertLeaveApproval({
    organizationId: updated.organizationId,
    leaveRequestId: updated.id,
    step: 1,
    actorUserId: ctx.userId,
    action: 'REJECT',
    notes: body.notes,
  })
  await emitWorkforceNotificationIntent({
    organizationId: updated.organizationId,
    employeeId: updated.employeeId,
    kind: 'leave.rejected',
    intentKey: `leave.rejected:${updated.id}`,
    entityType: AUDIT_ENTITY_TYPES.LEAVE_REQUEST,
    entityId: updated.id,
    meta,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.LEAVE_REJECTED,
    entityType: AUDIT_ENTITY_TYPES.LEAVE_REQUEST,
    entityId: updated.id,
    organizationId: updated.organizationId,
    meta,
  })
  return updated
}

export async function cancelLeaveRequest(
  ctx: AccessContext,
  id: string,
  body: { notes?: string },
  meta?: RequestMeta,
) {
  const request = await findLeaveRequestById(id)
  if (!request) throw notFound('Leave request was not found.')
  await requireWorkforceOrganization(ctx, request.organizationId)
  const self = await loadSelfEmployee(ctx, request.organizationId).catch(() => null)
  const canManage = hasPermission(ctx, PERMISSIONS.LEAVE_CANCEL) || hasPermission(ctx, PERMISSIONS.LEAVE_MANAGE)
  if (!canManage && self?.id !== request.employeeId) {
    throw forbiddenError('You may only cancel your own leave requests.')
  }

  if (request.status === LEAVE_REQUEST_STATUSES.CANCELLED) return request

  const fromStatuses = [
    LEAVE_REQUEST_STATUSES.DRAFT,
    LEAVE_REQUEST_STATUSES.SUBMITTED,
    LEAVE_REQUEST_STATUSES.UNDER_REVIEW,
    LEAVE_REQUEST_STATUSES.APPROVED,
  ]
  const updated = await updateLeaveRequest(
    id,
    {
      status: LEAVE_REQUEST_STATUSES.CANCELLED,
      cancelledAt: new Date(),
      cancelledBy: ctx.userId,
      reviewNotes: body.notes,
      updatedBy: ctx.userId,
    },
    fromStatuses,
  )
  if (!updated) throw conflict('Leave request cannot be cancelled.')

  const year = Number(request.startDate.slice(0, 4))
  const balance = await findLeaveBalance(
    request.organizationId,
    request.employeeId,
    request.leaveTypeId,
    year,
  )
  if (balance) {
    if (
      request.status === LEAVE_REQUEST_STATUSES.SUBMITTED ||
      request.status === LEAVE_REQUEST_STATUSES.UNDER_REVIEW
    ) {
      await releasePendingAndApplyUsage({
        request,
        actorUserId: ctx.userId,
        approve: false,
      })
    } else if (request.status === LEAVE_REQUEST_STATUSES.APPROVED) {
      const reversal = await insertLeaveBalanceTx({
        organizationId: request.organizationId,
        employeeId: request.employeeId,
        leaveTypeId: request.leaveTypeId,
        leaveBalanceId: balance.id,
        leaveRequestId: request.id,
        type: LEAVE_BALANCE_TX_TYPES.REVERSAL,
        days: request.daysRequested,
        balanceAfter: addLeaveDays(balance.availableDays, request.daysRequested),
        idempotencyKey: `reversal:${request.id}`,
        createdBy: ctx.userId,
      })
      if (reversal) {
        const usedDays = subtractLeaveDays(balance.usedDays, request.daysRequested, true)
        const availableDays = computeAvailable({
          openingDays: balance.openingDays,
          accruedDays: balance.accruedDays,
          adjustedDays: balance.adjustedDays,
          usedDays,
          pendingDays: balance.pendingDays,
        })
        await updateLeaveBalanceOptimistic(balance.id, balance.version, {
          usedDays,
          availableDays,
        })
      }
    }
  }

  await insertLeaveApproval({
    organizationId: request.organizationId,
    leaveRequestId: request.id,
    step: 1,
    actorUserId: ctx.userId,
    action: request.status === LEAVE_REQUEST_STATUSES.APPROVED ? 'REVERSE' : 'CANCEL',
    notes: body.notes,
  })
  await emitWorkforceNotificationIntent({
    organizationId: request.organizationId,
    employeeId: request.employeeId,
    kind: 'leave.cancelled',
    intentKey: `leave.cancelled:${request.id}`,
    entityType: AUDIT_ENTITY_TYPES.LEAVE_REQUEST,
    entityId: request.id,
    meta,
  })
  await publishWorkforceEvent({
    organizationId: request.organizationId,
    eventKey: `leave.cancelled:${request.id}`,
    eventType: 'leave.cancelled',
    payload: { leaveRequestId: request.id },
  })
  await recordAuditEvent({
    action:
      request.status === LEAVE_REQUEST_STATUSES.APPROVED
        ? AUDIT_ACTIONS.LEAVE_REVERSED
        : AUDIT_ACTIONS.LEAVE_CANCELLED,
    entityType: AUDIT_ENTITY_TYPES.LEAVE_REQUEST,
    entityId: request.id,
    organizationId: request.organizationId,
    meta,
  })
  return updated
}

export async function listLeaveRequestsService(
  ctx: AccessContext,
  query: {
    organizationId?: string
    employeeId?: string
    leaveTypeId?: string
    status?: string
    fromDate?: string
    toDate?: string
    page: number
    pageSize: number
  },
) {
  const organizationId = await requireWorkforceOrganization(ctx, query.organizationId)
  const self = await loadSelfEmployee(ctx, organizationId).catch(() => null)
  let employeeId = query.employeeId
  if (!hasPermission(ctx, PERMISSIONS.LEAVE_APPROVE) && !hasPermission(ctx, PERMISSIONS.LEAVE_MANAGE)) {
    if (!self) throw forbiddenError('Employee profile required.')
    employeeId = self.id
  }
  return listLeaveRequests({
    organizationId,
    employeeId,
    leaveTypeId: query.leaveTypeId,
    status: query.status,
    branchIds: branchScopeForList(ctx),
    fromDate: query.fromDate,
    toDate: query.toDate,
    skip: parseWorkforcePage(query).skip,
    limit: parseWorkforcePage(query).pageSize,
  })
}

export async function getLeaveRequest(ctx: AccessContext, id: string) {
  const request = await findLeaveRequestById(id)
  if (!request) throw notFound('Leave request was not found.')
  await requireWorkforceOrganization(ctx, request.organizationId)
  const self = await loadSelfEmployee(ctx, request.organizationId).catch(() => null)
  const canManage =
    hasPermission(ctx, PERMISSIONS.LEAVE_APPROVE) || hasPermission(ctx, PERMISSIONS.LEAVE_MANAGE)
  if (!canManage && self?.id !== request.employeeId) {
    throw notFound('Leave request was not found.')
  }
  return request
}
