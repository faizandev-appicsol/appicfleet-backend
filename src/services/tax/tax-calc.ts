import { TAX_PRICING_MODES, type TaxPricingMode, type TaxTreatment } from '../../constants/tax.js'
import {
  addMoney,
  compareMoney,
  multiplyMoney,
  normalizeMoney,
  percentOfMoney,
  subtractMoney,
} from '../../utils/money.js'

export type TaxLineInput = {
  description: string
  quantity: number
  unitPrice: string
  discountAmount?: string
  taxRatePercent: string
  taxCode?: string
  taxTreatment?: TaxTreatment
  pricingMode?: TaxPricingMode
  sourceType?: string
  sourceId?: string
}

export type CalculatedTaxLine = {
  description: string
  quantity: number
  unitPrice: string
  discountAmount: string
  taxRatePercent: string
  taxCode?: string
  taxTreatment?: TaxTreatment
  pricingMode: TaxPricingMode
  lineSubtotal: string
  taxableAmount: string
  taxAmount: string
  lineTotal: string
  sourceType?: string
  sourceId?: string
}

export type TaxDocumentTotals = {
  subtotal: string
  discountTotal: string
  taxableAmount: string
  taxAmount: string
  totalAmount: string
  lines: CalculatedTaxLine[]
  summaryByCode: Array<{
    taxCode: string
    taxRatePercent: string
    taxTreatment?: string
    taxableAmount: string
    taxAmount: string
    grossAmount: string
  }>
}

/**
 * Backend-authoritative tax math (BigInt cents via money helpers).
 * Exclusive: taxable = qty×unit − discount; tax = % of taxable; gross = taxable + tax.
 * Inclusive: gross = qty×unit − discount; taxable = gross / (1 + rate); tax = gross − taxable.
 * Rounding: half-up to nearest cent (same as percentOfMoney).
 */
export function calculateTaxLine(line: TaxLineInput): CalculatedTaxLine {
  if (!Number.isInteger(line.quantity) || line.quantity < 1) {
    throw new Error('quantity must be a positive integer')
  }
  const unitPrice = normalizeMoney(line.unitPrice)
  const discountAmount = normalizeMoney(line.discountAmount ?? '0.00')
  const taxRatePercent = normalizeMoney(line.taxRatePercent)
  const pricingMode = line.pricingMode ?? TAX_PRICING_MODES.EXCLUSIVE
  const lineSubtotal = multiplyMoney(unitPrice, line.quantity)

  if (pricingMode === TAX_PRICING_MODES.INCLUSIVE) {
    const gross = subtractMoney(lineSubtotal, discountAmount)
    const { taxableAmount, taxAmount } = splitInclusive(gross, taxRatePercent)
    return {
      description: line.description,
      quantity: line.quantity,
      unitPrice,
      discountAmount,
      taxRatePercent,
      taxCode: line.taxCode,
      taxTreatment: line.taxTreatment,
      pricingMode,
      lineSubtotal,
      taxableAmount,
      taxAmount,
      lineTotal: gross,
      sourceType: line.sourceType,
      sourceId: line.sourceId,
    }
  }

  const taxableAmount = subtractMoney(lineSubtotal, discountAmount)
  const taxAmount = percentOfMoney(taxableAmount, taxRatePercent)
  return {
    description: line.description,
    quantity: line.quantity,
    unitPrice,
    discountAmount,
    taxRatePercent,
    taxCode: line.taxCode,
    taxTreatment: line.taxTreatment,
    pricingMode,
    lineSubtotal,
    taxableAmount,
    taxAmount,
    lineTotal: addMoney(taxableAmount, taxAmount),
    sourceType: line.sourceType,
    sourceId: line.sourceId,
  }
}

/** gross / (1 + rate%) with half-up cents; tax = gross − net. */
export function splitInclusive(grossAmount: string, ratePercent: string): { taxableAmount: string; taxAmount: string } {
  const gross = normalizeMoney(grossAmount)
  const rate = normalizeMoney(ratePercent)
  if (compareMoney(rate, '0.00') === 0) {
    return { taxableAmount: gross, taxAmount: '0.00' }
  }
  const [w = '0', f = '00'] = rate.split('.')
  const rateBp = BigInt(w) * 100n + BigInt(f.padEnd(2, '0').slice(0, 2))
  const denom = 10000n + rateBp
  const grossCents = toCents(gross)
  const taxableCents = (grossCents * 10000n + denom / 2n) / denom
  const taxCents = grossCents - taxableCents
  return { taxableAmount: fromCents(taxableCents), taxAmount: fromCents(taxCents) }
}

