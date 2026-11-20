import { toPublicEnum } from '../../constants/vehicles.js'
import { addMoney } from '../../utils/money.js'
import { invoicePaymentStatus } from './finance-rules.js'
import type {
  CreditNoteRecord,
  DebitNoteRecord,
  DepositRecord,
  InvoiceLineRecord,
  InvoiceRecord,
  PaymentRecord,
  ReceiptRecord,
} from '../../repositories/finance/finance.repository.js'

function iso(value?: Date): string | undefined {
  return value ? value.toISOString() : undefined
}

function idOf(value: unknown): string {
  if (value && typeof value === 'object' && 'toString' in value) return String(value)
  return String(value ?? '')
}

export function toInvoiceResource(invoice: InvoiceRecord) {
  return {
    id: invoice.id,
    documentNumber: invoice.documentNumber,
    organizationId: invoice.organizationId,
    legalEntityId: invoice.legalEntityId,
    branchId: invoice.branchId,
    customerId: invoice.customerId,
    customerName: invoice.customerDisplayName,
    contractId: invoice.contractId,
    currency: invoice.currency,
    documentDate: invoice.documentDate.toISOString(),
    dueDate: invoice.dueDate.toISOString(),
    status: toPublicEnum(invoice.status),
    paymentStatus: toPublicEnum(invoicePaymentStatus(invoice.totalAmount, invoice.paidAmount)),
    subtotal: invoice.subtotal,
    discountTotal: invoice.discountTotal,
    taxableAmount: invoice.taxableAmount,
    taxAmount: invoice.taxAmount,
    totalAmount: invoice.totalAmount,
    paidAmount: invoice.paidAmount,
    creditedAmount: invoice.creditedAmount,
    outstandingAmount: invoice.outstandingAmount,
    notes: invoice.notes,
    postedAt: iso(invoice.postedAt),
    voidedAt: iso(invoice.voidedAt),
    createdAt: invoice.createdAt.toISOString(),
    updatedAt: invoice.updatedAt.toISOString(),
  }
}

export function toInvoiceLineResource(line: InvoiceLineRecord) {
  return {
    id: line.id,
    description: line.description,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    discountAmount: line.discountAmount,
    taxRatePercent: line.taxRatePercent,
    taxCode: line.taxCode,
    taxCodeId: line.taxCodeId,
    taxTreatment: line.taxTreatment ? toPublicEnum(line.taxTreatment) : undefined,
    taxCategory: line.taxCategory,
    pricingMode: line.pricingMode ? toPublicEnum(line.pricingMode) : undefined,
    lineSubtotal: line.lineSubtotal,
    taxableAmount: line.taxableAmount,
    taxAmount: line.taxAmount,
    lineTotal: line.lineTotal,
    sourceType: toPublicEnum(line.sourceType),
    sourceId: line.sourceId,
    sortOrder: line.sortOrder,
  }
}

function buildTaxSummary(lines: InvoiceLineRecord[]) {
  const byKey = new Map<
    string,
    { taxCode: string; taxRatePercent: string; taxTreatment?: string; taxableAmount: string; taxAmount: string }
  >()
  for (const line of lines) {
    const taxCode = line.taxCode || 'UNCODED'
    const key = `${taxCode}|${line.taxRatePercent}|${line.taxTreatment ?? ''}`
    const current = byKey.get(key) ?? {
      taxCode,
      taxRatePercent: line.taxRatePercent,
      taxTreatment: line.taxTreatment ? toPublicEnum(line.taxTreatment) : undefined,
      taxableAmount: '0.00',
      taxAmount: '0.00',
    }
    byKey.set(key, {
      ...current,
      taxableAmount: addMoney(current.taxableAmount, line.taxableAmount),
      taxAmount: addMoney(current.taxAmount, line.taxAmount),
    })
  }
  return [...byKey.values()]
}

