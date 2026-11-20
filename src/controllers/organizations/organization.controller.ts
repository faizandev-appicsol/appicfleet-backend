import { getRequestMeta } from '../../helpers/requestMeta.js'
import { sendSuccess } from '../../helpers/response.js'
import { requireAccess } from '../../middlewares/auth.middleware.js'
import { getValidated } from '../../middlewares/validation.middleware.js'
import {
  addOrganization,
  changeOrganization,
  getOrganization,
  listOrganizationDirectory,
} from '../../services/organizations/organization.service.js'
import type { ValidatedRequest } from '../../types/http.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import type {
  CreateOrganizationBody,
  ListOrganizationsQuery,
  OrganizationIdParams,
  UpdateOrganizationBody,
} from '../../validations/organization.validation.js'

export const listOrganizationsHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, ListOrganizationsQuery>>(req)
  const result = await listOrganizationDirectory(requireAccess(req), query)
  sendSuccess(res, 'Organizations retrieved successfully.', result)
})

export const getOrganizationHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, OrganizationIdParams>>(req)
  const organization = await getOrganization(requireAccess(req), params.id)
  sendSuccess(res, 'Organization retrieved successfully.', organization)
})

export const createOrganizationHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<CreateOrganizationBody>>(req)
  const organization = await addOrganization(requireAccess(req), body, getRequestMeta(req))
  sendSuccess(res, 'Organization created successfully.', organization, 201)
})

export const updateOrganizationHandler = asyncHandler(async (req, res) => {
  const { body, params } =
    getValidated<ValidatedRequest<UpdateOrganizationBody, unknown, OrganizationIdParams>>(req)
  const organization = await changeOrganization(
    requireAccess(req),
    params.id,
    body,
    getRequestMeta(req),
  )
  sendSuccess(res, 'Organization updated successfully.', organization)
})
