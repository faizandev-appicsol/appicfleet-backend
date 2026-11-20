import {
  FINE_STATUSES,
  REFUND_STATUSES,
  TOLL_STATUSES,
  type FineStatus,
  type RefundStatus,
  type TollStatus,
} from '../../constants/charges.js'
import { addMoney, normalizeMoney } from '../../utils/money.js'

const F = FINE_STATUSES
const T = TOLL_STATUSES
const R = REFUND_STATUSES

export const FINE_TRANSITIONS: Readonly<Record<FineStatus, readonly FineStatus[]>> = {
  [F.IMPORTED]: [F.PENDING_REVIEW, F.ASSIGNED, F.CANCELLED],
  [F.PENDING_REVIEW]: [F.ASSIGNED, F.CANCELLED],
  [F.ASSIGNED]: [F.APPROVED, F.DISPUTED, F.WAIVED, F.CANCELLED],
  [F.DISPUTED]: [F.ASSIGNED, F.WAIVED, F.CANCELLED],
  [F.APPROVED]: [F.RECOVERY_PENDING, F.WAIVED, F.CANCELLED],
  [F.RECOVERY_PENDING]: [F.RECOVERED, F.WAIVED, F.CANCELLED],
  [F.RECOVERED]: [],
  [F.WAIVED]: [],
  [F.CANCELLED]: [],
}

export const TOLL_TRANSITIONS: Readonly<Record<TollStatus, readonly TollStatus[]>> = {
  [T.IMPORTED]: [T.PENDING_REVIEW, T.ASSIGNED, T.CANCELLED],
  [T.PENDING_REVIEW]: [T.ASSIGNED, T.CANCELLED],
  [T.ASSIGNED]: [T.APPROVED, T.DISPUTED, T.WAIVED, T.CANCELLED],
  [T.DISPUTED]: [T.ASSIGNED, T.WAIVED, T.CANCELLED],
  [T.APPROVED]: [T.RECOVERY_PENDING, T.WAIVED, T.CANCELLED],
  [T.RECOVERY_PENDING]: [T.RECOVERED, T.WAIVED, T.CANCELLED],
  [T.RECOVERED]: [],
  [T.WAIVED]: [],
  [T.CANCELLED]: [],
}

export const REFUND_TRANSITIONS: Readonly<Record<RefundStatus, readonly RefundStatus[]>> = {
  [R.DRAFT]: [R.REQUESTED, R.CANCELLED],
  [R.REQUESTED]: [R.UNDER_REVIEW, R.CANCELLED],
  [R.UNDER_REVIEW]: [R.APPROVED, R.REJECTED, R.CANCELLED],
  [R.APPROVED]: [R.PROCESSING, R.CANCELLED],
  [R.REJECTED]: [],
  [R.PROCESSING]: [R.COMPLETED, R.FAILED],
  [R.COMPLETED]: [],
  [R.FAILED]: [R.PROCESSING, R.CANCELLED],
  [R.CANCELLED]: [],
}

export function canTransitionFine(from: FineStatus, to: FineStatus): boolean {
  return FINE_TRANSITIONS[from].includes(to)
}

export function canTransitionToll(from: TollStatus, to: TollStatus): boolean {
  return TOLL_TRANSITIONS[from].includes(to)
}

export function canTransitionRefund(from: RefundStatus, to: RefundStatus): boolean {
  return REFUND_TRANSITIONS[from].includes(to)
}

/** Recovery amount from configurable policy. Does not invent tax/legal treatment. */
export function calculateRecoveryAmount(
  authorityAmount: string,
  policy: 'EXACT' | 'EXACT_PLUS_ADMIN',
  adminFee = '0.00',
): { recoveryAmount: string; adminFee: string } {
  const amount = normalizeMoney(authorityAmount)
  const fee = normalizeMoney(adminFee)
  if (policy === 'EXACT_PLUS_ADMIN') {
    return { recoveryAmount: addMoney(amount, fee), adminFee: fee }
  }
  return { recoveryAmount: amount, adminFee: '0.00' }
}
