import { Router } from 'express'
import { PERMISSIONS } from '../constants/permissions.js'
import {
  createLegalEntityHandler,
  getLegalEntityHandler,
  listLegalEntitiesHandler,
  updateLegalEntityHandler,
} from '../controllers/legal-entities/legal-entity.controller.js'
import { authenticate, requirePermission } from '../middlewares/auth.middleware.js'
import { validate } from '../middlewares/validation.middleware.js'
import {
  createLegalEntityBodySchema,
  legalEntityIdParamsSchema,
  listLegalEntitiesQuerySchema,
  updateLegalEntityBodySchema,
} from '../validations/legal-entity.validation.js'

export const legalEntityRouter = Router()

legalEntityRouter.use(authenticate)
legalEntityRouter.get(
  '/',
  requirePermission(PERMISSIONS.LEGAL_ENTITIES_VIEW),
  validate({ query: listLegalEntitiesQuerySchema }),
  listLegalEntitiesHandler,
)
legalEntityRouter.post(
  '/',
  requirePermission(PERMISSIONS.LEGAL_ENTITIES_MANAGE),
  validate({ body: createLegalEntityBodySchema }),
  createLegalEntityHandler,
)
legalEntityRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.LEGAL_ENTITIES_VIEW),
  validate({ params: legalEntityIdParamsSchema }),
  getLegalEntityHandler,
)
legalEntityRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.LEGAL_ENTITIES_MANAGE),
  validate({ body: updateLegalEntityBodySchema, params: legalEntityIdParamsSchema }),
  updateLegalEntityHandler,
)
