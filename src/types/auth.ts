import type { Role, UserStatus } from '../constants/roles.js'

export type AuthenticatedUser = {
  id: string
  email: string
  name: string
  phone?: string
  role: Role
  status: UserStatus
  lastLoginAt?: Date | null
  organizationId: string | null
  branchIds: string[]
  legalEntityIds: string[]
  accessAllBranches: boolean
  accessAllOrganizations: boolean
}

export type SessionUser = {
  id: string
  email: string
  name: string
  roles: string[]
  permissions: string[]
  organizationId: string | null
  branchIds: string[]
  legalEntityIds: string[]
  accessAllBranches: boolean
  accessAllOrganizations: boolean
}

/** Full profile returned by GET /auth/me. */
export type ProfileResource = SessionUser & {
  phone?: string
  status: string
  lastLoginAt: string | null
  organization: { id: string; name: string; code: string } | null
  branches: { id: string; name: string; code: string }[]
}

export type IssuedSession = {
  accessToken: string
  expiresIn: number
  refreshToken: string
  refreshExpiresAt: Date
  user: SessionUser
}

export type PublicSession = {
  accessToken: string
  expiresIn: number
  user: SessionUser
}
