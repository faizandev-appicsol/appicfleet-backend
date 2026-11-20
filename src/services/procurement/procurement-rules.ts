import {
  EXPENSE_STATUSES,
  LPO_STATUSES,
  VENDOR_BILL_STATUSES,
  WORK_ORDER_STATUSES,
  type ExpenseStatus,
  type LpoStatus,
  type VendorBillStatus,
  type WorkOrderStatus,
} from '../../constants/procurement.js'
import { compareMoney, normalizeMoney } from '../../utils/money.js'
import { DEFAULT_APPROVAL_THRESHOLDS } from '../../constants/procurement.js'

const L = LPO_STATUSES
const B = VENDOR_BILL_STATUSES
const E = EXPENSE_STATUSES
const W = WORK_ORDER_STATUSES

export const LPO_TRANSITIONS: Readonly<Record<LpoStatus, readonly LpoStatus[]>> = {
  [L.DRAFT]: [L.PENDING_APPROVAL, L.CANCELLED],
  [L.PENDING_APPROVAL]: [L.APPROVED, L.DRAFT, L.CANCELLED],
  [L.APPROVED]: [L.SENT, L.CANCELLED, L.CLOSED],
  [L.SENT]: [L.PARTIALLY_RECEIVED, L.RECEIVED, L.CANCELLED, L.CLOSED],
  [L.PARTIALLY_RECEIVED]: [L.RECEIVED, L.CLOSED, L.CANCELLED],
  [L.RECEIVED]: [L.CLOSED],
  [L.CANCELLED]: [],
  [L.CLOSED]: [],
}

export const BILL_TRANSITIONS: Readonly<Record<VendorBillStatus, readonly VendorBillStatus[]>> = {
  [B.DRAFT]: [B.PENDING_REVIEW, B.CANCELLED],
  [B.PENDING_REVIEW]: [B.APPROVED, B.DRAFT, B.CANCELLED],
  [B.APPROVED]: [B.POSTED, B.CANCELLED],
  [B.POSTED]: [],
  [B.CANCELLED]: [],
}

export const EXPENSE_TRANSITIONS: Readonly<Record<ExpenseStatus, readonly ExpenseStatus[]>> = {
  [E.DRAFT]: [E.SUBMITTED, E.CANCELLED],
  [E.SUBMITTED]: [E.APPROVED, E.DRAFT, E.CANCELLED],
  [E.APPROVED]: [E.POSTED, E.CANCELLED],
  [E.POSTED]: [],
  [E.CANCELLED]: [],
}

export const WORK_ORDER_TRANSITIONS: Readonly<Record<WorkOrderStatus, readonly WorkOrderStatus[]>> = {
  [W.DRAFT]: [W.REQUESTED, W.CANCELLED],
  [W.REQUESTED]: [W.APPROVED, W.DRAFT, W.CANCELLED],
  [W.APPROVED]: [W.SCHEDULED, W.CANCELLED],
  [W.SCHEDULED]: [W.IN_PROGRESS, W.WAITING_FOR_PARTS, W.CANCELLED],
  [W.IN_PROGRESS]: [W.WAITING_FOR_PARTS, W.COMPLETED, W.CANCELLED],
  [W.WAITING_FOR_PARTS]: [W.IN_PROGRESS, W.COMPLETED, W.CANCELLED],
  [W.COMPLETED]: [],
  [W.CANCELLED]: [],
}

export function canTransitionLpo(from: LpoStatus, to: LpoStatus): boolean {
  return LPO_TRANSITIONS[from].includes(to)
}

export function canTransitionBill(from: VendorBillStatus, to: VendorBillStatus): boolean {
  return BILL_TRANSITIONS[from].includes(to)
}

export function canTransitionExpense(from: ExpenseStatus, to: ExpenseStatus): boolean {
  return EXPENSE_TRANSITIONS[from].includes(to)
}

export function canTransitionWorkOrder(from: WorkOrderStatus, to: WorkOrderStatus): boolean {
  return WORK_ORDER_TRANSITIONS[from].includes(to)
}

export function assertLpoMutable(status: LpoStatus): void {
  if (status !== L.DRAFT) throw new Error('Only draft LPOs can be edited.')
}

export function assertBillMutable(status: VendorBillStatus): void {
  if (status !== B.DRAFT) throw new Error('Only draft vendor bills can be edited.')
}

export function assertExpenseMutable(status: ExpenseStatus): void {
  if (status !== E.DRAFT) throw new Error('Only draft expenses can be edited.')
}

/** Remaining billable quantity on an LPO line after prior posted/approved bills. */
export function remainingBillableQty(ordered: number, alreadyBilled: number): number {
  return Math.max(0, ordered - alreadyBilled)
}

export function approvalLevelForAmount(amount: string): string {
  const normalized = normalizeMoney(amount)
  for (const band of DEFAULT_APPROVAL_THRESHOLDS) {
    if (band.maxAmount === null) return band.level
    if (compareMoney(normalized, band.maxAmount) <= 0) return band.level
  }
  return 'HIGHER'
}

export function billPaymentStatus(total: string, paid: string): 'UNPAID' | 'PARTIAL' | 'PAID' {
  if (compareMoney(paid, '0.00') <= 0) return 'UNPAID'
  if (compareMoney(paid, total) >= 0) return 'PAID'
  return 'PARTIAL'
}

export function matchBillAgainstLpo(input: {
  lpoVendorId: string
  billVendorId: string
  lpoCurrency: string
  billCurrency: string
  lpoTotal: string
  billTotal: string
  remainingQtyOk: boolean
}): string {
  if (input.lpoVendorId !== input.billVendorId) return 'VENDOR_MISMATCH'
  if (input.lpoCurrency !== input.billCurrency) return 'CURRENCY_MISMATCH'
  if (!input.remainingQtyOk) return 'QUANTITY_MISMATCH'
  if (compareMoney(input.billTotal, input.lpoTotal) > 0) return 'AMOUNT_MISMATCH'
  return 'MATCH'
}
