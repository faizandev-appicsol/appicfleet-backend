import { ENTITY_STATUSES } from '../../constants/roles.js'
import { findOrganizationById } from '../../repositories/organizations/organization.repository.js'
import {
  createLegalEntity,
  findLegalEntityById,
  listLegalEntities,
  updateLegalEntity,
  type LegalEntityRecord,
} from '../../repositories/legal-entities/legal-entity.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import {
  invalidField,
  notFound,
  toEntityStatus,
  toPublicEntityStatus,
} from '../../utils/httpErrors.js'
import { resolvePagination, toPaginated } from '../../utils/pagination.js'
import type {
  CreateLegalEntityBody,
  ListLegalEntitiesQuery,
  UpdateLegalEntityBody,
} from '../../validations/legal-entity.validation.js'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, recordAuditEvent } from '../audit/audit.service.js'
import {
  assertOrganizationWideAccess,
  hasLegalEntityAccess,
  hasOrganizationAccess,
  resolveOrganizationScope,
} from '../authorization/authorization.service.js'

export type LegalEntityResource = {
  id: string
  organizationId: string
  legalName: string
  displayName: string
  status: 'active' | 'inactive'
  country: string
  taxIdentifier?: string
  defaultCurrency: string
  timezone: string
  createdAt: string
  updatedAt: string
}

function toResource(entity: LegalEntityRecord): LegalEntityResource {
  return {
    id: entity.id,
    organizationId: entity.organizationId,
    legalName: entity.legalName,
    displayName: entity.displayName,
    status: toPublicEntityStatus(entity.status),
    country: entity.country,
    taxIdentifier: entity.taxIdentifier,
    defaultCurrency: entity.defaultCurrency,
    timezone: entity.timezone,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
  }
}

async function loadAccessible(ctx: AccessContext, id: string): Promise<LegalEntityRecord> {
  const entity = await findLegalEntityById(id)
  // Other tenants' or other legal entities' records are reported as missing.
  if (
    !entity ||
    !hasOrganizationAccess(ctx, entity.organizationId) ||
    !hasLegalEntityAccess(ctx, entity.id, entity.organizationId)
  ) {
    throw notFound('Legal entity was not found.')
  }
  return entity
}

export async function listLegalEntityDirectory(ctx: AccessContext, query: ListLegalEntitiesQuery) {
  const organizationId = resolveOrganizationScope(ctx, query.organizationId)
  const pagination = resolvePagination(query)
  const orgWide = ctx.accessAllOrganizations || ctx.accessAllBranches

  const result = await listLegalEntities({
    organizationId,
    skip: pagination.skip,
    take: pagination.take,
    search: query.search?.trim() ? query.search.trim() : undefined,
    status: query.status ? toEntityStatus(query.status) : undefined,
    onlyIds: orgWide ? undefined : [...ctx.legalEntityIds],
  })
  return toPaginated(result.items.map(toResource), pagination.page, pagination.limit, result.total)
}

export async function getLegalEntity(ctx: AccessContext, id: string): Promise<LegalEntityResource> {
  return toResource(await loadAccessible(ctx, id))
}

export async function addLegalEntity(
  ctx: AccessContext,
  input: CreateLegalEntityBody,
  meta: RequestMeta,
): Promise<LegalEntityResource> {
  const organizationId = resolveOrganizationScope(ctx, input.organizationId)
  assertOrganizationWideAccess(ctx, organizationId)

  const organization = await findOrganizationById(organizationId)
  if (!organization) throw invalidField('organizationId', 'Organization was not found')
  if (organization.status !== ENTITY_STATUSES.ACTIVE) {
    throw invalidField('organizationId', 'Organization is not active')
  }

  const entity = await createLegalEntity({
    organizationId,
    legalName: input.legalName,
    displayName: input.displayName,
    status: input.status ? toEntityStatus(input.status) : ENTITY_STATUSES.ACTIVE,
    country: input.country,
    taxIdentifier: input.taxIdentifier,
    defaultCurrency: input.defaultCurrency,
    timezone: input.timezone,
  })

  await recordAuditEvent({
    action: AUDIT_ACTIONS.LEGAL_ENTITY_CREATE,
    entityType: AUDIT_ENTITY_TYPES.LEGAL_ENTITY,
    entityId: entity.id,
    actorUserId: ctx.userId,
    organizationId,
    metadata: { legalName: entity.legalName, country: entity.country },
    meta,
  })
  return toResource(entity)
}

export async function changeLegalEntity(
  ctx: AccessContext,
  id: string,
  input: UpdateLegalEntityBody,
  meta: RequestMeta,
): Promise<LegalEntityResource> {
  const existing = await loadAccessible(ctx, id)

  const updated = await updateLegalEntity(id, existing.organizationId, {
    legalName: input.legalName,
    displayName: input.displayName,
    status: input.status ? toEntityStatus(input.status) : undefined,
    country: input.country,
    taxIdentifier: input.taxIdentifier,
    defaultCurrency: input.defaultCurrency,
    timezone: input.timezone,
  })
  if (!updated) throw notFound('Legal entity was not found.')

  await recordAuditEvent({
    action: AUDIT_ACTIONS.LEGAL_ENTITY_UPDATE,
    entityType: AUDIT_ENTITY_TYPES.LEGAL_ENTITY,
    entityId: updated.id,
    actorUserId: ctx.userId,
    organizationId: updated.organizationId,
    // Field names only: tax identifiers are not copied into the audit trail.
    metadata: {
      changedFields: Object.entries(input)
        .filter(([, value]) => value !== undefined)
        .map(([key]) => key),
      status: updated.status,
    },
    meta,
  })
  return toResource(updated)
}
