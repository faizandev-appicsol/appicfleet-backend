import type { FilterQuery, SortOrder } from 'mongoose'
import {
  DEFAULT_EXPENSE_CATEGORIES,
  type BillSortField,
  type ExpenseSortField,
  type ExpenseStatus,
  type LpoSortField,
  type LpoStatus,
  type ReminderStatus,
  type VendorBillStatus,
  type VendorSortField,
  type VendorStatus,
  type VendorType,
  type WorkOrderSortField,
  type WorkOrderStatus,
} from '../../constants/procurement.js'
import { rethrowDatabaseError } from '../../exceptions/mongooseError.js'
import {
  AccountingSourceEvent,
  ApPayment,
  ApPaymentAllocation,
  BorrowCostTerm,
  Expense,
  ExpenseCategory,
  Lpo,
  LpoLine,
  ProcurementCounter,
  ProcurementStatusEvent,
  ServiceReminder,
  Vendor,
  VendorBill,
  VendorBillLine,
  VendorContact,
  VendorDocument,
  WorkOrder,
  WorkOrderLine,
} from '../../models/procurement.model.js'
import { escapeRegex, toObjectId } from '../object-id.js'

type Lean = { _id: { toString(): string }; [key: string]: unknown }

function oid(value?: string) {
  return value ? toObjectId(value) : undefined
}
function sid(value: unknown): string {
  return value && typeof value === 'object' && 'toString' in value ? String(value) : String(value ?? '')
}

const PREFIX: Record<string, string> = {
  vendor: 'VEN',
  lpo: 'LPO',
  vendor_bill: 'VB',
  expense: 'EXP',
  work_order: 'WO',
  ap_payment: 'APP',
}

export async function allocateProcurementNumber(organizationId: string, name: keyof typeof PREFIX): Promise<string> {
  const orgId = toObjectId(organizationId)
  if (!orgId) throw new Error('organizationId is required')
  const counter = await ProcurementCounter.findOneAndUpdate(
    { organizationId: orgId, name },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  ).lean()
  return `${PREFIX[name]}-${String(counter?.seq ?? 1).padStart(6, '0')}`
}

