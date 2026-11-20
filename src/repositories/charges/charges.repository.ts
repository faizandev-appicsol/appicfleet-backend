import type { FilterQuery, SortOrder } from 'mongoose'
import {
  type FineSortField,
  type FineStatus,
  type ImportBatchStatus,
  type RefundSortField,
  type RefundStatus,
  type TollSortField,
  type TollStatus,
} from '../../constants/charges.js'
import { rethrowDatabaseError } from '../../exceptions/mongooseError.js'
import {
  ChargeCounter,
  ChargeDispute,
  ChargeRecovery,
  ChargeStatusEvent,
  Fine,
  FineTollImportBatch,
  FineTollImportRow,
  Refund,
  Toll,
} from '../../models/charges.model.js'
import { escapeRegex, toObjectId } from '../object-id.js'

type Lean = { _id: { toString(): string }; [key: string]: unknown }

function oid(value?: string) {
  return value ? toObjectId(value) : undefined
}
function sid(value: unknown): string {
  return value && typeof value === 'object' && 'toString' in value ? String(value) : String(value ?? '')
}

const PREFIX: Record<string, string> = {
  fine: 'FN',
  toll: 'TL',
  refund: 'RF',
  import: 'IMP',
  recovery: 'RCV',
}

export async function allocateChargeNumber(organizationId: string, name: keyof typeof PREFIX): Promise<string> {
  const orgId = toObjectId(organizationId)
  if (!orgId) throw new Error('organizationId is required')
  const counter = await ChargeCounter.findOneAndUpdate(
    { organizationId: orgId, name },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  ).lean()
  return `${PREFIX[name]}-${String(counter?.seq ?? 1).padStart(6, '0')}`
}

