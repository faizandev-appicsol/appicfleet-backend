import { Schema, model } from 'mongoose'
import type { IRefreshToken } from '../interfaces/refresh-token.interface.js'

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true, index: true },
    revokedAt: { type: Date, default: null },
    replacedById: { type: Schema.Types.ObjectId, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'refresh_tokens',
  },
)

export const RefreshToken = model<IRefreshToken>('RefreshToken', refreshTokenSchema)
