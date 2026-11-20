import { createHash } from 'node:crypto'
import type { FilterQuery, SortOrder } from 'mongoose'
import {
  DEPOSIT_EVENT_KINDS,
  DOC_STATUSES,
  INVOICE_LINE_SOURCES,
  type DepositStatus,
  type DocStatus,
  type InvoiceSortField,
  type PaymentMethod,
  type PaymentSortField,
  type PaymentStatus,
  type DepositSortField,
} from '../../constants/finance.js'
import { rethrowDatabaseError } from '../../exceptions/mongooseError.js'
import {
  CreditNote,
  CreditNoteLine,
  DebitNote,
  DebitNoteLine,
  Deposit,
  DepositEvent,
  FinanceCounter,
  FinanceIdempotency,
  FinanceStatusEvent,
  Invoice,
  InvoiceLine,
  Payment,
  PaymentAllocation,
  PaymentWebhookEvent,
  Receipt,
} from '../../models/finance.model.js'
import { Customer } from '../../models/customer.model.js'
import { escapeRegex, toObjectId } from '../object-id.js'

export type InvoiceRecord = {
  id: string
  organizationId: string
  legalEntityId: string
  branchId: string
  documentNumber?: string
  customerId: string
  customerDisplayName: string
  contractId?: string
  currency: string
  documentDate: Date
  dueDate: Date
  status: DocStatus
  subtotal: string
  discountTotal: string
  taxableAmount: string
  taxAmount: string
  totalAmount: string
  paidAmount: string
  creditedAmount: string
  outstandingAmount: string
  notes?: string
  createdBy: string
  postedBy?: string
  postedAt?: Date
  voidedBy?: string
  voidedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export type InvoiceLineRecord = {
  id: string
  invoiceId: string
  organizationId: string
  description: string
  quantity: number
  unitPrice: string
  discountAmount: string
  taxRatePercent: string
  taxCode?: string
  taxCodeId?: string
  taxTreatment?: string
  taxCategory?: string
  pricingMode?: string
  lineSubtotal: string
  taxableAmount: string
  taxAmount: string
  lineTotal: string
  sourceType: string
  sourceId?: string
  sortOrder: number
}

export type PaymentRecord = {
  id: string
  organizationId: string
  legalEntityId: string
  branchId: string
  paymentNumber?: string
  customerId: string
  customerDisplayName: string
  currency: string
  amount: string
  allocatedAmount: string
  unallocatedAmount: string
  method: PaymentMethod
  paymentDate: Date
  status: PaymentStatus
  externalReference?: string
  provider?: string
  notes?: string
  createdBy: string
  completedAt?: Date
  reversedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export type ReceiptRecord = {
  id: string
  organizationId: string
  legalEntityId: string
  branchId: string
  receiptNumber: string
  paymentId: string
  customerId: string
  customerDisplayName: string
  currency: string
  amount: string
  method: PaymentMethod
  issuedAt: Date
  status: DocStatus
  notes?: string
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export type CreditNoteRecord = {
  id: string
  organizationId: string
  legalEntityId: string
  branchId: string
  documentNumber?: string
  customerId: string
  customerDisplayName: string
  invoiceId: string
  contractId?: string
  currency: string
  documentDate: Date
  reason: string
  status: DocStatus
  subtotal: string
  discountTotal: string
  taxableAmount: string
  taxAmount: string
  totalAmount: string
  notes?: string
  createdBy: string
  postedBy?: string
  postedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export type DebitNoteRecord = Omit<CreditNoteRecord, 'invoiceId'> & { invoiceId?: string }

export type DepositRecord = {
  id: string
  organizationId: string
  legalEntityId: string
  branchId: string
  depositNumber: string
  customerId: string
  customerDisplayName: string
  contractId: string
  currency: string
  amount: string
  appliedAmount: string
  releasedAmount: string
  remainingAmount: string
  status: DepositStatus
  paymentId?: string
  heldAt: Date
  releasedAt?: Date
  notes?: string
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

type LeanDoc = {
  _id: { toString(): string }
  [key: string]: unknown
}

function oid(value: string | undefined) {
  return value ? toObjectId(value) : undefined
}

function strId(value: unknown): string {
  return value && typeof value === 'object' && 'toString' in value ? String(value) : String(value ?? '')
}

function toInvoice(doc: LeanDoc): InvoiceRecord {
  return {
    id: doc._id.toString(),
    organizationId: strId(doc.organizationId),
    legalEntityId: strId(doc.legalEntityId),
    branchId: strId(doc.branchId),
    documentNumber: doc.documentNumber ? String(doc.documentNumber) : undefined,
    customerId: strId(doc.customerId),
    customerDisplayName: String(doc.customerDisplayName),
    contractId: doc.contractId ? strId(doc.contractId) : undefined,
    currency: String(doc.currency),
    documentDate: doc.documentDate as Date,
    dueDate: doc.dueDate as Date,
    status: doc.status as DocStatus,
    subtotal: String(doc.subtotal),
    discountTotal: String(doc.discountTotal),
    taxableAmount: String(doc.taxableAmount),
    taxAmount: String(doc.taxAmount),
    totalAmount: String(doc.totalAmount),
    paidAmount: String(doc.paidAmount ?? '0.00'),
    creditedAmount: String(doc.creditedAmount ?? '0.00'),
    outstandingAmount: String(doc.outstandingAmount),
    notes: doc.notes ? String(doc.notes) : undefined,
    createdBy: strId(doc.createdBy),
    postedBy: doc.postedBy ? strId(doc.postedBy) : undefined,
    postedAt: doc.postedAt as Date | undefined,
    voidedBy: doc.voidedBy ? strId(doc.voidedBy) : undefined,
    voidedAt: doc.voidedAt as Date | undefined,
    createdAt: doc.createdAt as Date,
    updatedAt: doc.updatedAt as Date,
  }
}

function toLine(doc: LeanDoc): InvoiceLineRecord {
  return {
    id: doc._id.toString(),
    invoiceId: strId(doc.invoiceId),
    organizationId: strId(doc.organizationId),
    description: String(doc.description),
    quantity: Number(doc.quantity),
    unitPrice: String(doc.unitPrice),
    discountAmount: String(doc.discountAmount),
    taxRatePercent: String(doc.taxRatePercent),
    taxCode: doc.taxCode ? String(doc.taxCode) : undefined,
    taxCodeId: doc.taxCodeId ? strId(doc.taxCodeId) : undefined,
    taxTreatment: doc.taxTreatment ? String(doc.taxTreatment) : undefined,
    taxCategory: doc.taxCategory ? String(doc.taxCategory) : undefined,
    pricingMode: doc.pricingMode ? String(doc.pricingMode) : undefined,
    lineSubtotal: String(doc.lineSubtotal),
    taxableAmount: String(doc.taxableAmount),
    taxAmount: String(doc.taxAmount),
    lineTotal: String(doc.lineTotal),
    sourceType: String(doc.sourceType ?? INVOICE_LINE_SOURCES.MANUAL),
    sourceId: doc.sourceId ? String(doc.sourceId) : undefined,
    sortOrder: Number(doc.sortOrder),
  }
}

function toPayment(doc: LeanDoc): PaymentRecord {
  return {
    id: doc._id.toString(),
    organizationId: strId(doc.organizationId),
    legalEntityId: strId(doc.legalEntityId),
    branchId: strId(doc.branchId),
    paymentNumber: doc.paymentNumber ? String(doc.paymentNumber) : undefined,
    customerId: strId(doc.customerId),
    customerDisplayName: String(doc.customerDisplayName),
    currency: String(doc.currency),
    amount: String(doc.amount),
    allocatedAmount: String(doc.allocatedAmount ?? '0.00'),
    unallocatedAmount: String(doc.unallocatedAmount),
    method: doc.method as PaymentMethod,
    paymentDate: doc.paymentDate as Date,
    status: doc.status as PaymentStatus,
    externalReference: doc.externalReference ? String(doc.externalReference) : undefined,
    provider: doc.provider ? String(doc.provider) : undefined,
    notes: doc.notes ? String(doc.notes) : undefined,
    createdBy: strId(doc.createdBy),
    completedAt: doc.completedAt as Date | undefined,
    reversedAt: doc.reversedAt as Date | undefined,
    createdAt: doc.createdAt as Date,
    updatedAt: doc.updatedAt as Date,
  }
}

function toReceipt(doc: LeanDoc): ReceiptRecord {
  return {
    id: doc._id.toString(),
    organizationId: strId(doc.organizationId),
    legalEntityId: strId(doc.legalEntityId),
    branchId: strId(doc.branchId),
    receiptNumber: String(doc.receiptNumber),
    paymentId: strId(doc.paymentId),
    customerId: strId(doc.customerId),
    customerDisplayName: String(doc.customerDisplayName),
    currency: String(doc.currency),
    amount: String(doc.amount),
    method: doc.method as PaymentMethod,
    issuedAt: doc.issuedAt as Date,
    status: doc.status as DocStatus,
    notes: doc.notes ? String(doc.notes) : undefined,
    createdBy: strId(doc.createdBy),
    createdAt: doc.createdAt as Date,
    updatedAt: doc.updatedAt as Date,
  }
}

function toCreditNote(doc: LeanDoc): CreditNoteRecord {
  return {
    id: doc._id.toString(),
    organizationId: strId(doc.organizationId),
    legalEntityId: strId(doc.legalEntityId),
    branchId: strId(doc.branchId),
    documentNumber: doc.documentNumber ? String(doc.documentNumber) : undefined,
    customerId: strId(doc.customerId),
    customerDisplayName: String(doc.customerDisplayName),
    invoiceId: strId(doc.invoiceId),
    contractId: doc.contractId ? strId(doc.contractId) : undefined,
    currency: String(doc.currency),
    documentDate: doc.documentDate as Date,
    reason: String(doc.reason),
    status: doc.status as DocStatus,
    subtotal: String(doc.subtotal),
    discountTotal: String(doc.discountTotal),
    taxableAmount: String(doc.taxableAmount),
    taxAmount: String(doc.taxAmount),
    totalAmount: String(doc.totalAmount),
    notes: doc.notes ? String(doc.notes) : undefined,
    createdBy: strId(doc.createdBy),
    postedBy: doc.postedBy ? strId(doc.postedBy) : undefined,
    postedAt: doc.postedAt as Date | undefined,
    createdAt: doc.createdAt as Date,
    updatedAt: doc.updatedAt as Date,
  }
}

function toDebitNote(doc: LeanDoc): DebitNoteRecord {
  const base = toCreditNote({ ...doc, invoiceId: doc.invoiceId ?? doc._id })
  return { ...base, invoiceId: doc.invoiceId ? strId(doc.invoiceId) : undefined }
}

function toDeposit(doc: LeanDoc): DepositRecord {
  return {
    id: doc._id.toString(),
    organizationId: strId(doc.organizationId),
    legalEntityId: strId(doc.legalEntityId),
    branchId: strId(doc.branchId),
    depositNumber: String(doc.depositNumber),
    customerId: strId(doc.customerId),
    customerDisplayName: String(doc.customerDisplayName),
    contractId: strId(doc.contractId),
    currency: String(doc.currency),
    amount: String(doc.amount),
    appliedAmount: String(doc.appliedAmount ?? '0.00'),
    releasedAmount: String(doc.releasedAmount ?? '0.00'),
    remainingAmount: String(doc.remainingAmount),
    status: doc.status as DepositStatus,
    paymentId: doc.paymentId ? strId(doc.paymentId) : undefined,
    heldAt: doc.heldAt as Date,
    releasedAt: doc.releasedAt as Date | undefined,
    notes: doc.notes ? String(doc.notes) : undefined,
    createdBy: strId(doc.createdBy),
    createdAt: doc.createdAt as Date,
    updatedAt: doc.updatedAt as Date,
  }
}

export function hashFinanceRequest(payload: Record<string, unknown>): string {
  const keys = Object.keys(payload).sort()
  const stable: Record<string, unknown> = {}
  for (const key of keys) stable[key] = payload[key]
  return createHash('sha256').update(JSON.stringify(stable)).digest('hex')
}

const PREFIX: Record<string, string> = {
  invoice: 'INV',
  payment: 'PAY',
  receipt: 'RCP',
  credit_note: 'CN',
  debit_note: 'DN',
  deposit: 'DEP',
}

export async function allocateDocumentNumber(organizationId: string, name: keyof typeof PREFIX): Promise<string> {
  const orgId = toObjectId(organizationId)
  if (!orgId) throw new Error('organizationId is required')
  const counter = await FinanceCounter.findOneAndUpdate(
    { organizationId: orgId, name },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  ).lean()
  return `${PREFIX[name]}-${String(counter?.seq ?? 1).padStart(6, '0')}`
}

export async function insertInvoice(input: Omit<InvoiceRecord, 'id' | 'createdAt' | 'updatedAt' | 'documentNumber'> & { documentNumber?: string }) {
  try {
    const doc = await Invoice.create({
      ...input,
      organizationId: oid(input.organizationId),
      legalEntityId: oid(input.legalEntityId),
      branchId: oid(input.branchId),
      customerId: oid(input.customerId),
      contractId: oid(input.contractId),
      createdBy: oid(input.createdBy),
      creditedAmount: input.creditedAmount ?? '0.00',
      paidAmount: input.paidAmount ?? '0.00',
    })
    return toInvoice(doc.toObject() as LeanDoc)
  } catch (error) {
    rethrowDatabaseError(error, 'The invoice could not be saved.')
  }
}

export async function replaceInvoiceLines(
  invoiceId: string,
  organizationId: string,
  lines: Array<Omit<InvoiceLineRecord, 'id' | 'invoiceId' | 'organizationId'>>,
) {
  const invId = toObjectId(invoiceId)
  const orgId = toObjectId(organizationId)
  if (!invId || !orgId) throw new Error('invoiceId and organizationId are required')
  await InvoiceLine.deleteMany({ invoiceId: invId })
  if (lines.length === 0) return []
  try {
    const docs = await InvoiceLine.insertMany(
      lines.map((line, index) => ({
        ...line,
        invoiceId: invId,
        organizationId: orgId,
        sortOrder: line.sortOrder ?? index,
        sourceType: line.sourceType ?? INVOICE_LINE_SOURCES.MANUAL,
      })),
    )
    return docs.map((doc) => toLine(doc.toObject() as LeanDoc))
  } catch (error) {
    rethrowDatabaseError(error, 'Invoice lines could not be saved. A charge may already be invoiced.')
  }
}

export async function findInvoiceById(id: string): Promise<InvoiceRecord | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const doc = await Invoice.findById(objectId).lean()
  return doc ? toInvoice(doc as LeanDoc) : null
}

export async function listInvoiceLines(invoiceId: string): Promise<InvoiceLineRecord[]> {
  const id = toObjectId(invoiceId)
  if (!id) return []
  const docs = await InvoiceLine.find({ invoiceId: id }).sort({ sortOrder: 1 }).lean()
  return docs.map((doc) => toLine(doc as LeanDoc))
}

export async function findInvoiceLineBySource(organizationId: string, sourceType: string, sourceId: string) {
  const orgId = toObjectId(organizationId)
  if (!orgId) return null
  const doc = await InvoiceLine.findOne({ organizationId: orgId, sourceType, sourceId }).lean()
  return doc ? toLine(doc as LeanDoc) : null
}

export async function updateInvoiceDraft(
  id: string,
  expectedStatus: DocStatus,
  patch: Partial<{
    customerId: string
    customerDisplayName: string
    contractId: string | null
    currency: string
    documentDate: Date
    dueDate: Date
    subtotal: string
    discountTotal: string
    taxableAmount: string
    taxAmount: string
    totalAmount: string
    outstandingAmount: string
    notes: string | null
  }>,
): Promise<InvoiceRecord | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const set: Record<string, unknown> = { ...patch }
  if (patch.customerId) set.customerId = oid(patch.customerId)
  if (patch.contractId === null) set.contractId = undefined
  else if (patch.contractId) set.contractId = oid(patch.contractId)
  if (patch.notes === null) set.notes = undefined
  const doc = await Invoice.findOneAndUpdate(
    { _id: objectId, status: expectedStatus },
    { $set: set },
    { returnDocument: 'after' },
  ).lean()
  return doc ? toInvoice(doc as LeanDoc) : null
}

export async function transitionInvoice(
  id: string,
  from: DocStatus,
  to: DocStatus,
  meta: { actorUserId: string; documentNumber?: string; postedAt?: Date; voidedAt?: Date },
): Promise<InvoiceRecord | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const set: Record<string, unknown> = { status: to }
  if (to === DOC_STATUSES.POSTED) {
    set.documentNumber = meta.documentNumber
    set.postedBy = oid(meta.actorUserId)
    set.postedAt = meta.postedAt ?? new Date()
  }
  if (to === DOC_STATUSES.VOIDED) {
    set.voidedBy = oid(meta.actorUserId)
    set.voidedAt = meta.voidedAt ?? new Date()
  }
  const doc = await Invoice.findOneAndUpdate({ _id: objectId, status: from }, { $set: set }, { returnDocument: 'after' }).lean()
  return doc ? toInvoice(doc as LeanDoc) : null
}

export async function applyInvoicePaidDelta(id: string, paidDelta: string, outstanding: string, paidAmount: string) {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const doc = await Invoice.findOneAndUpdate(
    { _id: objectId, status: DOC_STATUSES.POSTED },
    { $set: { paidAmount, outstandingAmount: outstanding } },
    { returnDocument: 'after' },
  ).lean()
  void paidDelta
  return doc ? toInvoice(doc as LeanDoc) : null
}

export async function applyInvoiceCredit(id: string, creditedAmount: string, outstandingAmount: string) {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const doc = await Invoice.findOneAndUpdate(
    { _id: objectId, status: DOC_STATUSES.POSTED },
    { $set: { creditedAmount, outstandingAmount } },
    { returnDocument: 'after' },
  ).lean()
  return doc ? toInvoice(doc as LeanDoc) : null
}

async function customerIdsForSearch(organizationId: ReturnType<typeof toObjectId>, search: string) {
  const pattern = { $regex: escapeRegex(search), $options: 'i' }
  const customers = await Customer.find({
    organizationId,
    $or: [{ displayName: pattern }, { email: pattern }, { phone: pattern }, { customerNumber: pattern }],
  })
    .select('_id')
    .lean()
  return customers.map((row) => row._id)
}

export async function listInvoices(input: {
  organizationId: string
  branchIds?: string[]
  legalEntityIds?: string[]
  skip: number
  take: number
  search?: string
  status?: DocStatus
  paymentStatus?: 'UNPAID' | 'PARTIAL' | 'PAID'
  branchId?: string
  customerId?: string
  contractId?: string
  legalEntityId?: string
  currency?: string
  documentFrom?: Date
  documentTo?: Date
  dueFrom?: Date
  dueTo?: Date
  sort: InvoiceSortField
  order?: 'asc' | 'desc'
}): Promise<{ items: InvoiceRecord[]; total: number }> {
  const organizationId = toObjectId(input.organizationId)
  if (!organizationId) return { items: [], total: 0 }
  const filter: FilterQuery<unknown> = { organizationId }
  if (input.branchIds) filter.branchId = { $in: input.branchIds.map((id) => toObjectId(id)).filter(Boolean) }
  if (input.legalEntityIds) {
    filter.legalEntityId = { $in: input.legalEntityIds.map((id) => toObjectId(id)).filter(Boolean) }
  }
  if (input.branchId) filter.branchId = oid(input.branchId)
  if (input.legalEntityId) filter.legalEntityId = oid(input.legalEntityId)
  if (input.customerId) filter.customerId = oid(input.customerId)
  if (input.contractId) filter.contractId = oid(input.contractId)
  if (input.status) filter.status = input.status
  if (input.currency) filter.currency = input.currency.toUpperCase()
  if (input.documentFrom || input.documentTo) {
    filter.documentDate = {
      ...(input.documentFrom ? { $gte: input.documentFrom } : {}),
      ...(input.documentTo ? { $lt: input.documentTo } : {}),
    }
  }
  if (input.dueFrom || input.dueTo) {
    filter.dueDate = {
      ...(input.dueFrom ? { $gte: input.dueFrom } : {}),
      ...(input.dueTo ? { $lt: input.dueTo } : {}),
    }
  }
  if (input.paymentStatus === 'UNPAID') filter.paidAmount = '0.00'
  if (input.paymentStatus === 'PAID') filter.$expr = { $eq: ['$paidAmount', '$totalAmount'] }
  if (input.paymentStatus === 'PARTIAL') {
    filter.$and = [{ paidAmount: { $ne: '0.00' } }, { $expr: { $lt: ['$paidAmount', '$totalAmount'] } }]
  }
  if (input.search) {
    const ids = await customerIdsForSearch(organizationId, input.search)
    filter.$or = [
      { documentNumber: { $regex: escapeRegex(input.search), $options: 'i' } },
      { customerDisplayName: { $regex: escapeRegex(input.search), $options: 'i' } },
      ...(ids.length ? [{ customerId: { $in: ids } }] : []),
    ]
  }
  const sort: Record<string, SortOrder> = { [input.sort]: input.order === 'asc' ? 1 : -1 }
  const [items, total] = await Promise.all([
    Invoice.find(filter).sort(sort).skip(input.skip).limit(input.take).lean(),
    Invoice.countDocuments(filter),
  ])
  return { items: items.map((doc) => toInvoice(doc as LeanDoc)), total }
}

export async function insertPayment(input: Omit<PaymentRecord, 'id' | 'createdAt' | 'updatedAt' | 'paymentNumber'> & { paymentNumber?: string }) {
  try {
    const doc = await Payment.create({
      ...input,
      organizationId: oid(input.organizationId),
      legalEntityId: oid(input.legalEntityId),
      branchId: oid(input.branchId),
      customerId: oid(input.customerId),
      createdBy: oid(input.createdBy),
    })
    return toPayment(doc.toObject() as LeanDoc)
  } catch (error) {
    rethrowDatabaseError(error, 'The payment could not be saved.')
  }
}

export async function findPaymentById(id: string): Promise<PaymentRecord | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const doc = await Payment.findById(objectId).lean()
  return doc ? toPayment(doc as LeanDoc) : null
}

export async function transitionPayment(
  id: string,
  from: PaymentStatus,
  to: PaymentStatus,
  meta: { paymentNumber?: string; completedAt?: Date; reversedAt?: Date },
): Promise<PaymentRecord | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const set: Record<string, unknown> = { status: to, ...meta }
  const doc = await Payment.findOneAndUpdate({ _id: objectId, status: from }, { $set: set }, { returnDocument: 'after' }).lean()
  return doc ? toPayment(doc as LeanDoc) : null
}

