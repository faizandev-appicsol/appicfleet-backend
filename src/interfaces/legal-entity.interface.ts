import type { Types } from 'mongoose'
import type { EntityStatus } from '../constants/roles.js'

export interface ILegalEntity {
  organizationId: Types.ObjectId
  legalName: string
  displayName: string
  status: EntityStatus
  /** ISO 3166-1 alpha-2 country code. */
  country: string
  taxIdentifier?: string
  /** ISO 4217 currency code. */
  defaultCurrency: string
  /** IANA timezone name. */
  timezone: string
  createdAt: Date
  updatedAt: Date
}
