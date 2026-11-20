import { EMPLOYMENT_STATUSES, EMPLOYMENT_TYPES, HR_HISTORY_KINDS } from '../../constants/hr.js'
import { PERMISSIONS } from '../../constants/permissions.js'
import { findUserById } from '../../repositories/users/user.repository.js'
import {
  findEmployeeByUserId,
  insertEmployee,
  insertHistory,
  listDirectReports,
  listEmployees,
  listHistory,
  updateEmployee,
  type EmployeeRecord,
} from '../../repositories/hr/hr.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import { conflict, invalidField, notFound } from '../../utils/httpErrors.js'
import { resolvePagination, toPaginated } from '../../utils/pagination.js'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, recordAuditEvent } from '../audit/audit.service.js'
import {
  assertPermission,
  hasPermission,
} from '../authorization/authorization.service.js'
import { assertDepartmentAssignable } from './department.service.js'
import {
  assertBranchInOrg,
  assertLegalEntityInOrg,
  branchScopeForList,
  loadAccessibleEmployee,
  requireHrOrganization,
} from './hr-access.js'
import { assertValidManagerAssignment } from './hr-hierarchy.js'
import { toEmployeeResource, toHistoryResource } from './hr.mapper.js'
import { assertPositionAssignable } from './position.service.js'

function canViewSensitive(ctx: AccessContext) {
  return hasPermission(ctx, PERMISSIONS.HR_EMPLOYEE_SENSITIVE_VIEW)
}

async function validateAssignments(
  ctx: AccessContext,
  organizationId: string,
  body: {
    legalEntityId?: string
    branchId?: string
    departmentId?: string | null
    positionId?: string | null
    managerEmployeeId?: string | null
    employeeId?: string
  },
) {
  if (body.legalEntityId) await assertLegalEntityInOrg(body.legalEntityId, organizationId)
  if (body.branchId) {
    const branch = await assertBranchInOrg(body.branchId, organizationId)
    if (body.legalEntityId && branch.legalEntityId !== body.legalEntityId) {
      throw invalidField('branchId', 'Branch does not belong to the selected legal entity.')
    }
  }
  if (body.departmentId) await assertDepartmentAssignable(body.departmentId, organizationId)
  if (body.positionId) await assertPositionAssignable(body.positionId, organizationId)
  if (body.managerEmployeeId && body.employeeId) {
    await assertValidManagerAssignment({
      organizationId,
      employeeId: body.employeeId,
      managerEmployeeId: body.managerEmployeeId,
    })
  } else if (body.managerEmployeeId) {
    await loadAccessibleEmployee(ctx, body.managerEmployeeId, organizationId)
  }
}

export async function listEmployeeDirectory(
  ctx: AccessContext,
  query: {
    organizationId?: string
    legalEntityId?: string
    branchId?: string
    departmentId?: string
    positionId?: string
    status?: string
    employmentType?: string
    search?: string
    hireFrom?: Date
    hireTo?: Date
    page?: number
    pageSize?: number
    sort?: string
    order?: 'asc' | 'desc'
  },
) {
  assertPermission(ctx, PERMISSIONS.HR_EMPLOYEE_VIEW)
  const organizationId = await requireHrOrganization(ctx, query.organizationId)
  const pagination = resolvePagination(query)
  let branchIds = branchScopeForList(ctx)
  if (query.branchId) {
    if (branchIds && !branchIds.includes(query.branchId)) {
      return toPaginated([], pagination.page, pagination.limit, 0)
    }
    branchIds = [query.branchId]
  }
  const page = await listEmployees({
    organizationId,
    branchIds,
    legalEntityId: query.legalEntityId,
    departmentId: query.departmentId,
    positionId: query.positionId,
    status: query.status?.toUpperCase() as never,
    employmentType: query.employmentType?.toUpperCase() as never,
    search: query.search,
    hireFrom: query.hireFrom,
    hireTo: query.hireTo,
    skip: pagination.skip,
    take: pagination.take,
    sort: query.sort,
    order: query.order,
  })
  const sensitive = canViewSensitive(ctx)
  return toPaginated(
    page.items.map((row) => toEmployeeResource(row, sensitive)),
    pagination.page,
    pagination.limit,
    page.total,
  )
}

