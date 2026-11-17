import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken'
import { env } from '../../config/env.js'
import type { Role } from '../../constants/roles.js'
import { parseDurationSeconds } from '../../utils/duration.js'

export class TokenError extends Error {
  readonly reason: 'expired' | 'invalid'

  constructor(reason: 'expired' | 'invalid') {
    super(reason === 'expired' ? 'Token expired' : 'Token invalid')
    this.name = 'TokenError'
    this.reason = reason
  }
}

export type AccessTokenClaims = {
  sub: string
  role: Role
}

export type RefreshTokenClaims = {
  sub: string
  jti: string
}

function sign(payload: object, secret: string, expiresInSeconds: number): string {
  const options: SignOptions = { expiresIn: expiresInSeconds }
  return jwt.sign(payload, secret, options)
}

function verify(token: string, secret: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, secret)
    if (typeof decoded === 'string') throw new TokenError('invalid')
    return decoded
  } catch (error) {
    if (error instanceof TokenError) throw error
    if (error instanceof jwt.TokenExpiredError) throw new TokenError('expired')
    throw new TokenError('invalid')
  }
}

export function signAccessToken(claims: AccessTokenClaims): { token: string; expiresIn: number } {
  const expiresIn = parseDurationSeconds(env.jwtAccessExpiresIn)
  const token = sign({ sub: claims.sub, role: claims.role }, env.jwtAccessSecret, expiresIn)
  return { token, expiresIn }
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  const decoded = verify(token, env.jwtAccessSecret)
  if (typeof decoded.sub !== 'string' || typeof decoded.role !== 'string') {
    throw new TokenError('invalid')
  }
  return { sub: decoded.sub, role: decoded.role as Role }
}

export function signRefreshToken(userId: string, jti: string): { token: string; expiresAt: Date } {
  const expiresIn = parseDurationSeconds(env.jwtRefreshExpiresIn)
  const token = sign({ sub: userId, jti }, env.jwtRefreshSecret, expiresIn)
  return { token, expiresAt: new Date(Date.now() + expiresIn * 1000) }
}

export function verifyRefreshToken(token: string): RefreshTokenClaims {
  const decoded = verify(token, env.jwtRefreshSecret)
  if (typeof decoded.sub !== 'string' || typeof decoded.jti !== 'string') {
    throw new TokenError('invalid')
  }
  return { sub: decoded.sub, jti: decoded.jti }
}
