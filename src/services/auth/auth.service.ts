import { Types } from 'mongoose'
import { ROLES, toPublicRole, USER_STATUSES } from '../../constants/roles.js'
import { AppError } from '../../exceptions/AppError.js'
import { ERROR_CODES } from '../../exceptions/errorCodes.js'
import { dummyPasswordHash, hashPassword, verifyPassword } from '../../lib/password/index.js'
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
import {
  findBranchesByIds,
  findBranchesByOrganization,
} from '../../repositories/branches/branch.repository.js'
import { findOrganizationById } from '../../repositories/organizations/organization.repository.js'
import {
  findCredentialsByEmail,
  findCredentialsById,
  findUserById,
  recordFailedLogin,
  recordLoginSuccess,
  updatePasswordHash,
} from '../../repositories/users/user.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import type {
  AuthenticatedUser,
  IssuedSession,
  ProfileResource,
  PublicSession,
  SessionUser,
} from '../../types/auth.js'
import type { UserRecord } from '../../types/user.js'
import type { ChangePasswordBody, LoginBody } from '../../validations/auth.validation.js'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, recordAuditEvent } from '../audit/audit.service.js'
import { loadAccessContextForUser } from '../authorization/authorization.service.js'

/** Consecutive failed sign-ins before the account is temporarily locked. */
export const MAX_FAILED_LOGIN_ATTEMPTS = 5
/** How long a lock lasts. */
export const LOGIN_LOCK_MS = 15 * 60 * 1000

function toSessionUser(account: AuthenticatedUser, access: AccessContext): SessionUser {
  const roles = Array.from(
    new Set([toPublicRole(account.role), ...access.roleCodes.map((code) => code.toLowerCase())]),
  )

  return {
    id: account.id,
    email: account.email,
    name: account.name,
    roles,
    permissions: [...access.permissions].sort(),
    organizationId: account.organizationId,
    branchIds: [...account.branchIds],
    legalEntityIds: [...account.legalEntityIds],
    accessAllBranches: account.accessAllBranches,
    accessAllOrganizations: account.accessAllOrganizations,
  }
}

export function toPublicSession(session: IssuedSession): PublicSession {
  return {
    accessToken: session.accessToken,
    expiresIn: session.expiresIn,
    user: session.user,
  }
}

async function issueSession(
  account: AuthenticatedUser,
  access: AccessContext,
): Promise<IssuedSession> {
  const accessToken = signAccessToken({ sub: account.id, role: account.role })
  const jti = new Types.ObjectId().toHexString()
  const refreshToken = signRefreshToken(account.id, jti)
  await saveRefreshToken({
    id: jti,
    userId: account.id,
    token: refreshToken.token,
    expiresAt: refreshToken.expiresAt,
  })

  return {
    accessToken: accessToken.token,
    expiresIn: accessToken.expiresIn,
    refreshToken: refreshToken.token,
    refreshExpiresAt: refreshToken.expiresAt,
    user: toSessionUser(account, access),
  }
}

async function rejectLogin(
  account: UserRecord | null,
  reason: string,
  error: AppError,
  meta: RequestMeta,
): Promise<never> {
  // No email or password is stored: only the account id (when one matched) and a reason code.
  await recordAuditEvent({
    action: AUDIT_ACTIONS.AUTH_LOGIN_FAILED,
    entityType: AUDIT_ENTITY_TYPES.AUTH,
    entityId: account?.id,
    actorUserId: account?.id,
    organizationId: account?.organizationId,
    result: 'failure',
    metadata: { reason },
    meta,
  })
  throw error
}

function isLocked(account: UserRecord): boolean {
  return account.lockedUntil !== null && account.lockedUntil.getTime() > Date.now()
}

