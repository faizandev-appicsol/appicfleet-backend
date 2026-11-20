import { ENTITY_STATUSES } from '../../constants/roles.js'
import { AppError } from '../../exceptions/AppError.js'
import { ERROR_CODES } from '../../exceptions/errorCodes.js'
import {
  createOrganization,
  findOrganizationById,
  listOrganizations,
  updateOrganization,
  type OrganizationRecord,
} from '../../repositories/organizations/organization.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import {
  notFound,
  toEntityStatus,
  toPublicEntityStatus,
} from '../../utils/httpErrors.js'
import { resolvePagination, toPaginated } from '../../utils/pagination.js'
import type {
  CreateOrganizationBody,
  ListOrganizationsQuery,
  UpdateOrganizationBody,
} from '../../validations/organization.validation.js'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, recordAuditEvent } from '../audit/audit.service.js'
import { hasOrganizationAccess } from '../authorization/authorization.service.js'

export type OrganizationResource = {
  id: string
  name: string
  code: string
  status: 'active' | 'inactive'
  createdAt: string
  updatedAt: string
}

function toResource(organization: OrganizationRecord): OrganizationResource {
  return {
    id: organization.id,
    name: organization.name,
    code: organization.code,
    status: toPublicEntityStatus(organization.status),
    createdAt: organization.createdAt.toISOString(),
    updatedAt: organization.updatedAt.toISOString(),
  }
}

export async function listOrganizationDirectory(ctx: AccessContext, query: ListOrganizationsQuery) {
  const pagination = resolvePagination(query)
  const result = await listOrganizations({
    skip: pagination.skip,
    take: pagination.take,
    search: query.search?.trim() ? query.search.trim() : undefined,
    status: query.status ? toEntityStatus(query.status) : undefined,
    // Tenant scope: organization-bound accounts only ever see their own organization.
    onlyIds: ctx.accessAllOrganizations ? undefined : ctx.organizationId ? [ctx.organizationId] : [],
  })
  return toPaginated(result.items.map(toResource), pagination.page, pagination.limit, result.total)
}

async function loadAccessible(ctx: AccessContext, id: string): Promise<OrganizationRecord> {
  const organization = await findOrganizationById(id)
  // Another tenant's organization is reported as missing so its existence is not revealed.
  if (!organization || !hasOrganizationAccess(ctx, organization.id)) {
    throw notFound('Organization was not found.')
  }
  return organization
}

export async function getOrganization(ctx: AccessContext, id: string): Promise<OrganizationResource> {
  return toResource(await loadAccessible(ctx, id))
}

export async function addOrganization(
  ctx: AccessContext,
  input: CreateOrganizationBody,
  meta: RequestMeta,
): Promise<OrganizationResource> {
  // Creating tenants is a platform operation, not an organization-admin one.
  if (!ctx.accessAllOrganizations) {
    throw new AppError('Only platform administrators can create organizations.', 403, ERROR_CODES.FORBIDDEN)
  }

  const organization = await createOrganization({
    name: input.name.trim(),
    code: input.code,
    status: input.status ? toEntityStatus(input.status) : ENTITY_STATUSES.ACTIVE,
  })

  await recordAuditEvent({
    action: AUDIT_ACTIONS.ORGANIZATION_CREATE,
    entityType: AUDIT_ENTITY_TYPES.ORGANIZATION,
    entityId: organization.id,
    actorUserId: ctx.userId,
    organizationId: organization.id,
    metadata: { code: organization.code, status: organization.status },
    meta,
  })
  return toResource(organization)
}

export async function changeOrganization(
  ctx: AccessContext,
  id: string,
  input: UpdateOrganizationBody,
  meta: RequestMeta,
): Promise<OrganizationResource> {
  const existing = await loadAccessible(ctx, id)

  const status = input.status ? toEntityStatus(input.status) : undefined
  // An organization admin deactivating their own tenant would lock everyone out.
  if (status && status !== existing.status && !ctx.accessAllOrganizations) {
    throw new AppError(
      'Only platform administrators can change an organization status.',
      403,
      ERROR_CODES.FORBIDDEN,
    )
  }

  const updated = await updateOrganization(id, {
    name: input.name?.trim(),
    status,
  })
  if (!updated) throw notFound('Organization was not found.')

  await recordAuditEvent({
    action: AUDIT_ACTIONS.ORGANIZATION_UPDATE,
    entityType: AUDIT_ENTITY_TYPES.ORGANIZATION,
    entityId: updated.id,
    actorUserId: ctx.userId,
    organizationId: updated.id,
    metadata: {
      before: { name: existing.name, status: existing.status },
      after: { name: updated.name, status: updated.status },
    },
    meta,
  })
  return toResource(updated)
}
