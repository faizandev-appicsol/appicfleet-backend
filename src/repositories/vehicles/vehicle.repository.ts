import type { FilterQuery, SortOrder } from 'mongoose'
import {
  VEHICLE_STATUSES,
  type ComplianceState,
  type OwnershipType,
  type VehicleFuelType,
  type VehicleSortField,
  type VehicleStatus,
  type VehicleTransmission,
} from '../../constants/vehicles.js'
import { rethrowDatabaseError } from '../../exceptions/mongooseError.js'
import type {
  IVehicle,
  IVehicleCompliance,
  IVehicleOwnership,
} from '../../interfaces/vehicle.interface.js'
import { Vehicle } from '../../models/vehicle.model.js'
import { escapeRegex, omitUndefined, toObjectId, toObjectIds } from '../object-id.js'

export type VehicleRecord = {
  id: string
  organizationId: string
  legalEntityId: string
  branchId: string
  plateNumber: string
  vin?: string
  make: string
  model: string
  year: number
  color?: string
  category: string
  transmission: VehicleTransmission
  fuelType: VehicleFuelType
  seatingCapacity: number
  engineNumber?: string
  mileageKm: number
  purchasedOn?: Date
  salikTagNumber?: string
  mulkiyaNumber?: string
  latitude?: string
  longitude?: string
  featureOnWebsite: boolean
  notes?: string
  ownershipType: OwnershipType
  ownership?: IVehicleOwnership
  status: VehicleStatus
  compliance: IVehicleCompliance
  complianceState: ComplianceState
  photoStorageKey?: string
  photoMimeType?: string
  deletedAt?: Date
  deletedBy?: string
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

type PersistableVehicle = {
  _id: { toString(): string }
  organizationId: { toString(): string }
  legalEntityId: { toString(): string }
  branchId: { toString(): string }
  plateNumber: string
  vin?: string | null
  make: string
  model: string
  year: number
  color?: string | null
  category: string
  transmission: string
  fuelType: string
  seatingCapacity: number
  engineNumber?: string | null
  mileageKm: number
  purchasedOn?: Date | null
  salikTagNumber?: string | null
  mulkiyaNumber?: string | null
  latitude?: string | null
  longitude?: string | null
  featureOnWebsite?: boolean | null
  notes?: string | null
  ownershipType: string
  ownership?: IVehicleOwnership | null
  status: string
  compliance?: IVehicleCompliance | null
  complianceState: string
  photoStorageKey?: string | null
  photoMimeType?: string | null
  deletedAt?: Date | null
  deletedBy?: { toString(): string } | null
  createdBy: { toString(): string }
  createdAt: Date
  updatedAt: Date
}

/** Active (non-soft-deleted) vehicles only. */
const NOT_DELETED: FilterQuery<IVehicle> = { deletedAt: null }

function toOwnership(value: IVehicleOwnership | null | undefined): IVehicleOwnership | undefined {
  if (!value) return undefined
  const result = omitUndefined({
    investorName: value.investorName,
    investorReference: value.investorReference,
    lenderName: value.lenderName,
    expectedReturnOn: value.expectedReturnOn,
    lessorName: value.lessorName,
    leaseStartsOn: value.leaseStartsOn,
    leaseEndsOn: value.leaseEndsOn,
    leaseAmount: value.leaseAmount,
    leaseCurrency: value.leaseCurrency,
    purchasePrice: value.purchasePrice,
    downPayment: value.downPayment,
    financedAmount: value.financedAmount,
    interestRate: value.interestRate,
    numberOfInstallments: value.numberOfInstallments,
  })
  return Object.keys(result).length > 0 ? result : undefined
}

function toRecord(doc: PersistableVehicle): VehicleRecord {
  return {
    id: doc._id.toString(),
    organizationId: doc.organizationId.toString(),
    legalEntityId: doc.legalEntityId.toString(),
    branchId: doc.branchId.toString(),
    plateNumber: doc.plateNumber,
    vin: doc.vin ?? undefined,
    make: doc.make,
    model: doc.model,
    year: doc.year,
    color: doc.color ?? undefined,
    category: doc.category,
    transmission: doc.transmission as VehicleTransmission,
    fuelType: doc.fuelType as VehicleFuelType,
    seatingCapacity: doc.seatingCapacity,
    engineNumber: doc.engineNumber ?? undefined,
    mileageKm: doc.mileageKm,
    purchasedOn: doc.purchasedOn ?? undefined,
    salikTagNumber: doc.salikTagNumber ?? undefined,
    mulkiyaNumber: doc.mulkiyaNumber ?? undefined,
    latitude: doc.latitude ?? undefined,
    longitude: doc.longitude ?? undefined,
    featureOnWebsite: Boolean(doc.featureOnWebsite),
    notes: doc.notes ?? undefined,
    ownershipType: doc.ownershipType as OwnershipType,
    ownership: toOwnership(doc.ownership),
    status: doc.status as VehicleStatus,
    compliance: {
      registrationExpiresOn: doc.compliance?.registrationExpiresOn ?? undefined,
      insuranceExpiresOn: doc.compliance?.insuranceExpiresOn ?? undefined,
      inspectionExpiresOn: doc.compliance?.inspectionExpiresOn ?? undefined,
    },
    complianceState: doc.complianceState as ComplianceState,
    photoStorageKey: doc.photoStorageKey ?? undefined,
    photoMimeType: doc.photoMimeType ?? undefined,
    deletedAt: doc.deletedAt ?? undefined,
    deletedBy: doc.deletedBy ? doc.deletedBy.toString() : undefined,
    createdBy: doc.createdBy.toString(),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

const DUPLICATE_MESSAGE = 'A vehicle with this plate number or VIN already exists in the organization.'

export async function findVehicleById(
  id: string,
  options?: { includeDeleted?: boolean },
): Promise<VehicleRecord | null> {
  const objectId = toObjectId(id)
  if (!objectId) return null
  const doc = await Vehicle.findById(objectId).lean()
  if (!doc) return null
  const record = toRecord(doc)
  if (record.deletedAt && !options?.includeDeleted) return null
  return record
}

/** Exact plate match within one tenant. Used by fine/toll imports. */
export async function findVehicleByPlateInOrganization(
  organizationId: string,
  plateNumber: string,
): Promise<VehicleRecord | null> {
  const orgId = toObjectId(organizationId)
  if (!orgId || !plateNumber.trim()) return null
  const doc = await Vehicle.findOne({
    organizationId: orgId,
    plateNumber: plateNumber.trim().toUpperCase(),
    ...NOT_DELETED,
  }).lean()
  return doc ? toRecord(doc as Parameters<typeof toRecord>[0]) : null
}

export type ListVehiclesInput = {
  organizationId: string
  skip: number
  take: number
  search?: string
  status?: VehicleStatus
  ownershipType?: OwnershipType
  complianceState?: ComplianceState
  /** Case-insensitive exact match on free-text vehicle type. */
  category?: string
  /** Restricts the result to these branches (`$in`). Empty array matches nothing. */
  branchIds?: readonly string[]
  /** Restricts the result to these legal entities (`$in`). Empty array matches nothing. */
  legalEntityIds?: readonly string[]
  sort: VehicleSortField
  order: 'asc' | 'desc'
}

export async function listVehicles(
  input: ListVehiclesInput,
): Promise<{ items: VehicleRecord[]; total: number }> {
  const organizationId = toObjectId(input.organizationId)
  if (!organizationId) return { items: [], total: 0 }

  const filter: FilterQuery<IVehicle> = { organizationId, ...NOT_DELETED }
  if (input.status) filter.status = input.status
  if (input.ownershipType) filter.ownershipType = input.ownershipType
  if (input.complianceState) filter.complianceState = input.complianceState
  if (input.category?.trim()) {
    filter.category = { $regex: `^${escapeRegex(input.category.trim())}$`, $options: 'i' }
  }
  if (input.branchIds) filter.branchId = { $in: toObjectIds(input.branchIds) }
  if (input.legalEntityIds) filter.legalEntityId = { $in: toObjectIds(input.legalEntityIds) }
  if (input.search) {
    const pattern = { $regex: escapeRegex(input.search), $options: 'i' }
    filter.$or = [
      { plateNumber: pattern },
      { vin: pattern },
      { make: pattern },
      { model: pattern },
      { category: pattern },
    ]
  }

  const direction: SortOrder = input.order === 'asc' ? 1 : -1
  const sort: Record<string, SortOrder> = { [input.sort]: direction, _id: direction }

  try {
    const [items, total] = await Promise.all([
      Vehicle.find(filter).sort(sort).skip(input.skip).limit(input.take).lean(),
      Vehicle.countDocuments(filter),
    ])
    return { items: items.map(toRecord), total }
  } catch (error) {
    rethrowDatabaseError(error, 'Vehicles could not be loaded.')
  }
}

export type VehicleStatusCountsInput = {
  organizationId: string
  search?: string
  ownershipType?: OwnershipType
  complianceState?: ComplianceState
  branchIds?: readonly string[]
  legalEntityIds?: readonly string[]
  category?: string
}

/** Counts vehicles by status for register KPI cards (same filters as the list, ignoring status). */
export async function countVehiclesByStatus(
  input: VehicleStatusCountsInput,
): Promise<{ total: number; byStatus: Record<string, number> }> {
  const organizationId = toObjectId(input.organizationId)
  if (!organizationId) return { total: 0, byStatus: {} }

  const filter: FilterQuery<IVehicle> = { organizationId, ...NOT_DELETED }
  if (input.ownershipType) filter.ownershipType = input.ownershipType
  if (input.complianceState) filter.complianceState = input.complianceState
  if (input.branchIds) filter.branchId = { $in: toObjectIds(input.branchIds) }
  if (input.legalEntityIds) filter.legalEntityId = { $in: toObjectIds(input.legalEntityIds) }
  if (input.category?.trim()) {
    filter.category = { $regex: `^${escapeRegex(input.category.trim())}$`, $options: 'i' }
  }
  if (input.search) {
    const pattern = { $regex: escapeRegex(input.search), $options: 'i' }
    filter.$or = [
      { plateNumber: pattern },
      { vin: pattern },
      { make: pattern },
      { model: pattern },
      { category: pattern },
    ]
  }

  try {
    const rows = await Vehicle.aggregate<{ _id: string; count: number }>([
      { $match: filter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ])
    const byStatus: Record<string, number> = {}
    let total = 0
    for (const row of rows) {
      byStatus[row._id] = row.count
      total += row.count
    }
    return { total, byStatus }
  } catch (error) {
    rethrowDatabaseError(error, 'Vehicle stats could not be loaded.')
  }
}

export type NewVehicle = {
  organizationId: string
  legalEntityId: string
  branchId: string
  plateNumber: string
  vin?: string
  make: string
  model: string
  year: number
  color?: string
  category: string
  transmission: VehicleTransmission
  fuelType: VehicleFuelType
  seatingCapacity: number
  engineNumber?: string
  mileageKm: number
  purchasedOn?: Date
  salikTagNumber?: string
  mulkiyaNumber?: string
  latitude?: string
  longitude?: string
  featureOnWebsite?: boolean
  notes?: string
  ownershipType: OwnershipType
  ownership?: IVehicleOwnership
  status: VehicleStatus
  compliance: IVehicleCompliance
  complianceState: ComplianceState
  createdBy: string
}

export async function createVehicle(input: NewVehicle): Promise<VehicleRecord> {
  try {
    const doc = await Vehicle.create({
      ...omitUndefined({ ...input }),
      organizationId: toObjectId(input.organizationId),
      legalEntityId: toObjectId(input.legalEntityId),
      branchId: toObjectId(input.branchId),
      createdBy: toObjectId(input.createdBy),
      ownership: input.ownership ? omitUndefined({ ...input.ownership }) : undefined,
      compliance: omitUndefined({ ...input.compliance }),
    })
    return toRecord(doc)
  } catch (error) {
    rethrowDatabaseError(error, DUPLICATE_MESSAGE)
  }
}

/** `null` clears an optional field; `undefined` leaves it untouched. */
export type VehicleUpdate = {
  plateNumber?: string
  vin?: string | null
  make?: string
  model?: string
  year?: number
  color?: string | null
  category?: string
  transmission?: VehicleTransmission
  fuelType?: VehicleFuelType
  seatingCapacity?: number
  engineNumber?: string | null
  mileageKm?: number
  purchasedOn?: Date | null
  salikTagNumber?: string | null
  mulkiyaNumber?: string | null
  latitude?: string | null
  longitude?: string | null
  featureOnWebsite?: boolean
  notes?: string | null
  branchId?: string
  legalEntityId?: string
  ownershipType?: OwnershipType
  ownership?: IVehicleOwnership | null
  compliance?: {
    registrationExpiresOn?: Date | null
    insuranceExpiresOn?: Date | null
    inspectionExpiresOn?: Date | null
  }
  complianceState?: ComplianceState
  photoStorageKey?: string | null
  photoMimeType?: string | null
}

function buildUpdate(input: VehicleUpdate): {
  $set: Record<string, unknown>
  $unset: Record<string, ''>
} {
  const { compliance, ownership, branchId, legalEntityId, ...plain } = input
  const $set: Record<string, unknown> = {}
  const $unset: Record<string, ''> = {}

  for (const [key, value] of Object.entries(plain)) {
    if (value === undefined) continue
    if (value === null) $unset[key] = ''
    else $set[key] = value
  }
  if (branchId !== undefined) $set.branchId = toObjectId(branchId)
  if (legalEntityId !== undefined) $set.legalEntityId = toObjectId(legalEntityId)

  if (ownership === null) $unset.ownership = ''
  else if (ownership !== undefined) $set.ownership = omitUndefined({ ...ownership })

  if (compliance) {
    for (const [key, value] of Object.entries(compliance)) {
      if (value === undefined) continue
      if (value === null) $unset[`compliance.${key}`] = ''
      else $set[`compliance.${key}`] = value
    }
  }
  return { $set, $unset }
}

/** Scoped by organizationId so a vehicle can never be updated through another tenant. */
export async function updateVehicle(
  id: string,
  organizationId: string,
  input: VehicleUpdate,
): Promise<VehicleRecord | null> {
  const objectId = toObjectId(id)
  const orgId = toObjectId(organizationId)
  if (!objectId || !orgId) return null

  const { $set, $unset } = buildUpdate(input)
  const update: Record<string, unknown> = {}
  if (Object.keys($set).length > 0) update.$set = $set
  if (Object.keys($unset).length > 0) update.$unset = $unset

  try {
    const doc = await Vehicle.findOneAndUpdate(
      { _id: objectId, organizationId: orgId, ...NOT_DELETED },
      update,
      {
        new: true,
        runValidators: true,
      },
    ).lean()
    return doc ? toRecord(doc) : null
  } catch (error) {
    rethrowDatabaseError(error, DUPLICATE_MESSAGE)
  }
}

/**
 * Compare-and-set status change: succeeds only if the vehicle is still in `from`.
 * Returns null when the vehicle is gone or its status changed concurrently.
 */
export async function transitionVehicleStatus(
  id: string,
  organizationId: string,
  from: VehicleStatus,
  to: VehicleStatus,
): Promise<VehicleRecord | null> {
  const objectId = toObjectId(id)
  const orgId = toObjectId(organizationId)
  if (!objectId || !orgId) return null
  const doc = await Vehicle.findOneAndUpdate(
    { _id: objectId, organizationId: orgId, status: from, ...NOT_DELETED },
    { $set: { status: to } },
    { new: true },
  ).lean()
  return doc ? toRecord(doc) : null
}

/**
 * Soft-deletes a vehicle (sets deletedAt). Documents are never hard-removed.
 * Returns null when the vehicle is missing, already deleted, or in another tenant.
 */
export async function softDeleteVehicle(
  id: string,
  organizationId: string,
  deletedBy: string,
): Promise<VehicleRecord | null> {
  const objectId = toObjectId(id)
  const orgId = toObjectId(organizationId)
  const actorId = toObjectId(deletedBy)
  if (!objectId || !orgId || !actorId) return null

  const doc = await Vehicle.findOneAndUpdate(
    { _id: objectId, organizationId: orgId, ...NOT_DELETED },
    {
      $set: {
        deletedAt: new Date(),
        deletedBy: actorId,
        status: VEHICLE_STATUSES.INACTIVE,
      },
    },
    { new: true },
  ).lean()
  return doc ? toRecord(doc) : null
}