export async function updatePaymentAllocationTotals(id: string, allocatedAmount: string, unallocatedAmount: string) {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const doc = await Payment.findByIdAndUpdate(
    objectId,
    { $set: { allocatedAmount, unallocatedAmount } },
    { returnDocument: 'after' },
  ).lean()
  return doc ? toPayment(doc as LeanDoc) : null
}

export async function insertAllocation(input: {
  paymentId: string
  invoiceId: string
  organizationId: string
  amount: string
  createdBy: string
}) {
  try {
    const doc = await PaymentAllocation.create({
      paymentId: oid(input.paymentId),
      invoiceId: oid(input.invoiceId),
      organizationId: oid(input.organizationId),
      amount: input.amount,
      createdBy: oid(input.createdBy),
    })
    return {
      id: doc._id.toString(),
      paymentId: input.paymentId,
      invoiceId: input.invoiceId,
      organizationId: input.organizationId,
      amount: input.amount,
      createdBy: input.createdBy,
      createdAt: doc.createdAt,
    }
  } catch (error) {
    rethrowDatabaseError(error, 'Payment allocation could not be saved.')
  }
}

export async function listAllocationsByPayment(paymentId: string) {
  const id = toObjectId(paymentId)
  if (!id) return []
  return PaymentAllocation.find({ paymentId: id }).sort({ createdAt: 1 }).lean()
}

