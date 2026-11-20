import { PERMISSION_CATALOG } from '../../constants/permissions.js'
import { isSystemRoleCode, SYSTEM_ROLE_CODES } from '../../constants/roles.js'
import { AppError } from '../../exceptions/AppError.js'
import { ERROR_CODES } from '../../exceptions/errorCodes.js'
import {
  createRole,
  findRoleById,
  listRoles,
  updateCustomRolePermissions,
  type RoleRecord,
} from '../../repositories/roles/role.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import { conflict, notFound, toPublicEntityStatus } from '../../utils/httpErrors.js'
import type {
  AssignPermissionsBody,
  CreateRoleBody,
  ListRolesQuery,
} from '../../validations/role.validation.js'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, recordAuditEvent } from '../audit/audit.service.js'
import {
  assertCanGrantPermissions,
  assertOrganizationAccess,
  hasOrganizationAccess,
  resolveOrganizationScope,
} from '../authorization/authorization.service.js'

export type RoleResource = {
  id: string
  organizationId: string | null
  code: string
  name: string
  description?: string
  permissionKeys: string[]
  isSystem: boolean
  status: 'active' | 'inactive'
}

function toResource(role: RoleRecord): RoleResource {
  return {
    id: role.id,
    organizationId: role.organizationId,
    code: role.code,
    name: role.name,
    description: role.description,
    permissionKeys: role.permissionKeys,
    isSystem: role.isSystem,
    status: toPublicEntityStatus(role.status),
  }
}

/** The platform role is only visible to platform-wide accounts. */
function isVisible(ctx: AccessContext, role: RoleRecord): boolean {
  if (role.organizationId === null) {
    return role.code !== SYSTEM_ROLE_CODES.SUPER_ADMIN || ctx.accessAllOrganizations
  }
  return hasOrganizationAccess(ctx, role.organizationId)
}

async function loadVisible(ctx: AccessContext, id: string): Promise<RoleRecord> {
  const role = await findRoleById(id)
  if (!role || !isVisible(ctx, role)) throw notFound('Role was not found.')
  return role
}

export function listPermissionCatalog() {
  return { items: PERMISSION_CATALOG.map((permission) => ({ ...permission })) }
}

export async function listRoleDirectory(ctx: AccessContext, query: ListRolesQuery) {
  let items: RoleRecord[]
  if (query.organizationId) {
    assertOrganizationAccess(ctx, query.organizationId)
    items = await listRoles({ organizationId: query.organizationId })
  } else if (ctx.organizationId) {
    items = await listRoles({ organizationId: ctx.organizationId })
  } else if (ctx.accessAllOrganizations) {
    items = await listRoles({ organizationId: null, all: true })
  } else {
    items = []
  }

  return { items: items.filter((role) => isVisible(ctx, role)).map(toResource) }
}

export async function getRole(ctx: AccessContext, id: string): Promise<RoleResource> {
  return toResource(await loadVisible(ctx, id))
}

export async function addCustomRole(
  ctx: AccessContext,
  input: CreateRoleBody,
  meta: RequestMeta,
): Promise<RoleResource> {
  const organizationId = resolveOrganizationScope(ctx, input.organizationId)
  assertOrganizationAccess(ctx, organizationId)

  if (isSystemRoleCode(input.code)) {
    throw conflict('This role code is reserved for a system role.')
  }
  assertCanGrantPermissions(ctx, input.permissionKeys)

  const role = await createRole({
    organizationId,
    code: input.code,
    name: input.name,
    description: input.description,
    permissionKeys: input.permissionKeys,
  })

  await recordAuditEvent({
    action: AUDIT_ACTIONS.ROLE_CREATE,
    entityType: AUDIT_ENTITY_TYPES.ROLE,
    entityId: role.id,
    actorUserId: ctx.userId,
    organizationId,
    metadata: { code: role.code, permissionKeys: role.permissionKeys },
    meta,
  })
  return toResource(role)
}

export async function assignRolePermissions(
  ctx: AccessContext,
  id: string,
  input: AssignPermissionsBody,
  meta: RequestMeta,
): Promise<RoleResource> {
  const role = await loadVisible(ctx, id)

  if (role.isSystem || role.organizationId === null) {
    throw new AppError(
      'System role permissions are fixed. Create a custom role instead.',
      403,
      ERROR_CODES.FORBIDDEN,
    )
  }

  const before = new Set(role.permissionKeys)
  const after = new Set(input.permissionKeys)
  const added = [...after].filter((key) => !before.has(key))
  const removed = [...before].filter((key) => !after.has(key))

  // Privilege-escalation guard: only newly granted permissions must be held by the actor.
  assertCanGrantPermissions(ctx, added)

  const updated = await updateCustomRolePermissions(id, input.permissionKeys)
  if (!updated) throw notFound('Role was not found.')

  await recordAuditEvent({
    action: AUDIT_ACTIONS.PERMISSION_CHANGE,
    entityType: AUDIT_ENTITY_TYPES.ROLE,
    entityId: updated.id,
    actorUserId: ctx.userId,
    organizationId: role.organizationId,
    metadata: { code: updated.code, added, removed },
    meta,
  })
  return toResource(updated)
}
