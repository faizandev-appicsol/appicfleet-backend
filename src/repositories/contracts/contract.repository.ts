import { createHash } from 'node:crypto'
import type { FilterQuery, SortOrder } from 'mongoose'
import {
  CONTRACT_STATUSES,
  type ContractSortField,
  type ContractStatus,
  type ContractType,
} from '../../constants/contracts.js'
import { rethrowDatabaseError } from '../../exceptions/mongooseError.js'
import {
  Contract,
  ContractCharge,
  ContractCounter,
  ContractExtension,
  ContractHandover,
  ContractIdempotency,
  ContractPricingAmendment,
  ContractReplacement,
  ContractReturn,
  ContractSignature,
  ContractStatusEvent,
  ContractTermsVersion,
} from '../../models/contract.model.js'
import { Customer } from '../../models/customer.model.js'
import { Vehicle } from '../../models/vehicle.model.js'
import { escapeRegex, toObjectId } from '../object-id.js'

export type CustomerSnapshot = {
  customerNumber: string
  displayName: string
  type: string
  email?: string
  phone?: string
  companyName?: string
}

export type ContractRecord = {
  id: string
  organizationId: string
  legalEntityId: string
  branchId: string
  contractNumber: string
  type: ContractType
  status: ContractStatus
  customerId: string
  customerSnapshot?: CustomerSnapshot
  bookingId?: string
  currentVehicleId?: string
  currentPlate?: string
  currentVin?: string
  startsAt: Date
  endsAt: Date
  originalEndsAt?: Date
  currency?: string
  driverName?: string
  authorizedContactName?: string
  lenderName?: string
  borrowCost?: string
  notes?: string
  acceptedTermsVersionId?: string
  approvedBy?: string
  approvedAt?: Date
  activatedAt?: Date
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

type Persistable = {
  _id: { toString(): string }
  organizationId: { toString(): string }
  legalEntityId: { toString(): string }
  branchId: { toString(): string }
  contractNumber: string
  type: string
  status: string
  customerId: { toString(): string }
  customerSnapshot?: CustomerSnapshot
  bookingId?: { toString(): string }
  currentVehicleId?: { toString(): string }
  currentPlate?: string
  currentVin?: string
  startsAt: Date
  endsAt: Date
  originalEndsAt?: Date
  currency?: string
  driverName?: string
  authorizedContactName?: string
  lenderName?: string
  borrowCost?: string
  notes?: string
  acceptedTermsVersionId?: { toString(): string }
  approvedBy?: { toString(): string }
  approvedAt?: Date
  activatedAt?: Date
  createdBy: { toString(): string }
  createdAt: Date
  updatedAt: Date
}

function toContract(doc: Persistable): ContractRecord {
  return {
    id: doc._id.toString(),
    organizationId: doc.organizationId.toString(),
    legalEntityId: doc.legalEntityId.toString(),
    branchId: doc.branchId.toString(),
    contractNumber: doc.contractNumber,
    type: doc.type as ContractType,
    status: doc.status as ContractStatus,
    customerId: doc.customerId.toString(),
    customerSnapshot: doc.customerSnapshot ?? undefined,
    bookingId: doc.bookingId?.toString(),
    currentVehicleId: doc.currentVehicleId?.toString(),
    currentPlate: doc.currentPlate,
    currentVin: doc.currentVin,
    startsAt: doc.startsAt,
    endsAt: doc.endsAt,
    originalEndsAt: doc.originalEndsAt,
    currency: doc.currency,
    driverName: doc.driverName,
    authorizedContactName: doc.authorizedContactName,
    lenderName: doc.lenderName,
    borrowCost: doc.borrowCost,
    notes: doc.notes,
    acceptedTermsVersionId: doc.acceptedTermsVersionId?.toString(),
    approvedBy: doc.approvedBy?.toString(),
    approvedAt: doc.approvedAt,
    activatedAt: doc.activatedAt,
    createdBy: doc.createdBy.toString(),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

export function hashContractRequest(payload: Record<string, unknown>): string {
  const keys = Object.keys(payload).sort()
  const stable = JSON.stringify(payload, keys)
  return createHash('sha256').update(stable).digest('hex')
}

export async function allocateContractNumber(organizationId: string): Promise<string> {
  const orgId = toObjectId(organizationId)
  if (!orgId) throw new Error('organizationId is required')
  const counter = await ContractCounter.findOneAndUpdate(
    { organizationId: orgId, name: 'contract' },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  ).lean()
  return `CT-${String(counter?.seq ?? 1).padStart(6, '0')}`
}

export async function insertContract(input: {
  organizationId: string
  legalEntityId: string
  branchId: string
  contractNumber: string
  type: ContractType
  status: ContractStatus
  customerId: string
  customerSnapshot?: CustomerSnapshot
  bookingId?: string
  currentVehicleId?: string
  currentPlate?: string
  currentVin?: string
  startsAt: Date
  endsAt: Date
  currency?: string
  driverName?: string
  authorizedContactName?: string
  lenderName?: string
  borrowCost?: string
  notes?: string
  createdBy: string
}): Promise<ContractRecord> {
  try {
    const doc = await Contract.create({
      ...input,
      organizationId: toObjectId(input.organizationId),
      legalEntityId: toObjectId(input.legalEntityId),
      branchId: toObjectId(input.branchId),
      customerId: toObjectId(input.customerId),
      bookingId: input.bookingId ? toObjectId(input.bookingId) : undefined,
      currentVehicleId: input.currentVehicleId ? toObjectId(input.currentVehicleId) : undefined,
      createdBy: toObjectId(input.createdBy),
    })
    return toContract(doc)
  } catch (error) {
    rethrowDatabaseError(error, 'The contract could not be saved.')
  }
}

export async function findContractById(id: string): Promise<ContractRecord | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const doc = await Contract.findById(objectId).lean()
  return doc ? toContract(doc as Persistable) : null
}

export async function findContractByBookingId(bookingId: string): Promise<ContractRecord | null> {
  const id = toObjectId(bookingId)
  if (!id) return null
  const doc = await Contract.findOne({ bookingId: id }).lean()
  return doc ? toContract(doc as Persistable) : null
}

export async function transitionContract(
  id: string,
  organizationId: string,
  from: ContractStatus,
  to: ContractStatus,
  patch: Record<string, unknown> = {},
): Promise<ContractRecord | null> {
  const objectId = toObjectId(id)
  const orgId = toObjectId(organizationId)
  if (!objectId || !orgId) return null
  const objectIdKeys = new Set([
    'approvedBy',
    'currentVehicleId',
    'acceptedTermsVersionId',
    'bookingId',
    'branchId',
    'legalEntityId',
    'customerId',
  ])
  const set: Record<string, unknown> = { status: to }
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue
    if (objectIdKeys.has(key) && typeof value === 'string') set[key] = toObjectId(value) ?? value
    else set[key] = value
  }
  const doc = await Contract.findOneAndUpdate(
    { _id: objectId, organizationId: orgId, status: from },
    { $set: set },
    { new: true },
  ).lean()
  return doc ? toContract(doc as Persistable) : null
}

export async function updateDraftContract(
  id: string,
  organizationId: string,
  patch: Record<string, unknown>,
): Promise<ContractRecord | null> {
  return transitionContract(id, organizationId, CONTRACT_STATUSES.DRAFT, CONTRACT_STATUSES.DRAFT, patch)
}

export async function listContracts(input: {
  organizationId: string
  branchIds?: string[]
  legalEntityIds?: string[]
  skip: number
  take: number
  search?: string
  status?: ContractStatus
  type?: ContractType
  branchId?: string
  customerId?: string
  vehicleId?: string
  startsFrom?: Date
  startsTo?: Date
  activeOnly?: boolean
  sort: ContractSortField
  order?: 'asc' | 'desc'
}): Promise<{ items: ContractRecord[]; total: number }> {
  const organizationId = toObjectId(input.organizationId)
  if (!organizationId) return { items: [], total: 0 }
  const filter: FilterQuery<unknown> = { organizationId }
  if (input.branchIds) {
    filter.branchId = { $in: input.branchIds.map((id) => toObjectId(id)).filter(Boolean) }
  }
  if (input.legalEntityIds) {
    filter.legalEntityId = { $in: input.legalEntityIds.map((id) => toObjectId(id)).filter(Boolean) }
  }
  if (input.branchId) filter.branchId = toObjectId(input.branchId)
  if (input.customerId) filter.customerId = toObjectId(input.customerId)
  if (input.vehicleId) filter.currentVehicleId = toObjectId(input.vehicleId)
  if (input.type) filter.type = input.type
  if (input.activeOnly) filter.status = CONTRACT_STATUSES.ACTIVE
  else if (input.status) filter.status = input.status
  if (input.startsFrom || input.startsTo) {
    filter.startsAt = {
      ...(input.startsFrom ? { $gte: input.startsFrom } : {}),
      ...(input.startsTo ? { $lt: input.startsTo } : {}),
    }
  }
  if (input.search) {
    const pattern = { $regex: escapeRegex(input.search), $options: 'i' }
    const [customers, vehicles] = await Promise.all([
      Customer.find({
        organizationId,
        $or: [
          { displayName: pattern },
          { email: pattern },
          { phone: pattern },
          { customerNumber: pattern },
          { 'corporate.legalName': pattern },
        ],
      })
        .select('_id')
        .limit(50)
        .lean(),
      Vehicle.find({
        organizationId,
        $or: [{ plateNumber: pattern }, { vin: pattern }],
      })
        .select('_id')
        .limit(50)
        .lean(),
    ])
    filter.$or = [
      { contractNumber: pattern },
      { currentPlate: pattern },
      { currentVin: pattern },
      { 'customerSnapshot.displayName': pattern },
      { 'customerSnapshot.companyName': pattern },
      { customerId: { $in: customers.map((row) => row._id) } },
      { currentVehicleId: { $in: vehicles.map((row) => row._id) } },
    ]
  }
  const direction: SortOrder = input.order === 'asc' ? 1 : -1
  const [items, total] = await Promise.all([
    Contract.find(filter)
      .sort({ [input.sort]: direction, _id: direction })
      .skip(input.skip)
      .limit(input.take)
      .lean(),
    Contract.countDocuments(filter),
  ])
  return { items: items.map((doc) => toContract(doc as Persistable)), total }
}

export async function insertStatusEvent(input: {
  contractId: string
  organizationId: string
  branchId: string
  fromStatus?: ContractStatus
  toStatus: ContractStatus
  reason?: string
  actorUserId?: string
}): Promise<void> {
  await ContractStatusEvent.create({
    contractId: toObjectId(input.contractId),
    organizationId: toObjectId(input.organizationId),
    branchId: toObjectId(input.branchId),
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    reason: input.reason,
    actorUserId: input.actorUserId ? toObjectId(input.actorUserId) : undefined,
  })
}

export async function listStatusEvents(contractId: string) {
  const id = toObjectId(contractId)
  if (!id) return []
  return ContractStatusEvent.find({ contractId: id }).sort({ createdAt: 1 }).lean()
}

export async function insertTerms(input: {
  contractId: string
  organizationId: string
  version: number
  content: string
  status: string
  createdBy: string
  effectiveAt?: Date
}) {
  const doc = await ContractTermsVersion.create({
    ...input,
    contractId: toObjectId(input.contractId),
    organizationId: toObjectId(input.organizationId),
    createdBy: toObjectId(input.createdBy),
  })
  return doc
}

export async function listTerms(contractId: string) {
  const id = toObjectId(contractId)
  if (!id) return []
  return ContractTermsVersion.find({ contractId: id }).sort({ version: 1 }).lean()
}

export async function latestTerms(contractId: string) {
  const id = toObjectId(contractId)
  if (!id) return null
  return ContractTermsVersion.findOne({ contractId: id }).sort({ version: -1 }).lean()
}

export async function updateDraftTerms(contractId: string, content: string) {
  const id = toObjectId(contractId)
  if (!id) return null
  return ContractTermsVersion.findOneAndUpdate(
    { contractId: id, version: 1, status: 'DRAFT' },
    { $set: { content } },
    { new: true },
  ).lean()
}

export async function acceptTerms(termsId: string) {
  const id = toObjectId(termsId)
  if (!id) return null
  return ContractTermsVersion.findOneAndUpdate(
    { _id: id, status: 'DRAFT' },
    { $set: { status: 'ACCEPTED', effectiveAt: new Date() } },
    { new: true },
  ).lean()
}

export async function insertCharge(input: {
  contractId: string
  organizationId: string
  kind: string
  sourceId: string
  currency: string
  unitAmount: string
  quantityDays: number
  totalAmount: string
  rateType: string
  periodStart: Date
  periodEnd: Date
  createdBy: string
  supersededBy?: string
}) {
  const doc = await ContractCharge.create({
    ...input,
    contractId: toObjectId(input.contractId),
    organizationId: toObjectId(input.organizationId),
    createdBy: toObjectId(input.createdBy),
  })
  return doc
}

export async function listCharges(contractId: string) {
  const id = toObjectId(contractId)
  if (!id) return []
  return ContractCharge.find({ contractId: id }).sort({ createdAt: 1 }).lean()
}

export async function supersedeCharge(chargeId: string, supersededBy: string) {
  const id = toObjectId(chargeId)
  if (!id) return null
  return ContractCharge.findOneAndUpdate(
    { _id: id, supersededBy: { $exists: false } },
    { $set: { supersededBy } },
    { new: true },
  ).lean()
}

export async function insertAmendment(input: {
  contractId: string
  organizationId: string
  previousChargeId: string
  previousTotal: string
  newUnitAmount: string
  newTotal: string
  currency: string
  quantityDays: number
  reason: string
  effectiveAt: Date
  createdBy: string
}) {
  return ContractPricingAmendment.create({
    ...input,
    contractId: toObjectId(input.contractId),
    organizationId: toObjectId(input.organizationId),
    previousChargeId: toObjectId(input.previousChargeId),
    createdBy: toObjectId(input.createdBy),
  })
}

export async function listAmendments(contractId: string) {
  const id = toObjectId(contractId)
  if (!id) return []
  return ContractPricingAmendment.find({ contractId: id }).sort({ createdAt: 1 }).lean()
}

export async function findExtensionWindow(contractId: string, startsAt: Date) {
  const id = toObjectId(contractId)
  if (!id) return null
  return ContractExtension.findOne({ contractId: id, startsAt }).lean()
}

export async function insertExtension(input: {
  contractId: string
  organizationId: string
  assignmentId: string
  startsAt: Date
  endsAt: Date
  currency: string
  unitAmount: string
  quantityDays: number
  totalAmount: string
  rateType: string
  createdBy: string
}) {
  return ContractExtension.create({
    ...input,
    contractId: toObjectId(input.contractId),
    organizationId: toObjectId(input.organizationId),
    assignmentId: toObjectId(input.assignmentId),
    createdBy: toObjectId(input.createdBy),
  })
}

export async function listExtensions(contractId: string) {
  const id = toObjectId(contractId)
  if (!id) return []
  return ContractExtension.find({ contractId: id }).sort({ startsAt: 1 }).lean()
}

export async function findReplacementAt(contractId: string, occurredAt: Date, replacementVehicleId: string) {
  const id = toObjectId(contractId)
  const vehicleId = toObjectId(replacementVehicleId)
  if (!id || !vehicleId) return null
  return ContractReplacement.findOne({ contractId: id, occurredAt, replacementVehicleId: vehicleId }).lean()
}

export async function insertReplacement(input: {
  contractId: string
  organizationId: string
  previousVehicleId: string
  replacementVehicleId: string
  previousAssignmentId: string
  replacementAssignmentId: string
  previousPlate: string
  replacementPlate: string
  reason: string
  notes?: string
  status: string
  occurredAt: Date
  requestedBy: string
  approvedBy: string
}) {
  return ContractReplacement.create({
    contractId: toObjectId(input.contractId),
    organizationId: toObjectId(input.organizationId),
    previousVehicleId: toObjectId(input.previousVehicleId),
    replacementVehicleId: toObjectId(input.replacementVehicleId),
    previousAssignmentId: toObjectId(input.previousAssignmentId),
    replacementAssignmentId: toObjectId(input.replacementAssignmentId),
    previousPlate: input.previousPlate,
    replacementPlate: input.replacementPlate,
    reason: input.reason,
    notes: input.notes,
    status: input.status,
    occurredAt: input.occurredAt,
    requestedBy: toObjectId(input.requestedBy),
    approvedBy: toObjectId(input.approvedBy),
  })
}

export async function listReplacements(contractId: string) {
  const id = toObjectId(contractId)
  if (!id) return []
  return ContractReplacement.find({ contractId: id }).sort({ occurredAt: 1 }).lean()
}

export async function findHandover(contractId: string) {
  const id = toObjectId(contractId)
  if (!id) return null
  return ContractHandover.findOne({ contractId: id }).lean()
}

export async function insertHandover(input: {
  contractId: string
  organizationId: string
  assignmentId: string
  occurredAt: Date
  mileageKm: number
  fuelPercent: number
  condition: string
  notes?: string
  acknowledged: boolean
  staffUserId: string
}) {
  return ContractHandover.create({
    ...input,
    contractId: toObjectId(input.contractId),
    organizationId: toObjectId(input.organizationId),
    assignmentId: toObjectId(input.assignmentId),
    staffUserId: toObjectId(input.staffUserId),
  })
}

export async function findReturn(contractId: string) {
  const id = toObjectId(contractId)
  if (!id) return null
  return ContractReturn.findOne({ contractId: id }).lean()
}

export async function insertReturn(input: {
  contractId: string
  organizationId: string
  assignmentId: string
  occurredAt: Date
  mileageKm: number
  fuelPercent: number
  condition: string
  damageNotes?: string
  notes?: string
  acknowledged: boolean
  staffUserId: string
}) {
  return ContractReturn.create({
    ...input,
    contractId: toObjectId(input.contractId),
    organizationId: toObjectId(input.organizationId),
    assignmentId: toObjectId(input.assignmentId),
    staffUserId: toObjectId(input.staffUserId),
  })
}

export async function listSignatures(contractId: string) {
  const id = toObjectId(contractId)
  if (!id) return []
  return ContractSignature.find({ contractId: id }).sort({ createdAt: 1 }).lean()
}

export async function findSignedTerms(contractId: string, termsVersionId: string) {
  const id = toObjectId(contractId)
  const termsId = toObjectId(termsVersionId)
  if (!id || !termsId) return null
  return ContractSignature.findOne({ contractId: id, termsVersionId: termsId, status: 'SIGNED' }).lean()
}

export async function insertSignature(input: {
  contractId: string
  organizationId: string
  termsVersionId: string
  signerName: string
  status: string
  provider: string
  signedAt?: Date
  externalEventId?: string
}) {
  return ContractSignature.create({
    ...input,
    contractId: toObjectId(input.contractId),
    organizationId: toObjectId(input.organizationId),
    termsVersionId: toObjectId(input.termsVersionId),
  })
}

export async function findSignatureByEvent(organizationId: string, externalEventId: string) {
  const orgId = toObjectId(organizationId)
  if (!orgId) return null
  return ContractSignature.findOne({ organizationId: orgId, externalEventId }).lean()
}

export async function claimContractKey(
  organizationId: string,
  key: string,
  requestHash: string,
): Promise<'claimed' | 'replay' | 'mismatch' | 'busy'> {
  const orgId = toObjectId(organizationId)
  if (!orgId) return 'busy'
  try {
    await ContractIdempotency.create({ organizationId: orgId, key, requestHash })
    return 'claimed'
  } catch (error) {
    const code = (error as { code?: number }).code
    if (code !== 11000) throw error
    const existing = await ContractIdempotency.findOne({ organizationId: orgId, key }).lean()
    if (!existing) return 'busy'
    if (existing.requestHash !== requestHash) return 'mismatch'
    if (existing.contractId) return 'replay'
    return 'busy'
  }
}

export async function attachContractKey(organizationId: string, key: string, contractId: string) {
  const orgId = toObjectId(organizationId)
  const id = toObjectId(contractId)
  if (!orgId || !id) return
  await ContractIdempotency.updateOne(
    { organizationId: orgId, key, contractId: { $exists: false } },
    { $set: { contractId: id } },
  )
}

export async function releaseContractKey(organizationId: string, key: string) {
  const orgId = toObjectId(organizationId)
  if (!orgId) return
  await ContractIdempotency.deleteOne({ organizationId: orgId, key, contractId: { $exists: false } })
}

export async function contractIdForKey(organizationId: string, key: string): Promise<string | undefined> {
  const orgId = toObjectId(organizationId)
  if (!orgId) return undefined
  const doc = await ContractIdempotency.findOne({ organizationId: orgId, key }).lean()
  return doc?.contractId?.toString()
}
