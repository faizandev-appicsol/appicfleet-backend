import assert from 'node:assert/strict'
import { describe, it, vi } from 'vitest'
import { recordAuditEvent, sanitizeMetadata } from '../../src/services/audit/audit.service.js'
import { REDACTED_VALUE, redactFields } from '../../src/services/field-access/field-access.service.js'
import { db } from '../helpers/fake-repositories.js'

const state = vi.hoisted(() => ({ failNextWrite: false }))

vi.mock('../../src/repositories/audit/audit-event.repository.js', async () => {
  const fakes = await import('../helpers/fake-repositories.js')
  return {
    insertAuditEvent: async (event: unknown) => {
      if (state.failNextWrite) throw new Error('database down')
      await fakes.auditRepository.insertAuditEvent(event as never)
    },
  }
})

describe('audit metadata', () => {
  it('strips credential-like keys at any depth', () => {
    const result = sanitizeMetadata({
      reason: 'invalid_credentials',
      password: 'hunter2',
      nested: { refreshToken: 'abc', accessToken: 'def', ok: 1, passwordHash: '$2b$12$x' },
      list: [{ secret: 'x', keep: true }],
      apiKey: 'k',
    })

    assert.equal(result.reason, 'invalid_credentials')
    assert.equal(result.password, '[REDACTED]')
    assert.equal(result.apiKey, '[REDACTED]')
    assert.deepEqual(result.nested, {
      refreshToken: '[REDACTED]',
      accessToken: '[REDACTED]',
      ok: 1,
      passwordHash: '[REDACTED]',
    })
    assert.deepEqual(result.list, [{ secret: '[REDACTED]', keep: true }])
    assert.ok(!JSON.stringify(result).includes('hunter2'))
  })

  it('never throws to the caller when the write fails', async () => {
    db.reset()
    state.failNextWrite = true
    await assert.doesNotReject(
      recordAuditEvent({ action: 'user.update', entityType: 'user', metadata: { password: 'x' } }),
    )
    state.failNextWrite = false
    assert.equal(db.auditEvents.length, 0)

    await recordAuditEvent({
      action: 'user.update',
      entityType: 'user',
      metadata: { password: 'x', field: 'name' },
      meta: { requestId: 'req-1' },
    })
    assert.equal(db.auditEvents.length, 1)
    assert.equal(db.auditEvents[0]?.requestId, 'req-1')
    assert.equal(db.auditEvents[0]?.result, 'success')
    assert.equal(db.auditEvents[0]?.metadata.password, '[REDACTED]')
  })
})

describe('field access', () => {
  const record = { id: '1', name: 'Ada', salary: 120000, bankAccount: 'PK00-1234' }

  it('replaces protected fields when not allowed', () => {
    const result = redactFields(record, ['salary', 'bankAccount'], false)
    assert.equal(result.salary, REDACTED_VALUE)
    assert.equal(result.bankAccount, '[REDACTED]')
    assert.equal(result.name, 'Ada')
    // The input is never mutated.
    assert.equal(record.salary, 120000)
  })

  it('returns the values when allowed', () => {
    const result = redactFields(record, ['salary'], true)
    assert.equal(result.salary, 120000)
    assert.notEqual(result, record)
  })

  it('does not invent fields that are absent', () => {
    const result = redactFields({ id: '1' } as { id: string; salary?: number }, ['salary'], false)
    assert.ok(!('salary' in result))
  })
})
