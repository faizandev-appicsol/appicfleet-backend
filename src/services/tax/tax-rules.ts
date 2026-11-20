import {
  EINVOICE_STATUSES,
  TAX_PERIOD_STATUSES,
  type EInvoiceStatus,
  type TaxPeriodStatus,
} from '../../constants/tax.js'

const P = TAX_PERIOD_STATUSES
const E = EINVOICE_STATUSES

export const TAX_PERIOD_TRANSITIONS: Readonly<Record<TaxPeriodStatus, readonly TaxPeriodStatus[]>> = {
  [P.OPEN]: [P.LOCKED],
  [P.LOCKED]: [P.OPEN, P.FILED],
  [P.FILED]: [],
}

export const EINVOICE_TRANSITIONS: Readonly<Record<EInvoiceStatus, readonly EInvoiceStatus[]>> = {
  [E.NOT_READY]: [E.READY, E.CANCELLED],
  [E.READY]: [E.GENERATED, E.VALIDATING, E.CANCELLED],
  [E.GENERATED]: [E.VALIDATING, E.CANCELLED],
  [E.VALIDATING]: [E.READY, E.SUBMITTED, E.FAILED, E.REJECTED],
  [E.SUBMITTED]: [E.ACCEPTED, E.REJECTED, E.FAILED],
  [E.ACCEPTED]: [],
  [E.REJECTED]: [E.READY, E.CANCELLED],
  [E.FAILED]: [E.READY, E.CANCELLED],
  [E.CANCELLED]: [],
}

export function canTransitionTaxPeriod(from: TaxPeriodStatus, to: TaxPeriodStatus): boolean {
  return TAX_PERIOD_TRANSITIONS[from].includes(to)
}

export function canTransitionEInvoice(from: EInvoiceStatus, to: EInvoiceStatus): boolean {
  return EINVOICE_TRANSITIONS[from].includes(to)
}

export function isRetryableEInvoiceStatus(status: EInvoiceStatus): boolean {
  return status === E.FAILED || status === E.REJECTED
}

export function periodContainsDate(startDate: Date, endDate: Date, date: Date): boolean {
  return date >= startDate && date <= endDate
}

/** Rates are half-open on the end: effectiveFrom ≤ date < effectiveTo (or open-ended). */
export function rateCoversDate(effectiveFrom: Date, effectiveTo: Date | undefined, date: Date): boolean {
  if (date < effectiveFrom) return false
  if (!effectiveTo) return true
  return date < effectiveTo
}
