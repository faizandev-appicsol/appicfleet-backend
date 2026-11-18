import { Types } from 'mongoose'
import { toPublicRole, USER_STATUSES, type Role } from '../../constants/roles.js'
import { AppError } from '../../exceptions/AppError.js'
import { ERROR_CODES } from '../../exceptions/errorCodes.js'
import { dummyPasswordHash, verifyPassword } from '../../lib/password/index.js'
import jwt from 'jsonwebtoken'
import {
  signAccessToken,
  signRefreshToken,
  TokenError,
  verifyRefreshToken,
} from '../../lib/jwt/index.js'
import {
  revokeAllRefreshTokens,
  rotateRefreshToken,
  saveRefreshToken,
} from '../../repositories/auth/refresh-token.repository.js'
import { findCredentialsByEmail, findUserById } from '../../repositories/users/user.repository.js'
import type {
  AuthenticatedUser,
  IssuedSession,
  PublicSession,
  SessionUser,
} from '../../types/auth.js'
import type { LoginBody } from '../../validations/auth.validation.js'

function toSessionUser(account: {
  id: string
  email: string
  name: string
  role: Role
}): SessionUser {
  return {
    id: account.id,
    email: account.email,
    name: account.name,
    roles: [toPublicRole(account.role)],
  }
}

export function toPublicSession(session: IssuedSession): PublicSession {
  return {
    accessToken: session.accessToken,
    expiresIn: session.expiresIn,
    user: session.user,
  }
}

async function issueSession(account: {
  id: string
  email: string
  name: string
  role: Role
}): Promise<IssuedSession> {
  const access = signAccessToken({ sub: account.id, role: account.role })
  const jti = new Types.ObjectId().toHexString()
  const refresh = signRefreshToken(account.id, jti)
  await saveRefreshToken({
    id: jti,
    userId: account.id,
    token: refresh.token,
    expiresAt: refresh.expiresAt,
  })

  return {
    accessToken: access.token,
    expiresIn: access.expiresIn,
    refreshToken: refresh.token,
    refreshExpiresAt: refresh.expiresAt,
    user: toSessionUser(account),
  }
}

export async function login(input: LoginBody): Promise<IssuedSession> {
  const account = await findCredentialsByEmail(input.email.toLowerCase())
  const passwordMatches = await verifyPassword(
    input.password,
    account?.passwordHash ?? dummyPasswordHash(),
  )

  if (!account || !passwordMatches) {
    throw new AppError('The email or password is incorrect.', 401, ERROR_CODES.INVALID_CREDENTIALS)
  }

  if (account.status === USER_STATUSES.DISABLED) {
    throw new AppError('This account is disabled.', 403, ERROR_CODES.ACCOUNT_DISABLED)
  }

  if (account.status === USER_STATUSES.INVITED) {
    throw new AppError('This account has not been activated.', 403, ERROR_CODES.ACCOUNT_INVITED)
  }

  if (account.status !== USER_STATUSES.ACTIVE) {
    throw new AppError('This account is not active.', 403, ERROR_CODES.ACCOUNT_INACTIVE)
  }

  return issueSession(account)
}

export async function refresh(refreshToken: string): Promise<IssuedSession> {
  let claims: { sub: string; jti: string }
  try {
    claims = verifyRefreshToken(refreshToken)
  } catch (error) {
    if (error instanceof TokenError && error.reason === 'expired') {
      throw new AppError('Refresh token has expired.', 401, ERROR_CODES.TOKEN_EXPIRED)
    }
    throw new AppError('Refresh token is invalid.', 401, ERROR_CODES.TOKEN_INVALID)
  }

  const account = await findUserById(claims.sub)
  if (!account || account.status !== USER_STATUSES.ACTIVE) {
    await revokeAllRefreshTokens(claims.sub)
    throw new AppError('Authentication is required.', 401, ERROR_CODES.UNAUTHENTICATED)
  }

  const nextId = new Types.ObjectId().toHexString()
  const nextRefresh = signRefreshToken(account.id, nextId)
  const rotated = await rotateRefreshToken({
    jti: claims.jti,
    userId: account.id,
    presentedToken: refreshToken,
    nextId,
    nextToken: nextRefresh.token,
    expiresAt: nextRefresh.expiresAt,
  })

  if (rotated === 'expired') {
    throw new AppError('Refresh token has expired.', 401, ERROR_CODES.TOKEN_EXPIRED)
  }
  if (rotated !== 'rotated') {
    throw new AppError('Refresh token is no longer valid.', 401, ERROR_CODES.TOKEN_INVALID)
  }

  const access = signAccessToken({ sub: account.id, role: account.role })
  return {
    accessToken: access.token,
    expiresIn: access.expiresIn,
    refreshToken: nextRefresh.token,
    refreshExpiresAt: nextRefresh.expiresAt,
    user: toSessionUser(account),
  }
}

function readRefreshUserId(refreshToken: string): string | null {
  try {
    return verifyRefreshToken(refreshToken).sub
  } catch {
    const decoded = jwt.decode(refreshToken)
    if (typeof decoded === 'object' && decoded !== null && typeof decoded.sub === 'string') {
      return decoded.sub
    }
    return null
  }
}

export async function logout(refreshToken: string | undefined): Promise<void> {
  if (!refreshToken) return

  const userId = readRefreshUserId(refreshToken)
  if (!userId) return

  // Sign-out ends every refresh session for this account, not only the current token.
  await revokeAllRefreshTokens(userId)
}

export function currentSessionUser(account: AuthenticatedUser): SessionUser {
  return toSessionUser(account)
}
