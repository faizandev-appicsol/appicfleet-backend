import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import {
  addLeaveDays,
  compareLeaveDays,
  divideLeaveDays,
  minLeaveDays,
  normalizeLeaveDays,
  subtractLeaveDays,
} from '../../src/utils/leave-days.js'
import { computeLeaveDaysRequested } from '../../src/services/workforce/leave-days-request.js'
import { LEAVE_DAY_PARTS } from '../../src/constants/workforce.js'

describe('leave day arithmetic', () => {
  it('normalizes and adds without floats', () => {
    assert.equal(normalizeLeaveDays('2'), '2.00')
    assert.equal(addLeaveDays('2.00', '0.50', '1.25'), '3.75')
  })

  it('computes available = opening + accrued + adjusted - used - pending', () => {
    const available = subtractLeaveDays(
      addLeaveDays('10.00', '2.00', '1.00'),
      addLeaveDays('3.00', '1.50'),
    )
    assert.equal(available, '8.50')
  })

  it('divides annual entitlement for monthly accrual', () => {
    assert.equal(divideLeaveDays('24.00', 12), '2.00')
  })

  it('caps carry-forward', () => {
    assert.equal(minLeaveDays('10.00', '5.00'), '5.00')
    assert.equal(compareLeaveDays('5.00', '5.00'), 0)
  })
})

describe('leave request day parts', () => {
  it('counts inclusive full days', () => {
    assert.equal(
      computeLeaveDaysRequested({
        startDate: '2026-04-01',
        endDate: '2026-04-03',
        dayPart: LEAVE_DAY_PARTS.FULL_DAY,
      }),
      '3.00',
    )
  })

  it('supports half-day and partial hours', () => {
    assert.equal(
      computeLeaveDaysRequested({
        startDate: '2026-04-01',
        endDate: '2026-04-01',
        dayPart: LEAVE_DAY_PARTS.HALF_DAY_AM,
      }),
      '0.50',
    )
    assert.equal(
      computeLeaveDaysRequested({
        startDate: '2026-04-01',
        endDate: '2026-04-01',
        dayPart: LEAVE_DAY_PARTS.PARTIAL_HOURS,
        partialHours: '4',
      }),
      '0.50',
    )
  })
})