export async function recordChargeStatusEvent(input: {
  entityType: string
  entityId: string
  organizationId: string
  branchId?: string
  fromStatus?: string
  toStatus: string
  reason?: string
  actorUserId: string
}) {
  await ChargeStatusEvent.create({
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

export async function listChargeStatusEvents(entityType: string, entityId: string) {
  const id = toObjectId(entityId)
  if (!id) return []
  return ChargeStatusEvent.find({ entityType, entityId: id }).sort({ createdAt: 1 }).lean()
}

function toFine(doc: Lean) {
  return {
    id: doc._id.toString(),
    organizationId: sid(doc.organizationId),
    legalEntityId: sid(doc.legalEntityId),
    branchId: sid(doc.branchId),
    documentNumber: doc.documentNumber ? String(doc.documentNumber) : undefined,
    externalReference: String(doc.externalReference),
    provider: String(doc.provider),
    fineType: String(doc.fineType),
    source: String(doc.source),
    eventAt: doc.eventAt as Date,
    receivedAt: doc.receivedAt as Date,
    vehicleId: doc.vehicleId ? sid(doc.vehicleId) : undefined,
    vehiclePlate: doc.vehiclePlate ? String(doc.vehiclePlate) : undefined,
    assignmentId: doc.assignmentId ? sid(doc.assignmentId) : undefined,
    contractId: doc.contractId ? sid(doc.contractId) : undefined,
    customerId: doc.customerId ? sid(doc.customerId) : undefined,
    customerName: doc.customerName ? String(doc.customerName) : undefined,
    assignmentResolution: String(doc.assignmentResolution),
    reviewReason: doc.reviewReason ? String(doc.reviewReason) : undefined,
    currency: String(doc.currency),
    amount: String(doc.amount),
    description: doc.description ? String(doc.description) : undefined,
    location: doc.location ? String(doc.location) : undefined,
    authority: doc.authority ? String(doc.authority) : undefined,
    status: doc.status as FineStatus,
    importBatchId: doc.importBatchId ? sid(doc.importBatchId) : undefined,
    evidenceKey: doc.evidenceKey ? String(doc.evidenceKey) : undefined,
    recoveryId: doc.recoveryId ? sid(doc.recoveryId) : undefined,
    recoveryAmount: doc.recoveryAmount ? String(doc.recoveryAmount) : undefined,
    createdBy: sid(doc.createdBy),
    approvedAt: doc.approvedAt as Date | undefined,
    createdAt: doc.createdAt as Date,
    updatedAt: doc.updatedAt as Date,
  }
}
export type FineRecord = ReturnType<typeof toFine>

export async function insertFine(input: Omit<FineRecord, 'id' | 'createdAt' | 'updatedAt' | 'documentNumber'> & { documentNumber?: string }) {
  try {
    const doc = await Fine.create({
      ...input,
      organizationId: oid(input.organizationId),
      legalEntityId: oid(input.legalEntityId),
      branchId: oid(input.branchId),
      vehicleId: oid(input.vehicleId),
      assignmentId: oid(input.assignmentId),
      contractId: oid(input.contractId),
      customerId: oid(input.customerId),
      importBatchId: oid(input.importBatchId),
      recoveryId: oid(input.recoveryId),
      createdBy: oid(input.createdBy),
    })
    return toFine(doc.toObject() as Lean)
  } catch (error) {
    rethrowDatabaseError(error, 'The fine could not be saved. A duplicate external reference may exist.')
  }
}

export async function findFineById(id: string): Promise<FineRecord | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const doc = await Fine.findById(objectId).lean()
  return doc ? toFine(doc as Lean) : null
}

export async function findFineByExternal(organizationId: string, provider: string, externalReference: string) {
  const orgId = toObjectId(organizationId)
  if (!orgId) return null
  const doc = await Fine.findOne({ organizationId: orgId, provider, externalReference }).lean()
  return doc ? toFine(doc as Lean) : null
}

export async function transitionFine(id: string, from: FineStatus, to: FineStatus, meta: Record<string, unknown> = {}) {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const doc = await Fine.findOneAndUpdate({ _id: objectId, status: from }, { $set: { status: to, ...meta } }, { returnDocument: 'after' }).lean()
  return doc ? toFine(doc as Lean) : null
}

export async function updateFine(id: string, patch: Record<string, unknown>) {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const doc = await Fine.findByIdAndUpdate(objectId, { $set: patch }, { returnDocument: 'after' }).lean()
  return doc ? toFine(doc as Lean) : null
}

export async function listFines(input: {
  organizationId: string
  branchIds?: string[]
  legalEntityIds?: string[]
  skip: number
  take: number
  search?: string
  status?: FineStatus
  fineType?: string
  provider?: string
  vehicleId?: string
  customerId?: string
  contractId?: string
  branchId?: string
  eventFrom?: Date
  eventTo?: Date
  sort: FineSortField
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
  if (input.fineType) filter.fineType = input.fineType
  if (input.provider) filter.provider = input.provider
  if (input.vehicleId) filter.vehicleId = oid(input.vehicleId)
  if (input.customerId) filter.customerId = oid(input.customerId)
  if (input.contractId) filter.contractId = oid(input.contractId)
  if (input.eventFrom || input.eventTo) {
    filter.eventAt = {
      ...(input.eventFrom ? { $gte: input.eventFrom } : {}),
      ...(input.eventTo ? { $lt: input.eventTo } : {}),
    }
  }
  if (input.search) {
    const pattern = { $regex: escapeRegex(input.search), $options: 'i' }
    filter.$or = [
      { documentNumber: pattern },
      { externalReference: pattern },
      { vehiclePlate: pattern },
      { customerName: pattern },
    ]
  }
  const sort: Record<string, SortOrder> = { [input.sort]: input.order === 'asc' ? 1 : -1 }
  const [items, total] = await Promise.all([
    Fine.find(filter).sort(sort).skip(input.skip).limit(input.take).lean(),
    Fine.countDocuments(filter),
  ])
  return { items: items.map((doc) => toFine(doc as Lean)), total }
}

function toToll(doc: Lean) {
  return {
    id: doc._id.toString(),
    organizationId: sid(doc.organizationId),
    legalEntityId: sid(doc.legalEntityId),
    branchId: sid(doc.branchId),
    documentNumber: doc.documentNumber ? String(doc.documentNumber) : undefined,
    externalReference: String(doc.externalReference),
    provider: String(doc.provider),
    source: String(doc.source),
    eventAt: doc.eventAt as Date,
    receivedAt: doc.receivedAt as Date,
    vehicleId: doc.vehicleId ? sid(doc.vehicleId) : undefined,
    vehiclePlate: doc.vehiclePlate ? String(doc.vehiclePlate) : undefined,
    assignmentId: doc.assignmentId ? sid(doc.assignmentId) : undefined,
    contractId: doc.contractId ? sid(doc.contractId) : undefined,
    customerId: doc.customerId ? sid(doc.customerId) : undefined,
    customerName: doc.customerName ? String(doc.customerName) : undefined,
    assignmentResolution: String(doc.assignmentResolution),
    reviewReason: doc.reviewReason ? String(doc.reviewReason) : undefined,
    currency: String(doc.currency),
    amount: String(doc.amount),
    location: doc.location ? String(doc.location) : undefined,
    gate: doc.gate ? String(doc.gate) : undefined,
    description: doc.description ? String(doc.description) : undefined,
    status: doc.status as TollStatus,
    importBatchId: doc.importBatchId ? sid(doc.importBatchId) : undefined,
    recoveryId: doc.recoveryId ? sid(doc.recoveryId) : undefined,
    recoveryAmount: doc.recoveryAmount ? String(doc.recoveryAmount) : undefined,
    createdBy: sid(doc.createdBy),
    approvedAt: doc.approvedAt as Date | undefined,
    createdAt: doc.createdAt as Date,
    updatedAt: doc.updatedAt as Date,
  }
}
export type TollRecord = ReturnType<typeof toToll>

export async function insertToll(input: Omit<TollRecord, 'id' | 'createdAt' | 'updatedAt' | 'documentNumber'> & { documentNumber?: string }) {
  try {
    const doc = await Toll.create({
      ...input,
      organizationId: oid(input.organizationId),
      legalEntityId: oid(input.legalEntityId),
      branchId: oid(input.branchId),
      vehicleId: oid(input.vehicleId),
      assignmentId: oid(input.assignmentId),
      contractId: oid(input.contractId),
      customerId: oid(input.customerId),
      importBatchId: oid(input.importBatchId),
      recoveryId: oid(input.recoveryId),
      createdBy: oid(input.createdBy),
    })
    return toToll(doc.toObject() as Lean)
  } catch (error) {
    rethrowDatabaseError(error, 'The toll could not be saved. A duplicate external reference may exist.')
  }
}

export async function findTollById(id: string): Promise<TollRecord | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const doc = await Toll.findById(objectId).lean()
  return doc ? toToll(doc as Lean) : null
}

export async function findTollByExternal(organizationId: string, provider: string, externalReference: string) {
  const orgId = toObjectId(organizationId)
  if (!orgId) return null
  const doc = await Toll.findOne({ organizationId: orgId, provider, externalReference }).lean()
  return doc ? toToll(doc as Lean) : null
}

export async function transitionToll(id: string, from: TollStatus, to: TollStatus, meta: Record<string, unknown> = {}) {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const doc = await Toll.findOneAndUpdate({ _id: objectId, status: from }, { $set: { status: to, ...meta } }, { returnDocument: 'after' }).lean()
  return doc ? toToll(doc as Lean) : null
}

export async function updateToll(id: string, patch: Record<string, unknown>) {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const doc = await Toll.findByIdAndUpdate(objectId, { $set: patch }, { returnDocument: 'after' }).lean()
  return doc ? toToll(doc as Lean) : null
}

export async function listTolls(input: {
  organizationId: string
  branchIds?: string[]
  legalEntityIds?: string[]
  skip: number
  take: number
  search?: string
  status?: TollStatus
  provider?: string
  vehicleId?: string
  customerId?: string
  contractId?: string
  branchId?: string
  eventFrom?: Date
  eventTo?: Date
  sort: TollSortField
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
  if (input.provider) filter.provider = input.provider
  if (input.vehicleId) filter.vehicleId = oid(input.vehicleId)
  if (input.customerId) filter.customerId = oid(input.customerId)
  if (input.contractId) filter.contractId = oid(input.contractId)
  if (input.eventFrom || input.eventTo) {
    filter.eventAt = {
      ...(input.eventFrom ? { $gte: input.eventFrom } : {}),
      ...(input.eventTo ? { $lt: input.eventTo } : {}),
    }
  }
  if (input.search) {
    const pattern = { $regex: escapeRegex(input.search), $options: 'i' }
    filter.$or = [
      { documentNumber: pattern },
      { externalReference: pattern },
      { vehiclePlate: pattern },
      { customerName: pattern },
    ]
  }
  const sort: Record<string, SortOrder> = { [input.sort]: input.order === 'asc' ? 1 : -1 }
  const [items, total] = await Promise.all([
    Toll.find(filter).sort(sort).skip(input.skip).limit(input.take).lean(),
    Toll.countDocuments(filter),
  ])
  return { items: items.map((doc) => toToll(doc as Lean)), total }
}

export async function insertRecovery(input: Record<string, unknown>) {
  try {
    return await ChargeRecovery.create({
      ...input,
      organizationId: oid(String(input.organizationId)),
      legalEntityId: oid(String(input.legalEntityId)),
      branchId: oid(String(input.branchId)),
      sourceId: oid(String(input.sourceId)),
      contractId: oid(String(input.contractId)),
      customerId: oid(String(input.customerId)),
      vehicleId: input.vehicleId ? oid(String(input.vehicleId)) : undefined,
      contractChargeId: input.contractChargeId ? oid(String(input.contractChargeId)) : undefined,
      depositId: input.depositId ? oid(String(input.depositId)) : undefined,
      createdBy: oid(String(input.createdBy)),
    })
  } catch (error) {
    rethrowDatabaseError(error, 'Recovery could not be saved. It may already exist.')
  }
}

export async function findRecoveryBySource(organizationId: string, sourceKind: string, sourceId: string) {
  const orgId = toObjectId(organizationId)
  const id = toObjectId(sourceId)
  if (!orgId || !id) return null
  return ChargeRecovery.findOne({ organizationId: orgId, sourceKind, sourceId: id }).lean()
}

export async function findRecoveryById(id: string) {
  const objectId = toObjectId(id)
  if (!objectId) return null
  return ChargeRecovery.findById(objectId).lean()
}

export async function insertDispute(input: Record<string, unknown>) {
  return ChargeDispute.create({
    ...input,
    organizationId: oid(String(input.organizationId)),
    sourceId: oid(String(input.sourceId)),
    createdBy: oid(String(input.createdBy)),
  })
}

export async function listDisputes(organizationId: string, sourceKind: string, sourceId: string) {
  const orgId = toObjectId(organizationId)
  const id = toObjectId(sourceId)
  if (!orgId || !id) return []
  return ChargeDispute.find({ organizationId: orgId, sourceKind, sourceId: id }).sort({ createdAt: 1 }).lean()
}

export async function updateDispute(id: string, patch: Record<string, unknown>) {
  const objectId = toObjectId(id)
  if (!objectId) return null
  return ChargeDispute.findByIdAndUpdate(objectId, { $set: patch }, { returnDocument: 'after' }).lean()
}

export async function insertImportBatch(input: Record<string, unknown>) {
  return FineTollImportBatch.create({
    ...input,
    organizationId: oid(String(input.organizationId)),
    legalEntityId: oid(String(input.legalEntityId)),
    branchId: oid(String(input.branchId)),
    createdBy: oid(String(input.createdBy)),
  })
}

export async function findImportBatchById(id: string) {
  const objectId = toObjectId(id)
  if (!objectId) return null
  return FineTollImportBatch.findById(objectId).lean()
}

export async function updateImportBatch(id: string, patch: Record<string, unknown>) {
  const objectId = toObjectId(id)
  if (!objectId) return null
  return FineTollImportBatch.findByIdAndUpdate(objectId, { $set: patch }, { returnDocument: 'after' }).lean()
}

export async function insertImportRow(input: Record<string, unknown>) {
  return FineTollImportRow.create({
    ...input,
    batchId: oid(String(input.batchId)),
    organizationId: oid(String(input.organizationId)),
    createdRecordId: input.createdRecordId ? oid(String(input.createdRecordId)) : undefined,
    existingRecordId: input.existingRecordId ? oid(String(input.existingRecordId)) : undefined,
  })
}

export async function listImportRows(batchId: string) {
  const id = toObjectId(batchId)
  if (!id) return []
  return FineTollImportRow.find({ batchId: id }).sort({ rowNumber: 1 }).lean()
}

export async function listImportBatches(input: {
  organizationId: string
  skip: number
  take: number
  status?: ImportBatchStatus
}) {
  const orgId = toObjectId(input.organizationId)
  if (!orgId) return { items: [], total: 0 }
  const filter: FilterQuery<unknown> = { organizationId: orgId }
  if (input.status) filter.status = input.status
  const [items, total] = await Promise.all([
    FineTollImportBatch.find(filter).sort({ createdAt: -1 }).skip(input.skip).limit(input.take).lean(),
    FineTollImportBatch.countDocuments(filter),
  ])
  return { items, total }
}

function toRefund(doc: Lean) {
  return {
    id: doc._id.toString(),
    organizationId: sid(doc.organizationId),
    legalEntityId: sid(doc.legalEntityId),
    branchId: sid(doc.branchId),
    documentNumber: doc.documentNumber ? String(doc.documentNumber) : undefined,
    customerId: sid(doc.customerId),
    customerName: String(doc.customerName),
    contractId: doc.contractId ? sid(doc.contractId) : undefined,
    sourceKind: String(doc.sourceKind),
    depositId: doc.depositId ? sid(doc.depositId) : undefined,
    paymentId: doc.paymentId ? sid(doc.paymentId) : undefined,
    currency: String(doc.currency),
    amount: String(doc.amount),
    reason: String(doc.reason),
    notes: doc.notes ? String(doc.notes) : undefined,
    status: doc.status as RefundStatus,
    evidenceKey: doc.evidenceKey ? String(doc.evidenceKey) : undefined,
    idempotencyKey: String(doc.idempotencyKey),
    externalReference: doc.externalReference ? String(doc.externalReference) : undefined,
    requestedBy: sid(doc.requestedBy),
    requestedAt: doc.requestedAt as Date | undefined,
    approvedBy: doc.approvedBy ? sid(doc.approvedBy) : undefined,
    approvedAt: doc.approvedAt as Date | undefined,
    executedBy: doc.executedBy ? sid(doc.executedBy) : undefined,
    executedAt: doc.executedAt as Date | undefined,
    failedReason: doc.failedReason ? String(doc.failedReason) : undefined,
    createdBy: sid(doc.createdBy),
    createdAt: doc.createdAt as Date,
    updatedAt: doc.updatedAt as Date,
  }
}
export type RefundRecord = ReturnType<typeof toRefund>

export async function insertRefund(input: Omit<RefundRecord, 'id' | 'createdAt' | 'updatedAt' | 'documentNumber'> & { documentNumber?: string }) {
  try {
    const doc = await Refund.create({
      ...input,
      organizationId: oid(input.organizationId),
      legalEntityId: oid(input.legalEntityId),
      branchId: oid(input.branchId),
      customerId: oid(input.customerId),
      contractId: oid(input.contractId),
      depositId: oid(input.depositId),
      paymentId: oid(input.paymentId),
      requestedBy: oid(input.requestedBy),
      createdBy: oid(input.createdBy),
    })
    return toRefund(doc.toObject() as Lean)
  } catch (error) {
    rethrowDatabaseError(error, 'The refund could not be saved. A duplicate idempotency key may exist.')
  }
}

export async function findRefundById(id: string): Promise<RefundRecord | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const doc = await Refund.findById(objectId).lean()
  return doc ? toRefund(doc as Lean) : null
}

export async function findRefundByIdempotency(organizationId: string, idempotencyKey: string) {
  const orgId = toObjectId(organizationId)
  if (!orgId) return null
  const doc = await Refund.findOne({ organizationId: orgId, idempotencyKey }).lean()
  return doc ? toRefund(doc as Lean) : null
}

export async function transitionRefund(id: string, from: RefundStatus, to: RefundStatus, meta: Record<string, unknown> = {}) {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const doc = await Refund.findOneAndUpdate({ _id: objectId, status: from }, { $set: { status: to, ...meta } }, { returnDocument: 'after' }).lean()
  return doc ? toRefund(doc as Lean) : null
}

export async function listRefunds(input: {
  organizationId: string
  branchIds?: string[]
  skip: number
  take: number
  search?: string
  status?: RefundStatus
  customerId?: string
  branchId?: string
  sort: RefundSortField
  order?: 'asc' | 'desc'
}) {
  const organizationId = toObjectId(input.organizationId)
  if (!organizationId) return { items: [], total: 0 }
  const filter: FilterQuery<unknown> = { organizationId }
  if (input.branchIds) filter.branchId = { $in: input.branchIds.map((id) => toObjectId(id)).filter(Boolean) }
  if (input.branchId) filter.branchId = oid(input.branchId)
  if (input.status) filter.status = input.status
  if (input.customerId) filter.customerId = oid(input.customerId)
  if (input.search) {
    const pattern = { $regex: escapeRegex(input.search), $options: 'i' }
    filter.$or = [{ documentNumber: pattern }, { customerName: pattern }, { reason: pattern }]
  }
  const sort: Record<string, SortOrder> = { [input.sort]: input.order === 'asc' ? 1 : -1 }
  const [items, total] = await Promise.all([
    Refund.find(filter).sort(sort).skip(input.skip).limit(input.take).lean(),
    Refund.countDocuments(filter),
  ])
  return { items: items.map((doc) => toRefund(doc as Lean)), total }
}
