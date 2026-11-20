import type { CustomerDocumentStatus } from '../../constants/customers.js'
import { listActiveDocumentOcrStatuses } from '../../repositories/customers/customer-document.repository.js'
import { setCustomerDocumentStatus } from '../../repositories/customers/customer.repository.js'
import { deriveDocumentStatus } from './customer-rules.js'

/**
 * Recomputes the customer's denormalized `documentStatus` from its ACTIVE documents.
 * Call after any upload, archive, OCR run or OCR review.
 */
export async function refreshCustomerDocumentStatus(customer: {
  id: string
  organizationId: string
}): Promise<CustomerDocumentStatus> {
  const statuses = await listActiveDocumentOcrStatuses(customer.id, customer.organizationId)
  const status = deriveDocumentStatus(statuses)
  await setCustomerDocumentStatus(customer.id, customer.organizationId, status)
  return status
}
