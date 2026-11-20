import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import {
  CYCLE_STATUSES,
  REVIEW_STATUSES,
  WEIGHT_TOTAL,
} from '../../src/constants/performance.js'
import { AppError } from '../../src/exceptions/AppError.js'
import {
  assertCycleTransition,
  assertReviewTransition,
} from '../../src/services/performance/transitions.js'
import {
  assertGoalWeightsTotal100,
  computeNumericProgress,
  sumWeights,
  weightedAverage,
} from '../../src/services/performance/weight-math.js'

describe('performance cycle transitions', () => {
  it('allows draft → configuring → open', () => {
    assert.doesNotThrow(() =>
      assertCycleTransition(CYCLE_STATUSES.DRAFT, CYCLE_STATUSES.CONFIGURING),
    )
    assert.doesNotThrow(() =>
      assertCycleTransition(CYCLE_STATUSES.CONFIGURING, CYCLE_STATUSES.OPEN),
    )
  })

  it('rejects completed → open', () => {
    assert.throws(
      () => assertCycleTransition(CYCLE_STATUSES.COMPLETED, CYCLE_STATUSES.OPEN),
      AppError,
    )
  })
})

describe('performance review transitions', () => {
  it('allows self → manager → final → approved → completed', () => {
    assert.doesNotThrow(() =>
      assertReviewTransition(REVIEW_STATUSES.SELF_REVIEW, REVIEW_STATUSES.MANAGER_REVIEW),
    )
    assert.doesNotThrow(() =>
      assertReviewTransition(REVIEW_STATUSES.MANAGER_REVIEW, REVIEW_STATUSES.FINAL_REVIEW),
    )
    assert.doesNotThrow(() =>
      assertReviewTransition(REVIEW_STATUSES.FINAL_REVIEW, REVIEW_STATUSES.APPROVED),
    )
    assert.doesNotThrow(() =>
      assertReviewTransition(REVIEW_STATUSES.APPROVED, REVIEW_STATUSES.COMPLETED),
    )
  })

  it('rejects completed → manager review', () => {
    assert.throws(
      () => assertReviewTransition(REVIEW_STATUSES.COMPLETED, REVIEW_STATUSES.MANAGER_REVIEW),
      AppError,
    )
  })
})

describe('goal weight math', () => {
  it('sums weights without floating point drift', () => {
    assert.equal(sumWeights(['40.00', '20.00', '20.00', '20.00']), WEIGHT_TOTAL)
  })

  it('rejects totals that are not 100.00', () => {
    assert.throws(() => assertGoalWeightsTotal100(['40.00', '40.00']), AppError)
  })

  it('computes numeric progress capped at 100', () => {
    assert.equal(computeNumericProgress('100.00', '75.00'), '75.00')
    assert.equal(computeNumericProgress('100.00', '150.00'), '100.00')
  })

  it('computes weighted average from decimal weights', () => {
    assert.equal(
      weightedAverage([
        { rating: 4, weight: '50.00' },
        { rating: 2, weight: '50.00' },
      ]),
      '3.00',
    )
  })
})