export async function getEmployee(ctx: AccessContext, id: string, organizationId?: string) {
  assertPermission(ctx, PERMISSIONS.HR_EMPLOYEE_VIEW)
  const employee = await loadAccessibleEmployee(ctx, id, organizationId)
  return toEmployeeResource(employee, canViewSensitive(ctx))
}

export async function createEmployee(
  ctx: AccessContext,
  body: {
    organizationId?: string
    legalEntityId: string
    branchId: string
    firstName: string
    middleName?: string
    lastName: string
    preferredName?: string
    dateOfBirth?: Date
    nationality?: string
    personalEmail?: string
    workEmail?: string
    personalPhone?: string
    workPhone?: string
    employmentType?: string
    jobTitle?: string
    departmentId?: string
    positionId?: string
    managerEmployeeId?: string
    hireDate?: Date
    probationStartsAt?: Date
    probationEndsAt?: Date
    employmentStartsAt?: Date
    notes?: string
  },
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.HR_EMPLOYEE_CREATE)
  const organizationId = await requireHrOrganization(ctx, body.organizationId)
  await validateAssignments(ctx, organizationId, body)

  if (body.dateOfBirth || body.nationality || body.personalEmail || body.personalPhone) {
    assertPermission(ctx, PERMISSIONS.HR_EMPLOYEE_SENSITIVE_UPDATE)
  }

  const employee = await insertEmployee({
    organizationId,
    legalEntityId: body.legalEntityId,
    branchId: body.branchId,
    firstName: body.firstName.trim(),
    middleName: body.middleName?.trim(),
    lastName: body.lastName.trim(),
    preferredName: body.preferredName?.trim(),
    dateOfBirth: body.dateOfBirth,
    nationality: body.nationality?.toUpperCase(),
    personalEmail: body.personalEmail?.trim().toLowerCase(),
    workEmail: body.workEmail?.trim().toLowerCase(),
    personalPhone: body.personalPhone?.trim(),
    workPhone: body.workPhone?.trim(),
    status: EMPLOYMENT_STATUSES.ACTIVE,
    employmentType: (body.employmentType?.toUpperCase() as never) ?? EMPLOYMENT_TYPES.FULL_TIME,
    jobTitle: body.jobTitle?.trim(),
    departmentId: body.departmentId,
    positionId: body.positionId,
    managerEmployeeId: body.managerEmployeeId,
    hireDate: body.hireDate,
    probationStartsAt: body.probationStartsAt,
    probationEndsAt: body.probationEndsAt,
    employmentStartsAt: body.employmentStartsAt ?? body.hireDate,
    notes: body.notes?.trim(),
    createdBy: ctx.userId,
  })

  await insertHistory({
    organizationId,
    employeeId: employee.id,
    kind: HR_HISTORY_KINDS.STATUS,
    previousValue: null,
    newValue: EMPLOYMENT_STATUSES.ACTIVE,
    effectiveAt: body.hireDate ?? new Date(),
    reason: 'Employee created',
    changedBy: ctx.userId,
  })

  await recordAuditEvent({
    action: AUDIT_ACTIONS.HR_EMPLOYEE_CREATE,
    entityType: AUDIT_ENTITY_TYPES.EMPLOYEE,
    entityId: employee.id,
    actorUserId: ctx.userId,
    organizationId,
    branchId: employee.branchId,
    metadata: { employeeNumber: employee.employeeNumber },
    meta,
  })

  return toEmployeeResource(employee, canViewSensitive(ctx))
}

