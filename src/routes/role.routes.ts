import { Router } from 'express'
import { PERMISSIONS } from '../constants/permissions.js'
import {
  assignPermissionsHandler,
  createRoleHandler,
  getRoleHandler,
  listPermissionsHandler,
  listRolesHandler,
} from '../controllers/roles/role.controller.js'
import { authenticate, requirePermission } from '../middlewares/auth.middleware.js'
import { validate } from '../middlewares/validation.middleware.js'
import {
  assignPermissionsBodySchema,
  createRoleBodySchema,
  listRolesQuerySchema,
  roleIdParamsSchema,
} from '../validations/role.validation.js'

export const roleRouter = Router()

roleRouter.use(authenticate)
roleRouter.get(
  '/',
  requirePermission(PERMISSIONS.ROLES_VIEW),
  validate({ query: listRolesQuerySchema }),
  listRolesHandler,
)
roleRouter.post(
  '/',
  requirePermission(PERMISSIONS.ROLES_MANAGE),
  validate({ body: createRoleBodySchema }),
  createRoleHandler,
)
roleRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.ROLES_VIEW),
  validate({ params: roleIdParamsSchema }),
  getRoleHandler,
)
roleRouter.put(
  '/:id/permissions',
  requirePermission(PERMISSIONS.ROLES_MANAGE),
  validate({ body: assignPermissionsBodySchema, params: roleIdParamsSchema }),
  assignPermissionsHandler,
)

/** Permission catalog: every key a role can be granted. */
export const permissionRouter = Router()

permissionRouter.use(authenticate)
permissionRouter.get('/', requirePermission(PERMISSIONS.ROLES_VIEW), listPermissionsHandler)
