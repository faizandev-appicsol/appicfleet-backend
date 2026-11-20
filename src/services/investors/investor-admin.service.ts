import { randomBytes } from 'node:crypto'
import { INVESTOR_INVITE_TTL_MS, INVESTOR_STATUSES } from '../../constants/investors.js'
import { PERMISSIONS } from '../../constants/permissions.js'
import { ENTITY_STATUSES, ROLES, USER_STATUSES } from '../../constants/roles.js'
import { findBranchById } from '../../repositories/branches/branch.repository.js'
import {
  findInvitationByTokenHash,
  findInvestorById,
  findInvestorByUserId,
  generateInvestorInviteToken,
  hashInvestorInviteToken,
  insertInvitation,
  insertInvestor,
  listInvestors,
  markInvitationUsed,
  revokeOpenInvitations,
  updateInvestor,
  type InvestorRecord,
} from '../../repositories/investors/investor.repository.js'
import { findLegalEntityById } from '../../repositories/legal-entities/legal-entity.repository.js'
import { findOrganizationById } from '../../repositories/organizations/organization.repository.js'
import { revokeAllRefreshTokens } from '../../repositories/auth/refresh-token.repository.js'
import {
  createUser,
  findCredentialsByEmail,
  updatePasswordHash,
  updateUserStatus,
} from '../../repositories/users/user.repository.js'
import { findVehicleById } from '../../repositories/vehicles/vehicle.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import { resolvePagination, toPaginated } from '../../utils/pagination.js'
import { conflict, forbiddenError, invalidField, notFound } from '../../utils/httpErrors.js'
import { hashPassword } from '../../lib/password/index.js'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, recordAuditEvent } from '../audit/audit.service.js'
import {
  assertPermission,
  hasOrganizationAccess,
  resolveOrganizationScope,
} from '../authorization/authorization.service.js'
import { toInvestorAdminResource } from './investor.mapper.js'
import { normalizeScopeInput, scopeSummary } from './investor-scope.js'

async function requireOrg(ctx: AccessContext, organizationId?: string) {
  const orgId = resolveOrganizationScope(ctx, organizationId)
  if (!hasOrganizationAccess(ctx, orgId)) throw forbiddenError('You do not have access to this organization.')
  const organization = await findOrganizationById(orgId)
  if (!organization || organization.status !== ENTITY_STATUSES.ACTIVE) {
    throw invalidField('organizationId', 'Organization was not found or is not active.')
  }
  return orgId
}

async function loadInvestorInOrg(ctx: AccessContext, id: string, organizationId?: string) {
  const orgId = await requireOrg(ctx, organizationId)
  const investor = await findInvestorById(id)
  if (!investor || investor.organizationId !== orgId) throw notFound('Investor was not found.')
  return investor
}

async function validateScope(
  organizationId: string,
  scope: ReturnType<typeof normalizeScopeInput>,
) {
  for (const id of scope.legalEntityIds) {
    const entity = await findLegalEntityById(id)
    if (!entity || entity.organizationId !== organizationId) {
      throw invalidField('scope.legalEntityIds', 'Legal entity was not found in this organization.')
    }
  }
  for (const id of scope.branchIds) {
    const branch = await findBranchById(id)
    if (!branch || branch.organizationId !== organizationId) {
      throw invalidField('scope.branchIds', 'Branch was not found in this organization.')
    }
  }
  for (const id of scope.vehicleIds) {
    const vehicle = await findVehicleById(id)
    if (!vehicle || vehicle.organizationId !== organizationId) {
      throw invalidField('scope.vehicleIds', 'Vehicle was not found in this organization.')
    }
  }
}

