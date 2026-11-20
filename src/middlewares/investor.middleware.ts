import type { RequestHandler } from 'express'
import { ROLES } from '../constants/roles.js'
import { AppError } from '../exceptions/AppError.js'
import { ERROR_CODES } from '../exceptions/errorCodes.js'
import { findInvestorByUserId, updateInvestor } from '../repositories/investors/investor.repository.js'
import { INVESTOR_STATUSES } from '../constants/investors.js'
import {
  isInvestorPortalStatus,
  maybeExpireStatus,
} from '../services/investors/investor-scope.js'
import type { InvestorRecord } from '../repositories/investors/investor.repository.js'
import { asyncHandler } from '../utils/asyncHandler.js'

declare module 'express-serve-static-core' {
  interface Request {
    investor?: InvestorRecord
  }
}

/**
 * Loads the investor profile for the authenticated user from the database (never from the token).
 * Suspended / revoked / expired investors are denied.
 */
export const requireActiveInvestor: RequestHandler = asyncHandler(async (req, _res, next) => {
  if (!req.user || !req.access) {
    throw new AppError('Authentication is required.', 401, ERROR_CODES.UNAUTHENTICATED)
  }
  if (req.user.role !== ROLES.INVESTOR) {
    throw new AppError('Investor portal access is required.', 403, ERROR_CODES.FORBIDDEN)
  }

  let investor = await findInvestorByUserId(req.user.id)
  if (!investor) {
    throw new AppError('Investor portal access is required.', 403, ERROR_CODES.FORBIDDEN)
  }

  const status = maybeExpireStatus(investor)
  if (status === INVESTOR_STATUSES.EXPIRED && investor.status !== INVESTOR_STATUSES.EXPIRED) {
    investor = (await updateInvestor(investor.id, { status: INVESTOR_STATUSES.EXPIRED })) ?? investor
  }

  if (!isInvestorPortalStatus(investor.status, new Date(), investor)) {
    throw new AppError('Investor access is not active.', 403, ERROR_CODES.FORBIDDEN)
  }

  req.investor = investor
  next()
})

export function requireInvestor(req: { investor?: InvestorRecord }): InvestorRecord {
  if (!req.investor) {
    throw new AppError('Investor portal access is required.', 403, ERROR_CODES.FORBIDDEN)
  }
  return req.investor
}