export async function listAllocationsByInvoice(invoiceId: string) {
  const id = toObjectId(invoiceId)
  if (!id) return []
  return PaymentAllocation.find({ invoiceId: id }).sort({ createdAt: 1 }).lean()
}

export async function listPayments(input: {
  organizationId: string
  branchIds?: string[]
  legalEntityIds?: string[]
  skip: number
  take: number
  search?: string
  status?: PaymentStatus
  method?: PaymentMethod
  branchId?: string
  customerId?: string
  legalEntityId?: string
  invoiceId?: string
  paymentFrom?: Date
  paymentTo?: Date
  sort: PaymentSortField
  order?: 'asc' | 'desc'
}): Promise<{ items: PaymentRecord[]; total: number }> {
  const organizationId = toObjectId(input.organizationId)
  if (!organizationId) return { items: [], total: 0 }
  const filter: FilterQuery<unknown> = { organizationId }
  if (input.branchIds) filter.branchId = { $in: input.branchIds.map((id) => toObjectId(id)).filter(Boolean) }
  if (input.legalEntityIds) {
    filter.legalEntityId = { $in: input.legalEntityIds.map((id) => toObjectId(id)).filter(Boolean) }
  }
  if (input.branchId) filter.branchId = oid(input.branchId)
  if (input.legalEntityId) filter.legalEntityId = oid(input.legalEntityId)
  if (input.customerId) filter.customerId = oid(input.customerId)
  if (input.status) filter.status = input.status
  if (input.method) filter.method = input.method
  if (input.paymentFrom || input.paymentTo) {
    filter.paymentDate = {
      ...(input.paymentFrom ? { $gte: input.paymentFrom } : {}),
      ...(input.paymentTo ? { $lt: input.paymentTo } : {}),
    }
  }
  if (input.invoiceId) {
    const allocations = await PaymentAllocation.find({ invoiceId: oid(input.invoiceId) }).select('paymentId').lean()
    filter._id = { $in: allocations.map((row) => row.paymentId) }
  }
  if (input.search) {
    filter.$or = [
      { paymentNumber: { $regex: escapeRegex(input.search), $options: 'i' } },
      { customerDisplayName: { $regex: escapeRegex(input.search), $options: 'i' } },
      { externalReference: { $regex: escapeRegex(input.search), $options: 'i' } },
    ]
  }
  const sort: Record<string, SortOrder> = { [input.sort]: input.order === 'asc' ? 1 : -1 }
  const [items, total] = await Promise.all([
    Payment.find(filter).sort(sort).skip(input.skip).limit(input.take).lean(),
    Payment.countDocuments(filter),
  ])
  return { items: items.map((doc) => toPayment(doc as LeanDoc)), total }
}