export async function recordStatusEvent(input: {
  entityType: string
  entityId: string
  organizationId: string
  branchId?: string
  fromStatus?: string
  toStatus: string
  reason?: string
  actorUserId: string
}) {
  await ProcurementStatusEvent.create({
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

export async function listStatusEvents(entityType: string, entityId: string) {
  const id = toObjectId(entityId)
  if (!id) return []
  return ProcurementStatusEvent.find({ entityType, entityId: id }).sort({ createdAt: 1 }).lean()
}

/** Idempotent accounting source event for Module 12 consumption. Duplicate keys are ignored. */
export async function emitAccountingSourceEvent(input: {
  organizationId: string
  eventType: string
  entityType: string
  entityId: string
  idempotencyKey: string
  payload: Record<string, unknown>
}) {
  try {
    await AccountingSourceEvent.create({
      organizationId: oid(input.organizationId),
      eventType: input.eventType,
      entityType: input.entityType,
      entityId: oid(input.entityId),
      idempotencyKey: input.idempotencyKey,
      payload: input.payload,
    })
    return { duplicate: false }
  } catch {
    return { duplicate: true }
  }
}

export function toVendor(doc: Lean) {
  return {
    id: doc._id.toString(),
    organizationId: sid(doc.organizationId),
    legalEntityId: sid(doc.legalEntityId),
    branchId: sid(doc.branchId),
    vendorCode: String(doc.vendorCode),
    name: String(doc.name),
    vendorType: doc.vendorType as VendorType,
    partyKind: String(doc.partyKind),
    status: doc.status as VendorStatus,
    phone: doc.phone ? String(doc.phone) : undefined,
    email: doc.email ? String(doc.email) : undefined,
    addressLine1: doc.addressLine1 ? String(doc.addressLine1) : undefined,
    city: doc.city ? String(doc.city) : undefined,
    country: doc.country ? String(doc.country) : undefined,
    taxRegistration: doc.taxRegistration ? String(doc.taxRegistration) : undefined,
    paymentTerms: String(doc.paymentTerms),
    customPaymentDays: doc.customPaymentDays != null ? Number(doc.customPaymentDays) : undefined,
    bankName: doc.bankName ? String(doc.bankName) : undefined,
    bankAccountMasked: doc.bankAccountMasked ? String(doc.bankAccountMasked) : undefined,
    notes: doc.notes ? String(doc.notes) : undefined,
    createdBy: sid(doc.createdBy),
    createdAt: doc.createdAt as Date,
    updatedAt: doc.updatedAt as Date,
  }
}

export type VendorRecord = ReturnType<typeof toVendor>

export async function insertVendor(input: Omit<VendorRecord, 'id' | 'createdAt' | 'updatedAt'>) {
  try {
    const doc = await Vendor.create({
      ...input,
      organizationId: oid(input.organizationId),
      legalEntityId: oid(input.legalEntityId),
      branchId: oid(input.branchId),
      createdBy: oid(input.createdBy),
    })
    return toVendor(doc.toObject() as Lean)
  } catch (error) {
    rethrowDatabaseError(error, 'The vendor could not be saved.')
  }
}

export async function findVendorById(id: string): Promise<VendorRecord | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const doc = await Vendor.findById(objectId).lean()
  return doc ? toVendor(doc as Lean) : null
}

export async function updateVendor(id: string, patch: Record<string, unknown>): Promise<VendorRecord | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const doc = await Vendor.findByIdAndUpdate(objectId, { $set: patch }, { returnDocument: 'after' }).lean()
  return doc ? toVendor(doc as Lean) : null
}

export async function listVendors(input: {
  organizationId: string
  branchIds?: string[]
  legalEntityIds?: string[]
  skip: number
  take: number
  search?: string
  status?: VendorStatus
  vendorType?: VendorType
  branchId?: string
  legalEntityId?: string
  sort: VendorSortField
  order?: 'asc' | 'desc'
}) {
  const organizationId = toObjectId(input.organizationId)
  if (!organizationId) return { items: [], total: 0 }
  const filter: FilterQuery<unknown> = { organizationId }
  if (input.branchIds) filter.branchId = { $in: input.branchIds.map((id) => toObjectId(id)).filter(Boolean) }
  if (input.legalEntityIds) {
    filter.legalEntityId = { $in: input.legalEntityIds.map((id) => toObjectId(id)).filter(Boolean) }
  }
  if (input.branchId) filter.branchId = oid(input.branchId)
  if (input.legalEntityId) filter.legalEntityId = oid(input.legalEntityId)
  if (input.status) filter.status = input.status
  if (input.vendorType) filter.vendorType = input.vendorType
  if (input.search) {
    const pattern = { $regex: escapeRegex(input.search), $options: 'i' }
    filter.$or = [{ name: pattern }, { vendorCode: pattern }, { email: pattern }, { phone: pattern }]
  }
  const sort: Record<string, SortOrder> = { [input.sort]: input.order === 'asc' ? 1 : -1 }
  const [items, total] = await Promise.all([
    Vendor.find(filter).sort(sort).skip(input.skip).limit(input.take).lean(),
    Vendor.countDocuments(filter),
  ])
  return { items: items.map((doc) => toVendor(doc as Lean)), total }
}

export async function replaceVendorContacts(
  vendorId: string,
  organizationId: string,
  contacts: Array<{ role: string; name: string; phone?: string; email?: string; isPrimary?: boolean }>,
) {
  const vId = toObjectId(vendorId)
  const orgId = toObjectId(organizationId)
  if (!vId || !orgId) return []
  await VendorContact.deleteMany({ vendorId: vId })
  if (!contacts.length) return []
  return VendorContact.insertMany(contacts.map((c) => ({ ...c, vendorId: vId, organizationId: orgId })))
}

export async function listVendorContacts(vendorId: string) {
  const id = toObjectId(vendorId)
  if (!id) return []
  return VendorContact.find({ vendorId: id }).lean()
}

export async function insertVendorDocument(input: {
  vendorId: string
  organizationId: string
  documentType: string
  fileName: string
  storageKey: string
  mimeType?: string
  expiresAt?: Date
  notes?: string
  createdBy: string
}) {
  const doc = await VendorDocument.create({
    ...input,
    vendorId: oid(input.vendorId),
    organizationId: oid(input.organizationId),
    createdBy: oid(input.createdBy),
  })
  return doc
}

export async function listVendorDocuments(vendorId: string) {
  const id = toObjectId(vendorId)
  if (!id) return []
  return VendorDocument.find({ vendorId: id, archivedAt: { $exists: false } }).sort({ createdAt: -1 }).lean()
}

function toLpo(doc: Lean) {
  return {
    id: doc._id.toString(),
    organizationId: sid(doc.organizationId),
    legalEntityId: sid(doc.legalEntityId),
    branchId: sid(doc.branchId),
    documentNumber: doc.documentNumber ? String(doc.documentNumber) : undefined,
    vendorId: sid(doc.vendorId),
    vendorName: String(doc.vendorName),
    orderDate: doc.orderDate as Date,
    expectedAt: doc.expectedAt as Date | undefined,
    currency: String(doc.currency),
    paymentTerms: String(doc.paymentTerms),
    status: doc.status as LpoStatus,
    subtotal: String(doc.subtotal),
    discountTotal: String(doc.discountTotal),
    taxableAmount: String(doc.taxableAmount),
    taxAmount: String(doc.taxAmount),
    totalAmount: String(doc.totalAmount),
    approvalLevel: doc.approvalLevel ? String(doc.approvalLevel) : undefined,
    notes: doc.notes ? String(doc.notes) : undefined,
    workOrderId: doc.workOrderId ? sid(doc.workOrderId) : undefined,
    createdBy: sid(doc.createdBy),
    submittedBy: doc.submittedBy ? sid(doc.submittedBy) : undefined,
    submittedAt: doc.submittedAt as Date | undefined,
    approvedBy: doc.approvedBy ? sid(doc.approvedBy) : undefined,
    approvedAt: doc.approvedAt as Date | undefined,
    createdAt: doc.createdAt as Date,
    updatedAt: doc.updatedAt as Date,
  }
}
export type LpoRecord = ReturnType<typeof toLpo>

export async function insertLpo(input: Omit<LpoRecord, 'id' | 'createdAt' | 'updatedAt' | 'documentNumber'> & { documentNumber?: string }) {
  try {
    const doc = await Lpo.create({
      ...input,
      organizationId: oid(input.organizationId),
      legalEntityId: oid(input.legalEntityId),
      branchId: oid(input.branchId),
      vendorId: oid(input.vendorId),
      workOrderId: oid(input.workOrderId),
      createdBy: oid(input.createdBy),
    })
    return toLpo(doc.toObject() as Lean)
  } catch (error) {
    rethrowDatabaseError(error, 'The LPO could not be saved.')
  }
}

export async function findLpoById(id: string): Promise<LpoRecord | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const doc = await Lpo.findById(objectId).lean()
  return doc ? toLpo(doc as Lean) : null
}

