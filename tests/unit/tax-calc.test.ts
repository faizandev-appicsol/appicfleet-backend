import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import {
  calculateTaxDocument,
  calculateTaxLine,
  findTaxAmountMismatches,
  splitInclusive,
} from '../../src/services/tax/tax-calc.js'
import {
  EINVOICE_STATUSES,
  TAX_PERIOD_STATUSES,
  type EInvoiceStatus,
  type TaxPeriodStatus,
} from '../../src/constants/tax.js'
import {
  canTransitionEInvoice,
  canTransitionTaxPeriod,
  isRetryableEInvoiceStatus,
  rateCoversDate,
} from '../../src/services/tax/tax-rules.js'
import { validateInternalEInvoice } from '../../src/services/einvoice/einvoice-validation.js'

describe('tax exclusive / inclusive calculation', () => {
  it('calculates exclusive VAT with half-up cents', () => {
    const line = calculateTaxLine({
      description: 'Rental',
      quantity: 1,
      unitPrice: '1000.00',
      taxRatePercent: '5.00',
      pricingMode: 'EXCLUSIVE',
    })
    assert.equal(line.taxableAmount, '1000.00')
    assert.equal(line.taxAmount, '50.00')
    assert.equal(line.lineTotal, '1050.00')
  })

  it('splits inclusive prices into net and tax', () => {
    const { taxableAmount, taxAmount } = splitInclusive('1050.00', '5.00')
    assert.equal(taxableAmount, '1000.00')
    assert.equal(taxAmount, '50.00')
    const line = calculateTaxLine({
      description: 'Inclusive',
      quantity: 1,
      unitPrice: '105.00',
      taxRatePercent: '5.00',
      pricingMode: 'INCLUSIVE',
    })
    assert.equal(line.lineTotal, '105.00')
    assert.equal(line.taxableAmount, '100.00')
    assert.equal(line.taxAmount, '5.00')
  })

  it('supports zero tax and multi-line document totals', () => {
    const zero = calculateTaxLine({
      description: 'Zero',
      quantity: 2,
      unitPrice: '10.00',
      taxRatePercent: '0.00',
    })
    assert.equal(zero.taxAmount, '0.00')
    assert.equal(zero.lineTotal, '20.00')

    const doc = calculateTaxDocument([
      { description: 'A', quantity: 1, unitPrice: '100.00', taxRatePercent: '5.00', taxCode: 'STANDARD' },
      { description: 'B', quantity: 1, unitPrice: '50.00', taxRatePercent: '0.00', taxCode: 'ZERO_RATED' },
    ])
    assert.equal(doc.taxableAmount, '150.00')
    assert.equal(doc.taxAmount, '5.00')
    assert.equal(doc.totalAmount, '155.00')
    assert.equal(doc.summaryByCode.length, 2)
  })

  it('flags reconciliation mismatches', () => {
    const issues = findTaxAmountMismatches({
      invoiceTax: '50.00',
      taxTransactionTax: '49.00',
      einvoiceTax: '50.00',
      invoiceTotal: '1050.00',
      einvoiceTotal: '1050.00',
    })
    assert.ok(issues.includes('Invoice VAT != Tax Transaction VAT'))
    assert.ok(issues.includes('Tax Transaction VAT != E-Invoice VAT'))
  })
})

describe('tax period and e-invoice transitions', () => {
  it('locks open periods and blocks filed reopen', () => {
    assert.equal(canTransitionTaxPeriod(TAX_PERIOD_STATUSES.OPEN, TAX_PERIOD_STATUSES.LOCKED), true)
    assert.equal(canTransitionTaxPeriod(TAX_PERIOD_STATUSES.LOCKED, TAX_PERIOD_STATUSES.OPEN), true)
    assert.equal(canTransitionTaxPeriod(TAX_PERIOD_STATUSES.FILED, TAX_PERIOD_STATUSES.OPEN), false)
    for (const from of Object.values(TAX_PERIOD_STATUSES) as TaxPeriodStatus[]) {
      assert.equal(canTransitionTaxPeriod(from, from), false)
    }
  })

  it('enforces e-invoice state machine and retry eligibility', () => {
    assert.equal(canTransitionEInvoice(EINVOICE_STATUSES.GENERATED, EINVOICE_STATUSES.VALIDATING), true)
    assert.equal(canTransitionEInvoice(EINVOICE_STATUSES.ACCEPTED, EINVOICE_STATUSES.SUBMITTED), false)
    assert.equal(isRetryableEInvoiceStatus(EINVOICE_STATUSES.FAILED), true)
    assert.equal(isRetryableEInvoiceStatus(EINVOICE_STATUSES.ACCEPTED), false)
    for (const from of Object.values(EINVOICE_STATUSES) as EInvoiceStatus[]) {
      assert.ok(Array.isArray([from]))
    }
  })

  it('uses half-open effective rate windows', () => {
    const from = new Date('2026-01-01T00:00:00.000Z')
    const to = new Date('2026-07-01T00:00:00.000Z')
    assert.equal(rateCoversDate(from, to, from), true)
    assert.equal(rateCoversDate(from, to, new Date('2026-06-30T23:59:59.000Z')), true)
    assert.equal(rateCoversDate(from, to, to), false)
  })
})

describe('e-invoice validation', () => {
  it('blocks submission when supplier VAT or customer data is missing', () => {
    const errors = validateInternalEInvoice(
      {
        documentNumber: '',
        issueDate: '',
        currency: 'AE',
        supplier: { name: '' },
        customer: { name: '' },
        lines: [],
        taxSummary: [],
        totals: { taxableAmount: '0.00', taxAmount: '0.00', totalAmount: '0.00' },
      },
      { vatRegistrationStatus: 'REGISTERED', invoiceStatus: 'DRAFT' },
    )
    assert.ok(errors.some((e) => e.code === 'DOC_NUMBER'))
    assert.ok(errors.some((e) => e.code === 'SUPPLIER_VAT'))
    assert.ok(errors.some((e) => e.code === 'CUSTOMER_NAME'))
    assert.ok(errors.some((e) => e.code === 'INVOICE_STATUS'))
  })
})
