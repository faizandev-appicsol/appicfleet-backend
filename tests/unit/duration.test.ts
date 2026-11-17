import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { parseDurationSeconds } from '../../src/utils/duration.js'

describe('parseDurationSeconds', () => {
  it('converts minutes, hours, and days', () => {
    assert.equal(parseDurationSeconds('15m'), 900)
    assert.equal(parseDurationSeconds('2h'), 7200)
    assert.equal(parseDurationSeconds('7d'), 604800)
  })

  it('rejects values without a unit', () => {
    assert.throws(() => parseDurationSeconds('15'), /Invalid duration/)
  })
})