export async function listInvestorDirectory(
  ctx: AccessContext,
  query: {
    organizationId?: string
    status?: string
    search?: string
    page?: number
    pageSize?: number
    sort?: string
    order?: 'asc' | 'desc'
  },
) {
  assertPermission(ctx, PERMISSIONS.INVESTORS_VIEW)
  const organizationId = await requireOrg(ctx, query.organizationId)
  const pagination = resolvePagination(query)
  const page = await listInvestors({
    organizationId,
    status: query.status?.toUpperCase() as InvestorRecord['status'] | undefined,
    search: query.search,
    skip: pagination.skip,
    take: pagination.take,
    sort: query.sort ?? 'createdAt',
    order: query.order ?? 'desc',
  })
  return toPaginated(page.items.map(toInvestorAdminResource), pagination.page, pagination.limit, page.total)
}

export async function getInvestorAdmin(ctx: AccessContext, id: string, organizationId?: string) {
  assertPermission(ctx, PERMISSIONS.INVESTORS_VIEW)
  return toInvestorAdminResource(await loadInvestorInOrg(ctx, id, organizationId))
}

export async function createInvestor(
  ctx: AccessContext,
  body: {
    organizationId?: string
    displayName: string
    legalName?: string
    contactEmail: string
    phone?: string
    notes?: string
    accessStartsAt?: Date
    accessEndsAt?: Date
    scope?: {
      legalEntityIds?: string[]
      branchIds?: string[]
      vehicleIds?: string[]
      reportKeys?: string[]
    }
  },
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.INVESTORS_MANAGE)
  const organizationId = await requireOrg(ctx, body.organizationId)
  const email = body.contactEmail.trim().toLowerCase()
  const existingUser = await findCredentialsByEmail(email)
  if (existingUser) throw conflict('A user with this email already exists.')

  const scope = normalizeScopeInput(body.scope ?? {})
  await validateScope(organizationId, scope)

  const user = await createUser({
    email,
    name: body.displayName.trim(),
    phone: body.phone,
    role: ROLES.INVESTOR,
    status: USER_STATUSES.INVITED,
    organizationId,
    branchIds: scope.branchIds,
    legalEntityIds: scope.legalEntityIds,
    accessAllBranches: false,
    passwordHash: await hashPassword(randomBytes(32).toString('base64url')),
  })

  const investor = await insertInvestor({
    organizationId,
    userId: user.id,
    displayName: body.displayName.trim(),
    legalName: body.legalName?.trim(),
    contactEmail: email,
    phone: body.phone,
    status: INVESTOR_STATUSES.INVITED,
    accessStartsAt: body.accessStartsAt,
    accessEndsAt: body.accessEndsAt,
    scope,
    notes: body.notes,
    createdBy: ctx.userId,
  })

  await recordAuditEvent({
    action: AUDIT_ACTIONS.INVESTOR_CREATE,
    entityType: AUDIT_ENTITY_TYPES.INVESTOR,
    entityId: investor.id,
    actorUserId: ctx.userId,
    organizationId,
    metadata: { userId: user.id, ...scopeSummary(scope) },
    meta,
  })

  return toInvestorAdminResource(investor)
}

export async function updateInvestorProfile(
  ctx: AccessContext,
  id: string,
  body: {
    displayName?: string
    legalName?: string | null
    phone?: string | null
    notes?: string | null
    accessStartsAt?: Date | null
    accessEndsAt?: Date | null
  },
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.INVESTORS_MANAGE)
  const existing = await loadInvestorInOrg(ctx, id)
  const updated = await updateInvestor(existing.id, {
    displayName: body.displayName?.trim(),
    legalName: body.legalName === null ? null : body.legalName?.trim(),
    phone: body.phone === null ? null : body.phone,
    notes: body.notes === null ? null : body.notes,
    accessStartsAt: body.accessStartsAt,
    accessEndsAt: body.accessEndsAt,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.INVESTOR_UPDATE,
    entityType: AUDIT_ENTITY_TYPES.INVESTOR,
    entityId: existing.id,
    actorUserId: ctx.userId,
    organizationId: existing.organizationId,
    metadata: { fields: Object.keys(body) },
    meta,
  })
  return toInvestorAdminResource(updated!)
}

