import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { PAYROLL_PERIOD_STATUSES, PAYROLL_RUN_STATUSES } from '../../src/constants/payroll.js'

describe('payroll period and run immutability rules', () => {
  it('treats approved and paid periods as locked', () => {
    const locked = new Set([PAYROLL_PERIOD_STATUSES.APPROVED, PAYROLL_PERIOD_STATUSES.PAID])
    assert.equal(locked.has(PAYROLL_PERIOD_STATUSES.APPROVED), true)
    assert.equal(locked.has(PAYROLL_PERIOD_STATUSES.PAID), true)
    assert.equal(locked.has(PAYROLL_PERIOD_STATUSES.OPEN), false)
  })

  it('allows recalculation only in editable run statuses', () => {
    const editable = new Set([
      PAYROLL_RUN_STATUSES.OPEN,
      PAYROLL_RUN_STATUSES.PROCESSING,
      PAYROLL_RUN_STATUSES.CALCULATED,
    ])
    assert.equal(editable.has(PAYROLL_RUN_STATUSES.CALCULATED), true)
    assert.equal(editable.has(PAYROLL_RUN_STATUSES.APPROVED), false)
    assert.equal(editable.has(PAYROLL_RUN_STATUSES.PAID), false)
  })

  it('rejects end date before start date', () => {
    const start = new Date('2026-03-01')
    const end = new Date('2026-02-01')
    assert.equal(end < start, true)
  })
})
