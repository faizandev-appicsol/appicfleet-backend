import {
  ALL_PERMISSIONS,
  expandPermission,
  isPermission,
  type Permission,
  type PermissionInput,
} from '../../constants/permissions.js'
import {
  ENTITY_STATUSES,
  ROLES,
  SYSTEM_ROLE_PERMISSIONS,
  toSystemRoleCode,
  USER_STATUSES,
  type Role,
} from '../../constants/roles.js'
import { AppError } from '../../exceptions/AppError.js'
import { ERROR_CODES } from '../../exceptions/errorCodes.js'
import { findOrganizationById } from '../../repositories/organizations/organization.repository.js'
import { findRolesByIds, type RoleRecord } from '../../repositories/roles/role.repository.js'
import { findUserById } from '../../repositories/users/user.repository.js'
import type { AccessContext, RecordAccessTarget } from '../../types/access.js'
import type { UserRecord } from '../../types/user.js'

const FORBIDDEN_MESSAGE = 'You do not have permission to do that.'

function forbidden(message = FORBIDDEN_MESSAGE): AppError {
  return new AppError(message, 403, ERROR_CODES.FORBIDDEN)
}

/**
 * Pure builder for an access context. Default deny:
 * - non-active accounts hold no permissions;
 * - accounts without an organization hold none unless they have platform-wide access;
 * - a SUPER_ADMIN role without the accessAllOrganizations flag holds none;
 * - custom roles only count when they are active and either system-wide or from the user's own org.
 */
export function buildAccessContext(user: UserRecord, customRoles: readonly RoleRecord[]): AccessContext {
  const permissions = new Set<string>()
  const roleCodes: string[] = [toSystemRoleCode(user.role)]

  const eligible =
    user.status === USER_STATUSES.ACTIVE &&
    (user.accessAllOrganizations || user.organizationId !== null) &&
    (user.role !== ROLES.SUPER_ADMIN || user.accessAllOrganizations)

  const usableRoles = customRoles.filter(
    (role) =>
      role.status === ENTITY_STATUSES.ACTIVE &&
      (role.organizationId === null || role.organizationId === user.organizationId),
  )
  for (const role of usableRoles) {
    if (!roleCodes.includes(role.code)) roleCodes.push(role.code)
  }

  if (eligible) {
    if (user.accessAllOrganizations) {
      for (const key of ALL_PERMISSIONS) permissions.add(key)
    } else {
      for (const key of SYSTEM_ROLE_PERMISSIONS[user.role] ?? []) permissions.add(key)
      for (const role of usableRoles) {
        for (const key of role.permissionKeys) {
          if (isPermission(key)) permissions.add(key)
        }
      }
    }
  }

  return {
    userId: user.id,
    organizationId: user.organizationId,
    permissions,
    roleCodes,
    branchIds: user.branchIds,
    legalEntityIds: user.legalEntityIds,
    accessAllBranches: user.accessAllBranches,
    accessAllOrganizations: user.accessAllOrganizations,
    status: user.status,
  }
}

/**
 * Loads the access context for an already-loaded user. Denies when the user's organization is
 * missing or inactive (platform-wide accounts are exempt).
 */
export async function loadAccessContextForUser(user: UserRecord): Promise<AccessContext> {
  if (!user.accessAllOrganizations && user.organizationId) {
    const organization = await findOrganizationById(user.organizationId)
    if (!organization || organization.status !== ENTITY_STATUSES.ACTIVE) {
      throw new AppError('This organization is not active.', 403, ERROR_CODES.ACCOUNT_INACTIVE)
    }
  }

  const customRoles = user.roleIds.length > 0 ? await findRolesByIds(user.roleIds) : []
  return buildAccessContext(user, customRoles)
}

export async function loadAccessContext(userId: string): Promise<AccessContext> {
  const user = await findUserById(userId)
  if (!user) throw new AppError('Authentication is required.', 401, ERROR_CODES.UNAUTHENTICATED)
  return loadAccessContextForUser(user)
}

function isActive(ctx: AccessContext): boolean {
  return ctx.status === USER_STATUSES.ACTIVE
}

/** True only when every key the permission expands to is held. */
export function hasPermission(ctx: AccessContext, permission: PermissionInput): boolean {
  if (!isActive(ctx)) return false
  return expandPermission(permission).every((key) => ctx.permissions.has(key))
}

export function hasOrganizationAccess(ctx: AccessContext, organizationId: string): boolean {
  if (!isActive(ctx) || !organizationId) return false
  if (ctx.accessAllOrganizations) return true
  return ctx.organizationId !== null && ctx.organizationId === organizationId
}

/**
 * Scope check shared by legal entities and branches.
 * - Platform-wide accounts: always.
 * - Organization-wide accounts (accessAllBranches): only inside their own organization, so
 *   `organizationId` MUST be supplied; without it this path denies.
 * - Everyone else: only ids explicitly assigned to them (and inside organizationId when supplied).
 */