export async function updateEmployeeProfile(
  ctx: AccessContext,
  id: string,
  body: Record<string, unknown>,
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.HR_EMPLOYEE_UPDATE)
  const existing = await loadAccessibleEmployee(ctx, id)
  const sensitiveKeys = ['dateOfBirth', 'nationality', 'personalEmail', 'personalPhone', 'addresses', 'emergencyContacts']
  if (sensitiveKeys.some((key) => body[key] !== undefined)) {
    assertPermission(ctx, PERMISSIONS.HR_EMPLOYEE_SENSITIVE_UPDATE)
  }

  await validateAssignments(ctx, existing.organizationId, {
    legalEntityId: (body.legalEntityId as string | undefined) ?? existing.legalEntityId,
    branchId: (body.branchId as string | undefined) ?? existing.branchId,
    departmentId: body.departmentId as string | null | undefined,
    positionId: body.positionId as string | null | undefined,
    managerEmployeeId: body.managerEmployeeId as string | null | undefined,
    employeeId: existing.id,
  })

  const previousManager = existing.managerEmployeeId
  const updated = await updateEmployee(existing.id, {
    firstName: body.firstName as string | undefined,
    middleName: body.middleName as string | null | undefined,
    lastName: body.lastName as string | undefined,
    preferredName: body.preferredName as string | null | undefined,
    dateOfBirth: body.dateOfBirth as Date | null | undefined,
    nationality: body.nationality
      ? String(body.nationality).toUpperCase()
      : (body.nationality as null | undefined),
    personalEmail: body.personalEmail as string | null | undefined,
    workEmail: body.workEmail as string | null | undefined,
    personalPhone: body.personalPhone as string | null | undefined,
    workPhone: body.workPhone as string | null | undefined,
    employmentType: body.employmentType
      ? (String(body.employmentType).toUpperCase() as never)
      : undefined,
    jobTitle: body.jobTitle as string | null | undefined,
    departmentId: body.departmentId as string | null | undefined,
    positionId: body.positionId as string | null | undefined,
    managerEmployeeId: body.managerEmployeeId as string | null | undefined,
    hireDate: body.hireDate as Date | null | undefined,
    probationStartsAt: body.probationStartsAt as Date | null | undefined,
    probationEndsAt: body.probationEndsAt as Date | null | undefined,
    employmentStartsAt: body.employmentStartsAt as Date | null | undefined,
    employmentEndsAt: body.employmentEndsAt as Date | null | undefined,
    notes: body.notes as string | null | undefined,
    addresses: body.addresses as never,
    emergencyContacts: body.emergencyContacts as never,
    updatedBy: ctx.userId,
  })

  if (
    body.managerEmployeeId !== undefined &&
    previousManager !== (updated?.managerEmployeeId ?? undefined)
  ) {
    await insertHistory({
      organizationId: existing.organizationId,
      employeeId: existing.id,
      kind: HR_HISTORY_KINDS.MANAGER,
      previousValue: previousManager ?? null,
      newValue: updated?.managerEmployeeId ?? null,
      effectiveAt: new Date(),
      reason: (body.reason as string | undefined) ?? undefined,
      changedBy: ctx.userId,
    })
    await recordAuditEvent({
      action: AUDIT_ACTIONS.HR_EMPLOYEE_MANAGER_CHANGE,
      entityType: AUDIT_ENTITY_TYPES.EMPLOYEE,
      entityId: existing.id,
      actorUserId: ctx.userId,
      organizationId: existing.organizationId,
      metadata: { previousManager, nextManager: updated?.managerEmployeeId ?? null },
      meta,
    })
  }

  if (body.departmentId !== undefined && existing.departmentId !== updated?.departmentId) {
    await insertHistory({
      organizationId: existing.organizationId,
      employeeId: existing.id,
      kind: HR_HISTORY_KINDS.DEPARTMENT,
      previousValue: existing.departmentId ?? null,
      newValue: updated?.departmentId ?? null,
      effectiveAt: new Date(),
      changedBy: ctx.userId,
    })
  }
  if (body.positionId !== undefined && existing.positionId !== updated?.positionId) {
    await insertHistory({
      organizationId: existing.organizationId,
      employeeId: existing.id,
      kind: HR_HISTORY_KINDS.POSITION,
      previousValue: existing.positionId ?? null,
      newValue: updated?.positionId ?? null,
      effectiveAt: new Date(),
      changedBy: ctx.userId,
    })
  }

  await recordAuditEvent({
    action: AUDIT_ACTIONS.HR_EMPLOYEE_UPDATE,
    entityType: AUDIT_ENTITY_TYPES.EMPLOYEE,
    entityId: existing.id,
    actorUserId: ctx.userId,
    organizationId: existing.organizationId,
    metadata: { fields: Object.keys(body) },
    meta,
  })

  return toEmployeeResource(updated!, canViewSensitive(ctx))
}

