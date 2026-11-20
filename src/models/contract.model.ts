import { Schema, model } from 'mongoose'
import {
  CHARGE_KINDS,
  CONTRACT_STATUSES,
  CONTRACT_TYPES,
  REPLACEMENT_STATUSES,
  SIGNATURE_STATUSES,
  TERMS_STATUSES,
} from '../constants/contracts.js'

const snapshotSchema = new Schema(
  {
    customerNumber: { type: String, required: true },
    displayName: { type: String, required: true },
    type: { type: String, required: true },
    email: { type: String },
    phone: { type: String },
    companyName: { type: String },
  },
  { _id: false },
)

const contractSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    contractNumber: { type: String, required: true, trim: true, maxlength: 32 },
    type: { type: String, required: true, enum: Object.values(CONTRACT_TYPES) },
    status: { type: String, required: true, enum: Object.values(CONTRACT_STATUSES) },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    customerSnapshot: { type: snapshotSchema },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
    /** Pointer to the vehicle of the open window. History lives on vehicle_assignments. */
    currentVehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle' },
    currentPlate: { type: String, trim: true, maxlength: 20 },
    currentVin: { type: String, trim: true, maxlength: 32 },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    /** Set at activation. Extensions do not change it. */
    originalEndsAt: { type: Date },
    currency: { type: String, trim: true, uppercase: true, maxlength: 3 },
    driverName: { type: String, trim: true, maxlength: 200 },
    authorizedContactName: { type: String, trim: true, maxlength: 200 },
    lenderName: { type: String, trim: true, maxlength: 200 },
    borrowCost: { type: String, trim: true, maxlength: 20 },
    notes: { type: String, trim: true, maxlength: 2000 },
    acceptedTermsVersionId: { type: Schema.Types.ObjectId },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    activatedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, collection: 'contracts' },
)

contractSchema.index({ organizationId: 1, contractNumber: 1 }, { unique: true })
contractSchema.index({ organizationId: 1, branchId: 1, status: 1, startsAt: 1 })
contractSchema.index({ organizationId: 1, customerId: 1, startsAt: 1 })
contractSchema.index({ organizationId: 1, currentVehicleId: 1, startsAt: 1 })
contractSchema.index(
  { bookingId: 1 },
  { unique: true, partialFilterExpression: { bookingId: { $type: 'objectId' } } },
)

