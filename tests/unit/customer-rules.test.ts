import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import {
  CUSTOMER_DOCUMENT_STATUSES,
  CUSTOMER_DOCUMENT_TYPES,
  MAX_UPLOAD_BYTES,
  OCR_STATUSES,
} from '../../src/constants/customers.js'
import {
  buildDisplayName,
  canonicalPair,
  deriveDocumentStatus,
  normalizeEmail,
  normalizePhone,
  sharedSignals,
} from '../../src/services/customers/customer-rules.js'
import { isSensitiveKey, maskByKey, maskSensitive } from '../../src/services/customers/mask.js'
import {
  decodeBase64Content,
  matchesMagicBytes,
  sanitizeFilename,
} from '../../src/services/customers/upload-rules.js'
import { MockOcrProvider } from '../../src/services/ocr/mock-ocr.provider.js'
import {
  OCR_REVIEW_THRESHOLD,
  needsOcrReview,
  ocrStatusFor,
} from '../../src/services/ocr/ocr-provider.js'

describe('maskSensitive', () => {
  it('keeps the first 2 and last 2 characters of values longer than 6', () => {
    assert.equal(maskSensitive('1234567'), '12***67')
    assert.equal(maskSensitive('AB1234567890'), 'AB********90')
  })

  it('fully masks values of 6 characters or fewer', () => {
    assert.equal(maskSensitive('123456'), '****')
    assert.equal(maskSensitive('ab'), '****')
    assert.equal(maskSensitive(''), '****')
  })

  it('masks keys that look like identity numbers unless revealed', () => {
    for (const key of ['documentNumber', 'licenseNumber', 'taxNumber', 'passportNo', 'emiratesId']) {
      assert.equal(isSensitiveKey(key), true, key)
    }
    assert.equal(isSensitiveKey('fullName'), false)
    assert.equal(maskByKey('documentNumber', 'MOCK-PASS-0000', false), 'MO**********00')
    assert.equal(maskByKey('documentNumber', 'MOCK-PASS-0000', true), 'MOCK-PASS-0000')
    assert.equal(maskByKey('fullName', 'MOCK SAMPLE PERSON', false), 'MOCK SAMPLE PERSON')
  })
})

describe('duplicate normalization', () => {
  it('lowercases and trims email', () => {
    assert.equal(normalizeEmail('  Jane.Doe@Example.COM '), 'jane.doe@example.com')
    assert.equal(normalizeEmail('   '), undefined)
    assert.equal(normalizeEmail(undefined), undefined)
  })

  it('keeps digits only for phone', () => {
    assert.equal(normalizePhone('+971 (50) 123-4567'), '971501234567')
    assert.equal(normalizePhone('12'), undefined)
    assert.equal(normalizePhone(null), undefined)
  })

  it('finds the signals two customers share', () => {
    const a = { normalizedEmail: 'a@x.test', normalizedPhone: '5550100', registrationNumber: 'R-1' }
    const b = { normalizedEmail: 'a@x.test', normalizedPhone: '5550199', registrationNumber: 'R-1' }
    assert.deepEqual(sharedSignals(a, b), ['email', 'registration'])
    assert.deepEqual(sharedSignals({}, {}), [])
    assert.deepEqual(sharedSignals({ normalizedEmail: undefined }, { normalizedEmail: undefined }), [])
  })

  it('stores a pair in one canonical order', () => {
    const low = '507f1f77bcf86cd799439011'
    const high = '507f1f77bcf86cd799439012'
    assert.deepEqual(canonicalPair(high, low), { customerId: low, candidateId: high })
    assert.deepEqual(canonicalPair(low, high), { customerId: low, candidateId: high })
  })
})

describe('customer rules', () => {
  it('builds a display name from the name block', () => {
    assert.equal(
      buildDisplayName({
        type: 'INDIVIDUAL',
        individual: { firstName: 'Jane', middleName: null, lastName: 'Doe' },
      }),
      'Jane Doe',
    )
    assert.equal(
      buildDisplayName({ type: 'CORPORATE', corporate: { legalName: 'Acme Ltd', tradeName: 'Acme' } }),
      'Acme',
    )
  })

  it('derives the customer document status from active document OCR statuses', () => {
    assert.equal(deriveDocumentStatus([]), CUSTOMER_DOCUMENT_STATUSES.NONE)
    assert.equal(deriveDocumentStatus([OCR_STATUSES.COMPLETED]), CUSTOMER_DOCUMENT_STATUSES.VERIFIED)
    assert.equal(
      deriveDocumentStatus([OCR_STATUSES.COMPLETED, OCR_STATUSES.NONE]),
      CUSTOMER_DOCUMENT_STATUSES.PENDING,
    )
    assert.equal(
      deriveDocumentStatus([OCR_STATUSES.NONE, OCR_STATUSES.NEEDS_REVIEW]),
      CUSTOMER_DOCUMENT_STATUSES.NEEDS_REVIEW,
    )
    assert.equal(deriveDocumentStatus([OCR_STATUSES.FAILED]), CUSTOMER_DOCUMENT_STATUSES.NEEDS_REVIEW)
  })
})

