export const ROLES = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  DISPATCHER: 'DISPATCHER',
  VIEWER: 'VIEWER',
  USER: 'USER',
} as const

export type Role = (typeof ROLES)[keyof typeof ROLES]

export const USER_STATUSES = {
  ACTIVE: 'ACTIVE',
  INVITED: 'INVITED',
  DISABLED: 'DISABLED',
} as const

export type UserStatus = (typeof USER_STATUSES)[keyof typeof USER_STATUSES]

const PUBLIC_ROLES = {
  admin: ROLES.ADMIN,
  manager: ROLES.MANAGER,
  dispatcher: ROLES.DISPATCHER,
  viewer: ROLES.VIEWER,
  user: ROLES.USER,
} as const

const PUBLIC_STATUSES = {
  active: USER_STATUSES.ACTIVE,
  invited: USER_STATUSES.INVITED,
  disabled: USER_STATUSES.DISABLED,
} as const

export type PublicRole = keyof typeof PUBLIC_ROLES
export type PublicStatus = keyof typeof PUBLIC_STATUSES

export function isPublicRole(value: string): value is PublicRole {
  return value in PUBLIC_ROLES
}

export function isPublicStatus(value: string): value is PublicStatus {
  return value in PUBLIC_STATUSES
}

export function toRole(value: string): Role | null {
  return isPublicRole(value) ? PUBLIC_ROLES[value] : null
}

export function toStatus(value: string): UserStatus | null {
  return isPublicStatus(value) ? PUBLIC_STATUSES[value] : null
}

export function isRole(value: string): value is Role {
  return Object.values(ROLES).some((role) => role === value)
}

export function isUserStatus(value: string): value is UserStatus {
  return Object.values(USER_STATUSES).some((status) => status === value)
}

export function toPublicRole(role: Role): PublicRole {
  return role.toLowerCase() as PublicRole
}

export function toPublicStatus(status: UserStatus): PublicStatus {
  return status.toLowerCase() as PublicStatus
}
