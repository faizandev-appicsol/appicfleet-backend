import type { Role, UserStatus } from '../constants/roles.js'

export interface IUser {
  email: string
  name: string
  passwordHash: string
  role: Role
  status: UserStatus
  createdAt: Date
  updatedAt: Date
}
