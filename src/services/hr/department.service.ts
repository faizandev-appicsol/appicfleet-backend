import { HR_ENTITY_STATUSES } from '../../constants/hr.js'
import { PERMISSIONS } from '../../constants/permissions.js'
import {
  countEmployeesInDepartment,
  findDepartmentById,
  insertDepartment,
  listDepartments,
  updateDepartment,
} from '../../repositories/hr/hr.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import { conflict, invalidField, notFound } from '../../utils/httpErrors.js'
import { resolvePagination, toPaginated } from '../../utils/pagination.js'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, recordAuditEvent } from '../audit/audit.service.js'
import { assertPermission } from '../authorization/authorization.service.js'
import {
  assertBranchInOrg,
  assertLegalEntityInOrg,
  loadAccessibleEmployee,
  requireHrOrganization,
} from './hr-access.js'
import { toDepartmentResource } from './hr.mapper.js'

export async function listDepartmentDirectory(
  ctx: AccessContext,
  query: {
    organizationId?: string
    legalEntityId?: string
    status?: string
    search?: string
    page?: number
    pageSize?: number
  },
) {
  assertPermission(ctx, PERMISSIONS.HR_DEPARTMENT_VIEW)
  const organizationId = await requireHrOrganization(ctx, query.organizationId)
  const pagination = resolvePagination(query)
  const page = await listDepartments({
    organizationId,
    legalEntityId: query.legalEntityId,
    status: query.status?.toUpperCase() as never,
    search: query.search,
    skip: pagination.skip,
    take: pagination.take,
  })
  return toPaginated(page.items.map(toDepartmentResource), pagination.page, pagination.limit, page.total)
}

export async function getDepartment(ctx: AccessContext, id: string, organizationId?: string) {
  assertPermission(ctx, PERMISSIONS.HR_DEPARTMENT_VIEW)
  const orgId = await requireHrOrganization(ctx, organizationId)
  const department = await findDepartmentById(id)
  if (!department || department.organizationId !== orgId) throw notFound('Department was not found.')
  return toDepartmentResource(department)
}

export async function createDepartment(
  ctx: AccessContext,
  body: {
    organizationId?: string
    legalEntityId: string
    branchId?: string
    name: string
    code: string
    description?: string
    managerEmployeeId?: string
  },
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.HR_DEPARTMENT_MANAGE)
  const organizationId = await requireHrOrganization(ctx, body.organizationId)
  await assertLegalEntityInOrg(body.legalEntityId, organizationId)
  if (body.branchId) await assertBranchInOrg(body.branchId, organizationId)
  if (body.managerEmployeeId) {
    await loadAccessibleEmployee(ctx, body.managerEmployeeId, organizationId)
  }
  try {
    const department = await insertDepartment({
      organizationId,
      legalEntityId: body.legalEntityId,
      branchId: body.branchId,
      name: body.name.trim(),
      code: body.code.trim().toUpperCase(),
      description: body.description?.trim(),
      managerEmployeeId: body.managerEmployeeId,
      status: HR_ENTITY_STATUSES.ACTIVE,
      createdBy: ctx.userId,
    })
    await recordAuditEvent({
      action: AUDIT_ACTIONS.HR_DEPARTMENT_CREATE,
      entityType: AUDIT_ENTITY_TYPES.HR_DEPARTMENT,
      entityId: department.id,
      actorUserId: ctx.userId,
      organizationId,
      metadata: { code: department.code },
      meta,
    })
    return toDepartmentResource(department)
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      throw conflict('A department with this code already exists in the legal entity.')
    }
    throw error
  }
}

export async function patchDepartment(
  ctx: AccessContext,
  id: string,
  body: {
    name?: string
    description?: string | null
    branchId?: string | null
    managerEmployeeId?: string | null
    status?: string
    organizationId?: string
  },
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.HR_DEPARTMENT_MANAGE)
  const orgId = await requireHrOrganization(ctx, body.organizationId)
  const existing = await findDepartmentById(id)
  if (!existing || existing.organizationId !== orgId) throw notFound('Department was not found.')
  if (body.branchId) await assertBranchInOrg(body.branchId, orgId)
  if (body.managerEmployeeId) await loadAccessibleEmployee(ctx, body.managerEmployeeId, orgId)
  if (body.status === 'inactive' || body.status === HR_ENTITY_STATUSES.INACTIVE) {
    // Soft deactivate only — historical employee links remain.
  }
  const updated = await updateDepartment(id, {
    name: body.name?.trim(),
    description: body.description,
    branchId: body.branchId,
    managerEmployeeId: body.managerEmployeeId,
    status: body.status?.toUpperCase() as never,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.HR_DEPARTMENT_UPDATE,
    entityType: AUDIT_ENTITY_TYPES.HR_DEPARTMENT,
    entityId: id,
    actorUserId: ctx.userId,
    organizationId: orgId,
    metadata: { fields: Object.keys(body) },
    meta,
  })
  return toDepartmentResource(updated!)
}

export async function deactivateDepartment(ctx: AccessContext, id: string, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.HR_DEPARTMENT_MANAGE)
  const existing = await findDepartmentById(id)
  if (!existing) throw notFound('Department was not found.')
  await requireHrOrganization(ctx, existing.organizationId)
  const activeCount = await countEmployeesInDepartment(id)
  if (activeCount > 0) {
    // Prefer soft deactivate when employees still reference the department.
  }
  return patchDepartment(ctx, id, { status: HR_ENTITY_STATUSES.INACTIVE }, meta)
}

export async function assertDepartmentAssignable(departmentId: string, organizationId: string) {
  const department = await findDepartmentById(departmentId)
  if (!department || department.organizationId !== organizationId) {
    throw invalidField('departmentId', 'Department was not found in this organization.')
  }
  if (department.status !== HR_ENTITY_STATUSES.ACTIVE) {
    throw invalidField('departmentId', 'Department is not active.')
  }
  return department
}