function toCents(amount: string): bigint {
  const normalized = normalizeMoney(amount)
  const [whole = '0', fraction = '00'] = normalized.split('.')
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0').slice(0, 2))
}

function fromCents(cents: bigint): string {
  const negative = cents < 0n
  const absolute = negative ? -cents : cents
  return `${negative ? '-' : ''}${absolute / 100n}.${(absolute % 100n).toString().padStart(2, '0')}`
}

export function calculateTaxDocument(lines: readonly TaxLineInput[]): TaxDocumentTotals {
  if (lines.length === 0) {
    return {
      subtotal: '0.00',
      discountTotal: '0.00',
      taxableAmount: '0.00',
      taxAmount: '0.00',
      totalAmount: '0.00',
      lines: [],
      summaryByCode: [],
    }
  }
  const calculated = lines.map(calculateTaxLine)
  const byCode = new Map<
    string,
    { taxCode: string; taxRatePercent: string; taxTreatment?: string; taxableAmount: string; taxAmount: string; grossAmount: string }
  >()
  for (const line of calculated) {
    const key = `${line.taxCode ?? 'UNCODED'}|${line.taxRatePercent}|${line.taxTreatment ?? ''}`
    const current = byCode.get(key) ?? {
      taxCode: line.taxCode ?? 'UNCODED',
      taxRatePercent: line.taxRatePercent,
      taxTreatment: line.taxTreatment,
      taxableAmount: '0.00',
      taxAmount: '0.00',
      grossAmount: '0.00',
    }
    byCode.set(key, {
      ...current,
      taxableAmount: addMoney(current.taxableAmount, line.taxableAmount),
      taxAmount: addMoney(current.taxAmount, line.taxAmount),
      grossAmount: addMoney(current.grossAmount, line.lineTotal),
    })
  }
  return {
    subtotal: calculated.reduce((sum, line) => addMoney(sum, line.lineSubtotal), '0.00'),
    discountTotal: calculated.reduce((sum, line) => addMoney(sum, line.discountAmount), '0.00'),
    taxableAmount: calculated.reduce((sum, line) => addMoney(sum, line.taxableAmount), '0.00'),
    taxAmount: calculated.reduce((sum, line) => addMoney(sum, line.taxAmount), '0.00'),
    totalAmount: calculated.reduce((sum, line) => addMoney(sum, line.lineTotal), '0.00'),
    lines: calculated,
    summaryByCode: [...byCode.values()],
  }
}

/** Detect silent mismatches between invoice / tax transaction / e-invoice amounts. */
export function findTaxAmountMismatches(input: {
  invoiceTax?: string
  invoiceTotal?: string
  taxTransactionTax?: string
  taxTransactionGross?: string
  einvoiceTax?: string
  einvoiceTotal?: string
}): string[] {
  const issues: string[] = []
  const eq = (a?: string, b?: string) =>
    a !== undefined && b !== undefined && compareMoney(normalizeMoney(a), normalizeMoney(b)) === 0
  if (input.invoiceTax !== undefined && input.taxTransactionTax !== undefined && !eq(input.invoiceTax, input.taxTransactionTax)) {
    issues.push('Invoice VAT != Tax Transaction VAT')
  }
  if (input.taxTransactionTax !== undefined && input.einvoiceTax !== undefined && !eq(input.taxTransactionTax, input.einvoiceTax)) {
    issues.push('Tax Transaction VAT != E-Invoice VAT')
  }
  if (input.invoiceTotal !== undefined && input.einvoiceTotal !== undefined && !eq(input.invoiceTotal, input.einvoiceTotal)) {
    issues.push('Invoice total != E-Invoice total')
  }
  if (
    input.invoiceTotal !== undefined &&
    input.taxTransactionGross !== undefined &&
    !eq(input.invoiceTotal, input.taxTransactionGross)
  ) {
    issues.push('Invoice total != Tax Transaction gross')
  }
  return issues
}
