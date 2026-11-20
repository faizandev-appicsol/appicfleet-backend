import type { Types } from 'mongoose'
import type {
  AssignmentStatus,
  ComplianceState,
  DocumentStatus,
  DocumentType,
  OwnershipType,
  RateStatus,
  RateType,
  VehicleFuelType,
  VehicleStatus,
  VehicleTransmission,
} from '../constants/vehicles.js'

export interface IVehicleOwnership {
  /** INVESTOR */
  investorName?: string
  investorReference?: string
  /** BORROWED */
  lenderName?: string
  expectedReturnOn?: Date
  /** LEASED */
  lessorName?: string
  leaseStartsOn?: Date
  leaseEndsOn?: Date
  /** Decimal string, e.g. "1500.00". */
  leaseAmount?: string
  /** ISO 4217 */
  leaseCurrency?: string
  /** Finance / lease schedule extras (optional). */
  purchasePrice?: string
  downPayment?: string
  financedAmount?: string
  /** Percent as decimal string, e.g. "5.5". */
  interestRate?: string
  numberOfInstallments?: number
}

export interface IVehicleCompliance {
  registrationExpiresOn?: Date
  insuranceExpiresOn?: Date
  inspectionExpiresOn?: Date
}

export interface IVehicle {
  organizationId: Types.ObjectId
  legalEntityId: Types.ObjectId
  branchId: Types.ObjectId
  /** Uppercase, unique within the organization. */
  plateNumber: string
  /** Omitted (never null/empty) when unknown; unique within the organization when present. */
  vin?: string
  make: string
  model: string
  year: number
  color?: string
  /** Free-text vehicle type label (e.g. Sedan, SUV, Hatchback). */
  category: string
  transmission: VehicleTransmission
  fuelType: VehicleFuelType
  seatingCapacity: number
  engineNumber?: string
  mileageKm: number
  /** Purchase / acquisition calendar date when known. */
  purchasedOn?: Date
  salikTagNumber?: string
  mulkiyaNumber?: string
  latitude?: string
  longitude?: string
  /** When true, the vehicle may be featured on the public website. */
  featureOnWebsite?: boolean
  notes?: string
  ownershipType: OwnershipType
  ownership?: IVehicleOwnership
  status: VehicleStatus
  compliance?: IVehicleCompliance
  /** Denormalized overall compliance state, recomputed on every write of the compliance dates. */
  complianceState: ComplianceState
  /** Opaque object-store key for the primary vehicle photo. Never a URL. */
  photoStorageKey?: string
  /** MIME type of the primary photo (`image/jpeg`, `image/png`, or `image/webp`). */
  photoMimeType?: string
  /** Soft-delete timestamp. When set, the vehicle is hidden from registers and lookups. */
  deletedAt?: Date
  deletedBy?: Types.ObjectId
  createdBy: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

export interface IVehicleStatusEvent {
  vehicleId: Types.ObjectId
  organizationId: Types.ObjectId
  branchId: Types.ObjectId
  fromStatus: VehicleStatus
  toStatus: VehicleStatus
  reason: string
  actorUserId: Types.ObjectId
  createdAt: Date
}

export interface IVehicleDocument {
  vehicleId: Types.ObjectId
  organizationId: Types.ObjectId
  documentType: DocumentType
  documentNumber?: string
  issuedOn?: Date
  expiresOn?: Date
  /** Opaque object-store key. Never a URL and never a credential. */
  storageKey: string
  status: DocumentStatus
  uploadedBy: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

export interface IVehicleRateCard {
  vehicleId: Types.ObjectId
  organizationId: Types.ObjectId
  rateType: RateType
  /** Decimal string, e.g. "150.00". */
  amount: string
  currency: string
  effectiveFrom: Date
  /** null = open-ended. */
  effectiveTo: Date | null
  status: RateStatus
  createdBy: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

export interface IVehicleAssignment {
  vehicleId: Types.ObjectId
  organizationId: Types.ObjectId
  branchId: Types.ObjectId
  startsAt: Date
  endsAt: Date
  /** End stored at creation. Extensions move `endsAt`; this value stays. */
  plannedEndsAt?: Date
  /** Set when a replacement closes the window early. The vehicle id is never rewritten. */
  closedAt?: Date
  reason: string
  status: AssignmentStatus
  createdBy: Types.ObjectId
  createdAt: Date
  updatedAt: Date
  /** Set when a contract adopts or creates the window. Bookings leave this empty. */
  contractId?: Types.ObjectId
  assignmentType?: string
  sourceAssignmentId?: Types.ObjectId
  /** Plate at the time the window was written. Later vehicle edits do not change it. */
  vehiclePlate?: string
}

export interface IVehicleLock {
  vehicleId: Types.ObjectId
  token: string
  lockedUntil: Date
}
