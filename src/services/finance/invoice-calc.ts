import { TAX_PRICING_MODES, type TaxPricingMode, type TaxTreatment } from '../../constants/tax.js'
import { calculateTaxDocument, type CalculatedTaxLine, type TaxDocumentTotals } from '../tax/tax-calc.js'

export type InvoiceLineInput = {
  description: string
  quantity: number
  unitPrice: string
  discountAmount?: string
  taxRatePercent?: string
  taxCode?: string
  taxCodeId?: string
  taxTreatment?: TaxTreatment | string
  taxCategory?: string
  pricingMode?: TaxPricingMode | string
  sourceType?: string
  sourceId?: string
}

export type CalculatedLine = CalculatedTaxLine & {
  taxCodeId?: string
  taxCategory?: string
}

export type InvoiceTotals = Omit<TaxDocumentTotals, 'lines'> & {
  lines: CalculatedLine[]
}

/**
 * Backend authority for invoice math. Frontend totals are ignored.
 * Delegates to Module 12 tax engine (exclusive/inclusive, BigInt cents, half-up).
 */
export function calculateInvoice(lines: readonly InvoiceLineInput[], defaultTaxRate = '0.00'): InvoiceTotals {
  const totals = calculateTaxDocument(
    lines.map((line) => ({
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discountAmount: line.discountAmount,
      taxRatePercent: line.taxRatePercent ?? defaultTaxRate,
      taxCode: line.taxCode,
      taxTreatment: line.taxTreatment as TaxTreatment | undefined,
      pricingMode: (line.pricingMode as TaxPricingMode | undefined) ?? TAX_PRICING_MODES.EXCLUSIVE,
      sourceType: line.sourceType,
      sourceId: line.sourceId,
    })),
  )
  return {
    ...totals,
    lines: totals.lines.map((line, index) => ({
      ...line,
      taxCodeId: lines[index]?.taxCodeId,
      taxCategory: lines[index]?.taxCategory,
    })),
  }
}
