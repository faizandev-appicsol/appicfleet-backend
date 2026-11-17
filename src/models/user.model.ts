import { Schema, model } from 'mongoose'
import { ROLES, USER_STATUSES } from '../constants/roles.js'
import type { IUser } from '../interfaces/user.interface.js'

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, required: true, enum: Object.values(ROLES) },
    status: { type: String, required: true, enum: Object.values(USER_STATUSES) },
  },
  {
    timestamps: true,
    collection: 'users',
  },
)

userSchema.index({ role: 1 })
userSchema.index({ status: 1 })

export const User = model<IUser>('User', userSchema)
