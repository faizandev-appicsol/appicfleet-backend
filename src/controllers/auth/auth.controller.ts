import { AppError } from '../../exceptions/AppError.js'
import { ERROR_CODES } from '../../exceptions/errorCodes.js'
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from '../../helpers/cookies.js'
import { sendSuccess } from '../../helpers/response.js'
import { requireUser } from '../../middlewares/auth.middleware.js'
import { getValidated } from '../../middlewares/validation.middleware.js'
import {
  currentSessionUser,
  login,
  logout,
  refresh,
  toPublicSession,
} from '../../services/auth/auth.service.js'
import type { ValidatedRequest } from '../../types/http.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import type { LoginBody, RefreshBody } from '../../validations/auth.validation.js'

export const loginHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<LoginBody>>(req)
  const session = await login(body)
  setRefreshCookie(res, session.refreshToken, session.refreshExpiresAt)
  sendSuccess(res, 'Signed in successfully.', toPublicSession(session))
})

export const logoutHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<RefreshBody>>(req)
  await logout(readRefreshCookie(req.cookies) ?? body.refreshToken)
  clearRefreshCookie(res)
  sendSuccess(res, 'Signed out successfully.', null)
})

export const refreshHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<RefreshBody>>(req)
  const refreshToken = readRefreshCookie(req.cookies) ?? body.refreshToken
  if (!refreshToken) {
    throw new AppError('Refresh token is required.', 401, ERROR_CODES.UNAUTHENTICATED)
  }

  const session = await refresh(refreshToken)
  setRefreshCookie(res, session.refreshToken, session.refreshExpiresAt)
  sendSuccess(res, 'Session refreshed successfully.', toPublicSession(session))
})

export const meHandler = asyncHandler(async (req, res) => {
  const user = currentSessionUser(requireUser(req))
  sendSuccess(res, 'Profile retrieved successfully.', user)
})
