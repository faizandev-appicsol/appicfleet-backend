import { Schema, model } from 'mongoose'
import {
  EINVOICE_ENVIRONMENTS,
  EINVOICE_FAILURE_CLASSES,
  EINVOICE_PROVIDERS,
  EINVOICE_STATUSES,
  TAX_PERIOD_STATUSES,
  TAX_PRICING_MODES,
  TAX_SOURCE_TYPES,
  TAX_TREATMENTS,
  VAT_REGISTRATION_STATUSES,
} from '../constants/tax.js'

const money = { type: String, required: true, trim: true, maxlength: 20 }

const taxCodeSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity' },
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 32 },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 2000 },
    treatment: { type: String, required: true, enum: Object.values(TAX_TREATMENTS) },
    isActive: { type: Boolean, default: true },
    isSystem: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'tax_codes' },
)
taxCodeSchema.index({ organizationId: 1, code: 1 }, { unique: true })
taxCodeSchema.index({ organizationId: 1, isActive: 1 })

const taxRateSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    taxCodeId: { type: Schema.Types.ObjectId, ref: 'TaxCode', required: true },
    ratePercent: money,
    effectiveFrom: { type: Date, required: true },
    effectiveTo: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'tax_rates' },
)
taxRateSchema.index({ organizationId: 1, taxCodeId: 1, effectiveFrom: 1 })
taxRateSchema.index({ taxCodeId: 1, effectiveFrom: 1, effectiveTo: 1 })

const taxConfigurationSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity', required: true },
    vatRegistrationStatus: {
      type: String,
      required: true,
      enum: Object.values(VAT_REGISTRATION_STATUSES),
      default: VAT_REGISTRATION_STATUSES.NOT_REGISTERED,
    },
    vatRegistrationNumber: { type: String, trim: true, maxlength: 64 },
    registeredName: { type: String, trim: true, maxlength: 200 },
    registeredAddress: { type: String, trim: true, maxlength: 500 },
    vatEffectiveDate: { type: Date },
    defaultTaxCodeId: { type: Schema.Types.ObjectId, ref: 'TaxCode' },
    defaultPricingMode: {
      type: String,
      required: true,
      enum: Object.values(TAX_PRICING_MODES),
      default: TAX_PRICING_MODES.EXCLUSIVE,
    },
    einvoicingEnabled: { type: Boolean, default: false },
    einvoiceProvider: { type: String, enum: [...Object.values(EINVOICE_PROVIDERS), null], default: null },
    einvoiceEnvironment: {
      type: String,
      enum: Object.values(EINVOICE_ENVIRONMENTS),
      default: EINVOICE_ENVIRONMENTS.SANDBOX,
    },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'tax_configurations' },
)
taxConfigurationSchema.index({ organizationId: 1, legalEntityId: 1 }, { unique: true })

const taxPeriodSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity', required: true },
    taxYear: { type: Number, required: true, min: 2000, max: 2100 },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    periodNumber: { type: Number, required: true, min: 1, max: 24 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: { type: String, required: true, enum: Object.values(TAX_PERIOD_STATUSES), default: TAX_PERIOD_STATUSES.OPEN },
    lockedAt: { type: Date },
    lockedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    lockReason: { type: String, trim: true, maxlength: 500 },
    filedAt: { type: Date },
    filedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, collection: 'tax_periods' },
)
taxPeriodSchema.index({ organizationId: 1, legalEntityId: 1, taxYear: 1, periodNumber: 1 }, { unique: true })
taxPeriodSchema.index({ organizationId: 1, legalEntityId: 1, status: 1, startDate: 1 })

const taxTransactionSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    sourceType: { type: String, required: true, enum: Object.values(TAX_SOURCE_TYPES) },
    sourceId: { type: Schema.Types.ObjectId, required: true },
    documentNumber: { type: String, trim: true, maxlength: 32 },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer' },
    customerDisplayName: { type: String, trim: true, maxlength: 200 },
    transactionDate: { type: Date, required: true },
    taxCodeId: { type: Schema.Types.ObjectId, ref: 'TaxCode' },
    taxCode: { type: String, required: true, trim: true, uppercase: true, maxlength: 32 },
    taxRatePercent: money,
    taxTreatment: { type: String, required: true, enum: Object.values(TAX_TREATMENTS) },
    taxableAmount: money,
    taxAmount: money,
    grossAmount: money,
    currency: { type: String, required: true, uppercase: true, maxlength: 3 },
    taxPeriodId: { type: Schema.Types.ObjectId, ref: 'TaxPeriod' },
    pricingMode: { type: String, required: true, enum: Object.values(TAX_PRICING_MODES) },
    idempotencyKey: { type: String, required: true, trim: true, maxlength: 160 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'tax_transactions' },
)
taxTransactionSchema.index({ organizationId: 1, idempotencyKey: 1 }, { unique: true })
taxTransactionSchema.index({ organizationId: 1, sourceType: 1, sourceId: 1 })
taxTransactionSchema.index({ organizationId: 1, legalEntityId: 1, transactionDate: -1 })
taxTransactionSchema.index({ organizationId: 1, taxPeriodId: 1, taxCode: 1 })
taxTransactionSchema.index({ organizationId: 1, branchId: 1, transactionDate: -1 })

const einvoiceDocumentSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    sourceType: { type: String, required: true, enum: Object.values(TAX_SOURCE_TYPES) },
    sourceId: { type: Schema.Types.ObjectId, required: true },
    documentNumber: { type: String, trim: true, maxlength: 32 },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer' },
    customerDisplayName: { type: String, trim: true, maxlength: 200 },
    issueDate: { type: Date, required: true },
    currency: { type: String, required: true, uppercase: true, maxlength: 3 },
    taxableAmount: money,
    taxAmount: money,
    totalAmount: money,
    status: { type: String, required: true, enum: Object.values(EINVOICE_STATUSES), default: EINVOICE_STATUSES.NOT_READY },
    provider: { type: String, trim: true, maxlength: 64 },
    environment: { type: String, enum: Object.values(EINVOICE_ENVIRONMENTS) },
    providerReference: { type: String, trim: true, maxlength: 160 },
    submissionIdempotencyKey: { type: String, required: true, trim: true, maxlength: 200 },
    documentVersion: { type: Number, required: true, min: 1, default: 1 },
    formatVersion: { type: String, trim: true, maxlength: 32, default: 'internal-v1' },
    snapshot: { type: Schema.Types.Mixed },
    payload: { type: Schema.Types.Mixed },
    failureClass: { type: String, enum: [...Object.values(EINVOICE_FAILURE_CLASSES), null], default: null },
    failureReason: { type: String, trim: true, maxlength: 2000 },
    validationErrors: [{ code: String, message: String, field: String }],
    submittedAt: { type: Date },
    acceptedAt: { type: Date },
    rejectedAt: { type: Date },
    cancelledAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, collection: 'einvoice_documents' },
)
einvoiceDocumentSchema.index(
  { organizationId: 1, sourceType: 1, sourceId: 1, documentVersion: 1 },
  { unique: true },
)
einvoiceDocumentSchema.index({ organizationId: 1, submissionIdempotencyKey: 1 }, { unique: true })
einvoiceDocumentSchema.index({ organizationId: 1, status: 1, issueDate: -1 })
einvoiceDocumentSchema.index({ organizationId: 1, providerReference: 1 })
einvoiceDocumentSchema.index({ organizationId: 1, legalEntityId: 1, branchId: 1, status: 1 })

const einvoiceSubmissionSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    einvoiceDocumentId: { type: Schema.Types.ObjectId, ref: 'EInvoiceDocument', required: true },
    attemptNumber: { type: Number, required: true, min: 1 },
    provider: { type: String, required: true, trim: true, maxlength: 64 },
    environment: { type: String, required: true, enum: Object.values(EINVOICE_ENVIRONMENTS) },
    status: { type: String, required: true, enum: Object.values(EINVOICE_STATUSES) },
    failureClass: { type: String, enum: [...Object.values(EINVOICE_FAILURE_CLASSES), null], default: null },
    requestIdempotencyKey: { type: String, required: true, trim: true, maxlength: 200 },
    providerReference: { type: String, trim: true, maxlength: 160 },
    responseCode: { type: String, trim: true, maxlength: 64 },
    responseMessage: { type: String, trim: true, maxlength: 2000 },
    /** Sanitized provider payload — never store credentials. */
    responseBody: { type: Schema.Types.Mixed },
    actorUserId: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'einvoice_submissions' },
)
einvoiceSubmissionSchema.index({ organizationId: 1, requestIdempotencyKey: 1 }, { unique: true })
einvoiceSubmissionSchema.index({ einvoiceDocumentId: 1, attemptNumber: 1 }, { unique: true })
einvoiceSubmissionSchema.index({ organizationId: 1, createdAt: -1 })

const taxStatusEventSchema = new Schema(
  {
    entityType: { type: String, required: true, trim: true, maxlength: 64 },
    entityId: { type: Schema.Types.ObjectId, required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
    fromStatus: { type: String, trim: true, maxlength: 64 },
    toStatus: { type: String, required: true, trim: true, maxlength: 64 },
    reason: { type: String, trim: true, maxlength: 500 },
    actorUserId: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'tax_status_events' },
)
taxStatusEventSchema.index({ entityType: 1, entityId: 1, createdAt: 1 })

export const TaxCode = model('TaxCode', taxCodeSchema)
export const TaxRate = model('TaxRate', taxRateSchema)
export const TaxConfiguration = model('TaxConfiguration', taxConfigurationSchema)
export const TaxPeriod = model('TaxPeriod', taxPeriodSchema)
export const TaxTransaction = model('TaxTransaction', taxTransactionSchema)
export const EInvoiceDocument = model('EInvoiceDocument', einvoiceDocumentSchema)
export const EInvoiceSubmission = model('EInvoiceSubmission', einvoiceSubmissionSchema)
export const TaxStatusEvent = model('TaxStatusEvent', taxStatusEventSchema)
