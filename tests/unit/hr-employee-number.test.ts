import assert from 'node:assert/strict'
import { describe, it } from 'vitest'

describe('employee number format', () => {
  it('pads counter sequences as EMP-######', () => {
    const format = (seq: number) => `EMP-${String(seq).padStart(6, '0')}`
    assert.equal(format(1), 'EMP-000001')
    assert.equal(format(42), 'EMP-000042')
    assert.equal(format(100000), 'EMP-100000')
  })
})
