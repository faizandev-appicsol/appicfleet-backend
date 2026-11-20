import { HR_ENTITY_STATUSES } from '../../constants/hr.js'
import { PERMISSIONS } from '../../constants/permissions.js'
import {
  countEmployeesInPosition,
  findPositionById,
  insertPosition,
  listPositions,
  updatePosition,
} from '../../repositories/hr/hr.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import { conflict, invalidField, notFound } from '../../utils/httpErrors.js'
import { resolvePagination, toPaginated } from '../../utils/pagination.js'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, recordAuditEvent } from '../audit/audit.service.js'
import { assertPermission } from '../authorization/authorization.service.js'
import { assertLegalEntityInOrg, requireHrOrganization } from './hr-access.js'
import { assertDepartmentAssignable } from './department.service.js'
import { toPositionResource } from './hr.mapper.js'

export async function listPositionDirectory(
  ctx: AccessContext,
  query: {
    organizationId?: string
    legalEntityId?: string
    departmentId?: string
    status?: string
    search?: string
    page?: number
    pageSize?: number
  },
) {
  assertPermission(ctx, PERMISSIONS.HR_POSITION_VIEW)
  const organizationId = await requireHrOrganization(ctx, query.organizationId)
  const pagination = resolvePagination(query)
  const page = await listPositions({
    organizationId,
    legalEntityId: query.legalEntityId,
    departmentId: query.departmentId,
    status: query.status?.toUpperCase() as never,
    search: query.search,
    skip: pagination.skip,
    take: pagination.take,
  })
  return toPaginated(page.items.map(toPositionResource), pagination.page, pagination.limit, page.total)
}

export async function getPosition(ctx: AccessContext, id: string, organizationId?: string) {
  assertPermission(ctx, PERMISSIONS.HR_POSITION_VIEW)
  const orgId = await requireHrOrganization(ctx, organizationId)
  const position = await findPositionById(id)
  if (!position || position.organizationId !== orgId) throw notFound('Position was not found.')
  return toPositionResource(position)
}

export async function createPosition(
  ctx: AccessContext,
  body: {
    organizationId?: string
    legalEntityId: string
    departmentId?: string
    name: string
    code: string
    description?: string
  },
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.HR_POSITION_MANAGE)
  const organizationId = await requireHrOrganization(ctx, body.organizationId)
  await assertLegalEntityInOrg(body.legalEntityId, organizationId)
  if (body.departmentId) await assertDepartmentAssignable(body.departmentId, organizationId)
  try {
    const position = await insertPosition({
      organizationId,
      legalEntityId: body.legalEntityId,
      departmentId: body.departmentId,
      name: body.name.trim(),
      code: body.code.trim().toUpperCase(),
      description: body.description?.trim(),
      status: HR_ENTITY_STATUSES.ACTIVE,
      createdBy: ctx.userId,
    })
    await recordAuditEvent({
      action: AUDIT_ACTIONS.HR_POSITION_CREATE,
      entityType: AUDIT_ENTITY_TYPES.HR_POSITION,
      entityId: position.id,
      actorUserId: ctx.userId,
      organizationId,
      metadata: { code: position.code },
      meta,
    })
    return toPositionResource(position)
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      throw conflict('A position with this code already exists in the legal entity.')
    }
    throw error
  }
}

export async function patchPosition(
  ctx: AccessContext,
  id: string,
  body: {
    name?: string
    description?: string | null
    departmentId?: string | null
    status?: string
    organizationId?: string
  },
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.HR_POSITION_MANAGE)
  const orgId = await requireHrOrganization(ctx, body.organizationId)
  const existing = await findPositionById(id)
  if (!existing || existing.organizationId !== orgId) throw notFound('Position was not found.')
  if (body.departmentId) await assertDepartmentAssignable(body.departmentId, orgId)
  await countEmployeesInPosition(id)
  const updated = await updatePosition(id, {
    name: body.name?.trim(),
    description: body.description,
    departmentId: body.departmentId,
    status: body.status?.toUpperCase() as never,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.HR_POSITION_UPDATE,
    entityType: AUDIT_ENTITY_TYPES.HR_POSITION,
    entityId: id,
    actorUserId: ctx.userId,
    organizationId: orgId,
    metadata: { fields: Object.keys(body) },
    meta,
  })
  return toPositionResource(updated!)
}

export async function assertPositionAssignable(positionId: string, organizationId: string) {
  const position = await findPositionById(positionId)
  if (!position || position.organizationId !== organizationId) {
    throw invalidField('positionId', 'Position was not found in this organization.')
  }
  if (position.status !== HR_ENTITY_STATUSES.ACTIVE) {
    throw invalidField('positionId', 'Position is not active.')
  }
  return position
}