export async function insertReceipt(input: Omit<ReceiptRecord, 'id' | 'createdAt' | 'updatedAt'>) {
  try {
    const doc = await Receipt.create({
      ...input,
      organizationId: oid(input.organizationId),
      legalEntityId: oid(input.legalEntityId),
      branchId: oid(input.branchId),
      paymentId: oid(input.paymentId),
      customerId: oid(input.customerId),
      createdBy: oid(input.createdBy),
    })
    return toReceipt(doc.toObject() as LeanDoc)
  } catch (error) {
    rethrowDatabaseError(error, 'The receipt could not be saved.')
  }
}

export async function findReceiptById(id: string): Promise<ReceiptRecord | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const doc = await Receipt.findById(objectId).lean()
  return doc ? toReceipt(doc as LeanDoc) : null
}

export async function findReceiptByPaymentId(paymentId: string): Promise<ReceiptRecord | null> {
  const id = toObjectId(paymentId)
  if (!id) return null
  const doc = await Receipt.findOne({ paymentId: id }).lean()
  return doc ? toReceipt(doc as LeanDoc) : null
}

export async function listReceipts(input: {
  organizationId: string
  branchIds?: string[]
  legalEntityIds?: string[]
  skip: number
  take: number
  search?: string
  status?: DocStatus
  branchId?: string
  customerId?: string
  paymentId?: string
  issuedFrom?: Date
  issuedTo?: Date
  order?: 'asc' | 'desc'
}): Promise<{ items: ReceiptRecord[]; total: number }> {
  const organizationId = toObjectId(input.organizationId)
  if (!organizationId) return { items: [], total: 0 }
  const filter: FilterQuery<unknown> = { organizationId }
  if (input.branchIds) filter.branchId = { $in: input.branchIds.map((id) => toObjectId(id)).filter(Boolean) }
  if (input.legalEntityIds) {
    filter.legalEntityId = { $in: input.legalEntityIds.map((id) => toObjectId(id)).filter(Boolean) }
  }
  if (input.branchId) filter.branchId = oid(input.branchId)
  if (input.customerId) filter.customerId = oid(input.customerId)
  if (input.paymentId) filter.paymentId = oid(input.paymentId)
  if (input.status) filter.status = input.status
  if (input.issuedFrom || input.issuedTo) {
    filter.issuedAt = {
      ...(input.issuedFrom ? { $gte: input.issuedFrom } : {}),
      ...(input.issuedTo ? { $lt: input.issuedTo } : {}),
    }
  }
  if (input.search) {
    filter.$or = [
      { receiptNumber: { $regex: escapeRegex(input.search), $options: 'i' } },
      { customerDisplayName: { $regex: escapeRegex(input.search), $options: 'i' } },
    ]
  }
  const sort: Record<string, SortOrder> = { issuedAt: input.order === 'asc' ? 1 : -1 }
  const [items, total] = await Promise.all([
    Receipt.find(filter).sort(sort).skip(input.skip).limit(input.take).lean(),
    Receipt.countDocuments(filter),
  ])
  return { items: items.map((doc) => toReceipt(doc as LeanDoc)), total }
}

