import type { EntityStatus } from '../constants/roles.js'

export interface IOrganization {
  name: string
  /** Unique, uppercase business code (for example `ORG-A`). Immutable after creation. */
  code: string
  status: EntityStatus
  createdAt: Date
  updatedAt: Date
}
