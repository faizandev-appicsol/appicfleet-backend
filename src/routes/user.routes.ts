import { Router } from 'express'
import { PERMISSIONS } from '../constants/permissions.js'
import {
  activateUserHandler,
  assignUserBranchesHandler,
  assignUserRolesHandler,
  createUserHandler,
  deactivateUserHandler,
  deleteUserHandler,
  getUserHandler,
  listUsersHandler,
  updateUserHandler,
} from '../controllers/users/user.controller.js'
import { authenticate, requirePermission } from '../middlewares/auth.middleware.js'
import { validate } from '../middlewares/validation.middleware.js'
import {
  assignBranchesBodySchema,
  assignRolesBodySchema,
  createUserBodySchema,
  deactivateUserBodySchema,
  listUsersQuerySchema,
  updateUserBodySchema,
  userIdParamsSchema,
} from '../validations/user.validation.js'

export const userRouter = Router()

userRouter.use(authenticate)
userRouter.get(
  '/',
  requirePermission(PERMISSIONS.USERS_VIEW),
  validate({ query: listUsersQuerySchema }),
  listUsersHandler,
)
userRouter.post(
  '/',
  requirePermission(PERMISSIONS.USERS_CREATE),
  validate({ body: createUserBodySchema }),
  createUserHandler,
)
userRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.USERS_VIEW),
  validate({ params: userIdParamsSchema }),
  getUserHandler,
)
userRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.USERS_UPDATE),
  validate({ body: updateUserBodySchema, params: userIdParamsSchema }),
  updateUserHandler,
)
userRouter.post(
  '/:id/activate',
  requirePermission(PERMISSIONS.USERS_UPDATE),
  validate({ params: userIdParamsSchema }),
  activateUserHandler,
)
userRouter.post(
  '/:id/deactivate',
  requirePermission(PERMISSIONS.USERS_DEACTIVATE),
  validate({ body: deactivateUserBodySchema, params: userIdParamsSchema }),
  deactivateUserHandler,
)
userRouter.put(
  '/:id/branches',
  requirePermission(PERMISSIONS.USERS_UPDATE),
  validate({ body: assignBranchesBodySchema, params: userIdParamsSchema }),
  assignUserBranchesHandler,
)
userRouter.put(
  '/:id/roles',
  requirePermission(PERMISSIONS.USERS_UPDATE),
  requirePermission(PERMISSIONS.ROLES_MANAGE),
  validate({ body: assignRolesBodySchema, params: userIdParamsSchema }),
  assignUserRolesHandler,
)
userRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.USERS_DEACTIVATE),
  validate({ params: userIdParamsSchema }),
  deleteUserHandler,
)