export async function replaceInvestorAccess(
  ctx: AccessContext,
  id: string,
  body: {
    legalEntityIds?: string[]
    branchIds?: string[]
    vehicleIds?: string[]
    reportKeys?: string[]
    reason?: string
  },
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.INVESTORS_MANAGE_ACCESS)
  const existing = await loadInvestorInOrg(ctx, id)
  const scope = normalizeScopeInput(body)
  await validateScope(existing.organizationId, scope)
  const updated = await updateInvestor(existing.id, { scope })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.INVESTOR_ACCESS_UPDATE,
    entityType: AUDIT_ENTITY_TYPES.INVESTOR,
    entityId: existing.id,
    actorUserId: ctx.userId,
    organizationId: existing.organizationId,
    metadata: {
      reason: body.reason,
      previous: scopeSummary(existing.scope),
      next: scopeSummary(scope),
      previousScope: existing.scope,
      nextScope: scope,
    },
    meta,
  })
  return toInvestorAdminResource(updated!)
}

export async function getInvestorAccess(ctx: AccessContext, id: string) {
  assertPermission(ctx, PERMISSIONS.INVESTORS_VIEW)
  const investor = await loadInvestorInOrg(ctx, id)
  return {
    investorId: investor.id,
    scope: {
      legalEntityIds: investor.scope.legalEntityIds,
      branchIds: investor.scope.branchIds,
      vehicleIds: investor.scope.vehicleIds,
      reportKeys: investor.scope.reportKeys.map((key) => key.toLowerCase()),
    },
    accessPreview: scopeSummary(investor.scope),
  }
}

export async function inviteInvestor(ctx: AccessContext, id: string, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.INVESTORS_INVITE)
  const investor = await loadInvestorInOrg(ctx, id)
  if (investor.status === INVESTOR_STATUSES.REVOKED) {
    throw conflict('A revoked investor cannot be invited.')
  }
  await revokeOpenInvitations(investor.id)
  const token = generateInvestorInviteToken()
  const invitation = await insertInvitation({
    organizationId: investor.organizationId,
    investorId: investor.id,
    userId: investor.userId,
    tokenHash: token.hash,
    expiresAt: new Date(Date.now() + INVESTOR_INVITE_TTL_MS),
    createdBy: ctx.userId,
  })
  await updateInvestor(investor.id, {
    status: INVESTOR_STATUSES.INVITED,
    invitedAt: new Date(),
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.INVESTOR_INVITE,
    entityType: AUDIT_ENTITY_TYPES.INVESTOR_INVITATION,
    entityId: invitation.id,
    actorUserId: ctx.userId,
    organizationId: investor.organizationId,
    metadata: { investorId: investor.id, expiresAt: invitation.expiresAt.toISOString() },
    meta,
  })
  // Raw token returned once for delivery; never logged.
  return {
    investorId: investor.id,
    invitationId: invitation.id,
    expiresAt: invitation.expiresAt.toISOString(),
    token: token.raw,
  }
}

export async function suspendInvestor(ctx: AccessContext, id: string, reason: string | undefined, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.INVESTORS_SUSPEND)
  const investor = await loadInvestorInOrg(ctx, id)
  if (investor.status === INVESTOR_STATUSES.REVOKED) throw conflict('Investor is already revoked.')
  const updated = await updateInvestor(investor.id, {
    status: INVESTOR_STATUSES.SUSPENDED,
    suspendedAt: new Date(),
  })
  await updateUserStatus(investor.userId, USER_STATUSES.SUSPENDED)
  await revokeAllRefreshTokens(investor.userId)
  await recordAuditEvent({
    action: AUDIT_ACTIONS.INVESTOR_SUSPEND,
    entityType: AUDIT_ENTITY_TYPES.INVESTOR,
    entityId: investor.id,
    actorUserId: ctx.userId,
    organizationId: investor.organizationId,
    metadata: { reason },
    meta,
  })
  return toInvestorAdminResource(updated!)
}

