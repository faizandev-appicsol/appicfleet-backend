import { Router } from 'express'
import { PERMISSIONS } from '../constants/permissions.js'
import {
  activateInvestorHandler,
  activityHandler,
  createInvestorHandler,
  getAccessHandler,
  getInvestorHandler,
  inviteInvestorHandler,
  listInvestorsHandler,
  replaceAccessHandler,
  revokeInvestorHandler,
  suspendInvestorHandler,
  updateInvestorHandler,
} from '../controllers/investors/investor-admin.controller.js'
import {
  acceptInviteHandler,
  contractsHandler,
  exportHandler,
  filterOptionsHandler,
  financialHandler,
  fleetHandler,
  fleetVehicleHandler,
  overviewHandler,
  performanceHandler,
  profileHandler,
  reportDetailHandler,
  reportsHandler,
  updateProfileHandler,
} from '../controllers/investors/investor-portal.controller.js'
import { authenticate, requirePermission } from '../middlewares/auth.middleware.js'
import { requireActiveInvestor } from '../middlewares/investor.middleware.js'
import { validate } from '../middlewares/validation.middleware.js'
import {
  acceptInviteBodySchema,
  createInvestorBodySchema,
  idParamsSchema,
  investorExportQuerySchema,
  investorPortalQuerySchema,
  listInvestorsQuerySchema,
  reasonBodySchema,
  replaceAccessBodySchema,
  reportKeyParamsSchema,
  updateInvestorBodySchema,
  updateInvestorProfileBodySchema,
  vehicleParamsSchema,
} from '../validations/investor.validation.js'

/** Admin investor management APIs. */
export const investorsAdminRouter = Router()
investorsAdminRouter.use(authenticate)

investorsAdminRouter.get(
  '/',
  requirePermission(PERMISSIONS.INVESTORS_VIEW),
  validate({ query: listInvestorsQuerySchema }),
  listInvestorsHandler,
)
investorsAdminRouter.post(
  '/',
  requirePermission(PERMISSIONS.INVESTORS_MANAGE),
  validate({ body: createInvestorBodySchema }),
  createInvestorHandler,
)
investorsAdminRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.INVESTORS_VIEW),
  validate({ params: idParamsSchema }),
  getInvestorHandler,
)
investorsAdminRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.INVESTORS_MANAGE),
  validate({ params: idParamsSchema, body: updateInvestorBodySchema }),
  updateInvestorHandler,
)
investorsAdminRouter.post(
  '/:id/invite',
  requirePermission(PERMISSIONS.INVESTORS_INVITE),
  validate({ params: idParamsSchema }),
  inviteInvestorHandler,
)
investorsAdminRouter.post(
  '/:id/suspend',
  requirePermission(PERMISSIONS.INVESTORS_SUSPEND),
  validate({ params: idParamsSchema, body: reasonBodySchema }),
  suspendInvestorHandler,
)
investorsAdminRouter.post(
  '/:id/revoke',
  requirePermission(PERMISSIONS.INVESTORS_REVOKE),
  validate({ params: idParamsSchema, body: reasonBodySchema }),
  revokeInvestorHandler,
)
investorsAdminRouter.post(
  '/:id/activate',
  requirePermission(PERMISSIONS.INVESTORS_MANAGE),
  validate({ params: idParamsSchema }),
  activateInvestorHandler,
)
investorsAdminRouter.get(
  '/:id/access',
  requirePermission(PERMISSIONS.INVESTORS_VIEW),
  validate({ params: idParamsSchema }),
  getAccessHandler,
)
investorsAdminRouter.put(
  '/:id/access',
  requirePermission(PERMISSIONS.INVESTORS_MANAGE_ACCESS),
  validate({ params: idParamsSchema, body: replaceAccessBodySchema }),
  replaceAccessHandler,
)
investorsAdminRouter.get(
  '/:id/activity',
  requirePermission(PERMISSIONS.INVESTORS_VIEW),
  validate({ params: idParamsSchema }),
  activityHandler,
)

/** Investor portal APIs (authenticated investor only). */
export const investorPortalRouter = Router()

investorPortalRouter.post(
  '/invitations/accept',
  validate({ body: acceptInviteBodySchema }),
  acceptInviteHandler,
)

investorPortalRouter.use(authenticate, requireActiveInvestor)

investorPortalRouter.get('/overview', requirePermission(PERMISSIONS.INVESTOR_VIEW_OVERVIEW), validate({ query: investorPortalQuerySchema }), overviewHandler)
investorPortalRouter.get('/fleet', requirePermission(PERMISSIONS.INVESTOR_VIEW_FLEET), validate({ query: investorPortalQuerySchema }), fleetHandler)
investorPortalRouter.get('/fleet/:vehicleId', requirePermission(PERMISSIONS.INVESTOR_VIEW_FLEET), validate({ params: vehicleParamsSchema }), fleetVehicleHandler)
investorPortalRouter.get('/performance', requirePermission(PERMISSIONS.INVESTOR_VIEW_PERFORMANCE), validate({ query: investorPortalQuerySchema }), performanceHandler)
investorPortalRouter.get('/financial-summary', requirePermission(PERMISSIONS.INVESTOR_VIEW_FINANCIAL), validate({ query: investorPortalQuerySchema }), financialHandler)
investorPortalRouter.get('/contracts', requirePermission(PERMISSIONS.INVESTOR_VIEW_CONTRACTS), validate({ query: investorPortalQuerySchema }), contractsHandler)
investorPortalRouter.get('/reports', requirePermission(PERMISSIONS.INVESTOR_VIEW_REPORTS), reportsHandler)
investorPortalRouter.get('/reports/export', requirePermission(PERMISSIONS.INVESTOR_EXPORT), validate({ query: investorExportQuerySchema }), exportHandler)
investorPortalRouter.get('/reports/:key', requirePermission(PERMISSIONS.INVESTOR_VIEW_REPORTS), validate({ params: reportKeyParamsSchema, query: investorPortalQuerySchema }), reportDetailHandler)
investorPortalRouter.get('/profile', requirePermission(PERMISSIONS.INVESTOR_PORTAL), profileHandler)
investorPortalRouter.patch('/profile', requirePermission(PERMISSIONS.PROFILE_UPDATE), validate({ body: updateInvestorProfileBodySchema }), updateProfileHandler)
investorPortalRouter.get('/filter-options', requirePermission(PERMISSIONS.INVESTOR_PORTAL), filterOptionsHandler)