export async function login(input: LoginBody, meta: RequestMeta = {}): Promise<IssuedSession> {
  const account = await findCredentialsByEmail(input.email.toLowerCase())
  const passwordMatches = await verifyPassword(
    input.password,
    account?.passwordHash ?? dummyPasswordHash(),
  )

  if (!account) {
    return rejectLogin(
      null,
      'invalid_credentials',
      new AppError('The email or password is incorrect.', 401, ERROR_CODES.INVALID_CREDENTIALS),
      meta,
    )
  }

  if (!passwordMatches) {
    const locked = isLocked(account)
    // A locked account is not counted further, so an attacker cannot extend the lock for a victim.
    if (!locked) {
      await recordFailedLogin(account.id, {
        maxAttempts: MAX_FAILED_LOGIN_ATTEMPTS,
        lockMs: LOGIN_LOCK_MS,
      })
    }
    return rejectLogin(
      account,
      locked ? 'invalid_credentials_while_locked' : 'invalid_credentials',
      // Same response whether or not the account exists or is locked: no enumeration.
      new AppError('The email or password is incorrect.', 401, ERROR_CODES.INVALID_CREDENTIALS),
      meta,
    )
  }

  if (isLocked(account)) {
    return rejectLogin(
      account,
      'locked',
      new AppError(
        'Too many failed sign-in attempts. Try again later.',
        423,
        ERROR_CODES.ACCOUNT_LOCKED,
      ),
      meta,
    )
  }

  // Legacy DISABLED documents are already normalized to INACTIVE by the repository.
  if (account.status === USER_STATUSES.INVITED) {
    return rejectLogin(
      account,
      'invited',
      new AppError('This account has not been activated.', 403, ERROR_CODES.ACCOUNT_INVITED),
      meta,
    )
  }
  if (account.status === USER_STATUSES.SUSPENDED) {
    return rejectLogin(
      account,
      'suspended',
      new AppError('This account is suspended.', 403, ERROR_CODES.ACCOUNT_SUSPENDED),
      meta,
    )
  }
  if (account.status === USER_STATUSES.INACTIVE || account.status === USER_STATUSES.DISABLED) {
    return rejectLogin(
      account,
      'inactive',
      new AppError('This account is disabled.', 403, ERROR_CODES.ACCOUNT_DISABLED),
      meta,
    )
  }
  if (account.status !== USER_STATUSES.ACTIVE) {
    return rejectLogin(
      account,
      'not_active',
      new AppError('This account is not active.', 403, ERROR_CODES.ACCOUNT_INACTIVE),
      meta,
    )
  }

  if (account.role === ROLES.INVESTOR) {
    const { findInvestorByUserId, updateInvestor } = await import(
      '../../repositories/investors/investor.repository.js'
    )
    const { isInvestorPortalStatus, maybeExpireStatus } = await import(
      '../investors/investor-scope.js'
    )
    const { INVESTOR_STATUSES } = await import('../../constants/investors.js')
    let investor = await findInvestorByUserId(account.id)
    if (!investor) {
      return rejectLogin(
        account,
        'investor_missing',
        new AppError('Investor access is not configured.', 403, ERROR_CODES.FORBIDDEN),
        meta,
      )
    }
    const status = maybeExpireStatus(investor)
    if (status === INVESTOR_STATUSES.EXPIRED && investor.status !== INVESTOR_STATUSES.EXPIRED) {
      investor = (await updateInvestor(investor.id, { status: INVESTOR_STATUSES.EXPIRED })) ?? investor
    }
    if (!isInvestorPortalStatus(investor.status, new Date(), investor)) {
      await recordAuditEvent({
        action: AUDIT_ACTIONS.INVESTOR_LOGIN_DENIED,
        entityType: AUDIT_ENTITY_TYPES.INVESTOR,
        entityId: investor.id,
        actorUserId: account.id,
        organizationId: investor.organizationId,
        result: 'failure',
        metadata: { status: investor.status },
        meta,
      })
      return rejectLogin(
        account,
        'investor_inactive',
        new AppError('Investor access is not active.', 403, ERROR_CODES.FORBIDDEN),
        meta,
      )
    }
  }

  let access: AccessContext
  try {
    access = await loadAccessContextForUser(account)
  } catch (error) {
    if (error instanceof AppError) return rejectLogin(account, 'organization_inactive', error, meta)
    throw error
  }

  await recordLoginSuccess(account.id)
  const session = await issueSession(account, access)

  await recordAuditEvent({
    action: AUDIT_ACTIONS.AUTH_LOGIN,
    entityType: AUDIT_ENTITY_TYPES.AUTH,
    entityId: account.id,
    actorUserId: account.id,
    organizationId: account.organizationId,
    metadata: { role: account.role },
    meta,
  })

  return session
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

  let access: AccessContext
  try {
    access = await loadAccessContextForUser(account)
  } catch (error) {
    await revokeAllRefreshTokens(account.id)
    throw error
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

  const accessToken = signAccessToken({ sub: account.id, role: account.role })
  return {
    accessToken: accessToken.token,
    expiresIn: accessToken.expiresIn,
    refreshToken: nextRefresh.token,
    refreshExpiresAt: nextRefresh.expiresAt,
    user: toSessionUser(account, access),
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

export async function logout(
  refreshToken: string | undefined,
  meta: RequestMeta = {},
): Promise<void> {
  if (!refreshToken) return

  const userId = readRefreshUserId(refreshToken)
  if (!userId) return

  // Sign-out ends every refresh session for this account, not only the current token.
  await revokeAllRefreshTokens(userId)

  const account = await findUserById(userId)
  await recordAuditEvent({
    action: AUDIT_ACTIONS.AUTH_LOGOUT,
    entityType: AUDIT_ENTITY_TYPES.AUTH,
    entityId: userId,
    actorUserId: userId,
    organizationId: account?.organizationId,
    meta,
  })
}

export function currentSessionUser(account: AuthenticatedUser, access: AccessContext): SessionUser {
  return toSessionUser(account, access)
}

/**
 * Authenticated password change. Revokes every refresh session so other devices must sign in again.
 * Email-based reset is not implemented; see `requestPasswordResetBodySchema` as the future hook.
 */
export async function changePassword(
  account: AuthenticatedUser,
  input: ChangePasswordBody,
  meta: RequestMeta = {},
): Promise<void> {
  const credentials = await findCredentialsById(account.id)
  if (!credentials) {
    throw new AppError('Authentication is required.', 401, ERROR_CODES.UNAUTHENTICATED)
  }

  const matches = await verifyPassword(input.currentPassword, credentials.passwordHash)
  if (!matches) {
    await recordAuditEvent({
      action: AUDIT_ACTIONS.AUTH_PASSWORD_CHANGE,
      entityType: AUDIT_ENTITY_TYPES.AUTH,
      entityId: account.id,
      actorUserId: account.id,
      organizationId: account.organizationId,
      result: 'failure',
      metadata: { reason: 'current_password_mismatch' },
      meta,
    })
    throw new AppError('Current password is incorrect.', 403, ERROR_CODES.FORBIDDEN)
  }

  await updatePasswordHash(account.id, await hashPassword(input.newPassword))
  await revokeAllRefreshTokens(account.id)
  await recordAuditEvent({
    action: AUDIT_ACTIONS.AUTH_PASSWORD_CHANGE,
    entityType: AUDIT_ENTITY_TYPES.AUTH,
    entityId: account.id,
    actorUserId: account.id,
    organizationId: account.organizationId,
    meta,
  })
}

/** Full profile for GET /auth/me: session context plus organization and branch details. */
export async function getProfile(
  account: AuthenticatedUser,
  access: AccessContext,
): Promise<ProfileResource> {
  const organization = account.organizationId
    ? await findOrganizationById(account.organizationId)
    : null

  let branches: { id: string; name: string; code: string }[] = []
  if (account.organizationId) {
    const found =
      account.accessAllBranches || account.accessAllOrganizations
        ? await findBranchesByOrganization(account.organizationId)
        : await findBranchesByIds(account.branchIds)
    // Branches from another organization are never shown, even if an id was assigned in error.
    branches = found
      .filter((branch) => branch.organizationId === account.organizationId)
      .map((branch) => ({ id: branch.id, name: branch.name, code: branch.code }))
  }

  return {
    ...toSessionUser(account, access),
    phone: account.phone,
    status: account.status.toLowerCase(),
    lastLoginAt: account.lastLoginAt ? account.lastLoginAt.toISOString() : null,
    organization: organization
      ? { id: organization.id, name: organization.name, code: organization.code }
      : null,
    branches,
  }
}