export async function replaceLpoLines(
  lpoId: string,
  organizationId: string,
  lines: Array<Record<string, unknown>>,
) {
  const id = toObjectId(lpoId)
  const orgId = toObjectId(organizationId)
  if (!id || !orgId) return []
  await LpoLine.deleteMany({ lpoId: id })
  if (!lines.length) return []
  return LpoLine.insertMany(lines.map((line) => ({ ...line, lpoId: id, organizationId: orgId, billedQuantity: 0 })))
}

export async function listLpoLines(lpoId: string) {
  const id = toObjectId(lpoId)
  if (!id) return []
  return LpoLine.find({ lpoId: id }).sort({ sortOrder: 1 }).lean()
}

export async function transitionLpo(
  id: string,
  from: LpoStatus,
  to: LpoStatus,
  meta: Record<string, unknown>,
): Promise<LpoRecord | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const doc = await Lpo.findOneAndUpdate({ _id: objectId, status: from }, { $set: { status: to, ...meta } }, { returnDocument: 'after' }).lean()
  return doc ? toLpo(doc as Lean) : null
}

export async function updateLpoDraft(id: string, patch: Record<string, unknown>): Promise<LpoRecord | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const doc = await Lpo.findOneAndUpdate({ _id: objectId, status: 'DRAFT' }, { $set: patch }, { returnDocument: 'after' }).lean()
  return doc ? toLpo(doc as Lean) : null
}

export async function listLpos(input: {
  organizationId: string
  branchIds?: string[]
  legalEntityIds?: string[]
  skip: number
  take: number
  search?: string
  status?: LpoStatus
  vendorId?: string
  branchId?: string
  orderFrom?: Date
  orderTo?: Date
  sort: LpoSortField
  order?: 'asc' | 'desc'
}) {
  const organizationId = toObjectId(input.organizationId)
  if (!organizationId) return { items: [], total: 0 }
  const filter: FilterQuery<unknown> = { organizationId }
  if (input.branchIds) filter.branchId = { $in: input.branchIds.map((id) => toObjectId(id)).filter(Boolean) }
  if (input.legalEntityIds) {
    filter.legalEntityId = { $in: input.legalEntityIds.map((id) => toObjectId(id)).filter(Boolean) }
  }
  if (input.branchId) filter.branchId = oid(input.branchId)
  if (input.vendorId) filter.vendorId = oid(input.vendorId)
  if (input.status) filter.status = input.status
  if (input.orderFrom || input.orderTo) {
    filter.orderDate = {
      ...(input.orderFrom ? { $gte: input.orderFrom } : {}),
      ...(input.orderTo ? { $lt: input.orderTo } : {}),
    }
  }
  if (input.search) {
    const pattern = { $regex: escapeRegex(input.search), $options: 'i' }
    filter.$or = [{ documentNumber: pattern }, { vendorName: pattern }]
  }
  const sort: Record<string, SortOrder> = { [input.sort]: input.order === 'asc' ? 1 : -1 }
  const [items, total] = await Promise.all([
    Lpo.find(filter).sort(sort).skip(input.skip).limit(input.take).lean(),
    Lpo.countDocuments(filter),
  ])
  return { items: items.map((doc) => toLpo(doc as Lean)), total }
}

