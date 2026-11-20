import { DOC_STATUSES, PAYMENT_STATUSES, type DocStatus, type PaymentStatus } from '../../constants/finance.js'
import { compareMoney, isZeroMoney, subtractMoney } from '../../utils/money.js'

const D = DOC_STATUSES
const P = PAYMENT_STATUSES

export const DOC_TRANSITIONS: Readonly<Record<DocStatus, readonly DocStatus[]>> = {
  [D.DRAFT]: [D.POSTED, D.VOIDED],
  [D.POSTED]: [D.VOIDED],
  [D.VOIDED]: [],
}

export const PAYMENT_TRANSITIONS: Readonly<Record<PaymentStatus, readonly PaymentStatus[]>> = {
  [P.PENDING]: [P.COMPLETED, P.FAILED, P.CANCELLED],
  [P.COMPLETED]: [P.REVERSED],
  [P.FAILED]: [P.CANCELLED],
  [P.CANCELLED]: [],
  [P.REVERSED]: [],
}

export function canTransitionDoc(from: DocStatus, to: DocStatus): boolean {
  return DOC_TRANSITIONS[from].includes(to)
}

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus): boolean {
  return PAYMENT_TRANSITIONS[from].includes(to)
}

export function assertDraftMutable(status: DocStatus): void {
  if (status !== D.DRAFT) throw new Error('Posted financial documents cannot be edited.')
}

/** Remaining credit capacity on an invoice after existing posted credits. */
export function creditCapacity(invoiceTotal: string, alreadyCredited: string): string {
  if (compareMoney(alreadyCredited, invoiceTotal) >= 0) return '0.00'
  return subtractMoney(invoiceTotal, alreadyCredited)
}

export function invoicePaymentStatus(total: string, paid: string): 'UNPAID' | 'PARTIAL' | 'PAID' {
  if (isZeroMoney(paid)) return 'UNPAID'
  if (compareMoney(paid, total) >= 0) return 'PAID'
  return 'PARTIAL'
}

export function decidePaymentIdempotency(
  existing: { requestHash: string; paymentId?: string } | null,
  requestHash: string,
): 'proceed' | 'replay' | 'mismatch' | 'busy' {
  if (!existing) return 'proceed'
  if (existing.requestHash !== requestHash) return 'mismatch'
  if (existing.paymentId) return 'replay'
  return 'busy'
}

export function canApplyDeposit(remaining: string, applyAmount: string): boolean {
  return compareMoney(applyAmount, '0.00') > 0 && compareMoney(applyAmount, remaining) <= 0
}

export function canReleaseDeposit(remaining: string, releaseAmount: string): boolean {
  return canApplyDeposit(remaining, releaseAmount)
}
