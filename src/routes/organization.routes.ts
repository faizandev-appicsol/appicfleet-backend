import { Router } from 'express'
import { PERMISSIONS } from '../constants/permissions.js'
import {
  createOrganizationHandler,
  getOrganizationHandler,
  listOrganizationsHandler,
  updateOrganizationHandler,
} from '../controllers/organizations/organization.controller.js'
import { authenticate, requirePermission } from '../middlewares/auth.middleware.js'
import { validate } from '../middlewares/validation.middleware.js'
import {
  createOrganizationBodySchema,
  listOrganizationsQuerySchema,
  organizationIdParamsSchema,
  updateOrganizationBodySchema,
} from '../validations/organization.validation.js'

export const organizationRouter = Router()

organizationRouter.use(authenticate)
organizationRouter.get(
  '/',
  requirePermission(PERMISSIONS.ORGANIZATIONS_VIEW),
  validate({ query: listOrganizationsQuerySchema }),
  listOrganizationsHandler,
)
organizationRouter.post(
  '/',
  requirePermission(PERMISSIONS.ORGANIZATIONS_MANAGE),
  validate({ body: createOrganizationBodySchema }),
  createOrganizationHandler,
)
organizationRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.ORGANIZATIONS_VIEW),
  validate({ params: organizationIdParamsSchema }),
  getOrganizationHandler,
)
organizationRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.ORGANIZATIONS_MANAGE),
  validate({ body: updateOrganizationBodySchema, params: organizationIdParamsSchema }),
  updateOrganizationHandler,
)