export async function incrementLpoLineBilled(lpoLineId: string, quantity: number) {
  const id = toObjectId(lpoLineId)
  if (!id) return null
  return LpoLine.findByIdAndUpdate(id, { $inc: { billedQuantity: quantity } }, { returnDocument: 'after' }).lean()
}

function toBill(doc: Lean) {
  return {
    id: doc._id.toString(),
    organizationId: sid(doc.organizationId),
    legalEntityId: sid(doc.legalEntityId),
    branchId: sid(doc.branchId),
    documentNumber: doc.documentNumber ? String(doc.documentNumber) : undefined,
    vendorId: sid(doc.vendorId),
    vendorName: String(doc.vendorName),
    vendorInvoiceNumber: String(doc.vendorInvoiceNumber),
    lpoId: doc.lpoId ? sid(doc.lpoId) : undefined,
    workOrderId: doc.workOrderId ? sid(doc.workOrderId) : undefined,
    currency: String(doc.currency),
    billDate: doc.billDate as Date,
    dueDate: doc.dueDate as Date,
    status: doc.status as VendorBillStatus,
    matchResult: doc.matchResult ? String(doc.matchResult) : undefined,
    subtotal: String(doc.subtotal),
    discountTotal: String(doc.discountTotal),
    taxableAmount: String(doc.taxableAmount),
    taxAmount: String(doc.taxAmount),
    totalAmount: String(doc.totalAmount),
    paidAmount: String(doc.paidAmount ?? '0.00'),
    outstandingAmount: String(doc.outstandingAmount),
    paymentStatus: String(doc.paymentStatus),
    notes: doc.notes ? String(doc.notes) : undefined,
    createdBy: sid(doc.createdBy),
    approvedBy: doc.approvedBy ? sid(doc.approvedBy) : undefined,
    approvedAt: doc.approvedAt as Date | undefined,
    postedBy: doc.postedBy ? sid(doc.postedBy) : undefined,
    postedAt: doc.postedAt as Date | undefined,
    createdAt: doc.createdAt as Date,
    updatedAt: doc.updatedAt as Date,
  }
}
export type VendorBillRecord = ReturnType<typeof toBill>

export async function insertVendorBill(input: Omit<VendorBillRecord, 'id' | 'createdAt' | 'updatedAt' | 'documentNumber'> & { documentNumber?: string }) {
  try {
    const doc = await VendorBill.create({
      ...input,
      organizationId: oid(input.organizationId),
      legalEntityId: oid(input.legalEntityId),
      branchId: oid(input.branchId),
      vendorId: oid(input.vendorId),
      lpoId: oid(input.lpoId),
      workOrderId: oid(input.workOrderId),
      createdBy: oid(input.createdBy),
    })
    return toBill(doc.toObject() as Lean)
  } catch (error) {
    rethrowDatabaseError(error, 'The vendor bill could not be saved. A duplicate vendor invoice may exist.')
  }
}

export async function findVendorBillById(id: string): Promise<VendorBillRecord | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const doc = await VendorBill.findById(objectId).lean()
  return doc ? toBill(doc as Lean) : null
}

export async function replaceVendorBillLines(billId: string, organizationId: string, lines: Array<Record<string, unknown>>) {
  const id = toObjectId(billId)
  const orgId = toObjectId(organizationId)
  if (!id || !orgId) return []
  await VendorBillLine.deleteMany({ vendorBillId: id })
  if (!lines.length) return []
  return VendorBillLine.insertMany(lines.map((line) => ({ ...line, vendorBillId: id, organizationId: orgId })))
}

export async function listVendorBillLines(billId: string) {
  const id = toObjectId(billId)
  if (!id) return []
  return VendorBillLine.find({ vendorBillId: id }).sort({ sortOrder: 1 }).lean()
}

export async function transitionVendorBill(
  id: string,
  from: VendorBillStatus,
  to: VendorBillStatus,
  meta: Record<string, unknown>,
): Promise<VendorBillRecord | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const doc = await VendorBill.findOneAndUpdate(
    { _id: objectId, status: from },
    { $set: { status: to, ...meta } },
    { returnDocument: 'after' },
  ).lean()
  return doc ? toBill(doc as Lean) : null
}

export async function updateVendorBillPaid(id: string, paidAmount: string, outstandingAmount: string, paymentStatus: string) {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const doc = await VendorBill.findByIdAndUpdate(
    objectId,
    { $set: { paidAmount, outstandingAmount, paymentStatus } },
    { returnDocument: 'after' },
  ).lean()
  return doc ? toBill(doc as Lean) : null
}

