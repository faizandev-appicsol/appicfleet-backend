/**
 * Vehicle domain enums (Module 4). Stored in UPPERCASE (compliance states are lowercase),
 * exposed on the public API in lowercase.
 */
export const VEHICLE_STATUSES = {
  AVAILABLE: 'AVAILABLE',
  RESERVED: 'RESERVED',
  RENTED: 'RENTED',
  MAINTENANCE: 'MAINTENANCE',
  INSPECTION: 'INSPECTION',
  OUT_OF_SERVICE: 'OUT_OF_SERVICE',
  INACTIVE: 'INACTIVE',
} as const
export type VehicleStatus = (typeof VEHICLE_STATUSES)[keyof typeof VEHICLE_STATUSES]

export const VEHICLE_CATEGORIES = {
  SEDAN: 'SEDAN',
  SUV: 'SUV',
  VAN: 'VAN',
  TRUCK: 'TRUCK',
  OTHER: 'OTHER',
} as const
export type VehicleCategory = (typeof VEHICLE_CATEGORIES)[keyof typeof VEHICLE_CATEGORIES]

export const VEHICLE_TRANSMISSIONS = {
  AUTOMATIC: 'AUTOMATIC',
  MANUAL: 'MANUAL',
} as const
export type VehicleTransmission = (typeof VEHICLE_TRANSMISSIONS)[keyof typeof VEHICLE_TRANSMISSIONS]

export const VEHICLE_FUEL_TYPES = {
  PETROL: 'PETROL',
  DIESEL: 'DIESEL',
  HYBRID: 'HYBRID',
  ELECTRIC: 'ELECTRIC',
} as const
export type VehicleFuelType = (typeof VEHICLE_FUEL_TYPES)[keyof typeof VEHICLE_FUEL_TYPES]

export const OWNERSHIP_TYPES = {
  COMPANY: 'COMPANY',
  INVESTOR: 'INVESTOR',
  BORROWED: 'BORROWED',
  LEASED: 'LEASED',
} as const
export type OwnershipType = (typeof OWNERSHIP_TYPES)[keyof typeof OWNERSHIP_TYPES]

export const DOCUMENT_TYPES = {
  REGISTRATION: 'REGISTRATION',
  INSURANCE: 'INSURANCE',
  INSPECTION: 'INSPECTION',
  OWNERSHIP: 'OWNERSHIP',
  LEASE: 'LEASE',
  OTHER: 'OTHER',
} as const
export type DocumentType = (typeof DOCUMENT_TYPES)[keyof typeof DOCUMENT_TYPES]

export const DOCUMENT_STATUSES = {
  ACTIVE: 'ACTIVE',
  ARCHIVED: 'ARCHIVED',
} as const
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[keyof typeof DOCUMENT_STATUSES]

export const RATE_TYPES = {
  DAILY: 'DAILY',
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY',
} as const
export type RateType = (typeof RATE_TYPES)[keyof typeof RATE_TYPES]

export const RATE_STATUSES = {
  ACTIVE: 'ACTIVE',
  SUPERSEDED: 'SUPERSEDED',
  CANCELLED: 'CANCELLED',
} as const
export type RateStatus = (typeof RATE_STATUSES)[keyof typeof RATE_STATUSES]

export const ASSIGNMENT_STATUSES = {
  ACTIVE: 'ACTIVE',
  RELEASED: 'RELEASED',
} as const
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[keyof typeof ASSIGNMENT_STATUSES]

export const COMPLIANCE_STATES = {
  MISSING: 'missing',
  VALID: 'valid',
  EXPIRING: 'expiring',
  EXPIRED: 'expired',
} as const
export type ComplianceState = (typeof COMPLIANCE_STATES)[keyof typeof COMPLIANCE_STATES]

/** Sort keys accepted by the vehicle list (closed whitelist). */
export const VEHICLE_SORT_FIELDS = ['plateNumber', 'make', 'year', 'status', 'createdAt'] as const
export type VehicleSortField = (typeof VEHICLE_SORT_FIELDS)[number]

export function toPublicEnum<T extends string>(value: T): Lowercase<T> {
  return value.toLowerCase() as Lowercase<T>
}
