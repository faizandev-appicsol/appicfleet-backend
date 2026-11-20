import { Schema, model } from 'mongoose'
import { INVESTOR_REPORT_KEYS, INVESTOR_STATUSES } from '../constants/investors.js'

const scopeSchema = new Schema(
  {
    legalEntityIds: { type: [{ type: Schema.Types.ObjectId, ref: 'LegalEntity' }], default: [] },
    branchIds: { type: [{ type: Schema.Types.ObjectId, ref: 'Branch' }], default: [] },
    vehicleIds: { type: [{ type: Schema.Types.ObjectId, ref: 'Vehicle' }], default: [] },
    reportKeys: {
      type: [{ type: String, enum: Object.values(INVESTOR_REPORT_KEYS) }],
      default: [],
    },
  },
  { _id: false },
)

/**
 * Investor identity linked 1:1 to a user account with role INVESTOR.
 * Access is default-deny: empty scope arrays grant no fleet/financial data.
 */
const investorSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    investorNumber: { type: String, required: true, trim: true, maxlength: 32 },
    displayName: { type: String, required: true, trim: true, maxlength: 200 },
    legalName: { type: String, trim: true, maxlength: 200 },
    contactEmail: { type: String, required: true, trim: true, lowercase: true, maxlength: 200 },
    phone: { type: String, trim: true, maxlength: 40 },
    status: {
      type: String,
      required: true,
      enum: Object.values(INVESTOR_STATUSES),
      default: INVESTOR_STATUSES.INVITED,
    },
    accessStartsAt: { type: Date },
    accessEndsAt: { type: Date },
    scope: { type: scopeSchema, required: true, default: () => ({}) },
    notes: { type: String, trim: true, maxlength: 2000 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    invitedAt: { type: Date },
    activatedAt: { type: Date },
    suspendedAt: { type: Date },
    revokedAt: { type: Date },
  },
  { timestamps: true, collection: 'investors' },
)

investorSchema.index({ organizationId: 1, investorNumber: 1 }, { unique: true })
investorSchema.index({ userId: 1 }, { unique: true })
investorSchema.index({ organizationId: 1, status: 1, displayName: 1 })
investorSchema.index({ organizationId: 1, contactEmail: 1 })
investorSchema.index({ 'scope.branchIds': 1 })
investorSchema.index({ 'scope.legalEntityIds': 1 })
investorSchema.index({ 'scope.vehicleIds': 1 })

const invitationSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    investorId: { type: Schema.Types.ObjectId, ref: 'Investor', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    /** SHA-256 hex of the raw invitation token. Raw token is never stored. */
    tokenHash: { type: String, required: true, trim: true, maxlength: 128 },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date },
    revokedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'investor_invitations' },
)

invitationSchema.index({ tokenHash: 1 }, { unique: true })
invitationSchema.index({ investorId: 1, createdAt: -1 })
invitationSchema.index({ expiresAt: 1 })

const counterSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    name: { type: String, required: true, trim: true, maxlength: 40 },
    seq: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: true, collection: 'investor_counters' },
)
counterSchema.index({ organizationId: 1, name: 1 }, { unique: true })

export const Investor = model('Investor', investorSchema)
export const InvestorInvitation = model('InvestorInvitation', invitationSchema)
export const InvestorCounter = model('InvestorCounter', counterSchema)
