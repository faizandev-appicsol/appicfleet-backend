import { sendSuccess } from '../../helpers/response.js'
import { requireUser } from '../../middlewares/auth.middleware.js'
import { getValidated } from '../../middlewares/validation.middleware.js'
import {
  changeUser,
  getUser,
  inviteUser,
  listUserDirectory,
  removeUser,
} from '../../services/users/user.service.js'
import type { ValidatedRequest } from '../../types/http.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import type {
  CreateUserBody,
  ListUsersQuery,
  UpdateUserBody,
  UserIdParams,
} from '../../validations/user.validation.js'

export const listUsersHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, ListUsersQuery>>(req)
  const result = await listUserDirectory(query)
  sendSuccess(res, 'Users retrieved successfully.', result)
})

export const getUserHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, UserIdParams>>(req)
  const user = await getUser(params.id)
  sendSuccess(res, 'User retrieved successfully.', user)
})

export const createUserHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<CreateUserBody>>(req)
  const user = await inviteUser(requireUser(req), body)
  sendSuccess(res, 'User invited successfully.', user, 201)
})

export const updateUserHandler = asyncHandler(async (req, res) => {
  const { body, params } =
    getValidated<ValidatedRequest<UpdateUserBody, unknown, UserIdParams>>(req)
  const user = await changeUser(requireUser(req), params.id, body)
  sendSuccess(res, 'User updated successfully.', user)
})

export const deleteUserHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, UserIdParams>>(req)
  await removeUser(requireUser(req), params.id)
  sendSuccess(res, 'User deleted successfully.', null)
})
