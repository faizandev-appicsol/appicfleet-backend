import { Schema, model } from 'mongoose'
import {
  COMPLIANCE_STATES,
  OWNERSHIP_TYPES,
  VEHICLE_FUEL_TYPES,
  VEHICLE_STATUSES,
  VEHICLE_TRANSMISSIONS,
} from '../constants/vehicles.js'
import type { IVehicle } from '../interfaces/vehicle.interface.js'
import { MONEY_REGEX } from '../utils/money.js'

const ownershipSchema = new Schema(
  {
    investorName: { type: String, trim: true, maxlength: 120 },
    investorReference: { type: String, trim: true, maxlength: 80 },
    lenderName: { type: String, trim: true, maxlength: 120 },
    expectedReturnOn: { type: Date },
    lessorName: { type: String, trim: true, maxlength: 120 },
    leaseStartsOn: { type: Date },
    leaseEndsOn: { type: Date },
    leaseAmount: { type: String, trim: true, match: MONEY_REGEX },
    leaseCurrency: { type: String, uppercase: true, trim: true, match: /^[A-Z]{3}$/ },
    purchasePrice: { type: String, trim: true, match: MONEY_REGEX },
    downPayment: { type: String, trim: true, match: MONEY_REGEX },
    financedAmount: { type: String, trim: true, match: MONEY_REGEX },
    interestRate: {
      type: String,
      trim: true,
      maxlength: 8,
      match: /^\d{1,3}(\.\d{1,4})?$/,
    },
    numberOfInstallments: { type: Number, min: 1, max: 600, validate: Number.isInteger },
  },
  { _id: false },
)

const complianceSchema = new Schema(
  {
    registrationExpiresOn: { type: Date },
    insuranceExpiresOn: { type: Date },
    inspectionExpiresOn: { type: Date },
  },
  { _id: false },
)

const vehicleSchema = new Schema<IVehicle>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    plateNumber: { type: String, required: true, uppercase: true, trim: true, maxlength: 20 },
    // No default: the field is omitted when unknown so the partial unique index ignores it.
    vin: { type: String, uppercase: true, trim: true, maxlength: 32 },
    make: { type: String, required: true, trim: true, maxlength: 60 },
    model: { type: String, required: true, trim: true, maxlength: 60 },
    year: { type: Number, required: true, min: 1980, max: 2100, validate: Number.isInteger },
    color: { type: String, trim: true, maxlength: 40 },
    /** Free-text vehicle type (Sedan, SUV, custom…). Catalogued per user like make. */
    category: { type: String, required: true, trim: true, maxlength: 60 },
    transmission: { type: String, required: true, enum: Object.values(VEHICLE_TRANSMISSIONS) },
    fuelType: { type: String, required: true, enum: Object.values(VEHICLE_FUEL_TYPES) },
    seatingCapacity: { type: Number, required: true, min: 1, max: 60, validate: Number.isInteger },
    engineNumber: { type: String, trim: true, maxlength: 60 },
    mileageKm: { type: Number, required: true, min: 0, default: 0, validate: Number.isInteger },
    purchasedOn: { type: Date },
    salikTagNumber: { type: String, trim: true, maxlength: 40 },
    mulkiyaNumber: { type: String, trim: true, maxlength: 60 },
    latitude: { type: String, trim: true, maxlength: 24 },
    longitude: { type: String, trim: true, maxlength: 24 },
    featureOnWebsite: { type: Boolean, default: false },
    notes: { type: String, trim: true, maxlength: 2000 },
    ownershipType: { type: String, required: true, enum: Object.values(OWNERSHIP_TYPES) },
    ownership: { type: ownershipSchema },
    status: {
      type: String,
      required: true,
      enum: Object.values(VEHICLE_STATUSES),
      default: VEHICLE_STATUSES.AVAILABLE,
    },
    compliance: { type: complianceSchema },
    complianceState: {
      type: String,
      required: true,
      enum: Object.values(COMPLIANCE_STATES),
      default: COMPLIANCE_STATES.MISSING,
    },
    photoStorageKey: { type: String, trim: true, maxlength: 300 },
    photoMimeType: { type: String, trim: true, maxlength: 40 },
    /** Soft delete — never hard-remove vehicle documents. */
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, collection: 'vehicles' },
)

vehicleSchema.index(
  { organizationId: 1, plateNumber: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
)
vehicleSchema.index(
  { organizationId: 1, vin: 1 },
  {
    unique: true,
    partialFilterExpression: { vin: { $type: 'string' }, deletedAt: null },
  },
)
vehicleSchema.index({ organizationId: 1, branchId: 1, status: 1 })
vehicleSchema.index({ organizationId: 1, status: 1 })
vehicleSchema.index({ organizationId: 1, complianceState: 1 })
vehicleSchema.index({ organizationId: 1, createdAt: -1 })
vehicleSchema.index({ organizationId: 1, deletedAt: 1 })

export const Vehicle = model<IVehicle>('Vehicle', vehicleSchema)
