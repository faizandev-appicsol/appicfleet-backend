import {
  VEHICLE_CATEGORIES,
  toPublicEnum,
  type ComplianceState,
} from '../../constants/vehicles.js'
import type { IVehicleOwnership } from '../../interfaces/vehicle.interface.js'
import type { VehicleRecord } from '../../repositories/vehicles/vehicle.repository.js'
import type { VehicleStatusEventRecord } from '../../repositories/vehicles/vehicle-status-event.repository.js'
import { evaluateCompliance } from './compliance.js'

/** Legacy enum values stored UPPERCASE; free-text types are returned as entered. */
const LEGACY_CATEGORY_DISPLAY: Record<string, string> = {
  [VEHICLE_CATEGORIES.SEDAN]: 'Sedan',
  [VEHICLE_CATEGORIES.SUV]: 'SUV',
  [VEHICLE_CATEGORIES.VAN]: 'Van',
  [VEHICLE_CATEGORIES.TRUCK]: 'Truck',
  [VEHICLE_CATEGORIES.OTHER]: 'Other',
}

function toPublicCategory(value: string): string {
  return LEGACY_CATEGORY_DISPLAY[value.toUpperCase()] ?? value
}

export function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function optionalDateOnly(date: Date | undefined): string | undefined {
  return date ? toDateOnly(date) : undefined
}

export type VehicleListResource = {
  id: string
  plateNumber: string
  make: string
  model: string
  year: number
  color?: string
  category: string
  status: string
  ownershipType: string
  /** Investor / lender / lessor display name when applicable. */
  ownershipParty?: string
  mileageKm: number
  branchId: string
  legalEntityId: string
  complianceState: ComplianceState
  /** True when a primary photo is stored (fetch via GET /vehicles/:id/photo). */
  hasPhoto: boolean
  createdAt: string
}

function ownershipPartyName(vehicle: VehicleRecord): string | undefined {
  const ownership = vehicle.ownership
  if (!ownership) return undefined
  switch (vehicle.ownershipType) {
    case 'INVESTOR':
      return ownership.investorName
    case 'BORROWED':
      return ownership.lenderName
    case 'LEASED':
      return ownership.lessorName
    default:
      return undefined
  }
}

export type OwnershipResource = {
  investorName?: string
  investorReference?: string
  lenderName?: string
  expectedReturnOn?: string
  lessorName?: string
  leaseStartsOn?: string
  leaseEndsOn?: string
  leaseAmount?: string
  leaseCurrency?: string
  purchasePrice?: string
  downPayment?: string
  financedAmount?: string
  interestRate?: string
  numberOfInstallments?: number
}

export type ComplianceItemResource = { expiresOn: string | null; state: ComplianceState }

export type VehicleResource = Omit<VehicleListResource, 'complianceState'> & {
  organizationId: string
  vin?: string
  color?: string
  transmission: string
  fuelType: string
  seatingCapacity: number
  engineNumber?: string
  mileageKm: number
  purchasedOn?: string
  salikTagNumber?: string
  mulkiyaNumber?: string
  latitude?: string
  longitude?: string
  featureOnWebsite: boolean
  notes?: string
  ownership?: OwnershipResource
  compliance: {
    registration: ComplianceItemResource
    insurance: ComplianceItemResource
    inspection: ComplianceItemResource
    overall: ComplianceState
  }
  createdBy: string
  updatedAt: string
}

function toOwnershipResource(ownership: IVehicleOwnership | undefined): OwnershipResource | undefined {
  if (!ownership) return undefined
  return {
    investorName: ownership.investorName,
    investorReference: ownership.investorReference,
    lenderName: ownership.lenderName,
    expectedReturnOn: optionalDateOnly(ownership.expectedReturnOn),
    lessorName: ownership.lessorName,
    leaseStartsOn: optionalDateOnly(ownership.leaseStartsOn),
    leaseEndsOn: optionalDateOnly(ownership.leaseEndsOn),
    leaseAmount: ownership.leaseAmount,
    leaseCurrency: ownership.leaseCurrency,
    purchasePrice: ownership.purchasePrice,
    downPayment: ownership.downPayment,
    financedAmount: ownership.financedAmount,
    interestRate: ownership.interestRate,
    numberOfInstallments: ownership.numberOfInstallments,
  }
}

