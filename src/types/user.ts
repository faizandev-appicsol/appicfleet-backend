import type { PublicRole, PublicStatus, Role, UserStatus } from '../constants/roles.js'

export type UserResource = {
  id: string
  email: string
  name: string
  phone?: string
  organizationId: string | null
  role: PublicRole
  roleIds: string[]
  status: PublicStatus
  legalEntityIds: string[]
  branchIds: string[]
  accessAllBranches: boolean
  accessAllOrganizations: boolean
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
}

export type UserSortField = 'name' | 'email' | 'createdAt'
export type SortOrder = 'asc' | 'desc'

/** Server-side account shape. passwordHash is only present on UserCredentials. */
export type UserRecord = {
  id: string
  email: string
  name: string
  phone?: string
  organizationId: string | null
  role: Role
  roleIds: string[]
  /** Normalized: legacy DISABLED is read as INACTIVE. */
  status: UserStatus
  legalEntityIds: string[]
  branchIds: string[]
  accessAllBranches: boolean
  accessAllOrganizations: boolean
  lastLoginAt: Date | null
  failedLoginAttempts: number
  lockedUntil: Date | null
  createdAt: Date
  updatedAt: Date
}

export type UserCredentials = UserRecord & {
  passwordHash: string
}
