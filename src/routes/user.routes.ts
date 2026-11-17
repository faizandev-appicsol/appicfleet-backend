import { Router } from 'express'
import { PERMISSIONS } from '../constants/permissions.js'
import {
  createUserHandler,
  deleteUserHandler,
  getUserHandler,
  listUsersHandler,
  updateUserHandler,
} from '../controllers/users/user.controller.js'
import { authenticate, requirePermission } from '../middlewares/auth.middleware.js'
import { validate } from '../middlewares/validation.middleware.js'
import {
  createUserBodySchema,
  listUsersQuerySchema,
  updateUserBodySchema,
  userIdParamsSchema,
} from '../validations/user.validation.js'

export const userRouter = Router()

userRouter.use(authenticate)
userRouter.get(
  '/',
  requirePermission(PERMISSIONS.USERS_READ),
  validate({ query: listUsersQuerySchema }),
  listUsersHandler,
)
userRouter.post(
  '/',
  requirePermission(PERMISSIONS.USERS_WRITE),
  validate({ body: createUserBodySchema }),
  createUserHandler,
)
userRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.USERS_READ),
  validate({ params: userIdParamsSchema }),
  getUserHandler,
)
userRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.USERS_WRITE),
  validate({ body: updateUserBodySchema, params: userIdParamsSchema }),
  updateUserHandler,
)
userRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.USERS_WRITE),
  validate({ params: userIdParamsSchema }),
  deleteUserHandler,
)
