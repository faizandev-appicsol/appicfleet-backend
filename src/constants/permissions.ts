import { ROLES, type Role } from './roles.js'

export const PERMISSIONS = {
  USERS_READ: 'users:read',
  USERS_WRITE: 'users:write',
} as const

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

const GRANTS: Record<Role, readonly Permission[]> = {
  [ROLES.ADMIN]: [PERMISSIONS.USERS_READ, PERMISSIONS.USERS_WRITE],
  [ROLES.MANAGER]: [PERMISSIONS.USERS_READ, PERMISSIONS.USERS_WRITE],
  [ROLES.DISPATCHER]: [],
  [ROLES.VIEWER]: [],
  [ROLES.USER]: [],
}

export function roleHasPermission(role: Role, permission: Permission): boolean {
  return GRANTS[role].includes(permission)
}
