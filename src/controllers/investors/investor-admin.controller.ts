import { getRequestMeta } from '../../helpers/requestMeta.js'
import { sendSuccess } from '../../helpers/response.js'
import { requireAccess } from '../../middlewares/auth.middleware.js'
import { getValidated } from '../../middlewares/validation.middleware.js'
import {
  activateInvestor,
  createInvestor,
  getInvestorAccess,
  getInvestorActivity,
  getInvestorAdmin,
  inviteInvestor,
  listInvestorDirectory,
  replaceInvestorAccess,
  revokeInvestor,
  suspendInvestor,
  updateInvestorProfile,
} from '../../services/investors/investor-admin.service.js'
import type { ValidatedRequest } from '../../types/http.js'
import { asyncHandler } from '../../utils/asyncHandler.js'

export const listInvestorsHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, Record<string, unknown>>>(req)
  sendSuccess(res, 'Investors loaded.', await listInvestorDirectory(requireAccess(req), query as never))
})

export const createInvestorHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<Record<string, unknown>>>(req)
  sendSuccess(res, 'Investor created.', await createInvestor(requireAccess(req), body as never, getRequestMeta(req)), 201)
})

export const getInvestorHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, { id: string }>>(req)
  sendSuccess(res, 'Investor loaded.', await getInvestorAdmin(requireAccess(req), params.id))
})

export const updateInvestorHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<ValidatedRequest<Record<string, unknown>, unknown, { id: string }>>(req)
  sendSuccess(
    res,
    'Investor updated.',
    await updateInvestorProfile(requireAccess(req), params.id, body as never, getRequestMeta(req)),
  )
})

export const inviteInvestorHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, { id: string }>>(req)
  sendSuccess(res, 'Investor invitation created.', await inviteInvestor(requireAccess(req), params.id, getRequestMeta(req)))
})

export const suspendInvestorHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<ValidatedRequest<{ reason?: string }, unknown, { id: string }>>(req)
  sendSuccess(
    res,
    'Investor suspended.',
    await suspendInvestor(requireAccess(req), params.id, body.reason, getRequestMeta(req)),
  )
})

export const revokeInvestorHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<ValidatedRequest<{ reason?: string }, unknown, { id: string }>>(req)
  sendSuccess(
    res,
    'Investor revoked.',
    await revokeInvestor(requireAccess(req), params.id, body.reason, getRequestMeta(req)),
  )
})

export const activateInvestorHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, { id: string }>>(req)
  sendSuccess(
    res,
    'Investor activated.',
    await activateInvestor(requireAccess(req), params.id, getRequestMeta(req)),
  )
})

export const getAccessHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, { id: string }>>(req)
  sendSuccess(res, 'Investor access loaded.', await getInvestorAccess(requireAccess(req), params.id))
})

export const replaceAccessHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<ValidatedRequest<Record<string, unknown>, unknown, { id: string }>>(req)
  sendSuccess(
    res,
    'Investor access updated.',
    await replaceInvestorAccess(requireAccess(req), params.id, body as never, getRequestMeta(req)),
  )
})

export const activityHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, { id: string }>>(req)
  sendSuccess(res, 'Investor activity loaded.', await getInvestorActivity(requireAccess(req), params.id))
})
