import { Schema, model } from 'mongoose'
import {
  ASSIGNMENT_RESOLUTIONS,
  CHARGE_SOURCES,
  DISPUTE_STATUSES,
  FINE_STATUSES,
  FINE_TYPES,
  IMPORT_BATCH_STATUSES,
  IMPORT_ROW_RESULTS,
  REFUND_SOURCES,
  REFUND_STATUSES,
  RECOVERY_POLICIES,
  TOLL_PROVIDERS,
  TOLL_STATUSES,
} from '../constants/charges.js'

const money = { type: String, required: true, trim: true, maxlength: 20 }

const fineSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    documentNumber: { type: String, trim: true, maxlength: 32 },
    externalReference: { type: String, required: true, trim: true, maxlength: 120 },
    provider: { type: String, required: true, trim: true, uppercase: true, maxlength: 64 },
    fineType: { type: String, required: true, enum: Object.values(FINE_TYPES) },
    source: { type: String, required: true, enum: Object.values(CHARGE_SOURCES) },
    eventAt: { type: Date, required: true },
    receivedAt: { type: Date, required: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle' },
    vehiclePlate: { type: String, trim: true, maxlength: 32 },
    assignmentId: { type: Schema.Types.ObjectId, ref: 'VehicleAssignment' },
    contractId: { type: Schema.Types.ObjectId, ref: 'Contract' },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer' },
    customerName: { type: String, trim: true, maxlength: 200 },
    assignmentResolution: {
      type: String,
      required: true,
      enum: Object.values(ASSIGNMENT_RESOLUTIONS),
    },
    reviewReason: { type: String, trim: true, maxlength: 500 },
    currency: { type: String, required: true, uppercase: true, maxlength: 3 },
    amount: money,
    description: { type: String, trim: true, maxlength: 1000 },
    location: { type: String, trim: true, maxlength: 200 },
    authority: { type: String, trim: true, maxlength: 120 },
    status: { type: String, required: true, enum: Object.values(FINE_STATUSES) },
    importBatchId: { type: Schema.Types.ObjectId, ref: 'FineTollImportBatch' },
    evidenceKey: { type: String, trim: true, maxlength: 500 },
    recoveryId: { type: Schema.Types.ObjectId, ref: 'ChargeRecovery' },
    recoveryAmount: { type: String, trim: true, maxlength: 20 },
    waivedReason: { type: String, trim: true, maxlength: 500 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
  },
  { timestamps: true, collection: 'fines' },
)
fineSchema.index(
  { organizationId: 1, provider: 1, externalReference: 1 },
  { unique: true },
)
fineSchema.index(
  { organizationId: 1, documentNumber: 1 },
  { unique: true, partialFilterExpression: { documentNumber: { $type: 'string' } } },
)
fineSchema.index({ organizationId: 1, branchId: 1, status: 1, eventAt: 1 })
fineSchema.index({ organizationId: 1, vehicleId: 1, eventAt: 1 })
fineSchema.index({ organizationId: 1, customerId: 1, eventAt: 1 })
fineSchema.index({ organizationId: 1, contractId: 1, eventAt: 1 })

const tollSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    documentNumber: { type: String, trim: true, maxlength: 32 },
    externalReference: { type: String, required: true, trim: true, maxlength: 120 },
    provider: { type: String, required: true, enum: Object.values(TOLL_PROVIDERS) },
    source: { type: String, required: true, enum: Object.values(CHARGE_SOURCES) },
    eventAt: { type: Date, required: true },
    receivedAt: { type: Date, required: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle' },
    vehiclePlate: { type: String, trim: true, maxlength: 32 },
    assignmentId: { type: Schema.Types.ObjectId, ref: 'VehicleAssignment' },
    contractId: { type: Schema.Types.ObjectId, ref: 'Contract' },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer' },
    customerName: { type: String, trim: true, maxlength: 200 },
    assignmentResolution: {
      type: String,
      required: true,
      enum: Object.values(ASSIGNMENT_RESOLUTIONS),
    },
    reviewReason: { type: String, trim: true, maxlength: 500 },
    currency: { type: String, required: true, uppercase: true, maxlength: 3 },
    amount: money,
    location: { type: String, trim: true, maxlength: 200 },
    gate: { type: String, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 1000 },
    status: { type: String, required: true, enum: Object.values(TOLL_STATUSES) },
    importBatchId: { type: Schema.Types.ObjectId, ref: 'FineTollImportBatch' },
    recoveryId: { type: Schema.Types.ObjectId, ref: 'ChargeRecovery' },
    recoveryAmount: { type: String, trim: true, maxlength: 20 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
  },
  { timestamps: true, collection: 'tolls' },
)
tollSchema.index({ organizationId: 1, provider: 1, externalReference: 1 }, { unique: true })
tollSchema.index(
  { organizationId: 1, documentNumber: 1 },
  { unique: true, partialFilterExpression: { documentNumber: { $type: 'string' } } },
)
tollSchema.index({ organizationId: 1, branchId: 1, status: 1, eventAt: 1 })
tollSchema.index({ organizationId: 1, vehicleId: 1, eventAt: 1 })
tollSchema.index({ organizationId: 1, customerId: 1, eventAt: 1 })

const chargeRecoverySchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    sourceKind: { type: String, required: true, enum: ['FINE', 'TOLL'] },
    sourceId: { type: Schema.Types.ObjectId, required: true },
    contractId: { type: Schema.Types.ObjectId, ref: 'Contract', required: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle' },
    currency: { type: String, required: true, uppercase: true, maxlength: 3 },
    authorityAmount: money,
    recoveryAmount: money,
    adminFee: { ...money, default: '0.00' },
    policy: { type: String, required: true, enum: Object.values(RECOVERY_POLICIES) },
    contractChargeId: { type: Schema.Types.ObjectId, ref: 'ContractCharge' },
    depositId: { type: Schema.Types.ObjectId, ref: 'SecurityDeposit' },
    depositAppliedAmount: { type: String, trim: true, maxlength: 20 },
    status: { type: String, required: true, enum: ['PENDING', 'CHARGED', 'WAIVED', 'CANCELLED'] },
    idempotencyKey: { type: String, required: true, trim: true, maxlength: 128 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, collection: 'charge_recoveries' },
)
chargeRecoverySchema.index({ organizationId: 1, sourceKind: 1, sourceId: 1 }, { unique: true })
chargeRecoverySchema.index({ organizationId: 1, idempotencyKey: 1 }, { unique: true })

const chargeDisputeSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    sourceKind: { type: String, required: true, enum: ['FINE', 'TOLL'] },
    sourceId: { type: Schema.Types.ObjectId, required: true },
    status: { type: String, required: true, enum: Object.values(DISPUTE_STATUSES) },
    reason: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000 },
    evidenceKey: { type: String, trim: true, maxlength: 500 },
    resolution: { type: String, trim: true, maxlength: 2000 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: { type: Date },
  },
  { timestamps: true, collection: 'charge_disputes' },
)
chargeDisputeSchema.index({ organizationId: 1, sourceKind: 1, sourceId: 1, createdAt: 1 })

const importBatchSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    documentNumber: { type: String, trim: true, maxlength: 32 },
    provider: { type: String, required: true, trim: true, uppercase: true, maxlength: 64 },
    kind: { type: String, required: true, enum: ['FINE', 'TOLL'] },
    fileName: { type: String, trim: true, maxlength: 255 },
    status: { type: String, required: true, enum: Object.values(IMPORT_BATCH_STATUSES) },
    totalRows: { type: Number, required: true, min: 0, default: 0 },
    successRows: { type: Number, required: true, min: 0, default: 0 },
    duplicateRows: { type: Number, required: true, min: 0, default: 0 },
    failedRows: { type: Number, required: true, min: 0, default: 0 },
    reviewRows: { type: Number, required: true, min: 0, default: 0 },
    errorSummary: { type: String, trim: true, maxlength: 2000 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    completedAt: { type: Date },
  },
  { timestamps: true, collection: 'fine_toll_import_batches' },
)
importBatchSchema.index({ organizationId: 1, createdAt: -1 })

