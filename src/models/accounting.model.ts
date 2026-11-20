import { Schema, model } from 'mongoose'
import {
  ACCOUNT_ROLES,
  ACCOUNT_TYPES,
  JOURNAL_STATUSES,
  JOURNAL_TYPES,
  NORMAL_BALANCES,
  PERIOD_STATUSES,
  SOURCE_MODULES,
} from '../constants/accounting.js'

const money = { type: String, required: true, trim: true, maxlength: 20 }

const glAccountSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity' },
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 32 },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    accountType: { type: String, required: true, enum: Object.values(ACCOUNT_TYPES) },
    normalBalance: { type: String, required: true, enum: Object.values(NORMAL_BALANCES) },
    parentAccountId: { type: Schema.Types.ObjectId, ref: 'GlAccount' },
    description: { type: String, trim: true, maxlength: 2000 },
    currency: { type: String, uppercase: true, maxlength: 3 },
    isSystem: { type: Boolean, default: false },
    systemRole: { type: String, enum: [...Object.values(ACCOUNT_ROLES), null], default: null },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'gl_accounts' },
)
glAccountSchema.index({ organizationId: 1, code: 1 }, { unique: true })
glAccountSchema.index({ organizationId: 1, accountType: 1, isActive: 1 })
glAccountSchema.index(
  { organizationId: 1, systemRole: 1 },
  { unique: true, partialFilterExpression: { systemRole: { $type: 'string' } } },
)
glAccountSchema.index({ organizationId: 1, parentAccountId: 1 })

const fiscalYearSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity', required: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: { type: String, required: true, enum: Object.values(PERIOD_STATUSES), default: PERIOD_STATUSES.OPEN },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, collection: 'fiscal_years' },
)
fiscalYearSchema.index({ organizationId: 1, legalEntityId: 1, name: 1 }, { unique: true })
fiscalYearSchema.index({ organizationId: 1, legalEntityId: 1, startDate: 1, endDate: 1 })

const fiscalPeriodSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity', required: true },
    fiscalYearId: { type: Schema.Types.ObjectId, ref: 'FiscalYear', required: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    periodNumber: { type: Number, required: true, min: 1, max: 24 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: { type: String, required: true, enum: Object.values(PERIOD_STATUSES), default: PERIOD_STATUSES.OPEN },
    closedAt: { type: Date },
    closedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    closeReason: { type: String, trim: true, maxlength: 500 },
    reopenedAt: { type: Date },
    reopenedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reopenReason: { type: String, trim: true, maxlength: 500 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, collection: 'fiscal_periods' },
)
fiscalPeriodSchema.index({ organizationId: 1, fiscalYearId: 1, periodNumber: 1 }, { unique: true })
fiscalPeriodSchema.index({ organizationId: 1, legalEntityId: 1, startDate: 1, endDate: 1 })
fiscalPeriodSchema.index({ organizationId: 1, legalEntityId: 1, status: 1 })

const journalEntrySchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    journalNumber: { type: String, trim: true, maxlength: 32 },
    journalType: { type: String, required: true, enum: Object.values(JOURNAL_TYPES) },
    accountingDate: { type: Date, required: true },
    postingDate: { type: Date },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    reference: { type: String, trim: true, maxlength: 120 },
    sourceModule: { type: String, required: true, enum: Object.values(SOURCE_MODULES) },
    sourceType: { type: String, trim: true, maxlength: 64 },
    sourceId: { type: Schema.Types.ObjectId },
    sourceIdempotencyKey: { type: String, trim: true, maxlength: 160 },
    fiscalPeriodId: { type: Schema.Types.ObjectId, ref: 'FiscalPeriod' },
    status: { type: String, required: true, enum: Object.values(JOURNAL_STATUSES), default: JOURNAL_STATUSES.DRAFT },
    currency: { type: String, required: true, uppercase: true, maxlength: 3 },
    totalDebit: money,
    totalCredit: money,
    postedAt: { type: Date },
    postedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reversedJournalId: { type: Schema.Types.ObjectId, ref: 'JournalEntry' },
    reversalOfJournalId: { type: Schema.Types.ObjectId, ref: 'JournalEntry' },
    reversalReason: { type: String, trim: true, maxlength: 500 },
    cancelledReason: { type: String, trim: true, maxlength: 500 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'journal_entries' },
)
journalEntrySchema.index(
  { organizationId: 1, journalNumber: 1 },
  { unique: true, partialFilterExpression: { journalNumber: { $type: 'string' } } },
)
journalEntrySchema.index(
  { organizationId: 1, sourceIdempotencyKey: 1 },
  { unique: true, partialFilterExpression: { sourceIdempotencyKey: { $type: 'string' } } },
)
journalEntrySchema.index({ organizationId: 1, branchId: 1, status: 1, accountingDate: -1 })
journalEntrySchema.index({ organizationId: 1, legalEntityId: 1, accountingDate: -1 })
journalEntrySchema.index({ organizationId: 1, sourceModule: 1, sourceType: 1, sourceId: 1 })
journalEntrySchema.index({ organizationId: 1, fiscalPeriodId: 1, status: 1 })

const journalLineSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    journalId: { type: Schema.Types.ObjectId, ref: 'JournalEntry', required: true },
    lineNumber: { type: Number, required: true, min: 1 },
    accountId: { type: Schema.Types.ObjectId, ref: 'GlAccount', required: true },
    accountCode: { type: String, required: true, trim: true, maxlength: 32 },
    accountName: { type: String, required: true, trim: true, maxlength: 200 },
    debit: money,
    credit: money,
    description: { type: String, trim: true, maxlength: 2000 },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer' },
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor' },
    vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle' },
    contractId: { type: Schema.Types.ObjectId, ref: 'Contract' },
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice' },
    paymentId: { type: Schema.Types.ObjectId, ref: 'Payment' },
    reference: { type: String, trim: true, maxlength: 120 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'journal_lines' },
)
journalLineSchema.index({ journalId: 1, lineNumber: 1 }, { unique: true })
journalLineSchema.index({ organizationId: 1, accountId: 1, journalId: 1 })
journalLineSchema.index({ organizationId: 1, customerId: 1 })
journalLineSchema.index({ organizationId: 1, vendorId: 1 })

/** Period balances maintained on post for efficient trial balance / account balance. */
const accountBalanceSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
    accountId: { type: Schema.Types.ObjectId, ref: 'GlAccount', required: true },
    fiscalPeriodId: { type: Schema.Types.ObjectId, ref: 'FiscalPeriod', required: true },
    periodDebit: money,
    periodCredit: money,
  },
  { timestamps: true, collection: 'account_balances' },
)
accountBalanceSchema.index(
  { organizationId: 1, accountId: 1, fiscalPeriodId: 1, branchId: 1 },
  { unique: true },
)
accountBalanceSchema.index({ organizationId: 1, fiscalPeriodId: 1 })

const accountMappingSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity', required: true },
    role: { type: String, required: true, enum: Object.values(ACCOUNT_ROLES) },
    accountId: { type: Schema.Types.ObjectId, ref: 'GlAccount', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, collection: 'account_mappings' },
)
accountMappingSchema.index({ organizationId: 1, legalEntityId: 1, role: 1 }, { unique: true })

const accountingCounterSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    name: { type: String, required: true, trim: true, maxlength: 40 },
    seq: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: true, collection: 'accounting_counters' },
)
accountingCounterSchema.index({ organizationId: 1, name: 1 }, { unique: true })

const accountingStatusEventSchema = new Schema(
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
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'accounting_status_events' },
)
accountingStatusEventSchema.index({ entityType: 1, entityId: 1, createdAt: 1 })

export const GlAccount = model('GlAccount', glAccountSchema)
export const FiscalYear = model('FiscalYear', fiscalYearSchema)
export const FiscalPeriod = model('FiscalPeriod', fiscalPeriodSchema)
export const JournalEntry = model('JournalEntry', journalEntrySchema)
export const JournalLine = model('JournalLine', journalLineSchema)
export const AccountBalance = model('AccountBalance', accountBalanceSchema)
export const AccountMapping = model('AccountMapping', accountMappingSchema)
export const AccountingCounter = model('AccountingCounter', accountingCounterSchema)
export const AccountingStatusEvent = model('AccountingStatusEvent', accountingStatusEventSchema)
