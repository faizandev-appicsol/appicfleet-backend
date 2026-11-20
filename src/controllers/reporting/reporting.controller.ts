import { sendSuccess } from '../../helpers/response.js'
import { requireAccess } from '../../middlewares/auth.middleware.js'
import { getValidated } from '../../middlewares/validation.middleware.js'
import { getDashboardOverview } from '../../services/reporting/dashboard.service.js'
import { exportReportCsv } from '../../services/reporting/export.service.js'
import {
  getBookingReport,
  getContractReport,
  getCustomerReport,
  getEInvoiceReport,
  getExpenseReport,
  getFinesReport,
  getFleetUtilizationReport,
  getMaintenanceReport,
  getPaymentReport,
  getProfitabilityReport,
  getReceivablesReport,
  getRefundsReport,
  getReportsOverview,
  getRevenueTrendReport,
  getVatReportForDashboard,
  getVehicleReport,
} from '../../services/reporting/report.service.js'
import type { ValidatedRequest } from '../../types/http.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import type {
  DashboardQuery,
  ExportQuery,
  ReportScopeQuery,
} from '../../validations/reporting.validation.js'

export const dashboardOverviewHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, DashboardQuery>>(req)
  sendSuccess(res, 'Dashboard overview loaded.', await getDashboardOverview(requireAccess(req), query))
})

export const reportsOverviewHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, ReportScopeQuery>>(req)
  sendSuccess(res, 'Reports overview loaded.', await getReportsOverview(requireAccess(req), query))
})

export const bookingReportHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, ReportScopeQuery>>(req)
  sendSuccess(res, 'Booking report loaded.', await getBookingReport(requireAccess(req), query as never))
})

export const vehicleReportHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, ReportScopeQuery>>(req)
  sendSuccess(res, 'Vehicle report loaded.', await getVehicleReport(requireAccess(req), query as never))
})

export const fleetUtilizationHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, ReportScopeQuery>>(req)
  sendSuccess(
    res,
    'Fleet utilization report loaded.',
    await getFleetUtilizationReport(requireAccess(req), query as never),
  )
})

export const customerReportHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, ReportScopeQuery>>(req)
  sendSuccess(res, 'Customer report loaded.', await getCustomerReport(requireAccess(req), query as never))
})

export const contractReportHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, ReportScopeQuery>>(req)
  sendSuccess(res, 'Contract report loaded.', await getContractReport(requireAccess(req), query as never))
})

export const paymentReportHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, ReportScopeQuery>>(req)
  sendSuccess(res, 'Payment report loaded.', await getPaymentReport(requireAccess(req), query as never))
})

export const receivablesReportHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, ReportScopeQuery>>(req)
  sendSuccess(res, 'Receivables report loaded.', await getReceivablesReport(requireAccess(req), query))
})

export const expenseReportHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, ReportScopeQuery>>(req)
  sendSuccess(res, 'Expense report loaded.', await getExpenseReport(requireAccess(req), query as never))
})

export const maintenanceReportHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, ReportScopeQuery>>(req)
  sendSuccess(
    res,
    'Maintenance report loaded.',
    await getMaintenanceReport(requireAccess(req), query as never),
  )
})

export const finesReportHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, ReportScopeQuery>>(req)
  sendSuccess(res, 'Fines and tolls report loaded.', await getFinesReport(requireAccess(req), query as never))
})

export const refundsReportHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, ReportScopeQuery>>(req)
  sendSuccess(res, 'Refunds report loaded.', await getRefundsReport(requireAccess(req), query as never))
})

export const vatReportHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, { legalEntityId: string; taxPeriodId?: string; organizationId?: string }>>(req)
  sendSuccess(res, 'VAT report loaded.', await getVatReportForDashboard(requireAccess(req), query))
})

export const eInvoiceReportHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, ReportScopeQuery>>(req)
  sendSuccess(res, 'E-invoice report loaded.', await getEInvoiceReport(requireAccess(req), query))
})

export const profitabilityReportHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, ReportScopeQuery>>(req)
  sendSuccess(
    res,
    'Profitability foundation loaded.',
    await getProfitabilityReport(requireAccess(req), query as never),
  )
})

export const revenueTrendHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, ReportScopeQuery>>(req)
  sendSuccess(res, 'Revenue trend loaded.', await getRevenueTrendReport(requireAccess(req), query as never))
})

export const exportReportHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, ExportQuery>>(req)
  const file = await exportReportCsv(requireAccess(req), query.kind, query as never)
  res.setHeader('Content-Type', file.contentType)
  res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`)
  res.status(200).send(file.body)
})