const importRowSchema = new Schema(
  {
    batchId: { type: Schema.Types.ObjectId, ref: 'FineTollImportBatch', required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    rowNumber: { type: Number, required: true, min: 1 },
    result: { type: String, required: true, enum: Object.values(IMPORT_ROW_RESULTS) },
    externalReference: { type: String, trim: true, maxlength: 120 },
    reason: { type: String, trim: true, maxlength: 500 },
    createdRecordId: { type: Schema.Types.ObjectId },
    existingRecordId: { type: Schema.Types.ObjectId },
    payload: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'fine_toll_import_rows' },
)
importRowSchema.index({ batchId: 1, rowNumber: 1 }, { unique: true })

const refundSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    documentNumber: { type: String, trim: true, maxlength: 32 },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    customerName: { type: String, required: true, trim: true, maxlength: 200 },
    contractId: { type: Schema.Types.ObjectId, ref: 'Contract' },
    sourceKind: { type: String, required: true, enum: Object.values(REFUND_SOURCES) },
    depositId: { type: Schema.Types.ObjectId, ref: 'SecurityDeposit' },
    paymentId: { type: Schema.Types.ObjectId, ref: 'Payment' },
    currency: { type: String, required: true, uppercase: true, maxlength: 3 },
    amount: money,
    reason: { type: String, required: true, trim: true, maxlength: 500 },
    notes: { type: String, trim: true, maxlength: 2000 },
    status: { type: String, required: true, enum: Object.values(REFUND_STATUSES) },
    evidenceKey: { type: String, trim: true, maxlength: 500 },
    idempotencyKey: { type: String, required: true, trim: true, maxlength: 128 },
    externalReference: { type: String, trim: true, maxlength: 120 },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    requestedAt: { type: Date },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    rejectedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    rejectedAt: { type: Date },
    rejectionReason: { type: String, trim: true, maxlength: 500 },
    executedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    executedAt: { type: Date },
    failedReason: { type: String, trim: true, maxlength: 500 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, collection: 'refunds' },
)
refundSchema.index({ organizationId: 1, idempotencyKey: 1 }, { unique: true })
refundSchema.index(
  { organizationId: 1, documentNumber: 1 },
  { unique: true, partialFilterExpression: { documentNumber: { $type: 'string' } } },
)
refundSchema.index({ organizationId: 1, customerId: 1, status: 1, createdAt: 1 })
refundSchema.index({ organizationId: 1, branchId: 1, status: 1 })

const chargeCounterSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    name: { type: String, required: true, trim: true, maxlength: 40 },
    seq: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: true, collection: 'charge_counters' },
)
chargeCounterSchema.index({ organizationId: 1, name: 1 }, { unique: true })

const chargeStatusEventSchema = new Schema(
  {
    entityType: { type: String, required: true, trim: true, maxlength: 40 },
    entityId: { type: Schema.Types.ObjectId, required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
    fromStatus: { type: String, trim: true, maxlength: 40 },
    toStatus: { type: String, required: true, trim: true, maxlength: 40 },
    reason: { type: String, trim: true, maxlength: 500 },
    actorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'charge_status_events' },
)
chargeStatusEventSchema.index({ entityType: 1, entityId: 1, createdAt: 1 })

export const Fine = model('Fine', fineSchema)
export const Toll = model('Toll', tollSchema)
export const ChargeRecovery = model('ChargeRecovery', chargeRecoverySchema)
export const ChargeDispute = model('ChargeDispute', chargeDisputeSchema)
export const FineTollImportBatch = model('FineTollImportBatch', importBatchSchema)
export const FineTollImportRow = model('FineTollImportRow', importRowSchema)
export const Refund = model('Refund', refundSchema)
export const ChargeCounter = model('ChargeCounter', chargeCounterSchema)
export const ChargeStatusEvent = model('ChargeStatusEvent', chargeStatusEventSchema)
