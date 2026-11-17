import type { Role, UserStatus } from '../constants/roles.js'

export type AuthenticatedUser = {
  id: string
  email: string
  name: string
  role: Role
  status: UserStatus
}

export type SessionUser = {
  id: string
  email: string
  name: string
  roles: string[]
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
