import { getRequestMeta } from '../../helpers/requestMeta.js'
import { sendSuccess } from '../../helpers/response.js'
import { requireAccess } from '../../middlewares/auth.middleware.js'
import { requireInvestor } from '../../middlewares/investor.middleware.js'
import { getValidated } from '../../middlewares/validation.middleware.js'
import { acceptInvestorInvitation } from '../../services/investors/investor-admin.service.js'
import {
  exportInvestorReportCsv,
  getInvestorFilterOptions,
  getInvestorFinancialSummary,
  getInvestorOverview,
  getInvestorPerformance,
  getInvestorPortalProfile,
  getInvestorVehicle,
  listInvestorContracts,
  listInvestorFleet,
  listInvestorReports,
  runInvestorReport,
  updateInvestorPortalProfile,
} from '../../services/investors/investor-portal.service.js'
import type { ValidatedRequest } from '../../types/http.js'
import { asyncHandler } from '../../utils/asyncHandler.js'

export const acceptInviteHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<{ token: string; password: string; name?: string }>>(req)
  sendSuccess(res, 'Invitation accepted.', await acceptInvestorInvitation(body))
})

export const overviewHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Investor overview loaded.',
    await getInvestorOverview(requireAccess(req), requireInvestor(req), query as never),
  )
})

export const fleetHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Investor fleet loaded.',
    await listInvestorFleet(requireAccess(req), requireInvestor(req), query as never),
  )
})

export const fleetVehicleHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, { vehicleId: string }>>(req)
  sendSuccess(
    res,
    'Investor vehicle loaded.',
    await getInvestorVehicle(requireAccess(req), requireInvestor(req), params.vehicleId),
  )
})

export const performanceHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Investor performance loaded.',
    await getInvestorPerformance(requireAccess(req), requireInvestor(req), query as never),
  )
})

export const financialHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Investor financial summary loaded.',
    await getInvestorFinancialSummary(requireAccess(req), requireInvestor(req), query as never),
  )
})

export const contractsHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Investor contracts loaded.',
    await listInvestorContracts(requireAccess(req), requireInvestor(req), query as never),
  )
})

export const reportsHandler = asyncHandler(async (req, res) => {
  sendSuccess(res, 'Investor reports loaded.', await listInvestorReports(requireAccess(req), requireInvestor(req)))
})

export const reportDetailHandler = asyncHandler(async (req, res) => {
  const { params, query } = getValidated<
    ValidatedRequest<unknown, Record<string, unknown>, { key: string }>
  >(req)
  sendSuccess(
    res,
    'Investor report loaded.',
    await runInvestorReport(requireAccess(req), requireInvestor(req), params.key, query as never),
  )
})

export const exportHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, { key: string }>>(req)
  const file = await exportInvestorReportCsv(
    requireAccess(req),
    requireInvestor(req),
    query.key,
    getRequestMeta(req),
  )
  res.setHeader('Content-Type', file.contentType)
  res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`)
  res.status(200).send(file.body)
})

export const profileHandler = asyncHandler(async (req, res) => {
  sendSuccess(
    res,
    'Investor profile loaded.',
    await getInvestorPortalProfile(requireAccess(req), requireInvestor(req)),
  )
})

export const updateProfileHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<{ displayName?: string; phone?: string | null }>>(req)
  sendSuccess(
    res,
    'Investor profile updated.',
    await updateInvestorPortalProfile(requireAccess(req), requireInvestor(req), body),
  )
})

export const filterOptionsHandler = asyncHandler(async (req, res) => {
  sendSuccess(res, 'Investor filter options loaded.', getInvestorFilterOptions(requireInvestor(req)))
})
