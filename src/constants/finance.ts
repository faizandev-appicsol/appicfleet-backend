/** Stored uppercase. API uses lowercase via `toPublicEnum`. */
export const DOC_STATUSES = {
  DRAFT: 'DRAFT',
  POSTED: 'POSTED',
  VOIDED: 'VOIDED',
} as const
export type DocStatus = (typeof DOC_STATUSES)[keyof typeof DOC_STATUSES]

export const PAYMENT_STATUSES = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  REVERSED: 'REVERSED',
} as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[keyof typeof PAYMENT_STATUSES]

export const PAYMENT_METHODS = {
  CASH: 'CASH',
  CARD: 'CARD',
  BANK_TRANSFER: 'BANK_TRANSFER',
  ONLINE: 'ONLINE',
  CHEQUE: 'CHEQUE',
  OTHER: 'OTHER',
} as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[keyof typeof PAYMENT_METHODS]

export const DEPOSIT_STATUSES = {
  HELD: 'HELD',
  PARTIALLY_APPLIED: 'PARTIALLY_APPLIED',
  APPLIED: 'APPLIED',
  RELEASED: 'RELEASED',
} as const
export type DepositStatus = (typeof DEPOSIT_STATUSES)[keyof typeof DEPOSIT_STATUSES]

export const DEPOSIT_EVENT_KINDS = {
  CREATED: 'CREATED',
  APPLIED: 'APPLIED',
  RELEASED: 'RELEASED',
} as const

export const INVOICE_LINE_SOURCES = {
  MANUAL: 'MANUAL',
  CONTRACT_CHARGE: 'CONTRACT_CHARGE',
} as const

export const INVOICE_PAYMENT_STATUSES = {
  UNPAID: 'UNPAID',
  PARTIAL: 'PARTIAL',
  PAID: 'PAID',
} as const

/**
 * Fallback rate percent when no tax code/rate is resolved.
 * Prefer Module 12 effective-dated tax codes — do not treat this as a legal rate.
 */
export const DEFAULT_TAX_RATE = '5.00'

export const DEFAULT_CURRENCY = 'AED'

export const INVOICE_SORT_FIELDS = [
  'documentNumber',
  'documentDate',
  'dueDate',
  'totalAmount',
  'createdAt',
  'status',
] as const
export type InvoiceSortField = (typeof INVOICE_SORT_FIELDS)[number]

export const PAYMENT_SORT_FIELDS = ['paymentNumber', 'paymentDate', 'amount', 'createdAt', 'status'] as const
export type PaymentSortField = (typeof PAYMENT_SORT_FIELDS)[number]

export const DEPOSIT_SORT_FIELDS = ['depositNumber', 'heldAt', 'amount', 'createdAt', 'status'] as const
export type DepositSortField = (typeof DEPOSIT_SORT_FIELDS)[number]