export async function changeEmployeeStatus(
  ctx: AccessContext,
  id: string,
  body: { status: string; effectiveAt?: Date; reason?: string },
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.HR_EMPLOYEE_STATUS_MANAGE)
  const existing = await loadAccessibleEmployee(ctx, id)
  const next = body.status.toUpperCase()
  if (!Object.values(EMPLOYMENT_STATUSES).includes(next as never)) {
    throw invalidField('status', 'Invalid employment status.')
  }
  if (existing.status === next) return toEmployeeResource(existing, canViewSensitive(ctx))

  const updated = await updateEmployee(existing.id, {
    status: next as never,
    employmentEndsAt:
      next === EMPLOYMENT_STATUSES.TERMINATED ||
      next === EMPLOYMENT_STATUSES.RESIGNED ||
      next === EMPLOYMENT_STATUSES.RETIRED
        ? body.effectiveAt ?? new Date()
        : undefined,
    updatedBy: ctx.userId,
  })
  await insertHistory({
    organizationId: existing.organizationId,
    employeeId: existing.id,
    kind: HR_HISTORY_KINDS.STATUS,
    previousValue: existing.status,
    newValue: next,
    effectiveAt: body.effectiveAt ?? new Date(),
    reason: body.reason,
    changedBy: ctx.userId,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.HR_EMPLOYEE_STATUS_CHANGE,
    entityType: AUDIT_ENTITY_TYPES.EMPLOYEE,
    entityId: existing.id,
    actorUserId: ctx.userId,
    organizationId: existing.organizationId,
    metadata: { previous: existing.status, next, reason: body.reason },
    meta,
  })
  return toEmployeeResource(updated!, canViewSensitive(ctx))
}

export async function transferEmployee(
  ctx: AccessContext,
  id: string,
  body: {
    legalEntityId: string
    branchId: string
    departmentId?: string | null
    positionId?: string | null
    managerEmployeeId?: string | null
    effectiveAt?: Date
    reason?: string
  },
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.HR_EMPLOYEE_TRANSFER_MANAGE)
  const existing = await loadAccessibleEmployee(ctx, id)
  await validateAssignments(ctx, existing.organizationId, {
    ...body,
    employeeId: existing.id,
  })

  const updated = await updateEmployee(existing.id, {
    legalEntityId: body.legalEntityId,
    branchId: body.branchId,
    departmentId: body.departmentId,
    positionId: body.positionId,
    managerEmployeeId: body.managerEmployeeId,
    updatedBy: ctx.userId,
  })

  await insertHistory({
    organizationId: existing.organizationId,
    employeeId: existing.id,
    kind: HR_HISTORY_KINDS.TRANSFER,
    previousValue: {
      legalEntityId: existing.legalEntityId,
      branchId: existing.branchId,
      departmentId: existing.departmentId ?? null,
      positionId: existing.positionId ?? null,
    },
    newValue: {
      legalEntityId: body.legalEntityId,
      branchId: body.branchId,
      departmentId: body.departmentId ?? null,
      positionId: body.positionId ?? null,
    },
    effectiveAt: body.effectiveAt ?? new Date(),
    reason: body.reason,
    changedBy: ctx.userId,
  })

  await recordAuditEvent({
    action: AUDIT_ACTIONS.HR_EMPLOYEE_TRANSFER,
    entityType: AUDIT_ENTITY_TYPES.EMPLOYEE,
    entityId: existing.id,
    actorUserId: ctx.userId,
    organizationId: existing.organizationId,
    branchId: body.branchId,
    metadata: {
      previousBranchId: existing.branchId,
      nextBranchId: body.branchId,
      reason: body.reason,
    },
    meta,
  })

  return toEmployeeResource(updated!, canViewSensitive(ctx))
}

