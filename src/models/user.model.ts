import { Schema, model } from 'mongoose'
import { ROLES, USER_STATUSES } from '../constants/roles.js'
import type { IUser } from '../interfaces/user.interface.js'

/**
 * Limitation: `email` stays globally unique (not per organization). That is simpler and safe for
 * sign-in by email alone. `organizationId` is required for every account except
 * accessAllOrganizations (super admin) accounts.
 */
const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    passwordHash: { type: String, required: true, select: false },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', default: null },
    phone: { type: String, trim: true, maxlength: 32 },
    role: { type: String, required: true, enum: Object.values(ROLES) },
    roleIds: { type: [{ type: Schema.Types.ObjectId, ref: 'Role' }], default: [] },
    status: { type: String, required: true, enum: Object.values(USER_STATUSES) },
    legalEntityIds: { type: [{ type: Schema.Types.ObjectId, ref: 'LegalEntity' }], default: [] },
    branchIds: { type: [{ type: Schema.Types.ObjectId, ref: 'Branch' }], default: [] },
    accessAllBranches: { type: Boolean, default: false },
    accessAllOrganizations: { type: Boolean, default: false },
    lastLoginAt: { type: Date },
    failedLoginAttempts: { type: Number, default: 0, min: 0 },
    lockedUntil: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: 'users',
  },
)

// Document validation only (creates and saves). Partial updates are checked in the user service.
userSchema.pre('validate', function requireOrganization() {
  if (!this.organizationId && !this.accessAllOrganizations) {
    this.invalidate(
      'organizationId',
      'organizationId is required unless the account has platform-wide access',
    )
  }
})

userSchema.index({ role: 1 })
userSchema.index({ status: 1 })
userSchema.index({ organizationId: 1, status: 1 })
userSchema.index({ organizationId: 1, email: 1 })
userSchema.index({ branchIds: 1 })

export const User = model<IUser>('User', userSchema)
