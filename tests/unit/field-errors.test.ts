import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { z } from 'zod'
import { fieldErrorsFromZod } from '../../src/utils/fieldErrors.js'

describe('fieldErrorsFromZod', () => {
  it('keeps field messages from a failed parse', () => {
    const parsed = z
      .object({
        email: z.email('Enter a valid email address'),
        name: z.string().min(2, 'Name must be at least 2 characters'),
      })
      .safeParse({ email: 'not-an-email', name: 'A' })

    assert.equal(parsed.success, false)
    if (parsed.success) return

    const errors = fieldErrorsFromZod(parsed.error)
    assert.equal(errors.email?.[0], 'Enter a valid email address')
    assert.equal(errors.name?.[0], 'Name must be at least 2 characters')
  })
})
