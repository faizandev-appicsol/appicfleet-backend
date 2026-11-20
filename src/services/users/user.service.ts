import { randomBytes } from 'node:crypto'
import { PERMISSIONS } from '../../constants/permissions.js'
import {
  ENTITY_STATUSES,
  normalizeUserStatus,
  toPublicRole,
  toPublicStatus,
  toRole,
  toStatus,
  USER_STATUSES,
  type Role,
  type UserStatus,
} from '../../constants/roles.js'
import { AppError } from '../../exceptions/AppError.js'
import { ERROR_CODES } from '../../exceptions/errorCodes.js'
import { hashPassword } from '../../lib/password/index.js'
import { revokeAllRefreshTokens } from '../../repositories/auth/refresh-token.repository.js'
import { countBranchesInOrganization } from '../../repositories/branches/branch.repository.js'
import { countLegalEntitiesInOrganization } from '../../repositories/legal-entities/legal-entity.repository.js'
import { findOrganizationById } from '../../repositories/organizations/organization.repository.js'
import { findRolesByIds } from '../../repositories/roles/role.repository.js'
import {
  createUser,
  deleteUser,
  findUserById,
  listUsers,
  updateUser,
  updateUserAccess,
  updateUserRoles,
  updateUserStatus,
  type UserListScope,
} from '../../repositories/users/user.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import type { UserRecord, UserResource } from '../../types/user.js'
import { conflict, forbiddenError, invalidField, notFound } from '../../utils/httpErrors.js'
import { resolvePagination, toPaginated } from '../../utils/pagination.js'
import type {
  AssignBranchesBody,
  AssignRolesBody,
  CreateUserBody,
  DeactivateUserBody,
  ListUsersQuery,
  UpdateUserBody,
} from '../../validations/user.validation.js'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, recordAuditEvent } from '../audit/audit.service.js'
import {
  assertBranchAccess,
  assertCanAssignRole,
  assertCanGrantPermissions,
  assertCanManageRole,
  assertLegalEntityAccess,
  assertOrganizationAccess,
  assertOrganizationWideAccess,
  assertPermission,
  hasOrganizationAccess,
  resolveOrganizationScope,
} from '../authorization/authorization.service.js'

function toResource(user: UserRecord): UserResource {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    organizationId: user.organizationId,
    role: toPublicRole(user.role),
    roleIds: user.roleIds,
    status: toPublicStatus(user.status),
    legalEntityIds: user.legalEntityIds,
    branchIds: user.branchIds,
    accessAllBranches: user.accessAllBranches,
    accessAllOrganizations: user.accessAllOrganizations,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  }
}

function requireRole(value: string): Role {
  const role = toRole(value)
  if (!role) {
    throw new AppError('Role is not supported.', 422, ERROR_CODES.VALIDATION_ERROR)
  }
  return role
}

function isOrgWide(ctx: AccessContext): boolean {
  return ctx.accessAllOrganizations || ctx.accessAllBranches
}

/**
 * Tenant and branch visibility of a target account. Organization-bound actors never see other
 * organizations' accounts; branch-limited actors only see accounts sharing a branch (and
 * themselves). Platform accounts without an organization are visible to platform actors only.
 */
function isInScope(ctx: AccessContext, user: UserRecord): boolean {
  const inOrganization = user.organizationId
    ? hasOrganizationAccess(ctx, user.organizationId)
    : ctx.accessAllOrganizations
  if (!inOrganization) return false
  if (isOrgWide(ctx) || user.id === ctx.userId) return true
  return user.branchIds.some((branchId) => ctx.branchIds.includes(branchId))
}

async function loadScopedUser(ctx: AccessContext, id: string): Promise<UserRecord> {
  const user = await findUserById(id)
  // Out-of-scope accounts are reported as missing so their existence is not revealed.
  if (!user || !isInScope(ctx, user)) throw notFound('User was not found.')
  return user
}

function assertNotSelf(ctx: AccessContext, user: UserRecord, action: string): void {
  if (user.id === ctx.userId) {
    throw forbiddenError(`You cannot ${action} your own account.`)
  }
}