export async function listVendorBills(input: {
  organizationId: string
  branchIds?: string[]
  legalEntityIds?: string[]
  skip: number
  take: number
  search?: string
  status?: VendorBillStatus
  vendorId?: string
  lpoId?: string
  branchId?: string
  paymentStatus?: string
  billFrom?: Date
  billTo?: Date
  sort: BillSortField
  order?: 'asc' | 'desc'
}) {
  const organizationId = toObjectId(input.organizationId)
  if (!organizationId) return { items: [], total: 0 }
  const filter: FilterQuery<unknown> = { organizationId }
  if (input.branchIds) filter.branchId = { $in: input.branchIds.map((id) => toObjectId(id)).filter(Boolean) }
  if (input.legalEntityIds) {
    filter.legalEntityId = { $in: input.legalEntityIds.map((id) => toObjectId(id)).filter(Boolean) }
  }
  if (input.branchId) filter.branchId = oid(input.branchId)
  if (input.vendorId) filter.vendorId = oid(input.vendorId)
  if (input.lpoId) filter.lpoId = oid(input.lpoId)
  if (input.status) filter.status = input.status
  if (input.paymentStatus) filter.paymentStatus = input.paymentStatus
  if (input.billFrom || input.billTo) {
    filter.billDate = {
      ...(input.billFrom ? { $gte: input.billFrom } : {}),
      ...(input.billTo ? { $lt: input.billTo } : {}),
    }
  }
  if (input.search) {
    const pattern = { $regex: escapeRegex(input.search), $options: 'i' }
    filter.$or = [{ documentNumber: pattern }, { vendorInvoiceNumber: pattern }, { vendorName: pattern }]
  }
  const sort: Record<string, SortOrder> = { [input.sort]: input.order === 'asc' ? 1 : -1 }
  const [items, total] = await Promise.all([
    VendorBill.find(filter).sort(sort).skip(input.skip).limit(input.take).lean(),
    VendorBill.countDocuments(filter),
  ])
  return { items: items.map((doc) => toBill(doc as Lean)), total }
}

export async function ensureDefaultExpenseCategories(organizationId: string) {
  const orgId = toObjectId(organizationId)
  if (!orgId) return
  for (const code of DEFAULT_EXPENSE_CATEGORIES) {
    await ExpenseCategory.updateOne(
      { organizationId: orgId, code },
      { $setOnInsert: { name: code.replaceAll('_', ' '), active: true } },
      { upsert: true },
    )
  }
}

export async function listExpenseCategories(organizationId: string) {
  const orgId = toObjectId(organizationId)
  if (!orgId) return []
  return ExpenseCategory.find({ organizationId: orgId, active: true }).sort({ code: 1 }).lean()
}

function toExpense(doc: Lean) {
  return {
    id: doc._id.toString(),
    organizationId: sid(doc.organizationId),
    legalEntityId: sid(doc.legalEntityId),
    branchId: sid(doc.branchId),
    documentNumber: doc.documentNumber ? String(doc.documentNumber) : undefined,
    categoryCode: String(doc.categoryCode),
    vendorId: doc.vendorId ? sid(doc.vendorId) : undefined,
    vendorName: doc.vendorName ? String(doc.vendorName) : undefined,
    vehicleId: doc.vehicleId ? sid(doc.vehicleId) : undefined,
    vehiclePlate: doc.vehiclePlate ? String(doc.vehiclePlate) : undefined,
    contractId: doc.contractId ? sid(doc.contractId) : undefined,
    employeeUserId: doc.employeeUserId ? sid(doc.employeeUserId) : undefined,
    currency: String(doc.currency),
    expenseDate: doc.expenseDate as Date,
    description: String(doc.description),
    status: doc.status as ExpenseStatus,
    amount: String(doc.amount),
    taxRatePercent: String(doc.taxRatePercent ?? '0.00'),
    taxAmount: String(doc.taxAmount),
    totalAmount: String(doc.totalAmount),
    notes: doc.notes ? String(doc.notes) : undefined,
    attachmentKey: doc.attachmentKey ? String(doc.attachmentKey) : undefined,
    createdBy: sid(doc.createdBy),
    submittedBy: doc.submittedBy ? sid(doc.submittedBy) : undefined,
    submittedAt: doc.submittedAt as Date | undefined,
    approvedBy: doc.approvedBy ? sid(doc.approvedBy) : undefined,
    approvedAt: doc.approvedAt as Date | undefined,
    postedBy: doc.postedBy ? sid(doc.postedBy) : undefined,
    postedAt: doc.postedAt as Date | undefined,
    createdAt: doc.createdAt as Date,
    updatedAt: doc.updatedAt as Date,
  }
}
export type ExpenseRecord = ReturnType<typeof toExpense>

