import { Types } from 'mongoose'
import { hashToken, tokenHashesMatch } from '../../lib/jwt/hash.js'
import { RefreshToken } from '../../models/refresh-token.model.js'

export type RotateResult = 'rotated' | 'reused' | 'missing' | 'expired'

function asObjectId(value: string): Types.ObjectId | null {
  if (!Types.ObjectId.isValid(value)) return null
  return new Types.ObjectId(value)
}

export async function saveRefreshToken(input: {
  id: string
  userId: string
  token: string
  expiresAt: Date
}): Promise<void> {
  const id = asObjectId(input.id)
  const userId = asObjectId(input.userId)
  if (!id || !userId) {
    throw new Error('Refresh token identifiers must be ObjectIds.')
  }

  await RefreshToken.create({
    _id: id,
    userId,
    tokenHash: hashToken(input.token),
    expiresAt: input.expiresAt,
  })
}

export async function revokeAllRefreshTokens(userId: string): Promise<void> {
  const id = asObjectId(userId)
  if (!id) return

  await RefreshToken.updateMany(
    { userId: id, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  )
}

export async function rotateRefreshToken(input: {
  jti: string
  userId: string
  presentedToken: string
  nextId: string
  nextToken: string
  expiresAt: Date
}): Promise<RotateResult> {
  const currentId = asObjectId(input.jti)
  const userId = asObjectId(input.userId)
  const nextId = asObjectId(input.nextId)
  if (!currentId || !userId || !nextId) return 'missing'

  const current = await RefreshToken.findById(currentId).lean()
  if (!current || current.userId.toString() !== userId.toString()) return 'missing'

  const presentedHash = hashToken(input.presentedToken)
  const matches = tokenHashesMatch(current.tokenHash, presentedHash)
  if (current.revokedAt || !matches) {
    await revokeAllRefreshTokens(input.userId)
    return 'reused'
  }

  if (current.expiresAt.getTime() <= Date.now()) return 'expired'

  const revoked = await RefreshToken.updateOne(
    { _id: currentId, revokedAt: null },
    { $set: { revokedAt: new Date(), replacedById: nextId } },
  )
  if (revoked.modifiedCount !== 1) {
    await revokeAllRefreshTokens(input.userId)
    return 'reused'
  }

  await RefreshToken.create({
    _id: nextId,
    userId,
    tokenHash: hashToken(input.nextToken),
    expiresAt: input.expiresAt,
  })
  return 'rotated'
}

export async function revokePresentedRefreshToken(input: {
  jti: string
  userId: string
  presentedToken: string
}): Promise<void> {
  const currentId = asObjectId(input.jti)
  const userId = asObjectId(input.userId)
  if (!currentId || !userId) return

  const current = await RefreshToken.findById(currentId).lean()
  if (!current || current.userId.toString() !== userId.toString()) return

  const matches = tokenHashesMatch(current.tokenHash, hashToken(input.presentedToken))
  if (current.revokedAt || !matches) {
    await revokeAllRefreshTokens(input.userId)
    return
  }

  await RefreshToken.updateOne({ _id: currentId }, { $set: { revokedAt: new Date() } })
}