describe('OCR review threshold', () => {
  it('uses 0.75', () => {
    assert.equal(OCR_REVIEW_THRESHOLD, 0.75)
  })

  it('flags a low field or type confidence', () => {
    assert.equal(needsOcrReview({ typeConfidence: 0.9, fields: [{ key: 'a', value: 'x', confidence: 0.62 }] }), true)
    assert.equal(needsOcrReview({ typeConfidence: 0.4, fields: [] }), true)
    assert.equal(needsOcrReview({ typeConfidence: 0.9, fields: [{ key: 'a', value: 'x', confidence: 0.96 }] }), false)
    assert.equal(needsOcrReview({ typeConfidence: 0.75, fields: [] }), false)
  })

  it('maps the outcome to a document OCR status', () => {
    assert.equal(ocrStatusFor({ typeConfidence: 0.9, fields: [] }), OCR_STATUSES.COMPLETED)
    assert.equal(ocrStatusFor({ typeConfidence: 0.5, fields: [] }), OCR_STATUSES.NEEDS_REVIEW)
  })
})

describe('MockOcrProvider', () => {
  const provider = new MockOcrProvider()

  it('classifies from the filename or hint and marks low-confidence fields', async () => {
    const result = await provider.classifyAndExtract({
      filename: 'my-passport-scan.png',
      mimeType: 'image/png',
      documentTypeHint: CUSTOMER_DOCUMENT_TYPES.OTHER,
    })
    assert.equal(result.provider, 'mock')
    assert.equal(result.modelVersion, 'mock-1')
    assert.equal(result.detectedType, CUSTOMER_DOCUMENT_TYPES.PASSPORT)
    assert.ok(result.typeConfidence >= 0.9)
    assert.ok(result.fields.some((field) => field.key === 'documentNumber' && field.confidence === 0.62))
    assert.ok(result.fields.some((field) => field.key === 'fullName' && field.confidence === 0.96))
    assert.equal(needsOcrReview(result), true)
  })

  it('prefers trade license over plain license and does not match "private" as VAT', async () => {
    const trade = await provider.classifyAndExtract({
      filename: 'file.pdf',
      mimeType: 'application/pdf',
      documentTypeHint: CUSTOMER_DOCUMENT_TYPES.TRADE_LICENSE,
    })
    assert.equal(trade.detectedType, CUSTOMER_DOCUMENT_TYPES.TRADE_LICENSE)

    const other = await provider.classifyAndExtract({
      filename: 'private-notes.pdf',
      mimeType: 'application/pdf',
      documentTypeHint: CUSTOMER_DOCUMENT_TYPES.OTHER,
    })
    assert.equal(other.detectedType, CUSTOMER_DOCUMENT_TYPES.OTHER)
    assert.equal(other.typeConfidence, 0.4)
    assert.deepEqual(other.fields, [])
  })
})

describe('upload rules', () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00])
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])
  const pdf = Buffer.from('%PDF-1.7\n')
  const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.from([1, 0, 0, 0]), Buffer.from('WEBPVP8 ')])

  it('accepts matching magic bytes', () => {
    assert.equal(matchesMagicBytes('image/jpeg', jpeg), true)
    assert.equal(matchesMagicBytes('image/png', png), true)
    assert.equal(matchesMagicBytes('application/pdf', pdf), true)
    assert.equal(matchesMagicBytes('image/webp', webp), true)
  })

  it('rejects content that does not match the declared type', () => {
    assert.equal(matchesMagicBytes('image/png', jpeg), false)
    assert.equal(matchesMagicBytes('application/pdf', png), false)
    assert.equal(matchesMagicBytes('image/webp', Buffer.from('RIFF....WAVE')), false)
    assert.equal(matchesMagicBytes('image/jpeg', Buffer.alloc(0)), false)
    assert.equal(matchesMagicBytes('text/html', Buffer.from('<html>')), false)
  })

  it('keeps only the basename and rejects path traversal', () => {
    assert.deepEqual(sanitizeFilename('scan.png'), { ok: true, filename: 'scan.png' })
    assert.deepEqual(sanitizeFilename('folder/sub\\scan.png'), { ok: true, filename: 'scan.png' })
    assert.equal(sanitizeFilename('../../etc/passwd').ok, false)
    assert.equal(sanitizeFilename('..\\secret.png').ok, false)
    assert.equal(sanitizeFilename('a\u0000.png').ok, false)
    assert.equal(sanitizeFilename('///').ok, false)
  })

  it('decodes strict base64 and enforces the size limit before allocating', () => {
    const ok = decodeBase64Content(jpeg.toString('base64'))
    assert.equal(ok.ok, true)
    assert.deepEqual(ok.ok ? ok.bytes : null, jpeg)

    assert.deepEqual(decodeBase64Content(''), { ok: false, reason: 'empty' })
    assert.deepEqual(decodeBase64Content('not base64!'), { ok: false, reason: 'invalid' })
    assert.deepEqual(decodeBase64Content('abc'), { ok: false, reason: 'invalid' })

    const tooBig = Buffer.alloc(MAX_UPLOAD_BYTES + 1, 1).toString('base64')
    assert.deepEqual(decodeBase64Content(tooBig), { ok: false, reason: 'too_large' })
    const exact = Buffer.alloc(MAX_UPLOAD_BYTES, 1).toString('base64')
    assert.equal(decodeBase64Content(exact).ok, true)
  })
})

describe('MockScannerConnector', () => {
  it('refuses to scan and does not pretend to be a hardware device', async () => {
    const { MockScannerConnector, ScannerUnavailableError } = await import(
      '../../src/services/scanners/scanner-connector.js'
    )
    const scanner = new MockScannerConnector()
    await assert.rejects(() => scanner.scan(), ScannerUnavailableError)
    await scanner.connect()
    await assert.rejects(() => scanner.scan(), (error: unknown) => {
      assert.ok(error instanceof ScannerUnavailableError)
      assert.match(error.message, /not a production device/)
      return true
    })
    await scanner.disconnect()
  })
})