export async function insertCreditNote(input: Omit<CreditNoteRecord, 'id' | 'createdAt' | 'updatedAt' | 'documentNumber'> & { documentNumber?: string }) {
  try {
    const doc = await CreditNote.create({
      ...input,
      organizationId: oid(input.organizationId),
      legalEntityId: oid(input.legalEntityId),
      branchId: oid(input.branchId),
      customerId: oid(input.customerId),
      invoiceId: oid(input.invoiceId),
      contractId: oid(input.contractId),
      createdBy: oid(input.createdBy),
    })
    return toCreditNote(doc.toObject() as LeanDoc)
  } catch (error) {
    rethrowDatabaseError(error, 'The credit note could not be saved.')
  }
}

export async function replaceCreditNoteLines(
  creditNoteId: string,
  organizationId: string,
  lines: Array<{
    description: string
    quantity: number
    unitPrice: string
    discountAmount: string
    taxRatePercent: string
    lineSubtotal: string
    taxableAmount: string
    taxAmount: string
    lineTotal: string
    sortOrder: number
  }>,
) {
  const noteId = toObjectId(creditNoteId)
  const orgId = toObjectId(organizationId)
  if (!noteId || !orgId) throw new Error('creditNoteId required')
  await CreditNoteLine.deleteMany({ creditNoteId: noteId })
  if (!lines.length) return []
  const docs = await CreditNoteLine.insertMany(lines.map((line) => ({ ...line, creditNoteId: noteId, organizationId: orgId })))
  return docs
}

