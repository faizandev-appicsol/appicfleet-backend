import type {
  CreditNoteRecord,
  DebitNoteRecord,
  DepositRecord,
  InvoiceRecord,
  PaymentRecord,
  ReceiptRecord,
} from '../../repositories/finance/finance.repository.js'
import {
  findCreditNoteById,
  findDebitNoteById,
  findDepositById,
  findInvoiceById,
  findPaymentById,
  findReceiptById,
} from '../../repositories/finance/finance.repository.js'
import type { AccessContext } from '../../types/access.js'
import { notFound } from '../../utils/httpErrors.js'
import { hasBranchAccess, hasOrganizationAccess } from '../authorization/authorization.service.js'
import {
  hasVehicleLegalEntityScope,
  isOrganizationWide,
  resolveVehicleOrganization,
} from '../vehicles/vehicle-access.js'

export { isOrganizationWide }

export function resolveFinanceOrganization(ctx: AccessContext, requested?: string): string {
  return resolveVehicleOrganization(ctx, requested)
}

type Scoped = {
  organizationId: string
  branchId: string
  legalEntityId: string
}

export function canAccessFinanceRecord(ctx: AccessContext, record: Scoped): boolean {
  return (
    hasOrganizationAccess(ctx, record.organizationId) &&
    hasBranchAccess(ctx, record.branchId, record.organizationId) &&
    hasVehicleLegalEntityScope(ctx, record.legalEntityId, record.organizationId)
  )
}

export async function loadAccessibleInvoice(ctx: AccessContext, id: string): Promise<InvoiceRecord> {
  const invoice = await findInvoiceById(id)
  if (!invoice || !canAccessFinanceRecord(ctx, invoice)) throw notFound('Invoice was not found.')
  return invoice
}

export async function loadAccessiblePayment(ctx: AccessContext, id: string): Promise<PaymentRecord> {
  const payment = await findPaymentById(id)
  if (!payment || !canAccessFinanceRecord(ctx, payment)) throw notFound('Payment was not found.')
  return payment
}

export async function loadAccessibleReceipt(ctx: AccessContext, id: string): Promise<ReceiptRecord> {
  const receipt = await findReceiptById(id)
  if (!receipt || !canAccessFinanceRecord(ctx, receipt)) throw notFound('Receipt was not found.')
  return receipt
}

export async function loadAccessibleCreditNote(ctx: AccessContext, id: string): Promise<CreditNoteRecord> {
  const note = await findCreditNoteById(id)
  if (!note || !canAccessFinanceRecord(ctx, note)) throw notFound('Credit note was not found.')
  return note
}

export async function loadAccessibleDebitNote(ctx: AccessContext, id: string): Promise<DebitNoteRecord> {
  const note = await findDebitNoteById(id)
  if (!note || !canAccessFinanceRecord(ctx, note)) throw notFound('Debit note was not found.')
  return note
}

export async function loadAccessibleDeposit(ctx: AccessContext, id: string): Promise<DepositRecord> {
  const deposit = await findDepositById(id)
  if (!deposit || !canAccessFinanceRecord(ctx, deposit)) throw notFound('Deposit was not found.')
  return deposit
}
