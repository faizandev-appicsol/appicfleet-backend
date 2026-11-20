import { Router } from 'express'
import { PERMISSIONS } from '../constants/permissions.js'
import {
  createBranchHandler,
  getBranchHandler,
  listBranchesHandler,
  updateBranchHandler,
} from '../controllers/branches/branch.controller.js'
import { authenticate, requirePermission } from '../middlewares/auth.middleware.js'
import { validate } from '../middlewares/validation.middleware.js'
import {
  branchIdParamsSchema,
  createBranchBodySchema,
  listBranchesQuerySchema,
  updateBranchBodySchema,
} from '../validations/branch.validation.js'

export const branchRouter = Router()

branchRouter.use(authenticate)
branchRouter.get(
  '/',
  requirePermission(PERMISSIONS.BRANCHES_VIEW),
  validate({ query: listBranchesQuerySchema }),
  listBranchesHandler,
)
branchRouter.post(
  '/',
  requirePermission(PERMISSIONS.BRANCHES_MANAGE),
  validate({ body: createBranchBodySchema }),
  createBranchHandler,
)
branchRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.BRANCHES_VIEW),
  validate({ params: branchIdParamsSchema }),
  getBranchHandler,
)
branchRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.BRANCHES_MANAGE),
  validate({ body: updateBranchBodySchema, params: branchIdParamsSchema }),
  updateBranchHandler,
)
