/**
 * Customer domain enums (Module 5). Stored in UPPERCASE, exposed on the public API in lowercase
 * (use `toPublicEnum` from `constants/vehicles.ts`).
 */
export const CUSTOMER_TYPES = {
  INDIVIDUAL: 'INDIVIDUAL',
  CORPORATE: 'CORPORATE',
} as const
export type CustomerType = (typeof CUSTOMER_TYPES)[keyof typeof CUSTOMER_TYPES]

export const CUSTOMER_STATUSES = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  SUSPENDED: 'SUSPENDED',
} as const
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[keyof typeof CUSTOMER_STATUSES]

/** Denormalized on the customer; recomputed whenever documents or OCR outcomes change. */
export const CUSTOMER_DOCUMENT_STATUSES = {
  NONE: 'NONE',
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  NEEDS_REVIEW: 'NEEDS_REVIEW',
} as const
export type CustomerDocumentStatus =
  (typeof CUSTOMER_DOCUMENT_STATUSES)[keyof typeof CUSTOMER_DOCUMENT_STATUSES]

export const CONTACT_ROLES = {
  DRIVER: 'DRIVER',
  CONTACT: 'CONTACT',
  OTHER: 'OTHER',
} as const
export type ContactRole = (typeof CONTACT_ROLES)[keyof typeof CONTACT_ROLES]

export const CONTACT_STATUSES = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const
export type ContactStatus = (typeof CONTACT_STATUSES)[keyof typeof CONTACT_STATUSES]

export const CUSTOMER_DOCUMENT_TYPES = {
  EMIRATES_ID: 'EMIRATES_ID',
  PASSPORT: 'PASSPORT',
  DRIVING_LICENSE: 'DRIVING_LICENSE',
  TRADE_LICENSE: 'TRADE_LICENSE',
  VAT_CERTIFICATE: 'VAT_CERTIFICATE',
  OTHER: 'OTHER',
} as const
export type CustomerDocumentType =
  (typeof CUSTOMER_DOCUMENT_TYPES)[keyof typeof CUSTOMER_DOCUMENT_TYPES]

export const CUSTOMER_FILE_STATUSES = {
  ACTIVE: 'ACTIVE',
  ARCHIVED: 'ARCHIVED',
} as const
export type CustomerFileStatus = (typeof CUSTOMER_FILE_STATUSES)[keyof typeof CUSTOMER_FILE_STATUSES]

/** Document-level OCR state. */
export const OCR_STATUSES = {
  NONE: 'NONE',
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  NEEDS_REVIEW: 'NEEDS_REVIEW',
  FAILED: 'FAILED',
} as const
export type OcrStatus = (typeof OCR_STATUSES)[keyof typeof OCR_STATUSES]

/** Outcome of one OCR run. */
export const OCR_RUN_STATUSES = {
  COMPLETED: 'COMPLETED',
  NEEDS_REVIEW: 'NEEDS_REVIEW',
  FAILED: 'FAILED',
} as const
export type OcrRunStatus = (typeof OCR_RUN_STATUSES)[keyof typeof OCR_RUN_STATUSES]

export const OCR_REVIEW_STATUSES = {
  NONE: 'NONE',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const
export type OcrReviewStatus = (typeof OCR_REVIEW_STATUSES)[keyof typeof OCR_REVIEW_STATUSES]

export const DUPLICATE_REVIEW_STATUSES = {
  POTENTIAL: 'POTENTIAL',
  UNDER_REVIEW: 'UNDER_REVIEW',
  CONFIRMED: 'CONFIRMED',
  NOT_DUPLICATE: 'NOT_DUPLICATE',
} as const
export type DuplicateReviewStatus =
  (typeof DUPLICATE_REVIEW_STATUSES)[keyof typeof DUPLICATE_REVIEW_STATUSES]

export const DUPLICATE_SIGNALS = {
  EMAIL: 'email',
  PHONE: 'phone',
  REGISTRATION: 'registration',
} as const
export type DuplicateSignal = (typeof DUPLICATE_SIGNALS)[keyof typeof DUPLICATE_SIGNALS]

/** Sort keys accepted by the customer list (closed whitelist). */
export const CUSTOMER_SORT_FIELDS = ['displayName', 'createdAt', 'customerNumber'] as const
export type CustomerSortField = (typeof CUSTOMER_SORT_FIELDS)[number]

export const ALLOWED_UPLOAD_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const
export type AllowedUploadMimeType = (typeof ALLOWED_UPLOAD_MIME_TYPES)[number]

/** Maximum size of the decoded file. */
export const MAX_UPLOAD_BYTES = 5_000_000

/** Longest base64 text that can decode to MAX_UPLOAD_BYTES (4 chars per 3 bytes, plus padding). */
export const MAX_UPLOAD_BASE64_LENGTH = Math.ceil(MAX_UPLOAD_BYTES / 3) * 4

/** JSON body limit for the customer document upload route only. */
export const CUSTOMER_UPLOAD_BODY_LIMIT = '8mb'

/** An OCR type or field confidence below this needs a human review. */
export const OCR_REVIEW_THRESHOLD = 0.75
