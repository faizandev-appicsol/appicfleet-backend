import type { EInvoiceEnvironment, EInvoiceFailureClass } from '../../constants/tax.js'
import { sandboxProvider } from './providers/sandbox.provider.js'

export type InternalEInvoiceModel = {
  documentNumber: string
  issueDate: string
  currency: string
  supplier: {
    name: string
    vatNumber?: string
    address?: string
  }
  customer: {
    name: string
    taxNumber?: string
  }
  lines: Array<{
    description: string
    quantity: number
    unitPrice: string
    taxableAmount: string
    taxRatePercent: string
    taxAmount: string
    lineTotal: string
    taxCode?: string
  }>
  taxSummary: Array<{
    taxCode: string
    taxRatePercent: string
    taxableAmount: string
    taxAmount: string
  }>
  totals: {
    taxableAmount: string
    taxAmount: string
    totalAmount: string
  }
}

export type ProviderSubmitResult = {
  success: boolean
  providerReference?: string
  status: 'SUBMITTED' | 'ACCEPTED' | 'REJECTED' | 'FAILED'
  responseCode?: string
  responseMessage?: string
  failureClass?: EInvoiceFailureClass
  /** Sanitized response body — never credentials. */
  responseBody?: Record<string, unknown>
}

export type ProviderStatusResult = {
  providerReference: string
  status: 'SUBMITTED' | 'ACCEPTED' | 'REJECTED' | 'FAILED'
  responseCode?: string
  responseMessage?: string
}

export type EInvoiceProvider = {
  readonly name: string
  validate(document: InternalEInvoiceModel): Promise<{
    valid: boolean
    errors: Array<{ code: string; message: string; field?: string }>
  }>
  submitInvoice(input: {
    document: InternalEInvoiceModel
    idempotencyKey: string
    environment: EInvoiceEnvironment
  }): Promise<ProviderSubmitResult>
  getSubmissionStatus(input: {
    providerReference: string
    environment: EInvoiceEnvironment
  }): Promise<ProviderStatusResult>
  cancelInvoice?(input: {
    providerReference: string
    environment: EInvoiceEnvironment
    reason: string
  }): Promise<ProviderSubmitResult>
}

/** Resolve ASP adapter. Default is sandbox — replace with a real provider without changing invoice flows. */
export function getEInvoiceProvider(providerName?: string): EInvoiceProvider {
  const key = (providerName ?? 'SANDBOX').toUpperCase()
  void key
  return sandboxProvider
}