export async function findCreditNoteById(id: string): Promise<CreditNoteRecord | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const doc = await CreditNote.findById(objectId).lean()
  return doc ? toCreditNote(doc as LeanDoc) : null
}

export async function listCreditNoteLines(creditNoteId: string) {
  const id = toObjectId(creditNoteId)
  if (!id) return []
  return CreditNoteLine.find({ creditNoteId: id }).sort({ sortOrder: 1 }).lean()
}

export async function sumPostedCreditsForInvoice(invoiceId: string): Promise<string> {
  const id = toObjectId(invoiceId)
  if (!id) return '0.00'
  const rows = await CreditNote.find({ invoiceId: id, status: DOC_STATUSES.POSTED }).select('totalAmount').lean()
  let total = 0n
  for (const row of rows) {
    const [w = '0', f = '00'] = String(row.totalAmount).split('.')
    total += BigInt(w) * 100n + BigInt(f.padEnd(2, '0').slice(0, 2))
  }
  const frac = (total % 100n).toString().padStart(2, '0')
  return `${total / 100n}.${frac}`
}

export async function transitionCreditNote(
  id: string,
  from: DocStatus,
  to: DocStatus,
  meta: { actorUserId: string; documentNumber?: string },
): Promise<CreditNoteRecord | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const set: Record<string, unknown> = { status: to }
  if (to === DOC_STATUSES.POSTED) {
    set.documentNumber = meta.documentNumber
    set.postedBy = oid(meta.actorUserId)
    set.postedAt = new Date()
  }
  if (to === DOC_STATUSES.VOIDED) {
    set.voidedBy = oid(meta.actorUserId)
    set.voidedAt = new Date()
  }
  const doc = await CreditNote.findOneAndUpdate({ _id: objectId, status: from }, { $set: set }, { returnDocument: 'after' }).lean()
  return doc ? toCreditNote(doc as LeanDoc) : null
}

export async function updateCreditNoteDraft(
  id: string,
  patch: Partial<{
    reason: string
    documentDate: Date
    notes: string | null
    subtotal: string
    discountTotal: string
    taxableAmount: string
    taxAmount: string
    totalAmount: string
  }>,
): Promise<CreditNoteRecord | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const set: Record<string, unknown> = { ...patch }
  if (patch.notes === null) set.notes = undefined
  const doc = await CreditNote.findOneAndUpdate(
    { _id: objectId, status: DOC_STATUSES.DRAFT },
    { $set: set },
    { returnDocument: 'after' },
  ).lean()
  return doc ? toCreditNote(doc as LeanDoc) : null
}

export async function listCreditNotes(input: {
  organizationId: string
  branchIds?: string[]
  legalEntityIds?: string[]
  skip: number
  take: number
  search?: string
  status?: DocStatus
  branchId?: string
  customerId?: string
  invoiceId?: string
  documentFrom?: Date
  documentTo?: Date
  order?: 'asc' | 'desc'
}): Promise<{ items: CreditNoteRecord[]; total: number }> {
  const organizationId = toObjectId(input.organizationId)
  if (!organizationId) return { items: [], total: 0 }
  const filter: FilterQuery<unknown> = { organizationId }
  if (input.branchIds) filter.branchId = { $in: input.branchIds.map((id) => toObjectId(id)).filter(Boolean) }
  if (input.legalEntityIds) {
    filter.legalEntityId = { $in: input.legalEntityIds.map((id) => toObjectId(id)).filter(Boolean) }
  }
  if (input.branchId) filter.branchId = oid(input.branchId)
  if (input.customerId) filter.customerId = oid(input.customerId)
  if (input.invoiceId) filter.invoiceId = oid(input.invoiceId)
  if (input.status) filter.status = input.status
  if (input.documentFrom || input.documentTo) {
    filter.documentDate = {
      ...(input.documentFrom ? { $gte: input.documentFrom } : {}),
      ...(input.documentTo ? { $lt: input.documentTo } : {}),
    }
  }
  if (input.search) {
    filter.$or = [
      { documentNumber: { $regex: escapeRegex(input.search), $options: 'i' } },
      { customerDisplayName: { $regex: escapeRegex(input.search), $options: 'i' } },
      { reason: { $regex: escapeRegex(input.search), $options: 'i' } },
    ]
  }
  const sort: Record<string, SortOrder> = { documentDate: input.order === 'asc' ? 1 : -1 }
  const [items, total] = await Promise.all([
    CreditNote.find(filter).sort(sort).skip(input.skip).limit(input.take).lean(),
    CreditNote.countDocuments(filter),
  ])
  return { items: items.map((doc) => toCreditNote(doc as LeanDoc)), total }
}