export function toInvoiceDetail(
  invoice: InvoiceRecord,
  lines: InvoiceLineRecord[],
  history: Array<Record<string, unknown>>,
  allocations: Array<Record<string, unknown>>,
) {
  return {
    ...toInvoiceResource(invoice),
    lines: lines.map(toInvoiceLineResource),
    taxSummary: buildTaxSummary(lines),
    allocations: allocations.map((row) => ({
      id: idOf(row._id),
      paymentId: idOf(row.paymentId),
      amount: String(row.amount),
      createdAt: iso(row.createdAt as Date),
    })),
    history: history.map((row) => ({
      id: idOf(row._id),
      fromStatus: row.fromStatus ? toPublicEnum(String(row.fromStatus)) : undefined,
      toStatus: toPublicEnum(String(row.toStatus)),
      reason: row.reason ? String(row.reason) : undefined,
      actorUserId: idOf(row.actorUserId),
      createdAt: iso(row.createdAt as Date),
    })),
  }
}

export function toPaymentResource(payment: PaymentRecord) {
  return {
    id: payment.id,
    paymentNumber: payment.paymentNumber,
    organizationId: payment.organizationId,
    legalEntityId: payment.legalEntityId,
    branchId: payment.branchId,
    customerId: payment.customerId,
    customerName: payment.customerDisplayName,
    currency: payment.currency,
    amount: payment.amount,
    allocatedAmount: payment.allocatedAmount,
    unallocatedAmount: payment.unallocatedAmount,
    method: toPublicEnum(payment.method),
    paymentDate: payment.paymentDate.toISOString(),
    status: toPublicEnum(payment.status),
    externalReference: payment.externalReference,
    provider: payment.provider,
    notes: payment.notes,
    completedAt: iso(payment.completedAt),
    reversedAt: iso(payment.reversedAt),
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
  }
}

export function toPaymentDetail(
  payment: PaymentRecord,
  allocations: Array<Record<string, unknown>>,
  receipt: ReceiptRecord | null,
  history: Array<Record<string, unknown>>,
) {
  return {
    ...toPaymentResource(payment),
    allocations: allocations.map((row) => ({
      id: idOf(row._id),
      invoiceId: idOf(row.invoiceId),
      amount: String(row.amount),
      createdAt: iso(row.createdAt as Date),
    })),
    receipt: receipt ? toReceiptResource(receipt) : null,
    history: history.map((row) => ({
      id: idOf(row._id),
      fromStatus: row.fromStatus ? toPublicEnum(String(row.fromStatus)) : undefined,
      toStatus: toPublicEnum(String(row.toStatus)),
      reason: row.reason ? String(row.reason) : undefined,
      createdAt: iso(row.createdAt as Date),
    })),
  }
}

export function toReceiptResource(receipt: ReceiptRecord) {
  return {
    id: receipt.id,
    receiptNumber: receipt.receiptNumber,
    organizationId: receipt.organizationId,
    legalEntityId: receipt.legalEntityId,
    branchId: receipt.branchId,
    paymentId: receipt.paymentId,
    customerId: receipt.customerId,
    customerName: receipt.customerDisplayName,
    currency: receipt.currency,
    amount: receipt.amount,
    method: toPublicEnum(receipt.method),
    issuedAt: receipt.issuedAt.toISOString(),
    status: toPublicEnum(receipt.status),
    notes: receipt.notes,
    createdAt: receipt.createdAt.toISOString(),
    updatedAt: receipt.updatedAt.toISOString(),
  }
}

function noteLines(rows: Array<Record<string, unknown>>) {
  return rows.map((row) => ({
    id: idOf(row._id),
    description: String(row.description),
    quantity: Number(row.quantity),
    unitPrice: String(row.unitPrice),
    discountAmount: String(row.discountAmount),
    taxRatePercent: String(row.taxRatePercent),
    lineSubtotal: String(row.lineSubtotal),
    taxableAmount: String(row.taxableAmount),
    taxAmount: String(row.taxAmount),
    lineTotal: String(row.lineTotal),
    sortOrder: Number(row.sortOrder),
  }))
}

