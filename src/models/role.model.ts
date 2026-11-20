import { Schema, model } from 'mongoose'
import { ENTITY_STATUSES } from '../constants/roles.js'
import type { IRole } from '../interfaces/role.interface.js'

const roleSchema = new Schema<IRole>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', default: null },
    code: { type: String, required: true, uppercase: true, trim: true, maxlength: 48 },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 240 },
    permissionKeys: { type: [String], default: [] },
    isSystem: { type: Boolean, required: true, default: false },
    status: { type: String, required: true, enum: Object.values(ENTITY_STATUSES), default: 'ACTIVE' },
  },
  { timestamps: true, collection: 'roles' },
)

// organizationId null (system roles) is one key value, so system role codes stay unique too.
roleSchema.index({ organizationId: 1, code: 1 }, { unique: true })
roleSchema.index({ organizationId: 1, status: 1 })
roleSchema.index({ isSystem: 1 })

export const Role = model<IRole>('Role', roleSchema)
