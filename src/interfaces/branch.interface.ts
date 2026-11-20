import type { Types } from 'mongoose'
import type { EntityStatus } from '../constants/roles.js'

export interface IBranchAddress {
  line1?: string
  line2?: string
  city?: string
  region?: string
  postalCode?: string
  /** ISO 3166-1 alpha-2 country code. */
  country?: string
}

export interface IBranch {
  organizationId: Types.ObjectId
  legalEntityId: Types.ObjectId
  name: string
  /** Uppercase code, unique within the organization. */
  code: string
  address?: IBranchAddress
  /** IANA timezone name. */
  timezone: string
  status: EntityStatus
  createdAt: Date
  updatedAt: Date
}
