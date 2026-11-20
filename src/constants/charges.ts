/** Module 10 — Fines, Tolls/Salik & Refunds. Stored UPPERCASE; API uses lowercase via toPublicEnum. */

export const CHARGE_SOURCES = {
  MANUAL: 'MANUAL',
  IMPORT: 'IMPORT',
  API: 'API',
  WEBHOOK: 'WEBHOOK',
} as const
export type ChargeSource = (typeof CHARGE_SOURCES)[keyof typeof CHARGE_SOURCES]

export const FINE_TYPES = {
  SPEEDING: 'SPEEDING',
  PARKING: 'PARKING',
  RED_LIGHT: 'RED_LIGHT',
  TRAFFIC_VIOLATION: 'TRAFFIC_VIOLATION',
  ROAD_VIOLATION: 'ROAD_VIOLATION',
  MUNICIPALITY: 'MUNICIPALITY',
  OTHER: 'OTHER',
} as const
export type FineType = (typeof FINE_TYPES)[keyof typeof FINE_TYPES]

export const TOLL_PROVIDERS = {
  SALIK: 'SALIK',
  DARB: 'DARB',
  OTHER: 'OTHER',
} as const

export const FINE_STATUSES = {
  IMPORTED: 'IMPORTED',
  PENDING_REVIEW: 'PENDING_REVIEW',
  ASSIGNED: 'ASSIGNED',
  DISPUTED: 'DISPUTED',
  APPROVED: 'APPROVED',
  RECOVERY_PENDING: 'RECOVERY_PENDING',
  RECOVERED: 'RECOVERED',
  WAIVED: 'WAIVED',
  CANCELLED: 'CANCELLED',
} as const
export type FineStatus = (typeof FINE_STATUSES)[keyof typeof FINE_STATUSES]

export const TOLL_STATUSES = {
  IMPORTED: 'IMPORTED',
  PENDING_REVIEW: 'PENDING_REVIEW',
  ASSIGNED: 'ASSIGNED',
  APPROVED: 'APPROVED',
  RECOVERY_PENDING: 'RECOVERY_PENDING',
  RECOVERED: 'RECOVERED',
  DISPUTED: 'DISPUTED',
  WAIVED: 'WAIVED',
  CANCELLED: 'CANCELLED',
} as const
export type TollStatus = (typeof TOLL_STATUSES)[keyof typeof TOLL_STATUSES]

export const ASSIGNMENT_RESOLUTIONS = {
  ASSIGNED: 'ASSIGNED',
  UNASSIGNED: 'UNASSIGNED',
  OVERLAP_CONFLICT: 'OVERLAP_CONFLICT',
  VEHICLE_NOT_FOUND: 'VEHICLE_NOT_FOUND',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
} as const
export type AssignmentResolution = (typeof ASSIGNMENT_RESOLUTIONS)[keyof typeof ASSIGNMENT_RESOLUTIONS]

export const DISPUTE_STATUSES = {
  OPEN: 'OPEN',
  UNDER_REVIEW: 'UNDER_REVIEW',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  RESOLVED: 'RESOLVED',
} as const
export type DisputeStatus = (typeof DISPUTE_STATUSES)[keyof typeof DISPUTE_STATUSES]

export const IMPORT_BATCH_STATUSES = {
  UPLOADED: 'UPLOADED',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  COMPLETED_WITH_ERRORS: 'COMPLETED_WITH_ERRORS',
  FAILED: 'FAILED',
} as const
export type ImportBatchStatus = (typeof IMPORT_BATCH_STATUSES)[keyof typeof IMPORT_BATCH_STATUSES]

export const IMPORT_ROW_RESULTS = {
  CREATED: 'CREATED',
  DUPLICATE: 'DUPLICATE',
  INVALID: 'INVALID',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
} as const

export const REFUND_STATUSES = {
  DRAFT: 'DRAFT',
  REQUESTED: 'REQUESTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const
export type RefundStatus = (typeof REFUND_STATUSES)[keyof typeof REFUND_STATUSES]

export const REFUND_SOURCES = {
  DEPOSIT: 'DEPOSIT',
  PAYMENT: 'PAYMENT',
  OVERPAYMENT: 'OVERPAYMENT',
  ADJUSTMENT: 'ADJUSTMENT',
  OTHER: 'OTHER',
} as const

export const RECOVERY_POLICIES = {
  EXACT: 'EXACT',
  EXACT_PLUS_ADMIN: 'EXACT_PLUS_ADMIN',
} as const

export const DEFAULT_CURRENCY = 'AED'
export const DEFAULT_ADMIN_FEE = '0.00'

export const FINE_SORT_FIELDS = ['documentNumber', 'eventAt', 'amount', 'createdAt', 'status'] as const
export type FineSortField = (typeof FINE_SORT_FIELDS)[number]

export const TOLL_SORT_FIELDS = ['documentNumber', 'eventAt', 'amount', 'createdAt', 'status'] as const
export type TollSortField = (typeof TOLL_SORT_FIELDS)[number]

export const REFUND_SORT_FIELDS = ['documentNumber', 'amount', 'createdAt', 'status'] as const
export type RefundSortField = (typeof REFUND_SORT_FIELDS)[number]