export async function listUserDirectory(ctx: AccessContext, query: ListUsersQuery) {
  const pagination = resolvePagination({
    page: query.page,
    limit: query.limit,
    pageSize: query.pageSize,
  })
  const search = query.search?.trim() ? query.search.trim() : undefined

  const scope: UserListScope = {}
  if (ctx.accessAllOrganizations) {
    if (query.organizationId) scope.organizationId = query.organizationId
  } else {
    if (!ctx.organizationId) return toPaginated([], pagination.page, pagination.limit, 0)
    if (query.organizationId) assertOrganizationAccess(ctx, query.organizationId)
    scope.organizationId = ctx.organizationId
  }
  if (!isOrgWide(ctx)) {
    scope.branchIds = [...ctx.branchIds]
    scope.includeUserId = ctx.userId
  }
  if (query.status) {
    const status = toStatus(query.status)
    if (status) scope.status = normalizeUserStatus(status)
  }

  const result = await listUsers({
    skip: pagination.skip,
    take: pagination.take,
    search,
    sort: query.sort ?? 'createdAt',
    order: query.order ?? 'desc',
    scope,
  })

  return toPaginated(result.items.map(toResource), pagination.page, pagination.limit, result.total)
}

export async function getUser(ctx: AccessContext, id: string): Promise<UserResource> {
  return toResource(await loadScopedUser(ctx, id))
}

/** Branch and legal-entity ids must exist inside the organization and be within the actor's own scope. */
async function validateAccessAssignment(
  ctx: AccessContext,
  organizationId: string,
  input: { branchIds: readonly string[]; legalEntityIds: readonly string[] },
  changed: { branchIds: readonly string[]; legalEntityIds: readonly string[] },
): Promise<void> {
  const branchIds = [...new Set(input.branchIds)]
  const legalEntityIds = [...new Set(input.legalEntityIds)]

  if (branchIds.length > 0) {
    const found = await countBranchesInOrganization(organizationId, branchIds)
    if (found !== branchIds.length) {
      throw invalidField('branchIds', 'One or more branches were not found in this organization')
    }
  }
  if (legalEntityIds.length > 0) {
    const found = await countLegalEntitiesInOrganization(organizationId, legalEntityIds)
    if (found !== legalEntityIds.length) {
      throw invalidField(
        'legalEntityIds',
        'One or more legal entities were not found in this organization',
      )
    }
  }

  // An actor can only add or remove access they hold themselves.
  for (const branchId of changed.branchIds) assertBranchAccess(ctx, branchId, organizationId)
  for (const legalEntityId of changed.legalEntityIds) {
    assertLegalEntityAccess(ctx, legalEntityId, organizationId)
  }
}

function symmetricDifference(a: readonly string[], b: readonly string[]): string[] {
  const left = new Set(a)
  const right = new Set(b)
  return [...[...left].filter((id) => !right.has(id)), ...[...right].filter((id) => !left.has(id))]
}

export async function inviteUser(
  ctx: AccessContext,
  input: CreateUserBody,
  meta: RequestMeta,
): Promise<UserResource> {
  const role = requireRole(input.role)
  assertCanAssignRole(ctx, role)

  // The tenant comes from the actor. Only platform-wide actors may choose another organization.
  const organizationId = resolveOrganizationScope(ctx, input.organizationId)
  const organization = await findOrganizationById(organizationId)
  if (!organization || organization.status !== ENTITY_STATUSES.ACTIVE) {
    throw invalidField('organizationId', 'Organization was not found or is not active')
  }

  const branchIds = input.branchIds ?? []
  const legalEntityIds = input.legalEntityIds ?? []
  const accessAllBranches = input.accessAllBranches ?? false
  if (accessAllBranches) assertOrganizationWideAccess(ctx, organizationId)
  await validateAccessAssignment(
    ctx,
    organizationId,
    { branchIds, legalEntityIds },
    { branchIds, legalEntityIds },
  )

  const user = await createUser({
    email: input.email.toLowerCase(),
    name: input.name.trim(),
    phone: input.phone,
    role,
    status: USER_STATUSES.INVITED,
    organizationId,
    branchIds,
    legalEntityIds,
    accessAllBranches,
    // Invited accounts get an unusable random password until activation.
    passwordHash: await hashPassword(randomBytes(32).toString('base64url')),
  })

  await recordAuditEvent({
    action: AUDIT_ACTIONS.USER_CREATE,
    entityType: AUDIT_ENTITY_TYPES.USER,
    entityId: user.id,
    actorUserId: ctx.userId,
    organizationId,
    metadata: { role, branchCount: branchIds.length, accessAllBranches },
    meta,
  })
  return toResource(user)
}