export async function revokeInvestor(ctx: AccessContext, id: string, reason: string | undefined, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.INVESTORS_REVOKE)
  const investor = await loadInvestorInOrg(ctx, id)
  const updated = await updateInvestor(investor.id, {
    status: INVESTOR_STATUSES.REVOKED,
    revokedAt: new Date(),
    scope: { legalEntityIds: [], branchIds: [], vehicleIds: [], reportKeys: [] },
  })
  await revokeOpenInvitations(investor.id)
  await updateUserStatus(investor.userId, USER_STATUSES.INACTIVE)
  await revokeAllRefreshTokens(investor.userId)
  await recordAuditEvent({
    action: AUDIT_ACTIONS.INVESTOR_REVOKE,
    entityType: AUDIT_ENTITY_TYPES.INVESTOR,
    entityId: investor.id,
    actorUserId: ctx.userId,
    organizationId: investor.organizationId,
    metadata: { reason },
    meta,
  })
  return toInvestorAdminResource(updated!)
}

export async function activateInvestor(ctx: AccessContext, id: string, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.INVESTORS_MANAGE)
  const investor = await loadInvestorInOrg(ctx, id)
  if (investor.status === INVESTOR_STATUSES.REVOKED) throw conflict('A revoked investor cannot be activated.')
  if (investor.status === INVESTOR_STATUSES.INVITED) {
    throw conflict('An invited investor becomes active when the invitation is accepted.')
  }
  const updated = await updateInvestor(investor.id, {
    status: INVESTOR_STATUSES.ACTIVE,
    activatedAt: new Date(),
    suspendedAt: null,
  })
  await updateUserStatus(investor.userId, USER_STATUSES.ACTIVE)
  await recordAuditEvent({
    action: AUDIT_ACTIONS.INVESTOR_ACTIVATE,
    entityType: AUDIT_ENTITY_TYPES.INVESTOR,
    entityId: investor.id,
    actorUserId: ctx.userId,
    organizationId: investor.organizationId,
    meta,
  })
  return toInvestorAdminResource(updated!)
}

export async function acceptInvestorInvitation(input: {
  token: string
  password: string
  name?: string
}) {
  const invitation = await findInvitationByTokenHash(hashInvestorInviteToken(input.token))
  if (!invitation || invitation.revokedAt) throw notFound('Invitation was not found.')
  if (invitation.usedAt) throw conflict('This invitation has already been used.')
  if (invitation.expiresAt.getTime() <= Date.now()) throw conflict('This invitation has expired.')

  const investor = await findInvestorById(invitation.investorId)
  if (!investor || investor.status === INVESTOR_STATUSES.REVOKED) {
    throw notFound('Invitation was not found.')
  }

  const used = await markInvitationUsed(invitation.id)
  if (!used) throw conflict('This invitation has already been used.')

  await updatePasswordHash(investor.userId, await hashPassword(input.password))
  if (input.name?.trim()) {
    await updateInvestor(investor.id, { displayName: input.name.trim() })
  }
  await updateUserStatus(investor.userId, USER_STATUSES.ACTIVE)
  const updated = await updateInvestor(investor.id, {
    status: INVESTOR_STATUSES.ACTIVE,
    activatedAt: new Date(),
  })

  await recordAuditEvent({
    action: AUDIT_ACTIONS.INVESTOR_ACTIVATE,
    entityType: AUDIT_ENTITY_TYPES.INVESTOR,
    entityId: investor.id,
    actorUserId: investor.userId,
    organizationId: investor.organizationId,
    metadata: { via: 'invitation' },
  })

  return {
    investorId: updated!.id,
    status: 'active',
    email: updated!.contactEmail,
  }
}

export async function getInvestorActivity(ctx: AccessContext, id: string) {
  assertPermission(ctx, PERMISSIONS.INVESTORS_VIEW)
  const investor = await loadInvestorInOrg(ctx, id)
  const { listAuditEventsByEntity } = await import('../../repositories/audit/audit-event.repository.js')
  const items = await listAuditEventsByEntity(AUDIT_ENTITY_TYPES.INVESTOR, investor.id, 50)
  return { investorId: investor.id, items }
}

/** Used by auth login to block suspended/revoked investors. */
export async function assertInvestorMayLogin(userId: string): Promise<InvestorRecord | null> {
  const investor = await findInvestorByUserId(userId)
  return investor
}