export async function insertDebitNote(input: Omit<DebitNoteRecord, 'id' | 'createdAt' | 'updatedAt' | 'documentNumber'> & { documentNumber?: string }) {
  try {
    const doc = await DebitNote.create({
      ...input,
      organizationId: oid(input.organizationId),
      legalEntityId: oid(input.legalEntityId),
      branchId: oid(input.branchId),
      customerId: oid(input.customerId),
      invoiceId: oid(input.invoiceId),
      contractId: oid(input.contractId),
      createdBy: oid(input.createdBy),
    })
    return toDebitNote(doc.toObject() as LeanDoc)
  } catch (error) {
    rethrowDatabaseError(error, 'The debit note could not be saved.')
  }
}

export async function replaceDebitNoteLines(
  debitNoteId: string,
  organizationId: string,
  lines: Array<{
    description: string
    quantity: number
    unitPrice: string
    discountAmount: string
    taxRatePercent: string
    lineSubtotal: string
    taxableAmount: string
    taxAmount: string
    lineTotal: string
    sortOrder: number
  }>,
) {
  const noteId = toObjectId(debitNoteId)
  const orgId = toObjectId(organizationId)
  if (!noteId || !orgId) throw new Error('debitNoteId required')
  await DebitNoteLine.deleteMany({ debitNoteId: noteId })
  if (!lines.length) return []
  return DebitNoteLine.insertMany(lines.map((line) => ({ ...line, debitNoteId: noteId, organizationId: orgId })))
}

export async function findDebitNoteById(id: string): Promise<DebitNoteRecord | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const doc = await DebitNote.findById(objectId).lean()
  return doc ? toDebitNote(doc as LeanDoc) : null
}

export async function listDebitNoteLines(debitNoteId: string) {
  const id = toObjectId(debitNoteId)
  if (!id) return []
  return DebitNoteLine.find({ debitNoteId: id }).sort({ sortOrder: 1 }).lean()
}

export async function transitionDebitNote(
  id: string,
  from: DocStatus,
  to: DocStatus,
  meta: { actorUserId: string; documentNumber?: string },
): Promise<DebitNoteRecord | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const set: Record<string, unknown> = { status: to }
  if (to === DOC_STATUSES.POSTED) {
    set.documentNumber = meta.documentNumber
    set.postedBy = oid(meta.actorUserId)
    set.postedAt = new Date()
  }
  if (to === DOC_STATUSES.VOIDED) {
    set.voidedBy = oid(meta.actorUserId)
    set.voidedAt = new Date()
  }
  const doc = await DebitNote.findOneAndUpdate({ _id: objectId, status: from }, { $set: set }, { returnDocument: 'after' }).lean()
  return doc ? toDebitNote(doc as LeanDoc) : null
}

export async function updateDebitNoteDraft(
  id: string,
  patch: Partial<{
    reason: string
    documentDate: Date
    notes: string | null
    subtotal: string
    discountTotal: string
    taxableAmount: string
    taxAmount: string
    totalAmount: string
  }>,
): Promise<DebitNoteRecord | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const set: Record<string, unknown> = { ...patch }
  if (patch.notes === null) set.notes = undefined
  const doc = await DebitNote.findOneAndUpdate(
    { _id: objectId, status: DOC_STATUSES.DRAFT },
    { $set: set },
    { returnDocument: 'after' },
  ).lean()
  return doc ? toDebitNote(doc as LeanDoc) : null
}

export async function listDebitNotes(input: {
  organizationId: string
  branchIds?: string[]
  legalEntityIds?: string[]
  skip: number
  take: number
  search?: string
  status?: DocStatus
  branchId?: string
  customerId?: string
  invoiceId?: string
  documentFrom?: Date
  documentTo?: Date
  order?: 'asc' | 'desc'
}): Promise<{ items: DebitNoteRecord[]; total: number }> {
  const organizationId = toObjectId(input.organizationId)
  if (!organizationId) return { items: [], total: 0 }
  const filter: FilterQuery<unknown> = { organizationId }
  if (input.branchIds) filter.branchId = { $in: input.branchIds.map((id) => toObjectId(id)).filter(Boolean) }
  if (input.legalEntityIds) {
    filter.legalEntityId = { $in: input.legalEntityIds.map((id) => toObjectId(id)).filter(Boolean) }
  }
  if (input.branchId) filter.branchId = oid(input.branchId)
  if (input.customerId) filter.customerId = oid(input.customerId)
  if (input.invoiceId) filter.invoiceId = oid(input.invoiceId)
  if (input.status) filter.status = input.status
  if (input.documentFrom || input.documentTo) {
    filter.documentDate = {
      ...(input.documentFrom ? { $gte: input.documentFrom } : {}),
      ...(input.documentTo ? { $lt: input.documentTo } : {}),
    }
  }
  if (input.search) {
    filter.$or = [
      { documentNumber: { $regex: escapeRegex(input.search), $options: 'i' } },
      { customerDisplayName: { $regex: escapeRegex(input.search), $options: 'i' } },
      { reason: { $regex: escapeRegex(input.search), $options: 'i' } },
    ]
  }
  const sort: Record<string, SortOrder> = { documentDate: input.order === 'asc' ? 1 : -1 }
  const [items, total] = await Promise.all([
    DebitNote.find(filter).sort(sort).skip(input.skip).limit(input.take).lean(),
    DebitNote.countDocuments(filter),
  ])
  return { items: items.map((doc) => toDebitNote(doc as LeanDoc)), total }
}

export async function insertDeposit(input: Omit<DepositRecord, 'id' | 'createdAt' | 'updatedAt'>) {
  try {
    const doc = await Deposit.create({
      ...input,
      organizationId: oid(input.organizationId),
      legalEntityId: oid(input.legalEntityId),
      branchId: oid(input.branchId),
      customerId: oid(input.customerId),
      contractId: oid(input.contractId),
      paymentId: oid(input.paymentId),
      createdBy: oid(input.createdBy),
    })
    return toDeposit(doc.toObject() as LeanDoc)
  } catch (error) {
    rethrowDatabaseError(error, 'The deposit could not be saved.')
  }
}

