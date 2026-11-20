import { EINVOICE_FAILURE_CLASSES } from '../../../constants/tax.js'
import type { EInvoiceProvider, InternalEInvoiceModel, ProviderSubmitResult } from '../einvoice-provider.js'

/**
 * Non-production ASP stub. Never talks to a live network.
 * Use for TEST/SANDBOX only — production must configure a real provider adapter.
 */
export const sandboxProvider: EInvoiceProvider = {
  name: 'SANDBOX',

  async validate(document: InternalEInvoiceModel) {
    const errors: Array<{ code: string; message: string; field?: string }> = []
    if (!document.documentNumber) errors.push({ code: 'DOC_NUMBER', message: 'Document number is required.', field: 'documentNumber' })
    if (!document.supplier.name) errors.push({ code: 'SUPPLIER_NAME', message: 'Supplier name is required.', field: 'supplier.name' })
    if (!document.customer.name) errors.push({ code: 'CUSTOMER_NAME', message: 'Customer name is required.', field: 'customer.name' })
    if (!document.lines.length) errors.push({ code: 'LINES', message: 'At least one line is required.', field: 'lines' })
    return { valid: errors.length === 0, errors }
  },

  async submitInvoice({ document, idempotencyKey, environment }): Promise<ProviderSubmitResult> {
    if (environment === 'PRODUCTION') {
      return {
        success: false,
        status: 'FAILED',
        failureClass: EINVOICE_FAILURE_CLASSES.PERMANENT,
        responseCode: 'SANDBOX_BLOCKED',
        responseMessage: 'Sandbox provider cannot submit to PRODUCTION.',
      }
    }
    const providerReference = `SBX-${idempotencyKey.slice(-24)}`
    return {
      success: true,
      status: 'ACCEPTED',
      providerReference,
      responseCode: '200',
      responseMessage: 'Sandbox acceptance.',
      responseBody: {
        provider: 'SANDBOX',
        documentNumber: document.documentNumber,
        idempotencyKey,
        accepted: true,
      },
    }
  },

  async getSubmissionStatus({ providerReference }) {
    return {
      providerReference,
      status: 'ACCEPTED',
      responseCode: '200',
      responseMessage: 'Sandbox status: accepted.',
    }
  },

  async cancelInvoice({ providerReference, reason }) {
    return {
      success: true,
      status: 'FAILED',
      providerReference,
      responseCode: 'CANCELLED',
      responseMessage: reason,
      responseBody: { cancelled: true },
    }
  },
}
