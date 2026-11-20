import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { DOC_STATUSES, PAYMENT_STATUSES } from '../../src/constants/finance.js'
import {
  canApplyDeposit,
  canReleaseDeposit,
  canTransitionDoc,
  canTransitionPayment,
  creditCapacity,
  decidePaymentIdempotency,
  invoicePaymentStatus,
} from '../../src/services/finance/finance-rules.js'
import { calculateInvoice } from '../../src/services/finance/invoice-calc.js'
import { addMoney, compareMoney, normalizeMoney, percentOfMoney, subtractMoney } from '../../src/utils/money.js'

const D = DOC_STATUSES
const P = PAYMENT_STATUSES

describe('finance document transitions', () => {
  it('allows draft to posted and posted to voided only', () => {
    assert.equal(canTransitionDoc(D.DRAFT, D.POSTED), true)
    assert.equal(canTransitionDoc(D.POSTED, D.VOIDED), true)
    assert.equal(canTransitionDoc(D.POSTED, D.DRAFT), false)
    assert.equal(canTransitionDoc(D.VOIDED, D.POSTED), false)
  })
})

describe('payment transitions', () => {
  it('blocks invalid recovery paths', () => {
    assert.equal(canTransitionPayment(P.PENDING, P.COMPLETED), true)
    assert.equal(canTransitionPayment(P.FAILED, P.COMPLETED), false)
    assert.equal(canTransitionPayment(P.COMPLETED, P.REVERSED), true)
  })
})

describe('invoice calculation', () => {
  it('recalculates totals with decimal-safe money', () => {
    const totals = calculateInvoice(
      [
        {
          description: 'Rental',
          quantity: 2,
          unitPrice: '100.00',
          discountAmount: '20.00',
          taxRatePercent: '5.00',
        },
      ],
      '5.00',
    )
    assert.equal(totals.subtotal, '200.00')
    assert.equal(totals.discountTotal, '20.00')
    assert.equal(totals.taxableAmount, '180.00')
    assert.equal(totals.taxAmount, '9.00')
    assert.equal(totals.totalAmount, '189.00')
  })

  it('never uses floating point for percent tax', () => {
    assert.equal(percentOfMoney('180.00', '5.00'), '9.00')
    assert.equal(addMoney('180.00', '9.00'), '189.00')
  })
})

describe('credit capacity', () => {
  it('prevents credits above invoice total', () => {
    assert.equal(creditCapacity('1000.00', '0.00'), '1000.00')
    assert.equal(creditCapacity('1000.00', '200.00'), '800.00')
    assert.equal(creditCapacity('1000.00', '1000.00'), '0.00')
  })
})

describe('payment idempotency decision', () => {
  it('replays completed keys and rejects mismatches', () => {
    assert.equal(decidePaymentIdempotency(null, 'abc'), 'proceed')
    assert.equal(decidePaymentIdempotency({ requestHash: 'abc', paymentId: '1' }, 'abc'), 'replay')
    assert.equal(decidePaymentIdempotency({ requestHash: 'abc' }, 'abc'), 'busy')
    assert.equal(decidePaymentIdempotency({ requestHash: 'abc', paymentId: '1' }, 'xyz'), 'mismatch')
  })
})

describe('allocation and deposit guards', () => {
  it('keeps outstanding non-negative', () => {
    const outstanding = subtractMoney('1000.00', '600.00')
    assert.equal(outstanding, '400.00')
    assert.equal(compareMoney('600.00', '1000.00') <= 0, true)
  })

  it('derives invoice payment status', () => {
    assert.equal(invoicePaymentStatus('1000.00', '0.00'), 'UNPAID')
    assert.equal(invoicePaymentStatus('1000.00', '400.00'), 'PARTIAL')
    assert.equal(invoicePaymentStatus('1000.00', '1000.00'), 'PAID')
  })

  it('limits deposit apply and release to remaining', () => {
    assert.equal(canApplyDeposit('1500.00', '500.00'), true)
    assert.equal(canApplyDeposit('1500.00', '1600.00'), false)
    assert.equal(canReleaseDeposit('1500.00', '1500.00'), true)
    assert.equal(canReleaseDeposit('1500.00', '0.00'), false)
  })

  it('normalizes money strings', () => {
    assert.equal(normalizeMoney('150'), '150.00')
  })
})
