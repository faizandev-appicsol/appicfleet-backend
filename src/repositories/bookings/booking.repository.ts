import { createHash } from 'node:crypto'
import type { FilterQuery, SortOrder } from 'mongoose'
import {
  BOOKING_STATUSES,
  type BookingSortField,
  type BookingSource,
  type BookingStatus,
} from '../../constants/bookings.js'
import { rethrowDatabaseError } from '../../exceptions/mongooseError.js'
import { Booking } from '../../models/booking.model.js'
import { BookingCounter } from '../../models/booking-counter.model.js'
import { BookingIdempotency } from '../../models/booking-idempotency.model.js'
import { BookingIntakeEvent } from '../../models/booking-intake-event.model.js'
import { BookingStatusEvent } from '../../models/booking-status-event.model.js'
import { Vehicle } from '../../models/vehicle.model.js'
import { VehicleAssignment } from '../../models/vehicle-assignment.model.js'
import { Customer } from '../../models/customer.model.js'
import { ASSIGNMENT_STATUSES } from '../../constants/vehicles.js'
import { escapeRegex, toObjectId, toObjectIds } from '../object-id.js'

export type BookingPricing = {
  currency: string
  unitAmount: string
  quantityDays: number
  totalAmount: string
  rateType: string
}

export type BookingRecord = {
  id: string
  organizationId: string
  legalEntityId: string
  branchId: string
  returnBranchId: string
  bookingNumber: string
  customerId: string
  vehicleId?: string
  vehicleCategory?: string
  customerDisplayName: string
  vehiclePlate?: string
  startsAt: Date
  endsAt: Date
  status: BookingStatus
  source: BookingSource
  sourceChannel?: string
  campaignReference?: string
  externalReference?: string
  notes?: string
  pricing?: BookingPricing
  holdExpiresAt?: Date
  assignmentId?: string
  conversionKey?: string
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

type Persistable = {
  _id: { toString(): string }
  organizationId: { toString(): string }
  legalEntityId: { toString(): string }
  branchId: { toString(): string }
  returnBranchId: { toString(): string }
  bookingNumber: string
  customerId: { toString(): string }
  vehicleId?: { toString(): string }
  vehicleCategory?: string
  customerDisplayName: string
  vehiclePlate?: string
  startsAt: Date
  endsAt: Date
  status: string
  source: string
  sourceChannel?: string
  campaignReference?: string
  externalReference?: string
  notes?: string
  pricing?: BookingPricing
  holdExpiresAt?: Date
  assignmentId?: { toString(): string }
  conversionKey?: string
  createdBy: { toString(): string }
  createdAt: Date
  updatedAt: Date
}

function toRecord(doc: Persistable): BookingRecord {
  return {
    id: doc._id.toString(),
    organizationId: doc.organizationId.toString(),
    legalEntityId: doc.legalEntityId.toString(),
    branchId: doc.branchId.toString(),
    returnBranchId: doc.returnBranchId.toString(),
    bookingNumber: doc.bookingNumber,
    customerId: doc.customerId.toString(),
    vehicleId: doc.vehicleId?.toString(),
    vehicleCategory: doc.vehicleCategory,
    customerDisplayName: doc.customerDisplayName,
    vehiclePlate: doc.vehiclePlate,
    startsAt: doc.startsAt,
    endsAt: doc.endsAt,
    status: doc.status as BookingStatus,
    source: doc.source as BookingSource,
    sourceChannel: doc.sourceChannel,
    campaignReference: doc.campaignReference,
    externalReference: doc.externalReference,
    notes: doc.notes,
    pricing: doc.pricing ? { ...doc.pricing } : undefined,
    holdExpiresAt: doc.holdExpiresAt,
    assignmentId: doc.assignmentId?.toString(),
    conversionKey: doc.conversionKey,
    createdBy: doc.createdBy.toString(),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

export function hashRequest(payload: Record<string, unknown>): string {
  const keys = Object.keys(payload).sort()
  const stable: Record<string, unknown> = {}
  for (const key of keys) stable[key] = payload[key]
  return createHash('sha256').update(JSON.stringify(stable)).digest('hex')
}

/** Next booking number for the organization. `$inc` is atomic across concurrent creates. */
export async function allocateBookingNumber(organizationId: string): Promise<string> {
  const orgId = toObjectId(organizationId)
  if (!orgId) throw new Error('organizationId is required')
  const counter = await BookingCounter.findOneAndUpdate(
    { organizationId: orgId, name: 'booking' },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  ).lean()
  const seq = counter?.seq ?? 1
  return `BK-${String(seq).padStart(6, '0')}`
}

export type NewBooking = {
  organizationId: string
  legalEntityId: string
  branchId: string
  returnBranchId: string
  bookingNumber: string
  customerId: string
  vehicleId?: string
  vehicleCategory?: string
  customerDisplayName: string
  vehiclePlate?: string
  startsAt: Date
  endsAt: Date
  status: BookingStatus
  source: BookingSource
  sourceChannel?: string
  campaignReference?: string
  externalReference?: string
  notes?: string
  pricing?: BookingPricing
  holdExpiresAt?: Date
  assignmentId?: string
  createdBy: string
}

export async function insertBooking(input: NewBooking): Promise<BookingRecord> {
  try {
    const doc = await Booking.create({
      ...input,
      organizationId: toObjectId(input.organizationId),
      legalEntityId: toObjectId(input.legalEntityId),
      branchId: toObjectId(input.branchId),
      returnBranchId: toObjectId(input.returnBranchId),
      customerId: toObjectId(input.customerId),
      vehicleId: input.vehicleId ? toObjectId(input.vehicleId) : undefined,
      assignmentId: input.assignmentId ? toObjectId(input.assignmentId) : undefined,
      createdBy: toObjectId(input.createdBy),
    })
    return toRecord(doc)
  } catch (error) {
    rethrowDatabaseError(error, 'The booking could not be saved.')
  }
}

export async function findBookingById(id: string): Promise<BookingRecord | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const doc = await Booking.findById(objectId).lean()
  return doc ? toRecord(doc as Persistable) : null
}

export async function findBookingInOrg(
  id: string,
  organizationId: string,
): Promise<BookingRecord | null> {
  const objectId = toObjectId(id)
  const orgId = toObjectId(organizationId)
  if (!objectId || !orgId) return null
  const doc = await Booking.findOne({ _id: objectId, organizationId: orgId }).lean()
  return doc ? toRecord(doc as Persistable) : null
}

export type BookingPatch = {
  customerId?: string
  customerDisplayName?: string
  vehicleId?: string | null
  vehicleCategory?: string | null
  vehiclePlate?: string | null
  branchId?: string
  returnBranchId?: string
  legalEntityId?: string
  startsAt?: Date
  endsAt?: Date
  notes?: string | null
  sourceChannel?: string | null
  campaignReference?: string | null
  externalReference?: string | null
  pricing?: BookingPricing | null
  holdExpiresAt?: Date | null
  assignmentId?: string | null
  conversionKey?: string
}

function toSet(patch: BookingPatch): Record<string, unknown> {
  const set: Record<string, unknown> = {}
  if (patch.customerId) set.customerId = toObjectId(patch.customerId)
  if (patch.customerDisplayName) set.customerDisplayName = patch.customerDisplayName
  if (patch.vehicleId) set.vehicleId = toObjectId(patch.vehicleId)
  if (patch.vehicleCategory) set.vehicleCategory = patch.vehicleCategory
  if (patch.vehiclePlate) set.vehiclePlate = patch.vehiclePlate
  if (patch.branchId) set.branchId = toObjectId(patch.branchId)
  if (patch.returnBranchId) set.returnBranchId = toObjectId(patch.returnBranchId)
  if (patch.legalEntityId) set.legalEntityId = toObjectId(patch.legalEntityId)
  if (patch.startsAt) set.startsAt = patch.startsAt
  if (patch.endsAt) set.endsAt = patch.endsAt
  if (patch.notes !== undefined) set.notes = patch.notes
  if (patch.sourceChannel !== undefined) set.sourceChannel = patch.sourceChannel
  if (patch.campaignReference !== undefined) set.campaignReference = patch.campaignReference
  if (patch.externalReference !== undefined) set.externalReference = patch.externalReference
  if (patch.pricing) set.pricing = patch.pricing
  if (patch.holdExpiresAt !== undefined) set.holdExpiresAt = patch.holdExpiresAt
  if (patch.assignmentId) set.assignmentId = toObjectId(patch.assignmentId)
  if (patch.conversionKey) set.conversionKey = patch.conversionKey
  return set
}

function toUnset(patch: BookingPatch): Record<string, 1> {
  const unset: Record<string, 1> = {}
  if (patch.vehicleId === null) unset.vehicleId = 1
  if (patch.vehicleCategory === null) unset.vehicleCategory = 1
  if (patch.vehiclePlate === null) unset.vehiclePlate = 1
  if (patch.assignmentId === null) unset.assignmentId = 1
  if (patch.pricing === null) unset.pricing = 1
  return unset
}

/** Compare-and-set on the current status. Returns null when another writer already moved it. */
export async function transitionBooking(
  id: string,
  organizationId: string,
  from: BookingStatus,
  to: BookingStatus,
  patch: BookingPatch = {},
): Promise<BookingRecord | null> {
  const objectId = toObjectId(id)
  const orgId = toObjectId(organizationId)
  if (!objectId || !orgId) return null
  const unset = toUnset(patch)
  const update: Record<string, unknown> = { $set: { status: to, ...toSet(patch) } }
  if (Object.keys(unset).length > 0) update.$unset = unset
  const doc = await Booking.findOneAndUpdate(
    { _id: objectId, organizationId: orgId, status: from },
    update,
    { new: true },
  ).lean()
  return doc ? toRecord(doc as Persistable) : null
}

export async function updateDraftBooking(
  id: string,
  organizationId: string,
  patch: BookingPatch,
): Promise<BookingRecord | null> {
  return transitionBooking(id, organizationId, BOOKING_STATUSES.DRAFT, BOOKING_STATUSES.DRAFT, patch)
}

export type ListBookingsInput = {
  organizationId: string
  skip: number
  take: number
  search?: string
  status?: BookingStatus
  source?: BookingSource
  branchIds?: readonly string[]
  legalEntityIds?: readonly string[]
  vehicleId?: string
  customerId?: string
  vehicleCategory?: string
  pickupFrom?: Date
  pickupTo?: Date
  returnFrom?: Date
  returnTo?: Date
  /** When set, only bookings whose window overlaps [overlapFrom, overlapTo). */
  overlapFrom?: Date
  overlapTo?: Date
  sort: BookingSortField
  order: 'asc' | 'desc'
}

export async function listBookings(
  input: ListBookingsInput,
): Promise<{ items: BookingRecord[]; total: number }> {
  const organizationId = toObjectId(input.organizationId)
  if (!organizationId) return { items: [], total: 0 }

  const filter: FilterQuery<unknown> = { organizationId }
  if (input.status) filter.status = input.status
  if (input.source) filter.source = input.source
  if (input.branchIds) filter.branchId = { $in: toObjectIds(input.branchIds) }
  if (input.legalEntityIds) filter.legalEntityId = { $in: toObjectIds(input.legalEntityIds) }
  if (input.vehicleId) filter.vehicleId = toObjectId(input.vehicleId)
  if (input.customerId) filter.customerId = toObjectId(input.customerId)
  if (input.vehicleCategory) filter.vehicleCategory = input.vehicleCategory
  if (input.pickupFrom || input.pickupTo) {
    filter.startsAt = {
      ...(input.pickupFrom ? { $gte: input.pickupFrom } : {}),
      ...(input.pickupTo ? { $lt: input.pickupTo } : {}),
    }
  }
  if (input.returnFrom || input.returnTo) {
    filter.endsAt = {
      ...(input.returnFrom ? { $gte: input.returnFrom } : {}),
      ...(input.returnTo ? { $lt: input.returnTo } : {}),
    }
  }
  if (input.overlapFrom && input.overlapTo) {
    filter.startsAt = { ...(filter.startsAt as object), $lt: input.overlapTo }
    filter.endsAt = { ...(filter.endsAt as object), $gt: input.overlapFrom }
  }
  if (input.search) {
    const pattern = { $regex: escapeRegex(input.search), $options: 'i' }
    const [customers, vehicles] = await Promise.all([
      Customer.find({
        organizationId,
        $or: [{ displayName: pattern }, { email: pattern }, { phone: pattern }, { customerNumber: pattern }],
      })
        .select('_id')
        .limit(50)
        .lean(),
      Vehicle.find({ organizationId, plateNumber: pattern }).select('_id').limit(50).lean(),
    ])
    filter.$or = [
      { bookingNumber: pattern },
      { externalReference: pattern },
      { customerId: { $in: customers.map((row) => row._id) } },
      { vehicleId: { $in: vehicles.map((row) => row._id) } },
    ]
  }

  const direction: SortOrder = input.order === 'asc' ? 1 : -1
  try {
    const [items, total] = await Promise.all([
      Booking.find(filter)
        .sort({ [input.sort]: direction, _id: direction })
        .skip(input.skip)
        .limit(input.take)
        .lean(),
      Booking.countDocuments(filter),
    ])
    return { items: items.map((doc) => toRecord(doc as Persistable)), total }
  } catch (error) {
    rethrowDatabaseError(error, 'Bookings could not be loaded.')
  }
}

export async function listExpiredHolds(
  now: Date,
  limit: number,
  organizationId?: string,
): Promise<BookingRecord[]> {
  const filter: FilterQuery<unknown> = {
    status: BOOKING_STATUSES.HOLD,
    holdExpiresAt: { $lte: now },
  }
  if (organizationId) {
    const orgId = toObjectId(organizationId)
    if (!orgId) return []
    filter.organizationId = orgId
  }
  const docs = await Booking.find(filter)
    .sort({ holdExpiresAt: 1 })
    .limit(limit)
    .lean()
  return docs.map((doc) => toRecord(doc as Persistable))
}

export type StatusEventRecord = {
  id: string
  bookingId: string
  fromStatus?: string
  toStatus: string
  reason?: string
  actorUserId?: string
  createdAt: Date
}

export async function insertStatusEvent(input: {
  bookingId: string
  organizationId: string
  branchId: string
  fromStatus?: BookingStatus
  toStatus: BookingStatus
  reason?: string
  actorUserId?: string
}): Promise<void> {
  await BookingStatusEvent.create({
    bookingId: toObjectId(input.bookingId),
    organizationId: toObjectId(input.organizationId),
    branchId: toObjectId(input.branchId),
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    reason: input.reason,
    actorUserId: input.actorUserId ? toObjectId(input.actorUserId) : undefined,
  })
}

export async function listStatusEvents(bookingId: string): Promise<StatusEventRecord[]> {
  const id = toObjectId(bookingId)
  if (!id) return []
  const docs = await BookingStatusEvent.find({ bookingId: id }).sort({ createdAt: 1 }).lean()
  return docs.map((doc) => ({
    id: doc._id.toString(),
    bookingId: doc.bookingId.toString(),
    fromStatus: doc.fromStatus,
    toStatus: doc.toStatus,
    reason: doc.reason,
    actorUserId: doc.actorUserId?.toString(),
    createdAt: doc.createdAt,
  }))
}

export type AvailableVehicleRow = {
  id: string
  plateNumber: string
  make: string
  model: string
  year: number
  category: string
  status: string
  ownershipType: string
  branchId: string
  organizationId: string
}

export async function findCandidateVehicles(input: {
  organizationId: string
  branchId?: string
  branchIds?: readonly string[]
  legalEntityIds?: readonly string[]
  category?: string
  ownershipType?: string
  limit: number
}): Promise<AvailableVehicleRow[]> {
  const organizationId = toObjectId(input.organizationId)
  if (!organizationId) return []
  const filter: FilterQuery<unknown> = {
    organizationId,
    status: { $nin: ['INACTIVE', 'OUT_OF_SERVICE', 'MAINTENANCE', 'INSPECTION'] },
  }
  if (input.branchId) filter.branchId = toObjectId(input.branchId)
  else if (input.branchIds) filter.branchId = { $in: toObjectIds(input.branchIds) }
  if (input.legalEntityIds) filter.legalEntityId = { $in: toObjectIds(input.legalEntityIds) }
  if (input.category) filter.category = input.category
  if (input.ownershipType) filter.ownershipType = input.ownershipType
  const docs = await Vehicle.find(filter)
    .select('plateNumber make model year category status ownershipType branchId organizationId')
    .sort({ plateNumber: 1 })
    .limit(input.limit)
    .lean()
  return docs.map((doc) => ({
    id: doc._id.toString(),
    plateNumber: doc.plateNumber,
    make: doc.make,
    model: doc.model,
    year: doc.year,
    category: doc.category,
    status: doc.status,
    ownershipType: doc.ownershipType,
    branchId: doc.branchId.toString(),
    organizationId: doc.organizationId.toString(),
  }))
}

/** Active assignment windows overlapping [startsAt, endsAt) for the given vehicles. */
export async function findOverlappingAssignmentVehicleIds(
  organizationId: string,
  vehicleIds: readonly string[],
  startsAt: Date,
  endsAt: Date,
): Promise<Set<string>> {
  const orgId = toObjectId(organizationId)
  const ids = toObjectIds(vehicleIds)
  if (!orgId || ids.length === 0) return new Set()
  const docs = await VehicleAssignment.find({
    organizationId: orgId,
    vehicleId: { $in: ids },
    status: ASSIGNMENT_STATUSES.ACTIVE,
    startsAt: { $lt: endsAt },
    endsAt: { $gt: startsAt },
  })
    .select('vehicleId')
    .lean()
  return new Set(docs.map((doc) => doc.vehicleId.toString()))
}

export type ClaimResult =
  | { outcome: 'claimed' }
  | { outcome: 'replay'; bookingId: string }
  | { outcome: 'mismatch' }
  | { outcome: 'busy' }

type ClaimModel = typeof BookingIdempotency | typeof BookingIntakeEvent

async function readClaim(
  model: ClaimModel,
  filter: FilterQuery<unknown>,
): Promise<{ bookingId?: string; requestHash: string } | null> {
  const doc = await model.findOne(filter).lean()
  if (!doc) return null
  return { bookingId: doc.bookingId?.toString(), requestHash: doc.requestHash }
}

export async function claimKey(
  model: ClaimModel,
  filter: FilterQuery<unknown>,
  requestHash: string,
): Promise<ClaimResult> {
  try {
    await model.create({ ...filter, requestHash })
    return { outcome: 'claimed' }
  } catch (error) {
    const code = (error as { code?: number }).code
    if (code !== 11000) throw error
    const existing = await readClaim(model, filter)
    if (!existing) return { outcome: 'busy' }
    if (existing.requestHash !== requestHash) return { outcome: 'mismatch' }
    if (existing.bookingId) return { outcome: 'replay', bookingId: existing.bookingId }
    return { outcome: 'busy' }
  }
}

export async function attachClaim(
  model: ClaimModel,
  filter: FilterQuery<unknown>,
  bookingId: string,
): Promise<void> {
  await model.updateOne(
    { ...filter, bookingId: { $exists: false } },
    { $set: { bookingId: toObjectId(bookingId) } },
  )
}

export async function releaseClaim(model: ClaimModel, filter: FilterQuery<unknown>): Promise<void> {
  await model.deleteOne({ ...filter, bookingId: { $exists: false } })
}

export function idempotencyModel(): typeof BookingIdempotency {
  return BookingIdempotency
}

export function intakeModel(): typeof BookingIntakeEvent {
  return BookingIntakeEvent
}