/** Applies the status transition rules and the permission each transition needs. */
function planStatusChange(
  ctx: AccessContext,
  existing: UserRecord,
  requested: UserStatus,
): UserStatus | null {
  const next = normalizeUserStatus(requested)
  if (next === existing.status) return null

  if (next === USER_STATUSES.INVITED) {
    throw invalidField('status', 'An account cannot be moved back to invited')
  }
  if (next === USER_STATUSES.ACTIVE) {
    if (existing.status === USER_STATUSES.INVITED) {
      throw conflict('An invited account becomes active when the invitation is accepted.')
    }
    assertPermission(ctx, PERMISSIONS.USERS_UPDATE)
    return next
  }

  assertPermission(ctx, PERMISSIONS.USERS_DEACTIVATE)
  return next
}

async function applyStatusChange(
  ctx: AccessContext,
  existing: UserRecord,
  next: UserStatus,
  meta: RequestMeta,
): Promise<UserRecord> {
  const updated = await updateUserStatus(existing.id, next)
  if (next !== USER_STATUSES.ACTIVE) {
    // Leaving the active state ends every session immediately.
    await revokeAllRefreshTokens(existing.id)
  }

  await recordAuditEvent({
    action: AUDIT_ACTIONS.USER_STATUS_CHANGE,
    entityType: AUDIT_ENTITY_TYPES.USER,
    entityId: existing.id,
    actorUserId: ctx.userId,
    organizationId: existing.organizationId,
    metadata: { from: existing.status, to: next },
    meta,
  })
  return updated
}

export async function changeUser(
  ctx: AccessContext,
  id: string,
  input: UpdateUserBody,
  meta: RequestMeta,
): Promise<UserResource> {
  const existing = await loadScopedUser(ctx, id)
  assertCanManageRole(ctx, existing.role)

  const role = input.role ? requireRole(input.role) : undefined
  if (role && role !== existing.role) {
    assertNotSelf(ctx, existing, 'change the role of')
    assertCanAssignRole(ctx, role)
  }

  let nextStatus: UserStatus | null = null
  if (input.status) {
    const requested = toStatus(input.status)
    if (!requested) {
      throw new AppError('Status is not supported.', 422, ERROR_CODES.VALIDATION_ERROR)
    }
    nextStatus = planStatusChange(ctx, existing, requested)
    if (nextStatus && nextStatus !== USER_STATUSES.ACTIVE) {
      assertNotSelf(ctx, existing, 'deactivate')
    }
  }

  const profileChanged =
    input.email !== undefined ||
    input.name !== undefined ||
    input.phone !== undefined ||
    (role !== undefined && role !== existing.role)

  let user = existing
  if (profileChanged) {
    user = await updateUser(id, {
      email: input.email?.toLowerCase(),
      name: input.name?.trim(),
      phone: input.phone,
      role,
    })

    await recordAuditEvent({
      action: AUDIT_ACTIONS.USER_UPDATE,
      entityType: AUDIT_ENTITY_TYPES.USER,
      entityId: id,
      actorUserId: ctx.userId,
      organizationId: existing.organizationId,
      // Field names only: personal values are not copied into the audit trail.
      metadata: {
        changedFields: Object.entries(input)
          .filter(([key, value]) => value !== undefined && key !== 'status')
          .map(([key]) => key),
      },
      meta,
    })

    if (role && role !== existing.role) {
      await recordAuditEvent({
        action: AUDIT_ACTIONS.ROLE_ASSIGN,
        entityType: AUDIT_ENTITY_TYPES.USER,
        entityId: id,
        actorUserId: ctx.userId,
        organizationId: existing.organizationId,
        metadata: { from: existing.role, to: role },
        meta,
      })
    }
  }

  if (nextStatus) {
    user = await applyStatusChange(ctx, existing, nextStatus, meta)
  }

  return toResource(user)
}

export async function activateUser(
  ctx: AccessContext,
  id: string,
  meta: RequestMeta,
): Promise<UserResource> {
  const existing = await loadScopedUser(ctx, id)
  assertCanManageRole(ctx, existing.role)

  const next = planStatusChange(ctx, existing, USER_STATUSES.ACTIVE)
  if (!next) return toResource(existing)
  return toResource(await applyStatusChange(ctx, existing, next, meta))
}

export async function deactivateUser(
  ctx: AccessContext,
  id: string,
  input: DeactivateUserBody,
  meta: RequestMeta,
): Promise<UserResource> {
  const existing = await loadScopedUser(ctx, id)
  assertCanManageRole(ctx, existing.role)
  assertNotSelf(ctx, existing, 'deactivate')

  const target = input.status === 'suspended' ? USER_STATUSES.SUSPENDED : USER_STATUSES.INACTIVE
  if (existing.status === USER_STATUSES.INVITED) {
    throw conflict('An invited account has not been activated yet.')
  }
  const next = planStatusChange(ctx, existing, target)
  if (!next) return toResource(existing)
  return toResource(await applyStatusChange(ctx, existing, next, meta))
}

