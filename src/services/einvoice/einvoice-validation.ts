import { VAT_REGISTRATION_STATUSES } from '../../constants/tax.js'
import type { InternalEInvoiceModel } from './einvoice-provider.js'

export type ValidationIssue = { code: string; message: string; field?: string }

export function validateInternalEInvoice(
  document: InternalEInvoiceModel,
  context: {
    vatRegistrationStatus?: string
    vatRegistrationNumber?: string
    invoiceStatus?: string
  },
): ValidationIssue[] {
  const errors: ValidationIssue[] = []
  if (!document.documentNumber) {
    errors.push({ code: 'DOC_NUMBER', message: 'Invoice number is required.', field: 'documentNumber' })
  }
  if (!document.issueDate) {
    errors.push({ code: 'ISSUE_DATE', message: 'Issue date is required.', field: 'issueDate' })
  }
  if (!document.currency || document.currency.length !== 3) {
    errors.push({ code: 'CURRENCY', message: 'Currency is required.', field: 'currency' })
  }
  if (!document.supplier.name) {
    errors.push({ code: 'SUPPLIER_NAME', message: 'Supplier name is required.', field: 'supplier.name' })
  }
  if (
    context.vatRegistrationStatus === VAT_REGISTRATION_STATUSES.REGISTERED &&
    !context.vatRegistrationNumber &&
    !document.supplier.vatNumber
  ) {
    errors.push({
      code: 'SUPPLIER_VAT',
      message: 'Supplier VAT registration number is required when the legal entity is VAT registered.',
      field: 'supplier.vatNumber',
    })
  }
  if (!document.customer.name) {
    errors.push({ code: 'CUSTOMER_NAME', message: 'Customer name is required.', field: 'customer.name' })
  }
  if (!document.lines.length) {
    errors.push({ code: 'LINES', message: 'At least one line is required.', field: 'lines' })
  }
  for (const [index, line] of document.lines.entries()) {
    if (!line.description) {
      errors.push({ code: 'LINE_DESC', message: 'Line description is required.', field: `lines.${index}.description` })
    }
  }
  if (context.invoiceStatus && context.invoiceStatus !== 'POSTED') {
    errors.push({
      code: 'INVOICE_STATUS',
      message: 'Only posted invoices can be submitted as e-invoices.',
      field: 'status',
    })
  }
  return errors
}
