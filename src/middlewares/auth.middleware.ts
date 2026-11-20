import type { RequestHandler } from 'express'
import { z } from 'zod'
import type { PermissionInput } from '../constants/permissions.js'
import type { Role } from '../constants/roles.js'
import { USER_STATUSES } from '../constants/roles.js'
import { AppError } from '../exceptions/AppError.js'
import { ERROR_CODES } from '../exceptions/errorCodes.js'
import { TokenError, verifyAccessToken } from '../lib/jwt/index.js'
import { findUserById } from '../repositories/users/user.repository.js'
import {
  hasPermission,
  loadAccessContextForUser,
} from '../services/authorization/authorization.service.js'
import type { AccessContext } from '../types/access.js'
import type { AuthenticatedUser } from '../types/auth.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const authorizationSchema = z.object({
  authorization: z.string().regex(/^Bearer\s+\S+$/i, 'A bearer token is required.'),
})

function readBearerToken(header: string): string {
  return header.replace(/^Bearer\s+/i, '').trim()
}

/**
 * Verifies the bearer token, reloads the account from the database, and attaches both
 * `req.user` and the freshly resolved `req.access` (permissions and tenant scope).
 * The token only identifies the user: role, status and scope always come from the database.
 */
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

  req.access = await loadAccessContextForUser(user)
  req.user = user
  next()
})

export function requireUser(req: { user?: AuthenticatedUser }): AuthenticatedUser {
  if (!req.user) {
    throw new AppError('Authentication is required.', 401, ERROR_CODES.UNAUTHENTICATED)
  }
  return req.user
}

export function requireAccess(req: { access?: AccessContext }): AccessContext {
  if (!req.access) {
    throw new AppError('Authentication is required.', 401, ERROR_CODES.UNAUTHENTICATED)
  }
  return req.access
}

/**
 * Prefer `requirePermission` on routes. Role names are a coarse gate only; they do not carry
 * tenant scope and custom roles never match.
 */
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

/** Default deny: passes only when the resolved access context holds the permission. */
export function requirePermission(permission: PermissionInput): RequestHandler {
  return (req, _res, next) => {
    if (!req.user || !req.access) {
      next(new AppError('Authentication is required.', 401, ERROR_CODES.UNAUTHENTICATED))
      return
    }
    if (!hasPermission(req.access, permission)) {
      next(new AppError('You do not have permission to do that.', 403, ERROR_CODES.FORBIDDEN))
      return
    }
    next()
  }
}
