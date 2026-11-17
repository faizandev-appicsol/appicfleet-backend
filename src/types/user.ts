import type { PublicRole, PublicStatus, Role, UserStatus } from '../constants/roles.js'

export type UserResource = {
  id: string
  email: string
  name: string
  role: PublicRole
  status: PublicStatus
  createdAt: string
  updatedAt: string
}

export type UserSortField = 'name' | 'email' | 'createdAt'
export type SortOrder = 'asc' | 'desc'

export type UserRecord = {
  id: string
  email: string
  name: string
  role: Role
  status: UserStatus
  createdAt: Date
  updatedAt: Date
}

export type UserCredentials = UserRecord & {
  passwordHash: string
}
