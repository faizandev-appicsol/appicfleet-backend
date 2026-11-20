import { getRequestMeta } from '../../helpers/requestMeta.js'
import { sendSuccess } from '../../helpers/response.js'
import { requireAccess } from '../../middlewares/auth.middleware.js'
import { getValidated } from '../../middlewares/validation.middleware.js'
import {
  addLegalEntity,
  changeLegalEntity,
  getLegalEntity,
  listLegalEntityDirectory,
} from '../../services/legal-entities/legal-entity.service.js'
import type { ValidatedRequest } from '../../types/http.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import type {
  CreateLegalEntityBody,
  LegalEntityIdParams,
  ListLegalEntitiesQuery,
  UpdateLegalEntityBody,
} from '../../validations/legal-entity.validation.js'

export const listLegalEntitiesHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, ListLegalEntitiesQuery>>(req)
  const result = await listLegalEntityDirectory(requireAccess(req), query)
  sendSuccess(res, 'Legal entities retrieved successfully.', result)
})

export const getLegalEntityHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, LegalEntityIdParams>>(req)
  const entity = await getLegalEntity(requireAccess(req), params.id)
  sendSuccess(res, 'Legal entity retrieved successfully.', entity)
})

export const createLegalEntityHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<CreateLegalEntityBody>>(req)
  const entity = await addLegalEntity(requireAccess(req), body, getRequestMeta(req))
  sendSuccess(res, 'Legal entity created successfully.', entity, 201)
})

export const updateLegalEntityHandler = asyncHandler(async (req, res) => {
  const { body, params } =
    getValidated<ValidatedRequest<UpdateLegalEntityBody, unknown, LegalEntityIdParams>>(req)
  const entity = await changeLegalEntity(requireAccess(req), params.id, body, getRequestMeta(req))
  sendSuccess(res, 'Legal entity updated successfully.', entity)
})