export async function linkEmployeeUser(
  ctx: AccessContext,
  id: string,
  userId: string,
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.HR_EMPLOYEE_UPDATE)
  const existing = await loadAccessibleEmployee(ctx, id)
  if (existing.userId) throw conflict('Employee is already linked to a user account.')
  const user = await findUserById(userId)
  if (!user || !user.organizationId || user.organizationId !== existing.organizationId) {
    throw invalidField('userId', 'User was not found in this organization.')
  }
  const other = await findEmployeeByUserId(existing.organizationId, userId)
  if (other) throw conflict('This user is already linked to another employee.')

  const updated = await updateEmployee(existing.id, { userId, updatedBy: ctx.userId })
  await insertHistory({
    organizationId: existing.organizationId,
    employeeId: existing.id,
    kind: HR_HISTORY_KINDS.USER_LINK,
    previousValue: null,
    newValue: userId,
    effectiveAt: new Date(),
    changedBy: ctx.userId,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.HR_EMPLOYEE_USER_LINK,
    entityType: AUDIT_ENTITY_TYPES.EMPLOYEE,
    entityId: existing.id,
    actorUserId: ctx.userId,
    organizationId: existing.organizationId,
    metadata: { userId },
    meta,
  })
  return toEmployeeResource(updated!, canViewSensitive(ctx))
}

export async function unlinkEmployeeUser(ctx: AccessContext, id: string, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.HR_EMPLOYEE_UPDATE)
  const existing = await loadAccessibleEmployee(ctx, id)
  if (!existing.userId) return toEmployeeResource(existing, canViewSensitive(ctx))
  const previous = existing.userId
  const updated = await updateEmployee(existing.id, { userId: null, updatedBy: ctx.userId })
  await insertHistory({
    organizationId: existing.organizationId,
    employeeId: existing.id,
    kind: HR_HISTORY_KINDS.USER_UNLINK,
    previousValue: previous,
    newValue: null,
    effectiveAt: new Date(),
    changedBy: ctx.userId,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.HR_EMPLOYEE_USER_UNLINK,
    entityType: AUDIT_ENTITY_TYPES.EMPLOYEE,
    entityId: existing.id,
    actorUserId: ctx.userId,
    organizationId: existing.organizationId,
    metadata: { userId: previous },
    meta,
  })
  return toEmployeeResource(updated!, canViewSensitive(ctx))
}

export async function getEmployeeHistory(ctx: AccessContext, id: string, query: { page?: number; pageSize?: number }) {
  assertPermission(ctx, PERMISSIONS.HR_EMPLOYEE_VIEW)
  const employee = await loadAccessibleEmployee(ctx, id)
  const pagination = resolvePagination(query)
  const page = await listHistory({
    organizationId: employee.organizationId,
    employeeId: employee.id,
    skip: pagination.skip,
    take: pagination.take,
  })
  return toPaginated(page.items.map(toHistoryResource), pagination.page, pagination.limit, page.total)
}

export async function getDirectReports(ctx: AccessContext, id: string) {
  assertPermission(ctx, PERMISSIONS.HR_EMPLOYEE_VIEW)
  const employee = await loadAccessibleEmployee(ctx, id)
  const items = await listDirectReports(employee.organizationId, employee.id)
  const sensitive = canViewSensitive(ctx)
  return { items: items.map((row) => toEmployeeResource(row, sensitive)) }
}

export async function deactivateEmployee(ctx: AccessContext, id: string, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.HR_EMPLOYEE_DELETE)
  return changeEmployeeStatus(
    ctx,
    id,
    { status: EMPLOYMENT_STATUSES.TERMINATED, reason: 'Deactivated via HR' },
    meta,
  )
}

export type { EmployeeRecord }
