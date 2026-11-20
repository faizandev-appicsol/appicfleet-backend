import { Schema, model } from 'mongoose'
import { ENTITY_STATUSES } from '../constants/roles.js'
import type { IOrganization } from '../interfaces/organization.interface.js'

const organizationSchema = new Schema<IOrganization>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 32 },
    status: { type: String, required: true, enum: Object.values(ENTITY_STATUSES), default: 'ACTIVE' },
  },
  { timestamps: true, collection: 'organizations' },
)

organizationSchema.index({ status: 1 })

export const Organization = model<IOrganization>('Organization', organizationSchema)