export async function assignUserBranches(
  ctx: AccessContext,
  id: string,
  input: AssignBranchesBody,
  meta: RequestMeta,
): Promise<UserResource> {
  const existing = await loadScopedUser(ctx, id)
  assertCanManageRole(ctx, existing.role)
  assertNotSelf(ctx, existing, 'change the branch access of')

  if (!existing.organizationId) {
    throw invalidField('branchIds', 'This account is not bound to an organization')
  }
  const organizationId = existing.organizationId

  const branchIds = [...new Set(input.branchIds)]
  const legalEntityIds = input.legalEntityIds
    ? [...new Set(input.legalEntityIds)]
    : existing.legalEntityIds
  const accessAllBranches = input.accessAllBranches ?? existing.accessAllBranches
  if (accessAllBranches !== existing.accessAllBranches) {
    assertOrganizationWideAccess(ctx, organizationId)
  }

  await validateAccessAssignment(
    ctx,
    organizationId,
    { branchIds, legalEntityIds },
    {
      branchIds: symmetricDifference(existing.branchIds, branchIds),
      legalEntityIds: symmetricDifference(existing.legalEntityIds, legalEntityIds),
    },
  )

  const user = await updateUserAccess(id, { branchIds, legalEntityIds, accessAllBranches })

  await recordAuditEvent({
    action: AUDIT_ACTIONS.BRANCH_ACCESS_CHANGE,
    entityType: AUDIT_ENTITY_TYPES.USER,
    entityId: id,
    actorUserId: ctx.userId,
    organizationId,
    metadata: {
      before: {
        branchIds: existing.branchIds,
        legalEntityIds: existing.legalEntityIds,
        accessAllBranches: existing.accessAllBranches,
      },
      after: { branchIds, legalEntityIds, accessAllBranches },
    },
    meta,
  })
  return toResource(user)
}

export async function assignUserRoles(
  ctx: AccessContext,
  id: string,
  input: AssignRolesBody,
  meta: RequestMeta,
): Promise<UserResource> {
  const existing = await loadScopedUser(ctx, id)
  assertCanManageRole(ctx, existing.role)
  assertNotSelf(ctx, existing, 'change the roles of')

  const role = input.role ? requireRole(input.role) : undefined
  if (role) assertCanAssignRole(ctx, role)

  let roleIds: string[] | undefined
  if (input.roleIds) {
    if (!existing.organizationId) {
      throw invalidField('roleIds', 'This account is not bound to an organization')
    }
    roleIds = [...new Set(input.roleIds)]
    const roles = await findRolesByIds(roleIds)
    // Only active custom roles of the target's own organization can be attached.
    const valid =
      roles.length === roleIds.length &&
      roles.every(
        (candidate) =>
          !candidate.isSystem &&
          candidate.status === ENTITY_STATUSES.ACTIVE &&
          candidate.organizationId === existing.organizationId,
      )
    if (!valid) {
      throw invalidField('roleIds', 'One or more roles were not found in this organization')
    }
    for (const candidate of roles) assertCanGrantPermissions(ctx, candidate.permissionKeys)
  }

  const user = await updateUserRoles(id, { role, roleIds })

  await recordAuditEvent({
    action: AUDIT_ACTIONS.ROLE_ASSIGN,
    entityType: AUDIT_ENTITY_TYPES.USER,
    entityId: id,
    actorUserId: ctx.userId,
    organizationId: existing.organizationId,
    metadata: {
      from: { role: existing.role, roleIds: existing.roleIds },
      to: { role: role ?? existing.role, roleIds: roleIds ?? existing.roleIds },
    },
    meta,
  })
  return toResource(user)
}

export async function removeUser(
  ctx: AccessContext,
  id: string,
  meta: RequestMeta,
): Promise<void> {
  const existing = await loadScopedUser(ctx, id)
  assertNotSelf(ctx, existing, 'delete')
  assertCanManageRole(ctx, existing.role)

  await revokeAllRefreshTokens(id)
  await deleteUser(id)

  await recordAuditEvent({
    action: AUDIT_ACTIONS.USER_DELETE,
    entityType: AUDIT_ENTITY_TYPES.USER,
    entityId: id,
    actorUserId: ctx.userId,
    organizationId: existing.organizationId,
    metadata: { role: existing.role, status: existing.status },
    meta,
  })
}
