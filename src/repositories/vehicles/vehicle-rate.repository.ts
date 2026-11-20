import { RATE_STATUSES, type RateStatus, type RateType } from '../../constants/vehicles.js'
import { rethrowDatabaseError } from '../../exceptions/mongooseError.js'
import type { IVehicleRateCard } from '../../interfaces/vehicle.interface.js'
import { VehicleRateCard } from '../../models/vehicle-rate-card.model.js'
import type { FilterQuery } from 'mongoose'
import { toObjectId } from '../object-id.js'

export type VehicleRateRecord = {
  id: string
  vehicleId: string
  organizationId: string
  rateType: RateType
  amount: string
  currency: string
  effectiveFrom: Date
  effectiveTo: Date | null
  status: RateStatus
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

type PersistableRate = {
  _id: { toString(): string }
  vehicleId: { toString(): string }
  organizationId: { toString(): string }
  rateType: string
  amount: string
  currency: string
  effectiveFrom: Date
  effectiveTo?: Date | null
  status: string
  createdBy: { toString(): string }
  createdAt: Date
  updatedAt: Date
}

function toRecord(doc: PersistableRate): VehicleRateRecord {
  return {
    id: doc._id.toString(),
    vehicleId: doc.vehicleId.toString(),
    organizationId: doc.organizationId.toString(),
    rateType: doc.rateType as RateType,
    amount: doc.amount,
    currency: doc.currency,
    effectiveFrom: doc.effectiveFrom,
    effectiveTo: doc.effectiveTo ?? null,
    status: doc.status as RateStatus,
    createdBy: doc.createdBy.toString(),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

export async function listVehicleRates(input: {
  vehicleId: string
  organizationId: string
  skip: number
  take: number
  rateType?: RateType
  status?: RateStatus
}): Promise<{ items: VehicleRateRecord[]; total: number }> {
  const vehicleId = toObjectId(input.vehicleId)
  const organizationId = toObjectId(input.organizationId)
  if (!vehicleId || !organizationId) return { items: [], total: 0 }

  const filter: FilterQuery<IVehicleRateCard> = { vehicleId, organizationId }
  if (input.rateType) filter.rateType = input.rateType
  if (input.status) filter.status = input.status

  const [items, total] = await Promise.all([
    VehicleRateCard.find(filter)
      .sort({ rateType: 1, effectiveFrom: -1, _id: -1 })
      .skip(input.skip)
      .limit(input.take)
      .lean(),
    VehicleRateCard.countDocuments(filter),
  ])
  return { items: items.map(toRecord), total }
}

/** All ACTIVE cards of one type for a vehicle (small set); overlap is decided by the pure helper. */
export async function findActiveRates(
  vehicleId: string,
  organizationId: string,
  rateType: RateType,
): Promise<VehicleRateRecord[]> {
  const vehicleObjectId = toObjectId(vehicleId)
  const orgId = toObjectId(organizationId)
  if (!vehicleObjectId || !orgId) return []
  const docs = await VehicleRateCard.find({
    vehicleId: vehicleObjectId,
    organizationId: orgId,
    rateType,
    status: RATE_STATUSES.ACTIVE,
  }).lean()
  return docs.map(toRecord)
}

export async function insertVehicleRate(input: {
  vehicleId: string
  organizationId: string
  rateType: RateType
  amount: string
  currency: string
  effectiveFrom: Date
  effectiveTo: Date | null
  createdBy: string
}): Promise<VehicleRateRecord> {
  try {
    const doc = await VehicleRateCard.create({
      ...input,
      vehicleId: toObjectId(input.vehicleId),
      organizationId: toObjectId(input.organizationId),
      createdBy: toObjectId(input.createdBy),
      status: RATE_STATUSES.ACTIVE,
    })
    return toRecord(doc)
  } catch (error) {
    rethrowDatabaseError(error, 'The rate could not be saved.')
  }
}

/** Closes overlapping ACTIVE cards so a replacement rate can start at `effectiveTo`. */
export async function supersedeActiveRates(input: {
  vehicleId: string
  organizationId: string
  rateType: RateType
  effectiveTo: Date
  rateIds: readonly string[]
}): Promise<void> {
  const vehicleId = toObjectId(input.vehicleId)
  const organizationId = toObjectId(input.organizationId)
  const ids = input.rateIds.map((id) => toObjectId(id)).filter(Boolean)
  if (!vehicleId || !organizationId || ids.length === 0) return

  try {
    await VehicleRateCard.updateMany(
      {
        _id: { $in: ids },
        vehicleId,
        organizationId,
        rateType: input.rateType,
        status: RATE_STATUSES.ACTIVE,
      },
      {
        $set: {
          status: RATE_STATUSES.SUPERSEDED,
          effectiveTo: input.effectiveTo,
        },
      },
    )
  } catch (error) {
    rethrowDatabaseError(error, 'The previous rate could not be closed.')
  }
}
