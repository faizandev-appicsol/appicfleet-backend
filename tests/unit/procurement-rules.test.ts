import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import {
  EXPENSE_STATUSES,
  LPO_STATUSES,
  VENDOR_BILL_STATUSES,
  WORK_ORDER_STATUSES,
} from '../../src/constants/procurement.js'
import {
  approvalLevelForAmount,
  billPaymentStatus,
  canTransitionBill,
  canTransitionExpense,
  canTransitionLpo,
  canTransitionWorkOrder,
  matchBillAgainstLpo,
  remainingBillableQty,
} from '../../src/services/procurement/procurement-rules.js'
import { calculateInvoice } from '../../src/services/finance/invoice-calc.js'
import { multiplyMoney } from '../../src/utils/money.js'

const L = LPO_STATUSES
const B = VENDOR_BILL_STATUSES
const E = EXPENSE_STATUSES
const W = WORK_ORDER_STATUSES

describe('LPO transitions', () => {
  it('allows draft submit and blocks closed reopen', () => {
    assert.equal(canTransitionLpo(L.DRAFT, L.PENDING_APPROVAL), true)
    assert.equal(canTransitionLpo(L.PENDING_APPROVAL, L.APPROVED), true)
    assert.equal(canTransitionLpo(L.CLOSED, L.DRAFT), false)
    assert.equal(canTransitionLpo(L.CANCELLED, L.APPROVED), false)
  })
})

describe('vendor bill transitions', () => {
  it('supports review and post without reopen', () => {
    assert.equal(canTransitionBill(B.DRAFT, B.PENDING_REVIEW), true)
    assert.equal(canTransitionBill(B.APPROVED, B.POSTED), true)
    assert.equal(canTransitionBill(B.POSTED, B.DRAFT), false)
  })
})

describe('expense and work order transitions', () => {
  it('blocks completed reopen', () => {
    assert.equal(canTransitionExpense(E.DRAFT, E.SUBMITTED), true)
    assert.equal(canTransitionExpense(E.POSTED, E.DRAFT), false)
    assert.equal(canTransitionWorkOrder(W.IN_PROGRESS, W.COMPLETED), true)
    assert.equal(canTransitionWorkOrder(W.COMPLETED, W.IN_PROGRESS), false)
  })
})

describe('LPO bill matching and remaining quantity', () => {
  it('prevents overbilling remaining quantity', () => {
    assert.equal(remainingBillableQty(10, 6), 4)
    assert.equal(remainingBillableQty(10, 10), 0)
  })

  it('flags amount and vendor mismatches', () => {
    assert.equal(
      matchBillAgainstLpo({
        lpoVendorId: 'v1',
        billVendorId: 'v1',
        lpoCurrency: 'AED',
        billCurrency: 'AED',
        lpoTotal: '5000.00',
        billTotal: '5000.00',
        remainingQtyOk: true,
      }),
      'MATCH',
    )
    assert.equal(
      matchBillAgainstLpo({
        lpoVendorId: 'v1',
        billVendorId: 'v1',
        lpoCurrency: 'AED',
        billCurrency: 'AED',
        lpoTotal: '5000.00',
        billTotal: '6000.00',
        remainingQtyOk: true,
      }),
      'AMOUNT_MISMATCH',
    )
    assert.equal(
      matchBillAgainstLpo({
        lpoVendorId: 'v1',
        billVendorId: 'v2',
        lpoCurrency: 'AED',
        billCurrency: 'AED',
        lpoTotal: '5000.00',
        billTotal: '5000.00',
        remainingQtyOk: true,
      }),
      'VENDOR_MISMATCH',
    )
  })
})

describe('approval bands and payment status', () => {
  it('maps amounts to configurable levels', () => {
    assert.equal(approvalLevelForAmount('500.00'), 'STANDARD')
    assert.equal(approvalLevelForAmount('5000.00'), 'MANAGER')
    assert.equal(approvalLevelForAmount('15000.00'), 'HIGHER')
  })

  it('derives bill payment status from allocations', () => {
    assert.equal(billPaymentStatus('1000.00', '0.00'), 'UNPAID')
    assert.equal(billPaymentStatus('1000.00', '400.00'), 'PARTIAL')
    assert.equal(billPaymentStatus('1000.00', '1000.00'), 'PAID')
  })
})

describe('procurement money math', () => {
  it('reuses decimal-safe invoice calculation for LPO lines', () => {
    const totals = calculateInvoice(
      [{ description: 'Tyres', quantity: 4, unitPrice: '450.00', taxRatePercent: '5.00' }],
      '5.00',
    )
    assert.equal(totals.subtotal, '1800.00')
    assert.equal(totals.taxAmount, '90.00')
    assert.equal(totals.totalAmount, '1890.00')
  })

  it('allocates borrow daily cost without floating point', () => {
    assert.equal(multiplyMoney('100.00', 5), '500.00')
  })
})