export function toCreditNoteResource(note: CreditNoteRecord) {
  return {
    id: note.id,
    documentNumber: note.documentNumber,
    organizationId: note.organizationId,
    legalEntityId: note.legalEntityId,
    branchId: note.branchId,
    customerId: note.customerId,
    customerName: note.customerDisplayName,
    invoiceId: note.invoiceId,
    contractId: note.contractId,
    currency: note.currency,
    documentDate: note.documentDate.toISOString(),
    reason: note.reason,
    status: toPublicEnum(note.status),
    subtotal: note.subtotal,
    discountTotal: note.discountTotal,
    taxableAmount: note.taxableAmount,
    taxAmount: note.taxAmount,
    totalAmount: note.totalAmount,
    notes: note.notes,
    postedAt: iso(note.postedAt),
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  }
}

export function toCreditNoteDetail(note: CreditNoteRecord, lines: Array<Record<string, unknown>>, history: Array<Record<string, unknown>>) {
  return {
    ...toCreditNoteResource(note),
    lines: noteLines(lines),
    history: history.map((row) => ({
      id: idOf(row._id),
      fromStatus: row.fromStatus ? toPublicEnum(String(row.fromStatus)) : undefined,
      toStatus: toPublicEnum(String(row.toStatus)),
      reason: row.reason ? String(row.reason) : undefined,
      createdAt: iso(row.createdAt as Date),
    })),
  }
}

export function toDebitNoteResource(note: DebitNoteRecord) {
  return {
    id: note.id,
    documentNumber: note.documentNumber,
    organizationId: note.organizationId,
    legalEntityId: note.legalEntityId,
    branchId: note.branchId,
    customerId: note.customerId,
    customerName: note.customerDisplayName,
    invoiceId: note.invoiceId,
    contractId: note.contractId,
    currency: note.currency,
    documentDate: note.documentDate.toISOString(),
    reason: note.reason,
    status: toPublicEnum(note.status),
    subtotal: note.subtotal,
    discountTotal: note.discountTotal,
    taxableAmount: note.taxableAmount,
    taxAmount: note.taxAmount,
    totalAmount: note.totalAmount,
    notes: note.notes,
    postedAt: iso(note.postedAt),
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  }
}

export function toDebitNoteDetail(note: DebitNoteRecord, lines: Array<Record<string, unknown>>, history: Array<Record<string, unknown>>) {
  return {
    ...toDebitNoteResource(note),
    lines: noteLines(lines),
    history: history.map((row) => ({
      id: idOf(row._id),
      fromStatus: row.fromStatus ? toPublicEnum(String(row.fromStatus)) : undefined,
      toStatus: toPublicEnum(String(row.toStatus)),
      reason: row.reason ? String(row.reason) : undefined,
      createdAt: iso(row.createdAt as Date),
    })),
  }
}

export function toDepositResource(deposit: DepositRecord) {
  return {
    id: deposit.id,
    depositNumber: deposit.depositNumber,
    organizationId: deposit.organizationId,
    legalEntityId: deposit.legalEntityId,
    branchId: deposit.branchId,
    customerId: deposit.customerId,
    customerName: deposit.customerDisplayName,
    contractId: deposit.contractId,
    currency: deposit.currency,
    amount: deposit.amount,
    appliedAmount: deposit.appliedAmount,
    releasedAmount: deposit.releasedAmount,
    remainingAmount: deposit.remainingAmount,
    status: toPublicEnum(deposit.status),
    paymentId: deposit.paymentId,
    heldAt: deposit.heldAt.toISOString(),
    releasedAt: iso(deposit.releasedAt),
    notes: deposit.notes,
    createdAt: deposit.createdAt.toISOString(),
    updatedAt: deposit.updatedAt.toISOString(),
  }
}

export function toDepositDetail(deposit: DepositRecord, events: Array<Record<string, unknown>>) {
  return {
    ...toDepositResource(deposit),
    events: events.map((row) => ({
      id: idOf(row._id),
      kind: toPublicEnum(String(row.kind)),
      amount: String(row.amount),
      invoiceId: row.invoiceId ? idOf(row.invoiceId) : undefined,
      reason: row.reason ? String(row.reason) : undefined,
      createdAt: iso(row.createdAt as Date),
    })),
  }
}
