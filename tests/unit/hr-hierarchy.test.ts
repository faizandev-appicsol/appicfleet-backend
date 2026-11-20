import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import {
  HR_DOCUMENT_EXPIRY_WARNING_DAYS,
  HR_DOCUMENT_STATUSES,
} from '../../src/constants/hr.js'
import { resolveDocumentExpiryStatus } from '../../src/services/hr/hr-document-status.js'
import { redactFields } from '../../src/services/field-access/field-access.service.js'

describe('hr document expiry status', () => {
  it('marks expired and expiring-soon correctly', () => {
    const now = new Date('2026-06-01T00:00:00.000Z')
    assert.equal(
      resolveDocumentExpiryStatus(new Date('2026-05-01T00:00:00.000Z'), now),
      HR_DOCUMENT_STATUSES.EXPIRED,
    )
    assert.equal(
      resolveDocumentExpiryStatus(
        new Date(now.getTime() + (HR_DOCUMENT_EXPIRY_WARNING_DAYS - 1) * 86400000),
        now,
      ),
      HR_DOCUMENT_STATUSES.EXPIRING_SOON,
    )
    assert.equal(
      resolveDocumentExpiryStatus(
        new Date(now.getTime() + (HR_DOCUMENT_EXPIRY_WARNING_DAYS + 10) * 86400000),
        now,
      ),
      HR_DOCUMENT_STATUSES.VALID,
    )
    assert.equal(resolveDocumentExpiryStatus(null, now), HR_DOCUMENT_STATUSES.VALID)
  })
})

describe('hr sensitive field redaction', () => {
  it('redacts personal fields when sensitive view is denied', () => {
    const record = {
      firstName: 'Ada',
      personalEmail: 'ada@example.com',
      personalPhone: '+971500000000',
      dateOfBirth: '1990-01-01',
      nationality: 'AE',
    }
    const redacted = redactFields(record, ['personalEmail', 'personalPhone', 'dateOfBirth', 'nationality'], false)
    assert.equal(redacted.firstName, 'Ada')
    assert.equal(redacted.personalEmail, '[REDACTED]')
    assert.equal(redacted.personalPhone, '[REDACTED]')
    assert.equal(redacted.dateOfBirth, '[REDACTED]')
    assert.equal(redacted.nationality, '[REDACTED]')
  })
})
