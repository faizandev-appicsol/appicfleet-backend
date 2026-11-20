import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import {
  FINE_STATUSES,
  REFUND_STATUSES,
  TOLL_STATUSES,
} from '../../src/constants/charges.js'
import {
  calculateRecoveryAmount,
  canTransitionFine,
  canTransitionRefund,
  canTransitionToll,
} from '../../src/services/charges/charges-rules.js'

const F = FINE_STATUSES
const T = TOLL_STATUSES
const R = REFUND_STATUSES

describe('fine transitions', () => {
  it('allows review and recovery path and blocks recovered reopen', () => {
    assert.equal(canTransitionFine(F.IMPORTED, F.PENDING_REVIEW), true)
    assert.equal(canTransitionFine(F.ASSIGNED, F.APPROVED), true)
    assert.equal(canTransitionFine(F.APPROVED, F.RECOVERY_PENDING), true)
    assert.equal(canTransitionFine(F.RECOVERY_PENDING, F.RECOVERED), true)
    assert.equal(canTransitionFine(F.RECOVERED, F.APPROVED), false)
    assert.equal(canTransitionFine(F.WAIVED, F.ASSIGNED), false)
  })

  it('supports dispute and waiver from assigned', () => {
    assert.equal(canTransitionFine(F.ASSIGNED, F.DISPUTED), true)
    assert.equal(canTransitionFine(F.DISPUTED, F.ASSIGNED), true)
    assert.equal(canTransitionFine(F.ASSIGNED, F.WAIVED), true)
  })
})

describe('toll transitions', () => {
  it('mirrors fine recovery workflow', () => {
    assert.equal(canTransitionToll(T.IMPORTED, T.ASSIGNED), true)
    assert.equal(canTransitionToll(T.ASSIGNED, T.APPROVED), true)
    assert.equal(canTransitionToll(T.APPROVED, T.RECOVERY_PENDING), true)
    assert.equal(canTransitionToll(T.RECOVERED, T.APPROVED), false)
  })
})

describe('refund transitions', () => {
  it('enforces request → review → approve → execute', () => {
    assert.equal(canTransitionRefund(R.DRAFT, R.REQUESTED), true)
    assert.equal(canTransitionRefund(R.REQUESTED, R.UNDER_REVIEW), true)
    assert.equal(canTransitionRefund(R.UNDER_REVIEW, R.APPROVED), true)
    assert.equal(canTransitionRefund(R.APPROVED, R.PROCESSING), true)
    assert.equal(canTransitionRefund(R.PROCESSING, R.COMPLETED), true)
    assert.equal(canTransitionRefund(R.COMPLETED, R.APPROVED), false)
    assert.equal(canTransitionRefund(R.FAILED, R.PROCESSING), true)
  })
})

describe('recovery amount policy', () => {
  it('returns exact authority amount by default', () => {
    const result = calculateRecoveryAmount('500.00', 'EXACT')
    assert.equal(result.recoveryAmount, '500.00')
    assert.equal(result.adminFee, '0.00')
  })

  it('adds admin fee when configured', () => {
    const result = calculateRecoveryAmount('500.00', 'EXACT_PLUS_ADMIN', '25.00')
    assert.equal(result.recoveryAmount, '525.00')
    assert.equal(result.adminFee, '25.00')
  })
})

describe('event-time assignment boundary contract', () => {
  /**
   * Half-open intervals: startsAt <= t < endsAt.
   * Replacement at 05 Jan means Contract A ends at 05 Jan (exclusive)
   * and Contract B starts at 05 Jan (inclusive).
   * A fine at 07 Jan must resolve to Contract B.
   * A fine exactly at 05 Jan must resolve to Contract B.
   */
  it('documents half-open responsibility windows', () => {
    const windows = [
      { contract: 'A', startsAt: Date.parse('2026-01-01T00:00:00Z'), endsAt: Date.parse('2026-01-05T00:00:00Z') },
      { contract: 'B', startsAt: Date.parse('2026-01-05T00:00:00Z'), endsAt: Date.parse('2026-01-10T00:00:00Z') },
    ]
    const covers = (t: number) =>
      windows.filter((w) => w.startsAt <= t && t < w.endsAt).map((w) => w.contract)

    assert.deepEqual(covers(Date.parse('2026-01-04T23:59:59Z')), ['A'])
    assert.deepEqual(covers(Date.parse('2026-01-05T00:00:00Z')), ['B'])
    assert.deepEqual(covers(Date.parse('2026-01-07T10:30:00Z')), ['B'])
    assert.deepEqual(covers(Date.parse('2026-01-10T00:00:00Z')), [])
  })
})