const termsSchema = new Schema(
  {
    contractId: { type: Schema.Types.ObjectId, ref: 'Contract', required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    version: { type: Number, required: true, min: 1 },
    content: { type: String, required: true, maxlength: 20000 },
    status: { type: String, required: true, enum: Object.values(TERMS_STATUSES) },
    effectiveAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'contract_terms_versions' },
)
termsSchema.index({ contractId: 1, version: 1 }, { unique: true })

const chargeSchema = new Schema(
  {
    contractId: { type: Schema.Types.ObjectId, ref: 'Contract', required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    kind: { type: String, required: true, enum: Object.values(CHARGE_KINDS) },
    sourceId: { type: String, required: true },
    supersededBy: { type: String },
    currency: { type: String, required: true },
    unitAmount: { type: String, required: true },
    quantityDays: { type: Number, required: true, min: 1 },
    totalAmount: { type: String, required: true },
    rateType: { type: String, required: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'contract_charges' },
)
chargeSchema.index({ contractId: 1, kind: 1, sourceId: 1 }, { unique: true })

const amendmentSchema = new Schema(
  {
    contractId: { type: Schema.Types.ObjectId, ref: 'Contract', required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    previousChargeId: { type: Schema.Types.ObjectId, required: true },
    previousTotal: { type: String, required: true },
    newUnitAmount: { type: String, required: true },
    newTotal: { type: String, required: true },
    currency: { type: String, required: true },
    quantityDays: { type: Number, required: true },
    reason: { type: String, required: true, maxlength: 500 },
    effectiveAt: { type: Date, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'contract_pricing_amendments' },
)
amendmentSchema.index({ contractId: 1, createdAt: 1 })

const extensionSchema = new Schema(
  {
    contractId: { type: Schema.Types.ObjectId, ref: 'Contract', required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    assignmentId: { type: Schema.Types.ObjectId, ref: 'VehicleAssignment', required: true },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    currency: { type: String, required: true },
    unitAmount: { type: String, required: true },
    quantityDays: { type: Number, required: true },
    totalAmount: { type: String, required: true },
    rateType: { type: String, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'contract_extensions' },
)
extensionSchema.index({ contractId: 1, startsAt: 1 }, { unique: true })

const replacementSchema = new Schema(
  {
    contractId: { type: Schema.Types.ObjectId, ref: 'Contract', required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    previousVehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },
    replacementVehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },
    previousAssignmentId: { type: Schema.Types.ObjectId, ref: 'VehicleAssignment', required: true },
    replacementAssignmentId: { type: Schema.Types.ObjectId, ref: 'VehicleAssignment', required: true },
    previousPlate: { type: String, required: true },
    replacementPlate: { type: String, required: true },
    reason: { type: String, required: true, maxlength: 500 },
    notes: { type: String, maxlength: 2000 },
    status: { type: String, required: true, enum: Object.values(REPLACEMENT_STATUSES) },
    occurredAt: { type: Date, required: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'contract_replacements' },
)
replacementSchema.index({ contractId: 1, occurredAt: 1 })

const handoverSchema = new Schema(
  {
    contractId: { type: Schema.Types.ObjectId, ref: 'Contract', required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    assignmentId: { type: Schema.Types.ObjectId, ref: 'VehicleAssignment', required: true },
    occurredAt: { type: Date, required: true },
    mileageKm: { type: Number, required: true, min: 0 },
    fuelPercent: { type: Number, required: true, min: 0, max: 100 },
    condition: { type: String, required: true, maxlength: 500 },
    notes: { type: String, maxlength: 2000 },
    acknowledged: { type: Boolean, required: true },
    staffUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'contract_handovers' },
)
handoverSchema.index({ contractId: 1 }, { unique: true })

const returnSchema = new Schema(
  {
    contractId: { type: Schema.Types.ObjectId, ref: 'Contract', required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    assignmentId: { type: Schema.Types.ObjectId, ref: 'VehicleAssignment', required: true },
    occurredAt: { type: Date, required: true },
    mileageKm: { type: Number, required: true, min: 0 },
    fuelPercent: { type: Number, required: true, min: 0, max: 100 },
    condition: { type: String, required: true, maxlength: 500 },
    damageNotes: { type: String, maxlength: 2000 },
    notes: { type: String, maxlength: 2000 },
    acknowledged: { type: Boolean, required: true },
    staffUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'contract_returns' },
)
returnSchema.index({ contractId: 1 }, { unique: true })

const signatureSchema = new Schema(
  {
    contractId: { type: Schema.Types.ObjectId, ref: 'Contract', required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    termsVersionId: { type: Schema.Types.ObjectId, required: true },
    signerName: { type: String, required: true, trim: true, maxlength: 200 },
    status: { type: String, required: true, enum: Object.values(SIGNATURE_STATUSES) },
    provider: { type: String, required: true, trim: true, maxlength: 40, default: 'internal' },
    signedAt: { type: Date },
    externalEventId: { type: String, trim: true, maxlength: 120 },
  },
  { timestamps: { createdAt: true, updatedAt: true }, collection: 'contract_signatures' },
)
signatureSchema.index({ contractId: 1, termsVersionId: 1, signerName: 1 }, { unique: true })
signatureSchema.index(
  { organizationId: 1, externalEventId: 1 },
  { unique: true, partialFilterExpression: { externalEventId: { $type: 'string' } } },
)

const statusEventSchema = new Schema(
  {
    contractId: { type: Schema.Types.ObjectId, ref: 'Contract', required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    fromStatus: { type: String, enum: Object.values(CONTRACT_STATUSES) },
    toStatus: { type: String, required: true, enum: Object.values(CONTRACT_STATUSES) },
    reason: { type: String, maxlength: 500 },
    actorUserId: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'contract_status_events' },
)
statusEventSchema.index({ contractId: 1, createdAt: 1 })

const counterSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    name: { type: String, required: true, default: 'contract' },
    seq: { type: Number, required: true, default: 0 },
  },
  { collection: 'contract_counters' },
)
counterSchema.index({ organizationId: 1, name: 1 }, { unique: true })

const idempotencySchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    key: { type: String, required: true, maxlength: 200 },
    requestHash: { type: String, required: true },
    contractId: { type: Schema.Types.ObjectId, ref: 'Contract' },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'contract_idempotency_keys' },
)
idempotencySchema.index({ organizationId: 1, key: 1 }, { unique: true })

export const Contract = model('Contract', contractSchema)
export const ContractTermsVersion = model('ContractTermsVersion', termsSchema)
export const ContractCharge = model('ContractCharge', chargeSchema)
export const ContractPricingAmendment = model('ContractPricingAmendment', amendmentSchema)
export const ContractExtension = model('ContractExtension', extensionSchema)
export const ContractReplacement = model('ContractReplacement', replacementSchema)
export const ContractHandover = model('ContractHandover', handoverSchema)
export const ContractReturn = model('ContractReturn', returnSchema)
export const ContractSignature = model('ContractSignature', signatureSchema)
export const ContractStatusEvent = model('ContractStatusEvent', statusEventSchema)
export const ContractCounter = model('ContractCounter', counterSchema)
export const ContractIdempotency = model('ContractIdempotency', idempotencySchema)
