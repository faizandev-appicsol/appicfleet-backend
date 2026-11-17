import type { RequestHandler } from 'express'
import { z } from 'zod'
import type { Permission } from '../constants/permissions.js'
import { roleHasPermission } from '../constants/permissions.js'
import type { Role } from '../constants/roles.js'
import { USER_STATUSES } from '../constants/roles.js'
import { AppError } from '../exceptions/AppError.js'
import { ERROR_CODES } from '../exceptions/errorCodes.js'
import { TokenError, verifyAccessToken } from '../lib/jwt/index.js'
import { findUserById } from '../repositories/users/user.repository.js'
import type { AuthenticatedUser } from '../types/auth.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const authorizationSchema = z.object({
  authorization: z.string().regex(/^Bearer\s+\S+$/i, 'A bearer token is required.'),
})

function readBearerToken(header: string): string {
  return header.replace(/^Bearer\s+/i, '').trim()
}

export const authenticate: RequestHandler = asyncHandler(async (req, _res, next) => {
  const parsed = authorizationSchema.safeParse({ authorization: req.header('authorization') })
  if (!parsed.success) {
    throw new AppError('Authentication is required.', 401, ERROR_CODES.UNAUTHENTICATED)
  }

  let claims: { sub: string }
  try {
    claims = verifyAccessToken(readBearerToken(parsed.data.authorization))
  } catch (error) {
    if (error instanceof TokenError && error.reason === 'expired') {
      throw new AppError('Access token has expired.', 401, ERROR_CODES.TOKEN_EXPIRED)
    }
    throw new AppError('Access token is invalid.', 401, ERROR_CODES.TOKEN_INVALID)
  }

  const user = await findUserById(claims.sub)
  if (!user || user.status !== USER_STATUSES.ACTIVE) {
    throw new AppError('Authentication is required.', 401, ERROR_CODES.UNAUTHENTICATED)
  }

  req.user = user
  next()
})

export function requireUser(req: { user?: AuthenticatedUser }): AuthenticatedUser {
  if (!req.user) {
    throw new AppError('Authentication is required.', 401, ERROR_CODES.UNAUTHENTICATED)
  }
  return req.user
}

export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      next(new AppError('Authentication is required.', 401, ERROR_CODES.UNAUTHENTICATED))
      return
    }
    if (!roles.includes(req.user.role)) {
      next(new AppError('You do not have permission to do that.', 403, ERROR_CODES.FORBIDDEN))
      return
    }
    next()
  }
}

export function requirePermission(permission: Permission): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      next(new AppError('Authentication is required.', 401, ERROR_CODES.UNAUTHENTICATED))
      return
    }
    if (!roleHasPermission(req.user.role, permission)) {
      next(new AppError('You do not have permission to do that.', 403, ERROR_CODES.FORBIDDEN))
      return
    }
    next()
  }
}
