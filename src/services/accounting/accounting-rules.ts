import {
  ACCOUNT_TYPE_NORMAL_BALANCE,
  JOURNAL_STATUSES,
  PERIOD_STATUSES,
  type AccountType,
  type JournalStatus,
  type NormalBalance,
  type PeriodStatus,
} from '../../constants/accounting.js'
import { addMoney, compareMoney, isZeroMoney, normalizeMoney, subtractMoney } from '../../utils/money.js'

const J = JOURNAL_STATUSES
const P = PERIOD_STATUSES

export const JOURNAL_TRANSITIONS: Readonly<Record<JournalStatus, readonly JournalStatus[]>> = {
  [J.DRAFT]: [J.POSTED, J.CANCELLED],
  [J.POSTED]: [J.REVERSED],
  [J.REVERSED]: [],
  [J.CANCELLED]: [],
}

export const PERIOD_TRANSITIONS: Readonly<Record<PeriodStatus, readonly PeriodStatus[]>> = {
  [P.OPEN]: [P.CLOSED],
  [P.CLOSED]: [P.OPEN, P.LOCKED],
  [P.LOCKED]: [],
}

export function canTransitionJournal(from: JournalStatus, to: JournalStatus): boolean {
  return JOURNAL_TRANSITIONS[from].includes(to)
}

export function canTransitionPeriod(from: PeriodStatus, to: PeriodStatus): boolean {
  return PERIOD_TRANSITIONS[from].includes(to)
}

export function normalBalanceForType(accountType: AccountType): NormalBalance {
  return ACCOUNT_TYPE_NORMAL_BALANCE[accountType]
}

export type LineValidationIssue =
  | 'BOTH_DEBIT_AND_CREDIT'
  | 'ZERO_LINE'
  | 'NEGATIVE_AMOUNT'
  | 'INVALID_AMOUNT'

export function validateJournalLineAmounts(line: { debit: string; credit: string }): LineValidationIssue | null {
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(line.debit) || !/^\d{1,12}(\.\d{1,2})?$/.test(line.credit)) {
    return 'INVALID_AMOUNT'
  }
  const debit = normalizeMoney(line.debit)
  const credit = normalizeMoney(line.credit)
  const debitZero = isZeroMoney(debit)
  const creditZero = isZeroMoney(credit)
  if (!debitZero && !creditZero) return 'BOTH_DEBIT_AND_CREDIT'
  if (debitZero && creditZero) return 'ZERO_LINE'
  return null
}

export function sumDebits(lines: Array<{ debit: string }>): string {
  if (lines.length === 0) return '0.00'
  return addMoney(...lines.map((line) => normalizeMoney(line.debit)))
}

export function sumCredits(lines: Array<{ credit: string }>): string {
  if (lines.length === 0) return '0.00'
  return addMoney(...lines.map((line) => normalizeMoney(line.credit)))
}

export function isJournalBalanced(lines: Array<{ debit: string; credit: string }>): boolean {
  if (lines.length < 2) return false
  return compareMoney(sumDebits(lines), sumCredits(lines)) === 0
}

export function journalDifference(lines: Array<{ debit: string; credit: string }>): string {
  const debit = sumDebits(lines)
  const credit = sumCredits(lines)
  if (compareMoney(debit, credit) >= 0) return subtractMoney(debit, credit)
  return subtractMoney(credit, debit)
}

/**
 * Movement contribution for running balance.
 * Debit-normal: +debit − credit. Credit-normal: +credit − debit.
 * Returns a money string; may be negative with a leading minus for display math only.
 */
export function signedMovement(normalBalance: NormalBalance, debit: string, credit: string): string {
  const d = normalizeMoney(debit)
  const c = normalizeMoney(credit)
  if (normalBalance === 'DEBIT') {
    return compareMoney(d, c) >= 0 ? subtractMoney(d, c) : `-${subtractMoney(c, d)}`
  }
  return compareMoney(c, d) >= 0 ? subtractMoney(c, d) : `-${subtractMoney(d, c)}`
}

export function addSignedMoney(balance: string, movement: string): string {
  const leftNegative = balance.startsWith('-')
  const rightNegative = movement.startsWith('-')
  const left = leftNegative ? balance.slice(1) : balance
  const right = rightNegative ? movement.slice(1) : movement
  if (!leftNegative && !rightNegative) return addMoney(left || '0.00', right || '0.00')
  if (leftNegative && rightNegative) return `-${addMoney(left || '0.00', right || '0.00')}`
  if (leftNegative) {
    return compareMoney(right || '0.00', left || '0.00') >= 0
      ? subtractMoney(right || '0.00', left || '0.00')
      : `-${subtractMoney(left || '0.00', right || '0.00')}`
  }
  return compareMoney(left || '0.00', right || '0.00') >= 0
    ? subtractMoney(left || '0.00', right || '0.00')
    : `-${subtractMoney(right || '0.00', left || '0.00')}`
}

/** Detect circular parent: proposedParentId is self or ancestor loop into accountId. */
export function wouldCreateAccountCycle(
  accountId: string,
  proposedParentId: string | undefined,
  parentById: Map<string, string | undefined>,
): boolean {
  if (!proposedParentId) return false
  if (proposedParentId === accountId) return true
  let current: string | undefined = proposedParentId
  const seen = new Set<string>()
  while (current) {
    if (current === accountId) return true
    if (seen.has(current)) return true
    seen.add(current)
    current = parentById.get(current)
  }
  return false
}

export function periodContainsDate(startDate: Date, endDate: Date, accountingDate: Date): boolean {
  return accountingDate >= startDate && accountingDate <= endDate
}
