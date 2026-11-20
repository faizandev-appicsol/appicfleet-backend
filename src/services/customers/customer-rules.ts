import {
  CUSTOMER_DOCUMENT_STATUSES,
  CUSTOMER_TYPES,
  DUPLICATE_SIGNALS,
  OCR_STATUSES,
  type CustomerDocumentStatus,
  type CustomerType,
  type DuplicateSignal,
  type OcrStatus,
} from '../../constants/customers.js'

/** Fewer digits than this is not specific enough to treat two phones as the same number. */
export const MIN_PHONE_DIGITS = 6

/** Lowercase, trimmed email used only for duplicate search. Empty becomes undefined. */
export function normalizeEmail(value: string | null | undefined): string | undefined {
  const normalized = value?.trim().toLowerCase()
  return normalized ? normalized : undefined
}

/** Digits only, used only for duplicate search. Too short to be meaningful becomes undefined. */
export function normalizePhone(value: string | null | undefined): string | undefined {
  const digits = value?.replace(/\D/g, '') ?? ''
  return digits.length >= MIN_PHONE_DIGITS ? digits : undefined
}

/** Trimmed, uppercase registration number so formatting differences do not hide a match. */
export function normalizeRegistration(value: string | null | undefined): string | undefined {
  const normalized = value?.trim().toUpperCase()
  return normalized ? normalized : undefined
}

export type NameParts = {
  type: CustomerType
  individual?: { firstName: string; middleName?: string | null; lastName: string }
  corporate?: { legalName: string; tradeName?: string | null }
}

/** Display name used when the client does not supply one. */
export function buildDisplayName(parts: NameParts): string {
  if (parts.type === CUSTOMER_TYPES.INDIVIDUAL && parts.individual) {
    return [parts.individual.firstName, parts.individual.middleName, parts.individual.lastName]
      .filter((part): part is string => typeof part === 'string' && part.trim() !== '')
      .join(' ')
  }
  if (parts.corporate) return parts.corporate.tradeName?.trim() || parts.corporate.legalName
  return ''
}

export type MatchKeys = {
  normalizedEmail?: string
  normalizedPhone?: string
  registrationNumber?: string
}

/** Which signals two customers share. Empty when they share none. */
export function sharedSignals(a: MatchKeys, b: MatchKeys): DuplicateSignal[] {
  const signals: DuplicateSignal[] = []
  if (a.normalizedEmail && a.normalizedEmail === b.normalizedEmail) {
    signals.push(DUPLICATE_SIGNALS.EMAIL)
  }
  if (a.normalizedPhone && a.normalizedPhone === b.normalizedPhone) {
    signals.push(DUPLICATE_SIGNALS.PHONE)
  }
  if (a.registrationNumber && a.registrationNumber === b.registrationNumber) {
    signals.push(DUPLICATE_SIGNALS.REGISTRATION)
  }
  return signals
}

/** Canonical order for a duplicate pair, so A-B and B-A are the same record. */
export function canonicalPair(a: string, b: string): { customerId: string; candidateId: string } {
  return a < b ? { customerId: a, candidateId: b } : { customerId: b, candidateId: a }
}

/**
 * Customer-level document status from the OCR status of its ACTIVE documents.
 * No documents -> NONE; any needing review (or failed) -> NEEDS_REVIEW; any not yet processed ->
 * PENDING; otherwise VERIFIED.
 */
export function deriveDocumentStatus(ocrStatuses: readonly OcrStatus[]): CustomerDocumentStatus {
  if (ocrStatuses.length === 0) return CUSTOMER_DOCUMENT_STATUSES.NONE
  if (ocrStatuses.some((s) => s === OCR_STATUSES.NEEDS_REVIEW || s === OCR_STATUSES.FAILED)) {
    return CUSTOMER_DOCUMENT_STATUSES.NEEDS_REVIEW
  }
  if (ocrStatuses.some((s) => s !== OCR_STATUSES.COMPLETED)) {
    return CUSTOMER_DOCUMENT_STATUSES.PENDING
  }
  return CUSTOMER_DOCUMENT_STATUSES.VERIFIED
}