export async function insertExpense(input: Omit<ExpenseRecord, 'id' | 'createdAt' | 'updatedAt' | 'documentNumber'> & { documentNumber?: string }) {
  try {
    const doc = await Expense.create({
      ...input,
      organizationId: oid(input.organizationId),
      legalEntityId: oid(input.legalEntityId),
      branchId: oid(input.branchId),
      vendorId: oid(input.vendorId),
      vehicleId: oid(input.vehicleId),
      contractId: oid(input.contractId),
      employeeUserId: oid(input.employeeUserId),
      createdBy: oid(input.createdBy),
    })
    return toExpense(doc.toObject() as Lean)
  } catch (error) {
    rethrowDatabaseError(error, 'The expense could not be saved.')
  }
}

export async function findExpenseById(id: string): Promise<ExpenseRecord | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const doc = await Expense.findById(objectId).lean()
  return doc ? toExpense(doc as Lean) : null
}

export async function transitionExpense(
  id: string,
  from: ExpenseStatus,
  to: ExpenseStatus,
  meta: Record<string, unknown>,
): Promise<ExpenseRecord | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const doc = await Expense.findOneAndUpdate(
    { _id: objectId, status: from },
    { $set: { status: to, ...meta } },
    { returnDocument: 'after' },
  ).lean()
  return doc ? toExpense(doc as Lean) : null
}

export async function updateExpenseDraft(id: string, patch: Record<string, unknown>): Promise<ExpenseRecord | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const doc = await Expense.findOneAndUpdate({ _id: objectId, status: 'DRAFT' }, { $set: patch }, { returnDocument: 'after' }).lean()
  return doc ? toExpense(doc as Lean) : null
}

export async function listExpenses(input: {
  organizationId: string
  branchIds?: string[]
  legalEntityIds?: string[]
  skip: number
  take: number
  search?: string
  status?: ExpenseStatus
  categoryCode?: string
  vendorId?: string
  vehicleId?: string
  contractId?: string
  branchId?: string
  expenseFrom?: Date
  expenseTo?: Date
  sort: ExpenseSortField
  order?: 'asc' | 'desc'
}) {
  const organizationId = toObjectId(input.organizationId)
  if (!organizationId) return { items: [], total: 0 }
  const filter: FilterQuery<unknown> = { organizationId }
  if (input.branchIds) filter.branchId = { $in: input.branchIds.map((id) => toObjectId(id)).filter(Boolean) }
  if (input.legalEntityIds) {
    filter.legalEntityId = { $in: input.legalEntityIds.map((id) => toObjectId(id)).filter(Boolean) }
  }
  if (input.branchId) filter.branchId = oid(input.branchId)
  if (input.status) filter.status = input.status
  if (input.categoryCode) filter.categoryCode = input.categoryCode
  if (input.vendorId) filter.vendorId = oid(input.vendorId)
  if (input.vehicleId) filter.vehicleId = oid(input.vehicleId)
  if (input.contractId) filter.contractId = oid(input.contractId)
  if (input.expenseFrom || input.expenseTo) {
    filter.expenseDate = {
      ...(input.expenseFrom ? { $gte: input.expenseFrom } : {}),
      ...(input.expenseTo ? { $lt: input.expenseTo } : {}),
    }
  }
  if (input.search) {
    const pattern = { $regex: escapeRegex(input.search), $options: 'i' }
    filter.$or = [{ documentNumber: pattern }, { description: pattern }, { vendorName: pattern }, { vehiclePlate: pattern }]
  }
  const sort: Record<string, SortOrder> = { [input.sort]: input.order === 'asc' ? 1 : -1 }
  const [items, total] = await Promise.all([
    Expense.find(filter).sort(sort).skip(input.skip).limit(input.take).lean(),
    Expense.countDocuments(filter),
  ])
  return { items: items.map((doc) => toExpense(doc as Lean)), total }
}

