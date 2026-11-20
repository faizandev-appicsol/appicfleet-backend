import { getRequestMeta } from '../../helpers/requestMeta.js'
import { sendSuccess } from '../../helpers/response.js'
import { requireAccess } from '../../middlewares/auth.middleware.js'
import { getValidated } from '../../middlewares/validation.middleware.js'
import {
  addBranch,
  changeBranch,
  getBranch,
  listBranchDirectory,
} from '../../services/branches/branch.service.js'
import type { ValidatedRequest } from '../../types/http.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import type {
  BranchIdParams,
  CreateBranchBody,
  ListBranchesQuery,
  UpdateBranchBody,
} from '../../validations/branch.validation.js'

export const listBranchesHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, ListBranchesQuery>>(req)
  const result = await listBranchDirectory(requireAccess(req), query)
  sendSuccess(res, 'Branches retrieved successfully.', result)
})

export const getBranchHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, BranchIdParams>>(req)
  const branch = await getBranch(requireAccess(req), params.id)
  sendSuccess(res, 'Branch retrieved successfully.', branch)
})

export const createBranchHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<CreateBranchBody>>(req)
  const branch = await addBranch(requireAccess(req), body, getRequestMeta(req))
  sendSuccess(res, 'Branch created successfully.', branch, 201)
})

export const updateBranchHandler = asyncHandler(async (req, res) => {
  const { body, params } =
    getValidated<ValidatedRequest<UpdateBranchBody, unknown, BranchIdParams>>(req)
  const branch = await changeBranch(requireAccess(req), params.id, body, getRequestMeta(req))
  sendSuccess(res, 'Branch updated successfully.', branch)
})
