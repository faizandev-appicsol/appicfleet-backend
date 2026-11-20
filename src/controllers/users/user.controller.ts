import { getRequestMeta } from '../../helpers/requestMeta.js'
import { sendSuccess } from '../../helpers/response.js'
import { requireAccess } from '../../middlewares/auth.middleware.js'
import { getValidated } from '../../middlewares/validation.middleware.js'
import {
  activateUser,
  assignUserBranches,
  assignUserRoles,
  changeUser,
  deactivateUser,
  getUser,
  inviteUser,
  listUserDirectory,
  removeUser,
} from '../../services/users/user.service.js'
import type { ValidatedRequest } from '../../types/http.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import type {
  AssignBranchesBody,
  AssignRolesBody,
  CreateUserBody,
  DeactivateUserBody,
  ListUsersQuery,
  UpdateUserBody,
  UserIdParams,
} from '../../validations/user.validation.js'

type IdRequest<TBody = unknown> = ValidatedRequest<TBody, unknown, UserIdParams>

export const listUsersHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, ListUsersQuery>>(req)
  const result = await listUserDirectory(requireAccess(req), query)
  sendSuccess(res, 'Users retrieved successfully.', result)
})

export const getUserHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<IdRequest>(req)
  const user = await getUser(requireAccess(req), params.id)
  sendSuccess(res, 'User retrieved successfully.', user)
})

export const createUserHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<CreateUserBody>>(req)
  const user = await inviteUser(requireAccess(req), body, getRequestMeta(req))
  sendSuccess(res, 'User invited successfully.', user, 201)
})

export const updateUserHandler = asyncHandler(async (req, res) => {
  const { body, params } = getValidated<IdRequest<UpdateUserBody>>(req)
  const user = await changeUser(requireAccess(req), params.id, body, getRequestMeta(req))
  sendSuccess(res, 'User updated successfully.', user)
})

export const activateUserHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<IdRequest>(req)
  const user = await activateUser(requireAccess(req), params.id, getRequestMeta(req))
  sendSuccess(res, 'User activated successfully.', user)
})

export const deactivateUserHandler = asyncHandler(async (req, res) => {
  const { body, params } = getValidated<IdRequest<DeactivateUserBody>>(req)
  const user = await deactivateUser(requireAccess(req), params.id, body, getRequestMeta(req))
  sendSuccess(res, 'User deactivated successfully.', user)
})

export const assignUserBranchesHandler = asyncHandler(async (req, res) => {
  const { body, params } = getValidated<IdRequest<AssignBranchesBody>>(req)
  const user = await assignUserBranches(requireAccess(req), params.id, body, getRequestMeta(req))
  sendSuccess(res, 'Branch access updated successfully.', user)
})

export const assignUserRolesHandler = asyncHandler(async (req, res) => {
  const { body, params } = getValidated<IdRequest<AssignRolesBody>>(req)
  const user = await assignUserRoles(requireAccess(req), params.id, body, getRequestMeta(req))
  sendSuccess(res, 'Roles updated successfully.', user)
})

export const deleteUserHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<IdRequest>(req)
  await removeUser(requireAccess(req), params.id, getRequestMeta(req))
  sendSuccess(res, 'User deleted successfully.', null)
})