function toWorkOrder(doc: Lean) {
  return {
    id: doc._id.toString(),
    organizationId: sid(doc.organizationId),
    legalEntityId: sid(doc.legalEntityId),
    branchId: sid(doc.branchId),
    documentNumber: doc.documentNumber ? String(doc.documentNumber) : undefined,
    vehicleId: sid(doc.vehicleId),
    vehiclePlate: String(doc.vehiclePlate),
    vendorId: doc.vendorId ? sid(doc.vendorId) : undefined,
    vendorName: doc.vendorName ? String(doc.vendorName) : undefined,
    lpoId: doc.lpoId ? sid(doc.lpoId) : undefined,
    serviceType: String(doc.serviceType),
    priority: String(doc.priority),
    status: doc.status as WorkOrderStatus,
    description: String(doc.description),
    issue: doc.issue ? String(doc.issue) : undefined,
    requestedAt: doc.requestedAt as Date | undefined,
    scheduledAt: doc.scheduledAt as Date | undefined,
    startedAt: doc.startedAt as Date | undefined,
    completedAt: doc.completedAt as Date | undefined,
    downtimeStartsAt: doc.downtimeStartsAt as Date | undefined,
    downtimeEndsAt: doc.downtimeEndsAt as Date | undefined,
    assignmentId: doc.assignmentId ? sid(doc.assignmentId) : undefined,
    estimatedCost: String(doc.estimatedCost ?? '0.00'),
    actualCost: doc.actualCost ? String(doc.actualCost) : undefined,
    currency: String(doc.currency),
    notes: doc.notes ? String(doc.notes) : undefined,
    assignedUserId: doc.assignedUserId ? sid(doc.assignedUserId) : undefined,
    createdBy: sid(doc.createdBy),
    approvedBy: doc.approvedBy ? sid(doc.approvedBy) : undefined,
    approvedAt: doc.approvedAt as Date | undefined,
    createdAt: doc.createdAt as Date,
    updatedAt: doc.updatedAt as Date,
  }
}
export type WorkOrderRecord = ReturnType<typeof toWorkOrder>

export async function insertWorkOrder(input: Omit<WorkOrderRecord, 'id' | 'createdAt' | 'updatedAt' | 'documentNumber'> & { documentNumber?: string }) {
  try {
    const doc = await WorkOrder.create({
      ...input,
      organizationId: oid(input.organizationId),
      legalEntityId: oid(input.legalEntityId),
      branchId: oid(input.branchId),
      vehicleId: oid(input.vehicleId),
      vendorId: oid(input.vendorId),
      lpoId: oid(input.lpoId),
      assignmentId: oid(input.assignmentId),
      assignedUserId: oid(input.assignedUserId),
      createdBy: oid(input.createdBy),
    })
    return toWorkOrder(doc.toObject() as Lean)
  } catch (error) {
    rethrowDatabaseError(error, 'The work order could not be saved.')
  }
}

export async function findWorkOrderById(id: string): Promise<WorkOrderRecord | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const doc = await WorkOrder.findById(objectId).lean()
  return doc ? toWorkOrder(doc as Lean) : null
}

export async function replaceWorkOrderLines(workOrderId: string, organizationId: string, lines: Array<Record<string, unknown>>) {
  const id = toObjectId(workOrderId)
  const orgId = toObjectId(organizationId)
  if (!id || !orgId) return []
  await WorkOrderLine.deleteMany({ workOrderId: id })
  if (!lines.length) return []
  return WorkOrderLine.insertMany(lines.map((line) => ({ ...line, workOrderId: id, organizationId: orgId })))
}

export async function listWorkOrderLines(workOrderId: string) {
  const id = toObjectId(workOrderId)
  if (!id) return []
  return WorkOrderLine.find({ workOrderId: id }).sort({ sortOrder: 1 }).lean()
}

export async function transitionWorkOrder(
  id: string,
  from: WorkOrderStatus,
  to: WorkOrderStatus,
  meta: Record<string, unknown>,
): Promise<WorkOrderRecord | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const doc = await WorkOrder.findOneAndUpdate(
    { _id: objectId, status: from },
    { $set: { status: to, ...meta } },
    { returnDocument: 'after' },
  ).lean()
  return doc ? toWorkOrder(doc as Lean) : null
}

export async function updateWorkOrder(id: string, patch: Record<string, unknown>): Promise<WorkOrderRecord | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const doc = await WorkOrder.findByIdAndUpdate(objectId, { $set: patch }, { returnDocument: 'after' }).lean()
  return doc ? toWorkOrder(doc as Lean) : null
}

export async function listWorkOrders(input: {
  organizationId: string
  branchIds?: string[]
  legalEntityIds?: string[]
  skip: number
  take: number
  search?: string
  status?: WorkOrderStatus
  priority?: string
  serviceType?: string
  vendorId?: string
  vehicleId?: string
  branchId?: string
  sort: WorkOrderSortField
  order?: 'asc' | 'desc'
}) {
  const organizationId = toObjectId(input.organizationId)
  if (!organizationId) return { items: [], total: 0 }
  const filter: FilterQuery<unknown> = { organizationId }
  if (input.branchIds) filter.branchId = { $in: input.branchIds.map((id) => toObjectId(id)).filter(Boolean) }
  if (input.legalEntityIds) {
    filter.legalEntityId = { $in: input.legalEntityIds.map((id) => toObjectId(id)).filter(Boolean) }
  }
  if (input.branchId) filter.branchId = oid(input.branchId)
  if (input.status) filter.status = input.status
  if (input.priority) filter.priority = input.priority
  if (input.serviceType) filter.serviceType = input.serviceType
  if (input.vendorId) filter.vendorId = oid(input.vendorId)
  if (input.vehicleId) filter.vehicleId = oid(input.vehicleId)
  if (input.search) {
    const pattern = { $regex: escapeRegex(input.search), $options: 'i' }
    filter.$or = [{ documentNumber: pattern }, { vehiclePlate: pattern }, { description: pattern }, { vendorName: pattern }]
  }
  const sort: Record<string, SortOrder> = { [input.sort]: input.order === 'asc' ? 1 : -1 }
  const [items, total] = await Promise.all([
    WorkOrder.find(filter).sort(sort).skip(input.skip).limit(input.take).lean(),
    WorkOrder.countDocuments(filter),
  ])
  return { items: items.map((doc) => toWorkOrder(doc as Lean)), total }
}