/**
 * Slim list row. The compliance state is evaluated at read time from the stored dates, so it is
 * never stale in the response (the stored `complianceState` only powers the list filter).
 */
export function toVehicleListResource(vehicle: VehicleRecord, now: Date): VehicleListResource {
  const party = ownershipPartyName(vehicle)
  return {
    id: vehicle.id,
    plateNumber: vehicle.plateNumber,
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year,
    color: vehicle.color,
    category: toPublicCategory(vehicle.category),
    status: toPublicEnum(vehicle.status),
    ownershipType: toPublicEnum(vehicle.ownershipType),
    ownershipParty: party,
    mileageKm: vehicle.mileageKm,
    branchId: vehicle.branchId,
    legalEntityId: vehicle.legalEntityId,
    complianceState: evaluateCompliance(vehicle.compliance, now).overall,
    hasPhoto: Boolean(vehicle.photoStorageKey),
    createdAt: vehicle.createdAt.toISOString(),
  }
}

export function toVehicleResource(vehicle: VehicleRecord, now: Date): VehicleResource {
  const states = evaluateCompliance(vehicle.compliance, now)
  const { registrationExpiresOn, insuranceExpiresOn, inspectionExpiresOn } = vehicle.compliance
  return {
    id: vehicle.id,
    organizationId: vehicle.organizationId,
    plateNumber: vehicle.plateNumber,
    vin: vehicle.vin,
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year,
    color: vehicle.color,
    category: toPublicCategory(vehicle.category),
    transmission: toPublicEnum(vehicle.transmission),
    fuelType: toPublicEnum(vehicle.fuelType),
    seatingCapacity: vehicle.seatingCapacity,
    engineNumber: vehicle.engineNumber,
    mileageKm: vehicle.mileageKm,
    purchasedOn: optionalDateOnly(vehicle.purchasedOn),
    salikTagNumber: vehicle.salikTagNumber,
    mulkiyaNumber: vehicle.mulkiyaNumber,
    latitude: vehicle.latitude,
    longitude: vehicle.longitude,
    featureOnWebsite: Boolean(vehicle.featureOnWebsite),
    notes: vehicle.notes,
    status: toPublicEnum(vehicle.status),
    ownershipType: toPublicEnum(vehicle.ownershipType),
    ownership: toOwnershipResource(vehicle.ownership),
    branchId: vehicle.branchId,
    legalEntityId: vehicle.legalEntityId,
    compliance: {
      registration: {
        expiresOn: registrationExpiresOn ? toDateOnly(registrationExpiresOn) : null,
        state: states.registration,
      },
      insurance: {
        expiresOn: insuranceExpiresOn ? toDateOnly(insuranceExpiresOn) : null,
        state: states.insurance,
      },
      inspection: {
        expiresOn: inspectionExpiresOn ? toDateOnly(inspectionExpiresOn) : null,
        state: states.inspection,
      },
      overall: states.overall,
    },
    hasPhoto: Boolean(vehicle.photoStorageKey),
    createdBy: vehicle.createdBy,
    createdAt: vehicle.createdAt.toISOString(),
    updatedAt: vehicle.updatedAt.toISOString(),
  }
}

export type VehicleStatusEventResource = {
  id: string
  vehicleId: string
  branchId: string
  fromStatus: string
  toStatus: string
  reason: string
  actorUserId: string
  createdAt: string
}

export function toStatusEventResource(event: VehicleStatusEventRecord): VehicleStatusEventResource {
  return {
    id: event.id,
    vehicleId: event.vehicleId,
    branchId: event.branchId,
    fromStatus: toPublicEnum(event.fromStatus),
    toStatus: toPublicEnum(event.toStatus),
    reason: event.reason,
    actorUserId: event.actorUserId,
    createdAt: event.createdAt.toISOString(),
  }
}