function hasScopedAccess(
  ctx: AccessContext,
  id: string,
  assigned: readonly string[],
  organizationId: string | undefined,
): boolean {
  if (!isActive(ctx) || !id) return false
  if (ctx.accessAllOrganizations) return true
  if (organizationId !== undefined && !hasOrganizationAccess(ctx, organizationId)) return false
  if (assigned.includes(id)) return true
  return ctx.accessAllBranches && organizationId !== undefined
}

export function hasLegalEntityAccess(
  ctx: AccessContext,
  legalEntityId: string,
  organizationId?: string,
): boolean {
  return hasScopedAccess(ctx, legalEntityId, ctx.legalEntityIds, organizationId)
}

export function hasBranchAccess(
  ctx: AccessContext,
  branchId: string,
  organizationId?: string,
): boolean {
  return hasScopedAccess(ctx, branchId, ctx.branchIds, organizationId)
}

/** Platform-wide, or organization-wide inside this organization. */
export function hasOrganizationWideAccess(ctx: AccessContext, organizationId: string): boolean {
  if (!hasOrganizationAccess(ctx, organizationId)) return false
  return ctx.accessAllOrganizations || ctx.accessAllBranches
}

export function assertPermission(ctx: AccessContext, permission: PermissionInput): void {
  if (!hasPermission(ctx, permission)) throw forbidden()
}

export function assertOrganizationAccess(ctx: AccessContext, organizationId: string): void {
  if (!hasOrganizationAccess(ctx, organizationId)) {
    throw forbidden('You do not have access to this organization.')
  }
}

export function assertOrganizationWideAccess(ctx: AccessContext, organizationId: string): void {
  if (!hasOrganizationWideAccess(ctx, organizationId)) {
    throw forbidden('This action needs organization-wide access.')
  }
}

export function assertLegalEntityAccess(
  ctx: AccessContext,
  legalEntityId: string,
  organizationId?: string,
): void {
  if (!hasLegalEntityAccess(ctx, legalEntityId, organizationId)) {
    throw forbidden('You do not have access to this legal entity.')
  }
}

export function assertBranchAccess(
  ctx: AccessContext,
  branchId: string,
  organizationId?: string,
): void {
  if (!hasBranchAccess(ctx, branchId, organizationId)) {
    throw forbidden('You do not have access to this branch.')
  }
}

/** Permission, then organization, then legal entity and branch when the record has them. */
export function assertRecordAccess(ctx: AccessContext, target: RecordAccessTarget): void {
  assertPermission(ctx, target.permission)
  assertOrganizationAccess(ctx, target.organizationId)
  if (target.legalEntityId) {
    assertLegalEntityAccess(ctx, target.legalEntityId, target.organizationId)
  }
  if (target.branchId) {
    assertBranchAccess(ctx, target.branchId, target.organizationId)
  }
}

/**
 * Picks the organization a request acts on. Organization-bound accounts always act on their own;
 * naming a different one is forbidden. Platform-wide accounts must name one.
 */
export function resolveOrganizationScope(ctx: AccessContext, requested?: string): string {
  if (requested) {
    assertOrganizationAccess(ctx, requested)
    return requested
  }
  if (ctx.organizationId) return ctx.organizationId
  throw new AppError('An organization is required.', 422, ERROR_CODES.VALIDATION_ERROR, {
    fieldErrors: { organizationId: ['Select an organization'] },
  })
}

/**
 * Privilege-escalation guard: an actor may only hand out permissions they hold themselves.
 */
export function assertCanGrantPermissions(
  ctx: AccessContext,
  permissions: readonly string[],
): void {
  const missing = permissions.filter((key) => !ctx.permissions.has(key))
  if (missing.length > 0) {
    throw forbidden('You cannot grant permissions that you do not hold.')
  }
}

/** Whether the actor may create or assign accounts holding this system role. */
export function assertCanAssignRole(ctx: AccessContext, role: Role): void {
  // Platform operators are provisioned out of band (seed / database), never through the API.
  if (role === ROLES.SUPER_ADMIN) {
    throw forbidden('This role cannot be assigned through the API.')
  }
  assertCanGrantPermissions(ctx, SYSTEM_ROLE_PERMISSIONS[role] ?? [])
}

/** Whether the actor may modify an account that currently holds this system role. */
export function assertCanManageRole(ctx: AccessContext, role: Role): void {
  if (role === ROLES.SUPER_ADMIN) {
    if (!ctx.accessAllOrganizations) throw forbidden('You do not have permission to manage this account.')
    return
  }
  const missing = (SYSTEM_ROLE_PERMISSIONS[role] ?? []).filter((key: Permission) => !ctx.permissions.has(key))
  if (missing.length > 0) throw forbidden('You do not have permission to manage this account.')
}
