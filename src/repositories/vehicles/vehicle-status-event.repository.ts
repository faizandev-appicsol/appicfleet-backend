import type { VehicleStatus } from '../../constants/vehicles.js'
import { VehicleStatusEvent } from '../../models/vehicle-status-event.model.js'
import { toObjectId } from '../object-id.js'

export type VehicleStatusEventRecord = {
  id: string
  vehicleId: string
  organizationId: string
  branchId: string
  fromStatus: VehicleStatus
  toStatus: VehicleStatus
  reason: string
  actorUserId: string
  createdAt: Date
}

type PersistableEvent = {
  _id: { toString(): string }
  vehicleId: { toString(): string }
  organizationId: { toString(): string }
  branchId: { toString(): string }
  fromStatus: string
  toStatus: string
  reason: string
  actorUserId: { toString(): string }
  createdAt: Date
}

function toRecord(doc: PersistableEvent): VehicleStatusEventRecord {
  return {
    id: doc._id.toString(),
    vehicleId: doc.vehicleId.toString(),
    organizationId: doc.organizationId.toString(),
    branchId: doc.branchId.toString(),
    fromStatus: doc.fromStatus as VehicleStatus,
    toStatus: doc.toStatus as VehicleStatus,
    reason: doc.reason,
    actorUserId: doc.actorUserId.toString(),
    createdAt: doc.createdAt,
  }
}

export async function insertVehicleStatusEvent(input: {
  vehicleId: string
  organizationId: string
  branchId: string
  fromStatus: VehicleStatus
  toStatus: VehicleStatus
  reason: string
  actorUserId: string
}): Promise<VehicleStatusEventRecord> {
  const doc = await VehicleStatusEvent.create({
    ...input,
    vehicleId: toObjectId(input.vehicleId),
    organizationId: toObjectId(input.organizationId),
    branchId: toObjectId(input.branchId),
    actorUserId: toObjectId(input.actorUserId),
  })
  return toRecord(doc)
}

export async function listVehicleStatusEvents(input: {
  vehicleId: string
  organizationId: string
  skip: number
  take: number
}): Promise<{ items: VehicleStatusEventRecord[]; total: number }> {
  const vehicleId = toObjectId(input.vehicleId)
  const organizationId = toObjectId(input.organizationId)
  if (!vehicleId || !organizationId) return { items: [], total: 0 }
  const filter = { vehicleId, organizationId }
  const [items, total] = await Promise.all([
    VehicleStatusEvent.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(input.skip)
      .limit(input.take)
      .lean(),
    VehicleStatusEvent.countDocuments(filter),
  ])
  return { items: items.map(toRecord), total }
}
