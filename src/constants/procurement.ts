/** Stored UPPERCASE. API uses lowercase via `toPublicEnum`. */

export const VENDOR_STATUSES = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  BLOCKED: 'BLOCKED',
} as const
export type VendorStatus = (typeof VENDOR_STATUSES)[keyof typeof VENDOR_STATUSES]

export const VENDOR_TYPES = {
  VEHICLE_SUPPLIER: 'VEHICLE_SUPPLIER',
  MAINTENANCE: 'MAINTENANCE',
  INSURANCE: 'INSURANCE',
  PARTS: 'PARTS',
  FUEL: 'FUEL',
  TYRE: 'TYRE',
  TOWING: 'TOWING',
  CLEANING: 'CLEANING',
  TECHNOLOGY: 'TECHNOLOGY',
  GENERAL: 'GENERAL',
  BORROW_SUPPLIER: 'BORROW_SUPPLIER',
  OTHER: 'OTHER',
} as const
export type VendorType = (typeof VENDOR_TYPES)[keyof typeof VENDOR_TYPES]

export const VENDOR_CONTACT_ROLES = {
  PRIMARY: 'PRIMARY',
  FINANCE: 'FINANCE',
  OPERATIONS: 'OPERATIONS',
  SERVICE: 'SERVICE',
  OTHER: 'OTHER',
} as const

export const PAYMENT_TERMS = {
  IMMEDIATE: 'IMMEDIATE',
  NET_7: 'NET_7',
  NET_15: 'NET_15',
  NET_30: 'NET_30',
  NET_45: 'NET_45',
  NET_60: 'NET_60',
  CUSTOM: 'CUSTOM',
} as const
export type PaymentTerm = (typeof PAYMENT_TERMS)[keyof typeof PAYMENT_TERMS]

export const LPO_STATUSES = {
  DRAFT: 'DRAFT',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  SENT: 'SENT',
  PARTIALLY_RECEIVED: 'PARTIALLY_RECEIVED',
  RECEIVED: 'RECEIVED',
  CANCELLED: 'CANCELLED',
  CLOSED: 'CLOSED',
} as const
export type LpoStatus = (typeof LPO_STATUSES)[keyof typeof LPO_STATUSES]

export const VENDOR_BILL_STATUSES = {
  DRAFT: 'DRAFT',
  PENDING_REVIEW: 'PENDING_REVIEW',
  APPROVED: 'APPROVED',
  POSTED: 'POSTED',
  CANCELLED: 'CANCELLED',
} as const
export type VendorBillStatus = (typeof VENDOR_BILL_STATUSES)[keyof typeof VENDOR_BILL_STATUSES]

export const BILL_PAYMENT_STATUSES = {
  UNPAID: 'UNPAID',
  PARTIAL: 'PARTIAL',
  PAID: 'PAID',
} as const

export const EXPENSE_STATUSES = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  POSTED: 'POSTED',
  CANCELLED: 'CANCELLED',
} as const
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[keyof typeof EXPENSE_STATUSES]

export const DEFAULT_EXPENSE_CATEGORIES = [
  'FUEL',
  'MAINTENANCE',
  'REPAIRS',
  'TYRES',
  'CLEANING',
  'INSURANCE',
  'REGISTRATION',
  'PARKING',
  'TOWING',
  'SPARE_PARTS',
  'OFFICE',
  'UTILITIES',
  'TECHNOLOGY',
  'MARKETING',
  'OTHER',
] as const

export const WORK_ORDER_STATUSES = {
  DRAFT: 'DRAFT',
  REQUESTED: 'REQUESTED',
  APPROVED: 'APPROVED',
  SCHEDULED: 'SCHEDULED',
  IN_PROGRESS: 'IN_PROGRESS',
  WAITING_FOR_PARTS: 'WAITING_FOR_PARTS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const
export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[keyof typeof WORK_ORDER_STATUSES]

export const SERVICE_PRIORITIES = {
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const

export const SERVICE_TYPES = {
  SCHEDULED_MAINTENANCE: 'SCHEDULED_MAINTENANCE',
  OIL_CHANGE: 'OIL_CHANGE',
  TYRE_REPLACEMENT: 'TYRE_REPLACEMENT',
  BRAKE_SERVICE: 'BRAKE_SERVICE',
  ENGINE_REPAIR: 'ENGINE_REPAIR',
  AC_SERVICE: 'AC_SERVICE',
  ELECTRICAL: 'ELECTRICAL',
  BODY_REPAIR: 'BODY_REPAIR',
  ACCIDENT_REPAIR: 'ACCIDENT_REPAIR',
  INSPECTION: 'INSPECTION',
  CLEANING: 'CLEANING',
  OTHER: 'OTHER',
} as const

export const REMINDER_STATUSES = {
  UPCOMING: 'UPCOMING',
  DUE: 'DUE',
  OVERDUE: 'OVERDUE',
  COMPLETED: 'COMPLETED',
  DISMISSED: 'DISMISSED',
} as const
export type ReminderStatus = (typeof REMINDER_STATUSES)[keyof typeof REMINDER_STATUSES]

export const REMINDER_BASES = {
  DATE: 'DATE',
  MILEAGE: 'MILEAGE',
  INTERVAL_DAYS: 'INTERVAL_DAYS',
  INTERVAL_KM: 'INTERVAL_KM',
} as const

export const BORROW_RATE_TYPES = {
  DAILY: 'DAILY',
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY',
  FIXED: 'FIXED',
} as const

export const MATCH_RESULTS = {
  MATCH: 'MATCH',
  QUANTITY_MISMATCH: 'QUANTITY_MISMATCH',
  AMOUNT_MISMATCH: 'AMOUNT_MISMATCH',
  VENDOR_MISMATCH: 'VENDOR_MISMATCH',
  CURRENCY_MISMATCH: 'CURRENCY_MISMATCH',
} as const

/** Configurable approval bands (AED). Policy foundation — not hard legal rules. */
export const DEFAULT_APPROVAL_THRESHOLDS = [
  { maxAmount: '1000.00', level: 'STANDARD' },
  { maxAmount: '10000.00', level: 'MANAGER' },
  { maxAmount: null, level: 'HIGHER' },
] as const

export const DEFAULT_TAX_RATE = '5.00'
export const DEFAULT_CURRENCY = 'AED'

export const VENDOR_SORT_FIELDS = ['vendorCode', 'name', 'createdAt', 'status', 'vendorType'] as const
export type VendorSortField = (typeof VENDOR_SORT_FIELDS)[number]

export const LPO_SORT_FIELDS = ['documentNumber', 'orderDate', 'totalAmount', 'createdAt', 'status'] as const
export type LpoSortField = (typeof LPO_SORT_FIELDS)[number]

export const BILL_SORT_FIELDS = ['documentNumber', 'billDate', 'totalAmount', 'createdAt', 'status'] as const
export type BillSortField = (typeof BILL_SORT_FIELDS)[number]

export const EXPENSE_SORT_FIELDS = ['documentNumber', 'expenseDate', 'totalAmount', 'createdAt', 'status'] as const
export type ExpenseSortField = (typeof EXPENSE_SORT_FIELDS)[number]

export const WORK_ORDER_SORT_FIELDS = ['documentNumber', 'scheduledAt', 'createdAt', 'status', 'priority'] as const
export type WorkOrderSortField = (typeof WORK_ORDER_SORT_FIELDS)[number]
