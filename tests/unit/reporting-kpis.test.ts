import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { UTILIZATION_ELIGIBLE_STATUSES } from '../../src/constants/reporting.js'
import { VEHICLE_STATUSES } from '../../src/constants/vehicles.js'
import { percentChange } from '../../src/services/reporting/date-range.js'

describe('reporting KPI helpers', () => {
  it('defines utilization eligible statuses from vehicle module values', () => {
    for (const status of UTILIZATION_ELIGIBLE_STATUSES) {
      assert.ok(Object.values(VEHICLE_STATUSES).includes(status))
    }
    assert.ok(!UTILIZATION_ELIGIBLE_STATUSES.includes(VEHICLE_STATUSES.INACTIVE as never))
    assert.ok(!UTILIZATION_ELIGIBLE_STATUSES.includes(VEHICLE_STATUSES.OUT_OF_SERVICE as never))
  })

  it('computes fleet utilization percent as rented / eligible', () => {
    const rented = 8
    const eligible = 20
    const utilizationPercent = Math.round((rented / eligible) * 10000) / 100
    assert.equal(utilizationPercent, 40)
    assert.equal(percentChange(8, 5), 60)
  })
})
