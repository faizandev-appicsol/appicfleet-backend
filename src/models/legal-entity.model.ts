import { Schema, model } from 'mongoose'
import { ENTITY_STATUSES } from '../constants/roles.js'
import type { ILegalEntity } from '../interfaces/legal-entity.interface.js'

const legalEntitySchema = new Schema<ILegalEntity>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    legalName: { type: String, required: true, trim: true, minlength: 2, maxlength: 160 },
    displayName: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    status: { type: String, required: true, enum: Object.values(ENTITY_STATUSES), default: 'ACTIVE' },
    country: { type: String, required: true, uppercase: true, trim: true, minlength: 2, maxlength: 2 },
    taxIdentifier: { type: String, trim: true, maxlength: 64 },
    defaultCurrency: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
    },
    timezone: { type: String, required: true, trim: true, maxlength: 64 },
  },
  { timestamps: true, collection: 'legal_entities' },
)

legalEntitySchema.index({ organizationId: 1, status: 1 })
legalEntitySchema.index({ organizationId: 1, legalName: 1 })

export const LegalEntity = model<ILegalEntity>('LegalEntity', legalEntitySchema)
