import type { Types } from 'mongoose'
import type { EntityStatus } from '../constants/roles.js'

export interface IRole {
  /** null = system role shared by every organization. */
  organizationId: Types.ObjectId | null
  code: string
  name: string
  description?: string
  /** Dotted permission keys (see constants/permissions.ts). */
  permissionKeys: string[]
  isSystem: boolean
  status: EntityStatus
  createdAt: Date
  updatedAt: Date
}
