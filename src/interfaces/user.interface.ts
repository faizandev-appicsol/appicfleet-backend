import type { Types } from 'mongoose'
import type { Role, UserStatus } from '../constants/roles.js'

export interface IUser {
  email: string
  name: string
  passwordHash: string
  /** Tenant. Required for everyone except accessAllOrganizations (super admin) accounts. */
  organizationId?: Types.ObjectId | null
  phone?: string
  /** Primary role code (system role). Authorization is derived from permissions. */
  role: Role
  /** Optional custom roles; their permission keys are added to the primary role's. */
  roleIds?: Types.ObjectId[]
  status: UserStatus
  legalEntityIds: Types.ObjectId[]
  branchIds: Types.ObjectId[]
  /** Organization-wide scope: every legal entity and branch inside organizationId. */
  accessAllBranches: boolean
  /** Platform scope (super admin). Never settable through the public API. */
  accessAllOrganizations: boolean
  lastLoginAt?: Date
  failedLoginAttempts: number
  lockedUntil?: Date | null
  createdAt: Date
  updatedAt: Date
}
