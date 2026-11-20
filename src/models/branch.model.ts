import { Schema, model } from 'mongoose'
import { ENTITY_STATUSES } from '../constants/roles.js'
import type { IBranch } from '../interfaces/branch.interface.js'

const addressSchema = new Schema(
  {
    line1: { type: String, trim: true, maxlength: 160 },
    line2: { type: String, trim: true, maxlength: 160 },
    city: { type: String, trim: true, maxlength: 80 },
    region: { type: String, trim: true, maxlength: 80 },
    postalCode: { type: String, trim: true, maxlength: 20 },
    country: { type: String, uppercase: true, trim: true, minlength: 2, maxlength: 2 },
  },
  { _id: false },
)

const branchSchema = new Schema<IBranch>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity', required: true },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    code: { type: String, required: true, uppercase: true, trim: true, maxlength: 32 },
    address: { type: addressSchema },
    timezone: { type: String, required: true, trim: true, maxlength: 64 },
    status: { type: String, required: true, enum: Object.values(ENTITY_STATUSES), default: 'ACTIVE' },
  },
  { timestamps: true, collection: 'branches' },
)

branchSchema.index({ organizationId: 1, code: 1 }, { unique: true })
branchSchema.index({ organizationId: 1, legalEntityId: 1 })
branchSchema.index({ organizationId: 1, status: 1 })

export const Branch = model<IBranch>('Branch', branchSchema)
