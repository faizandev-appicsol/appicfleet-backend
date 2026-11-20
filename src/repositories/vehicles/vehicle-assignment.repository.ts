import type { FilterQuery } from 'mongoose'
import { ASSIGNMENT_STATUSES, type AssignmentStatus } from '../../constants/vehicles.js'
import { rethrowDatabaseError } from '../../exceptions/mongooseError.js'
import type { IVehicleAssignment } from '../../interfaces/vehicle.interface.js'
import { VehicleAssignment } from '../../models/vehicle-assignment.model.js'
import { toObjectId } from '../object-id.js'

export type VehicleAssignmentRecord = {
  id: string
  vehicleId: string
  organizationId: string
  branchId: string
  startsAt: Date
  endsAt: Date
  reason: string
  status: AssignmentStatus
  createdBy: string
  createdAt: Date
  updatedAt: Date
  plannedEndsAt?: Date
  closedAt?: Date
  contractId?: string
  assignmentType?: string
  sourceAssignmentId?: string
  vehiclePlate?: string
}

type PersistableAssignment = {
  _id: { toString(): string }
  vehicleId: { toString(): string }
  organizationId: { toString(): string }
  branchId: { toString(): string }
  startsAt: Date
  endsAt: Date
  reason: string
  status: string
  createdBy: { toString(): string }
  createdAt: Date
  updatedAt: Date
  plannedEndsAt?: Date
  closedAt?: Date
  contractId?: { toString(): string }
  assignmentType?: string
  sourceAssignmentId?: { toString(): string }
  vehiclePlate?: string
}

function toRecord(doc: PersistableAssignment): VehicleAssignmentRecord {
  return {
    id: doc._id.toString(),
    vehicleId: doc.vehicleId.toString(),
    organizationId: doc.organizationId.toString(),
    branchId: doc.branchId.toString(),
    startsAt: doc.startsAt,
    endsAt: doc.endsAt,
    reason: doc.reason,
    status: doc.status as AssignmentStatus,
    createdBy: doc.createdBy.toString(),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    plannedEndsAt: doc.plannedEndsAt,
    closedAt: doc.closedAt,
    contractId: doc.contractId?.toString(),
    assignmentType: doc.assignmentType,
    sourceAssignmentId: doc.sourceAssignmentId?.toString(),
    vehiclePlate: doc.vehiclePlate,
  }
}

/**
 * ACTIVE assignments whose window overlaps [startsAt, endsAt): existing.startsAt < endsAt AND
 * existing.endsAt > startsAt (same rule as `intervalsOverlap`).
 */
/**
 * Half-open coverage: assignment matches when startsAt <= instant < endsAt.
 * Used for fine/toll event-time responsibility (never current vehicle customer).
 */
export async function findAssignmentsCoveringInstant(
  vehicleId: string,
  organizationId: string,
  instant: Date,
): Promise<VehicleAssignmentRecord[]> {
  const vehicleObjectId = toObjectId(vehicleId)
  const orgId = toObjectId(organizationId)
  if (!vehicleObjectId || !orgId) return []
  const docs = await VehicleAssignment.find({
    vehicleId: vehicleObjectId,
    organizationId: orgId,
    status: ASSIGNMENT_STATUSES.ACTIVE,
    startsAt: { $lte: instant },
    endsAt: { $gt: instant },
  })
    .sort({ startsAt: 1, _id: 1 })
    .lean()
  return docs.map(toRecord)
}

export async function findActiveAssignmentsOverlapping(
  vehicleId: string,
  organizationId: string,
  startsAt: Date,
  endsAt: Date,
): Promise<VehicleAssignmentRecord[]> {
  const vehicleObjectId = toObjectId(vehicleId)
  const orgId = toObjectId(organizationId)
  if (!vehicleObjectId || !orgId) return []
  const docs = await VehicleAssignment.find({
    vehicleId: vehicleObjectId,
    organizationId: orgId,
    status: ASSIGNMENT_STATUSES.ACTIVE,
    startsAt: { $lt: endsAt },
    endsAt: { $gt: startsAt },
  })
    .sort({ startsAt: 1 })
    .lean()
  return docs.map(toRecord)
}

export async function insertVehicleAssignment(input: {
  vehicleId: string
  organizationId: string
  branchId: string
  startsAt: Date
  endsAt: Date
  reason: string
  createdBy: string
  contractId?: string
  assignmentType?: string
  sourceAssignmentId?: string
  vehiclePlate?: string
}): Promise<VehicleAssignmentRecord> {
  try {
    const doc = await VehicleAssignment.create({
      vehicleId: toObjectId(input.vehicleId),
      organizationId: toObjectId(input.organizationId),
      branchId: toObjectId(input.branchId),
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      plannedEndsAt: input.endsAt,
      reason: input.reason,
      createdBy: toObjectId(input.createdBy),
      status: ASSIGNMENT_STATUSES.ACTIVE,
      contractId: input.contractId ? toObjectId(input.contractId) : undefined,
      assignmentType: input.assignmentType,
      sourceAssignmentId: input.sourceAssignmentId ? toObjectId(input.sourceAssignmentId) : undefined,
      vehiclePlate: input.vehiclePlate,
    })
    return toRecord(doc)
  } catch (error) {
    rethrowDatabaseError(error, 'The assignment could not be saved.')
  }
}