export async function insertServiceReminder(input: Record<string, unknown>) {
  const doc = await ServiceReminder.create({
    ...input,
    organizationId: oid(String(input.organizationId)),
    legalEntityId: oid(String(input.legalEntityId)),
    branchId: oid(String(input.branchId)),
    vehicleId: oid(String(input.vehicleId)),
    workOrderId: input.workOrderId ? oid(String(input.workOrderId)) : undefined,
    createdBy: oid(String(input.createdBy)),
  })
  return doc
}

export async function findServiceReminderById(id: string) {
  const objectId = toObjectId(id)
  if (!objectId) return null
  return ServiceReminder.findById(objectId).lean()
}

export async function updateServiceReminder(id: string, patch: Record<string, unknown>) {
  const objectId = toObjectId(id)
  if (!objectId) return null
  return ServiceReminder.findByIdAndUpdate(objectId, { $set: patch }, { returnDocument: 'after' }).lean()
}

export async function listServiceReminders(input: {
  organizationId: string
  branchIds?: string[]
  skip: number
  take: number
  status?: ReminderStatus
  vehicleId?: string
  branchId?: string
}) {
  const organizationId = toObjectId(input.organizationId)
  if (!organizationId) return { items: [], total: 0 }
  const filter: FilterQuery<unknown> = { organizationId }
  if (input.branchIds) filter.branchId = { $in: input.branchIds.map((id) => toObjectId(id)).filter(Boolean) }
  if (input.branchId) filter.branchId = oid(input.branchId)
  if (input.status) filter.status = input.status
  if (input.vehicleId) filter.vehicleId = oid(input.vehicleId)
  const [items, total] = await Promise.all([
    ServiceReminder.find(filter).sort({ dueAt: 1 }).skip(input.skip).limit(input.take).lean(),
    ServiceReminder.countDocuments(filter),
  ])
  return { items, total }
}

export async function insertBorrowCostTerm(input: Record<string, unknown>) {
  return BorrowCostTerm.create({
    ...input,
    organizationId: oid(String(input.organizationId)),
    vendorId: oid(String(input.vendorId)),
    vehicleId: oid(String(input.vehicleId)),
    createdBy: oid(String(input.createdBy)),
  })
}

export async function listBorrowCostTerms(organizationId: string, vehicleId: string) {
  const orgId = toObjectId(organizationId)
  const vId = toObjectId(vehicleId)
  if (!orgId || !vId) return []
  return BorrowCostTerm.find({ organizationId: orgId, vehicleId: vId }).sort({ effectiveFrom: -1 }).lean()
}

export async function insertApPayment(input: Record<string, unknown>) {
  try {
    const doc = await ApPayment.create({
      ...input,
      organizationId: oid(String(input.organizationId)),
      legalEntityId: oid(String(input.legalEntityId)),
      branchId: oid(String(input.branchId)),
      vendorId: oid(String(input.vendorId)),
      createdBy: oid(String(input.createdBy)),
    })
    return doc
  } catch (error) {
    rethrowDatabaseError(error, 'The AP payment could not be saved.')
  }
}

export async function findApPaymentById(id: string) {
  const objectId = toObjectId(id)
  if (!objectId) return null
  return ApPayment.findById(objectId).lean()
}

export async function insertApAllocation(input: {
  apPaymentId: string
  vendorBillId: string
  organizationId: string
  amount: string
  createdBy: string
}) {
  try {
    return await ApPaymentAllocation.create({
      apPaymentId: oid(input.apPaymentId),
      vendorBillId: oid(input.vendorBillId),
      organizationId: oid(input.organizationId),
      amount: input.amount,
      createdBy: oid(input.createdBy),
    })
  } catch (error) {
    rethrowDatabaseError(error, 'AP allocation could not be saved.')
  }
}

export async function updateApPaymentTotals(id: string, allocatedAmount: string, unallocatedAmount: string, status?: string) {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const set: Record<string, unknown> = { allocatedAmount, unallocatedAmount }
  if (status) set.status = status
  return ApPayment.findByIdAndUpdate(objectId, { $set: set }, { returnDocument: 'after' }).lean()
}
