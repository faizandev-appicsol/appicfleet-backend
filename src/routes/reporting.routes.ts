import { Router } from 'express'
import { PERMISSIONS } from '../constants/permissions.js'
import {
  bookingReportHandler,
  contractReportHandler,
  customerReportHandler,
  dashboardOverviewHandler,
  eInvoiceReportHandler,
  expenseReportHandler,
  exportReportHandler,
  finesReportHandler,
  fleetUtilizationHandler,
  maintenanceReportHandler,
  paymentReportHandler,
  profitabilityReportHandler,
  receivablesReportHandler,
  refundsReportHandler,
  reportsOverviewHandler,
  revenueTrendHandler,
  vatReportHandler,
  vehicleReportHandler,
} from '../controllers/reporting/reporting.controller.js'
import { authenticate, requirePermission } from '../middlewares/auth.middleware.js'
import { validate } from '../middlewares/validation.middleware.js'
import {
  bookingReportQuerySchema,
  contractReportQuerySchema,
  customerReportQuerySchema,
  dashboardQuerySchema,
  expenseReportQuerySchema,
  exportQuerySchema,
  finesReportQuerySchema,
  maintenanceReportQuerySchema,
  paymentReportQuerySchema,
  profitabilityQuerySchema,
  refundsReportQuerySchema,
  reportScopeQuerySchema,
  revenueTrendQuerySchema,
  utilizationReportQuerySchema,
  vatReportQuerySchema,
  vehicleReportQuerySchema,
} from '../validations/reporting.validation.js'

export const reportingRouter = Router()
reportingRouter.use(authenticate)

reportingRouter.get(
  '/dashboard',
  requirePermission(PERMISSIONS.DASHBOARD_VIEW),
  validate({ query: dashboardQuerySchema }),
  dashboardOverviewHandler,
)

reportingRouter.get(
  '/reports/overview',
  requirePermission(PERMISSIONS.REPORTS_VIEW),
  validate({ query: reportScopeQuerySchema }),
  reportsOverviewHandler,
)

reportingRouter.get(
  '/reports/bookings',
  requirePermission(PERMISSIONS.REPORTS_OPERATIONAL),
  validate({ query: bookingReportQuerySchema }),
  bookingReportHandler,
)

reportingRouter.get(
  '/reports/vehicles',
  requirePermission(PERMISSIONS.REPORTS_OPERATIONAL),
  validate({ query: vehicleReportQuerySchema }),
  vehicleReportHandler,
)

reportingRouter.get(
  '/reports/fleet-utilization',
  requirePermission(PERMISSIONS.REPORTS_OPERATIONAL),
  validate({ query: utilizationReportQuerySchema }),
  fleetUtilizationHandler,
)

reportingRouter.get(
  '/reports/customers',
  requirePermission(PERMISSIONS.REPORTS_OPERATIONAL),
  validate({ query: customerReportQuerySchema }),
  customerReportHandler,
)

reportingRouter.get(
  '/reports/contracts',
  requirePermission(PERMISSIONS.REPORTS_OPERATIONAL),
  validate({ query: contractReportQuerySchema }),
  contractReportHandler,
)

reportingRouter.get(
  '/reports/payments',
  requirePermission(PERMISSIONS.REPORTS_FINANCIAL),
  validate({ query: paymentReportQuerySchema }),
  paymentReportHandler,
)

reportingRouter.get(
  '/reports/receivables',
  requirePermission(PERMISSIONS.REPORTS_FINANCIAL),
  validate({ query: reportScopeQuerySchema }),
  receivablesReportHandler,
)

reportingRouter.get(
  '/reports/expenses',
  requirePermission(PERMISSIONS.REPORTS_FINANCIAL),
  validate({ query: expenseReportQuerySchema }),
  expenseReportHandler,
)

reportingRouter.get(
  '/reports/maintenance',
  requirePermission(PERMISSIONS.REPORTS_OPERATIONAL),
  validate({ query: maintenanceReportQuerySchema }),
  maintenanceReportHandler,
)

reportingRouter.get(
  '/reports/fines',
  requirePermission(PERMISSIONS.REPORTS_OPERATIONAL),
  validate({ query: finesReportQuerySchema }),
  finesReportHandler,
)

reportingRouter.get(
  '/reports/refunds',
  requirePermission(PERMISSIONS.REPORTS_FINANCIAL),
  validate({ query: refundsReportQuerySchema }),
  refundsReportHandler,
)

reportingRouter.get(
  '/reports/vat',
  requirePermission(PERMISSIONS.REPORTS_FINANCIAL),
  validate({ query: vatReportQuerySchema }),
  vatReportHandler,
)

reportingRouter.get(
  '/reports/e-invoices',
  requirePermission(PERMISSIONS.REPORTS_FINANCIAL),
  validate({ query: reportScopeQuerySchema }),
  eInvoiceReportHandler,
)

reportingRouter.get(
  '/reports/profitability',
  requirePermission(PERMISSIONS.REPORTS_FINANCIAL),
  validate({ query: profitabilityQuerySchema }),
  profitabilityReportHandler,
)

reportingRouter.get(
  '/reports/revenue-trend',
  requirePermission(PERMISSIONS.REPORTS_FINANCIAL),
  validate({ query: revenueTrendQuerySchema }),
  revenueTrendHandler,
)

reportingRouter.get(
  '/reports/export',
  requirePermission(PERMISSIONS.REPORTS_EXPORT),
  validate({ query: exportQuerySchema }),
  exportReportHandler,
)