/** Compare-and-set the effective end. Returns null when the window changed underneath us. */
export async function moveAssignmentEnd(input: {
  assignmentId: string
  vehicleId: string
  organizationId: string
  expectedEndsAt: Date
  endsAt: Date
}): Promise<VehicleAssignmentRecord | null> {
  const id = toObjectId(input.assignmentId)
  const vehicleId = toObjectId(input.vehicleId)
  const organizationId = toObjectId(input.organizationId)
  if (!id || !vehicleId || !organizationId) return null
  const shortening = input.endsAt.getTime() < input.expectedEndsAt.getTime()
  const doc = await VehicleAssignment.findOneAndUpdate(
    {
      _id: id,
      vehicleId,
      organizationId,
      status: ASSIGNMENT_STATUSES.ACTIVE,
      endsAt: input.expectedEndsAt,
    },
    {
      $set: {
        endsAt: input.endsAt,
        ...(shortening ? { closedAt: input.endsAt } : {}),
      },
    },
    { new: true },
  ).lean()
  return doc ? toRecord(doc) : null
}

/** Attaches a contract to an existing window. A window already owned by another contract is left alone. */
export async function linkAssignmentToContract(
  assignmentId: string,
  organizationId: string,
  contractId: string,
): Promise<VehicleAssignmentRecord | null> {
  const id = toObjectId(assignmentId)
  const orgId = toObjectId(organizationId)
  const contractObjectId = toObjectId(contractId)
  if (!id || !orgId || !contractObjectId) return null
  const doc = await VehicleAssignment.findOneAndUpdate(
    {
      _id: id,
      organizationId: orgId,
      $or: [{ contractId: { $exists: false } }, { contractId: null }, { contractId: contractObjectId }],
    },
    { $set: { contractId: contractObjectId, assignmentType: 'CONTRACT' } },
    { new: true },
  ).lean()
  return doc ? toRecord(doc) : null
}

export async function listAssignmentsForContract(
  contractId: string,
  organizationId: string,
): Promise<VehicleAssignmentRecord[]> {
  const id = toObjectId(contractId)
  const orgId = toObjectId(organizationId)
  if (!id || !orgId) return []
  const docs = await VehicleAssignment.find({ contractId: id, organizationId: orgId })
    .sort({ startsAt: 1, _id: 1 })
    .lean()
  return docs.map(toRecord)
}

export async function listVehicleAssignments(input: {
  vehicleId: string
  organizationId: string
  skip: number
  take: number
  status?: AssignmentStatus
}): Promise<{ items: VehicleAssignmentRecord[]; total: number }> {
  const vehicleId = toObjectId(input.vehicleId)
  const organizationId = toObjectId(input.organizationId)
  if (!vehicleId || !organizationId) return { items: [], total: 0 }

  const filter: FilterQuery<IVehicleAssignment> = { vehicleId, organizationId }
  if (input.status) filter.status = input.status

  const [items, total] = await Promise.all([
    VehicleAssignment.find(filter)
      .sort({ startsAt: -1, _id: -1 })
      .skip(input.skip)
      .limit(input.take)
      .lean(),
    VehicleAssignment.countDocuments(filter),
  ])
  return { items: items.map(toRecord), total }
}

export async function findVehicleAssignment(
  vehicleId: string,
  organizationId: string,
  assignmentId: string,
): Promise<VehicleAssignmentRecord | null> {
  const vehicleObjectId = toObjectId(vehicleId)
  const orgId = toObjectId(organizationId)
  const id = toObjectId(assignmentId)
  if (!vehicleObjectId || !orgId || !id) return null
  const doc = await VehicleAssignment.findOne({
    _id: id,
    vehicleId: vehicleObjectId,
    organizationId: orgId,
  }).lean()
  return doc ? toRecord(doc) : null
}

/** Compare-and-set: returns null when missing or already released. */
export async function releaseVehicleAssignment(
  vehicleId: string,
  organizationId: string,
  assignmentId: string,
): Promise<VehicleAssignmentRecord | null> {
  const vehicleObjectId = toObjectId(vehicleId)
  const orgId = toObjectId(organizationId)
  const id = toObjectId(assignmentId)
  if (!vehicleObjectId || !orgId || !id) return null
  const doc = await VehicleAssignment.findOneAndUpdate(
    {
      _id: id,
      vehicleId: vehicleObjectId,
      organizationId: orgId,
      status: ASSIGNMENT_STATUSES.ACTIVE,
    },
    { $set: { status: ASSIGNMENT_STATUSES.RELEASED } },
    { new: true },
  ).lean()
  return doc ? toRecord(doc) : null
}
