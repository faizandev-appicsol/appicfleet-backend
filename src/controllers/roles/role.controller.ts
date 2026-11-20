import { getRequestMeta } from '../../helpers/requestMeta.js'
import { sendSuccess } from '../../helpers/response.js'
import { requireAccess } from '../../middlewares/auth.middleware.js'
import { getValidated } from '../../middlewares/validation.middleware.js'
import {
  addCustomRole,
  assignRolePermissions,
  getRole,
  listPermissionCatalog,
  listRoleDirectory,
} from '../../services/roles/role.service.js'
import type { ValidatedRequest } from '../../types/http.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import type {
  AssignPermissionsBody,
  CreateRoleBody,
  ListRolesQuery,
  RoleIdParams,
} from '../../validations/role.validation.js'

export const listRolesHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, ListRolesQuery>>(req)
  const result = await listRoleDirectory(requireAccess(req), query)
  sendSuccess(res, 'Roles retrieved successfully.', result)
})

export const getRoleHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, RoleIdParams>>(req)
  const role = await getRole(requireAccess(req), params.id)
  sendSuccess(res, 'Role retrieved successfully.', role)
})

export const createRoleHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<CreateRoleBody>>(req)
  const role = await addCustomRole(requireAccess(req), body, getRequestMeta(req))
  sendSuccess(res, 'Role created successfully.', role, 201)
})

export const assignPermissionsHandler = asyncHandler(async (req, res) => {
  const { body, params } =
    getValidated<ValidatedRequest<AssignPermissionsBody, unknown, RoleIdParams>>(req)
  const role = await assignRolePermissions(requireAccess(req), params.id, body, getRequestMeta(req))
  sendSuccess(res, 'Role permissions updated successfully.', role)
})

export const listPermissionsHandler = asyncHandler(async (_req, res) => {
  sendSuccess(res, 'Permissions retrieved successfully.', listPermissionCatalog())
})
