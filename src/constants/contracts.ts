/** Stored uppercase. The API uses lowercase via `toPublicEnum`. */
export const CONTRACT_TYPES = {
  B2C: 'B2C',
  B2B: 'B2B',
  BORROW: 'BORROW',
} as const
export type ContractType = (typeof CONTRACT_TYPES)[keyof typeof CONTRACT_TYPES]

export const CONTRACT_STATUSES = {
  DRAFT: 'DRAFT',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  TERMINATED: 'TERMINATED',
} as const
export type ContractStatus = (typeof CONTRACT_STATUSES)[keyof typeof CONTRACT_STATUSES]

export const CHARGE_KINDS = {
  RENTAL: 'RENTAL',
  EXTENSION: 'EXTENSION',
  AMENDMENT: 'AMENDMENT',
  FINE_RECOVERY: 'FINE_RECOVERY',
  TOLL_RECOVERY: 'TOLL_RECOVERY',
} as const
export type ChargeKind = (typeof CHARGE_KINDS)[keyof typeof CHARGE_KINDS]

export const TERMS_STATUSES = {
  DRAFT: 'DRAFT',
  ACCEPTED: 'ACCEPTED',
} as const
export type TermsStatus = (typeof TERMS_STATUSES)[keyof typeof TERMS_STATUSES]

export const SIGNATURE_STATUSES = {
  REQUESTED: 'REQUESTED',
  PENDING: 'PENDING',
  SIGNED: 'SIGNED',
  DECLINED: 'DECLINED',
} as const
export type SignatureStatus = (typeof SIGNATURE_STATUSES)[keyof typeof SIGNATURE_STATUSES]

export const REPLACEMENT_STATUSES = {
  REQUESTED: 'REQUESTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  COMPLETED: 'COMPLETED',
} as const
export type ReplacementStatus = (typeof REPLACEMENT_STATUSES)[keyof typeof REPLACEMENT_STATUSES]

export const CONTRACT_SORT_FIELDS = ['contractNumber', 'startsAt', 'endsAt', 'createdAt', 'status'] as const
export type ContractSortField = (typeof CONTRACT_SORT_FIELDS)[number]

export const ASSIGNMENT_TYPES = {
  CONTRACT: 'CONTRACT',
  REPLACEMENT: 'REPLACEMENT',
} as const
