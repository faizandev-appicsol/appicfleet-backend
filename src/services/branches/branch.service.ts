import { ENTITY_STATUSES } from '../../constants/roles.js'
import type { IBranchAddress } from '../../interfaces/branch.interface.js'
import {
  createBranch,
  findBranchById,
  listBranches,
  updateBranch,
  type BranchRecord,
} from '../../repositories/branches/branch.repository.js'
import { findLegalEntityById } from '../../repositories/legal-entities/legal-entity.repository.js'
import { findOrganizationById } from '../../repositories/organizations/organization.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import {
  invalidField,
  notFound,
  toEntityStatus,
  toPublicEntityStatus,
} from '../../utils/httpErrors.js'
import { resolvePagination, toPaginated } from '../../utils/pagination.js'
import type {
  CreateBranchBody,
  ListBranchesQuery,
  UpdateBranchBody,
} from '../../validations/branch.validation.js'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, recordAuditEvent } from '../audit/audit.service.js'
import {
  assertOrganizationWideAccess,
  hasBranchAccess,
  hasOrganizationAccess,
  resolveOrganizationScope,
} from '../authorization/authorization.service.js'

export type BranchResource = {
  id: string
  organizationId: string
  legalEntityId: string
  name: string
  code: string
  address?: IBranchAddress
  timezone: string
  status: 'active' | 'inactive'
  createdAt: string
  updatedAt: string
}

function toResource(branch: BranchRecord): BranchResource {
  return {
    id: branch.id,
    organizationId: branch.organizationId,
    legalEntityId: branch.legalEntityId,
    name: branch.name,
    code: branch.code,
    address: branch.address,
    timezone: branch.timezone,
    status: toPublicEntityStatus(branch.status),
    createdAt: branch.createdAt.toISOString(),
    updatedAt: branch.updatedAt.toISOString(),
  }
}

async function loadAccessible(ctx: AccessContext, id: string): Promise<BranchRecord> {
  const branch = await findBranchById(id)
  // Other tenants' or unassigned branches are reported as missing.
  if (
    !branch ||
    !hasOrganizationAccess(ctx, branch.organizationId) ||
    !hasBranchAccess(ctx, branch.id, branch.organizationId)
  ) {
    throw notFound('Branch was not found.')
  }
  return branch
}

/** The legal entity must exist inside the same organization as the branch. */
async function assertLegalEntityInOrganization(
  legalEntityId: string,
  organizationId: string,
): Promise<void> {
  const legalEntity = await findLegalEntityById(legalEntityId)
  if (!legalEntity || legalEntity.organizationId !== organizationId) {
    throw invalidField('legalEntityId', 'Legal entity was not found in this organization')
  }
}

export async function listBranchDirectory(ctx: AccessContext, query: ListBranchesQuery) {
  const organizationId = resolveOrganizationScope(ctx, query.organizationId)
  const pagination = resolvePagination(query)
  const orgWide = ctx.accessAllOrganizations || ctx.accessAllBranches

  const result = await listBranches({
    organizationId,
    skip: pagination.skip,
    take: pagination.take,
    search: query.search?.trim() ? query.search.trim() : undefined,
    status: query.status ? toEntityStatus(query.status) : undefined,
    legalEntityId: query.legalEntityId,
    // Branch isolation: branch-limited accounts only list the branches assigned to them.
    onlyIds: orgWide ? undefined : [...ctx.branchIds],
  })
  return toPaginated(result.items.map(toResource), pagination.page, pagination.limit, result.total)
}

export async function getBranch(ctx: AccessContext, id: string): Promise<BranchResource> {
  return toResource(await loadAccessible(ctx, id))
}

export async function addBranch(
  ctx: AccessContext,
  input: CreateBranchBody,
  meta: RequestMeta,
): Promise<BranchResource> {
  const organizationId = resolveOrganizationScope(ctx, input.organizationId)
  assertOrganizationWideAccess(ctx, organizationId)

  const organization = await findOrganizationById(organizationId)
  if (!organization) throw invalidField('organizationId', 'Organization was not found')
  if (organization.status !== ENTITY_STATUSES.ACTIVE) {
    throw invalidField('organizationId', 'Organization is not active')
  }
  await assertLegalEntityInOrganization(input.legalEntityId, organizationId)

  const branch = await createBranch({
    organizationId,
    legalEntityId: input.legalEntityId,
    name: input.name,
    code: input.code,
    address: input.address,
    timezone: input.timezone,
    status: input.status ? toEntityStatus(input.status) : ENTITY_STATUSES.ACTIVE,
  })

  await recordAuditEvent({
    action: AUDIT_ACTIONS.BRANCH_CREATE,
    entityType: AUDIT_ENTITY_TYPES.BRANCH,
    entityId: branch.id,
    actorUserId: ctx.userId,
    organizationId,
    branchId: branch.id,
    metadata: { code: branch.code, legalEntityId: branch.legalEntityId },
    meta,
  })
  return toResource(branch)
}

export async function changeBranch(
  ctx: AccessContext,
  id: string,
  input: UpdateBranchBody,
  meta: RequestMeta,
): Promise<BranchResource> {
  const existing = await loadAccessible(ctx, id)

  if (input.legalEntityId && input.legalEntityId !== existing.legalEntityId) {
    // Re-parenting a branch is an organization-level change.
    assertOrganizationWideAccess(ctx, existing.organizationId)
    await assertLegalEntityInOrganization(input.legalEntityId, existing.organizationId)
  }

  const updated = await updateBranch(id, existing.organizationId, {
    legalEntityId: input.legalEntityId,
    name: input.name,
    address: input.address,
    timezone: input.timezone,
    status: input.status ? toEntityStatus(input.status) : undefined,
  })
  if (!updated) throw notFound('Branch was not found.')

  await recordAuditEvent({
    action: AUDIT_ACTIONS.BRANCH_UPDATE,
    entityType: AUDIT_ENTITY_TYPES.BRANCH,
    entityId: updated.id,
    actorUserId: ctx.userId,
    organizationId: updated.organizationId,
    branchId: updated.id,
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