export async function findDepositById(id: string): Promise<DepositRecord | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const doc = await Deposit.findById(objectId).lean()
  return doc ? toDeposit(doc as LeanDoc) : null
}

export async function updateDepositAmounts(
  id: string,
  expectedRemaining: string,
  patch: {
    appliedAmount: string
    releasedAmount: string
    remainingAmount: string
    status: DepositStatus
    releasedAt?: Date
  },
): Promise<DepositRecord | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const doc = await Deposit.findOneAndUpdate(
    { _id: objectId, remainingAmount: expectedRemaining },
    { $set: patch },
    { returnDocument: 'after' },
  ).lean()
  return doc ? toDeposit(doc as LeanDoc) : null
}

export async function insertDepositEvent(input: {
  depositId: string
  organizationId: string
  kind: (typeof DEPOSIT_EVENT_KINDS)[keyof typeof DEPOSIT_EVENT_KINDS]
  amount: string
  invoiceId?: string
  reason?: string
  actorUserId: string
}) {
  await DepositEvent.create({
    depositId: oid(input.depositId),
    organizationId: oid(input.organizationId),
    kind: input.kind,
    amount: input.amount,
    invoiceId: oid(input.invoiceId),
    reason: input.reason,
    actorUserId: oid(input.actorUserId),
  })
}

export async function listDepositEvents(depositId: string) {
  const id = toObjectId(depositId)
  if (!id) return []
  return DepositEvent.find({ depositId: id }).sort({ createdAt: 1 }).lean()
}

export async function listDeposits(input: {
  organizationId: string
  branchIds?: string[]
  legalEntityIds?: string[]
  skip: number
  take: number
  search?: string
  status?: DepositStatus
  branchId?: string
  customerId?: string
  contractId?: string
  legalEntityId?: string
  heldFrom?: Date
  heldTo?: Date
  sort: DepositSortField
  order?: 'asc' | 'desc'
}): Promise<{ items: DepositRecord[]; total: number }> {
  const organizationId = toObjectId(input.organizationId)
  if (!organizationId) return { items: [], total: 0 }
  const filter: FilterQuery<unknown> = { organizationId }
  if (input.branchIds) filter.branchId = { $in: input.branchIds.map((id) => toObjectId(id)).filter(Boolean) }
  if (input.legalEntityIds) {
    filter.legalEntityId = { $in: input.legalEntityIds.map((id) => toObjectId(id)).filter(Boolean) }
  }
  if (input.branchId) filter.branchId = oid(input.branchId)
  if (input.legalEntityId) filter.legalEntityId = oid(input.legalEntityId)
  if (input.customerId) filter.customerId = oid(input.customerId)
  if (input.contractId) filter.contractId = oid(input.contractId)
  if (input.status) filter.status = input.status
  if (input.heldFrom || input.heldTo) {
    filter.heldAt = {
      ...(input.heldFrom ? { $gte: input.heldFrom } : {}),
      ...(input.heldTo ? { $lt: input.heldTo } : {}),
    }
  }
  if (input.search) {
    filter.$or = [
      { depositNumber: { $regex: escapeRegex(input.search), $options: 'i' } },
      { customerDisplayName: { $regex: escapeRegex(input.search), $options: 'i' } },
    ]
  }
  const sort: Record<string, SortOrder> = { [input.sort]: input.order === 'asc' ? 1 : -1 }
  const [items, total] = await Promise.all([
    Deposit.find(filter).sort(sort).skip(input.skip).limit(input.take).lean(),
    Deposit.countDocuments(filter),
  ])
  return { items: items.map((doc) => toDeposit(doc as LeanDoc)), total }
}

export async function recordFinanceStatusEvent(input: {
  entityType: string
  entityId: string
  organizationId: string
  branchId?: string
  fromStatus?: string
  toStatus: string
  reason?: string
  actorUserId: string
}) {
  await FinanceStatusEvent.create({
    entityType: input.entityType,
    entityId: oid(input.entityId),
    organizationId: oid(input.organizationId),
    branchId: oid(input.branchId),
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    reason: input.reason,
    actorUserId: oid(input.actorUserId),
  })
}

export async function listFinanceStatusEvents(entityType: string, entityId: string) {
  const id = toObjectId(entityId)
  if (!id) return []
  return FinanceStatusEvent.find({ entityType, entityId: id }).sort({ createdAt: 1 }).lean()
}

export async function claimIdempotencyKey(organizationId: string, key: string, requestHash: string) {
  const orgId = toObjectId(organizationId)
  if (!orgId) throw new Error('organizationId required')
  try {
    const created = await FinanceIdempotency.create({ organizationId: orgId, key, requestHash })
    return { kind: 'created' as const, id: created._id.toString() }
  } catch (error) {
    const existing = await FinanceIdempotency.findOne({ organizationId: orgId, key }).lean()
    if (!existing) rethrowDatabaseError(error, 'Idempotency key could not be claimed.')
    return {
      kind: 'existing' as const,
      requestHash: existing.requestHash,
      paymentId: existing.paymentId?.toString(),
    }
  }
}

export async function attachIdempotencyPayment(organizationId: string, key: string, paymentId: string) {
  await FinanceIdempotency.updateOne(
    { organizationId: oid(organizationId), key },
    { $set: { paymentId: oid(paymentId) } },
  )
}

export async function findIdempotency(organizationId: string, key: string) {
  const orgId = toObjectId(organizationId)
  if (!orgId) return null
  return FinanceIdempotency.findOne({ organizationId: orgId, key }).lean()
}

export async function claimWebhookEvent(input: {
  organizationId: string
  provider: string
  externalEventId: string
  payloadHash: string
  paymentId?: string
}) {
  try {
    await PaymentWebhookEvent.create({
      organizationId: oid(input.organizationId),
      provider: input.provider,
      externalEventId: input.externalEventId,
      payloadHash: input.payloadHash,
      paymentId: oid(input.paymentId),
      processedAt: new Date(),
    })
    return { duplicate: false }
  } catch {
    return { duplicate: true }
  }
}
