import { getRequestMeta } from '../../helpers/requestMeta.js'
import { sendSuccess } from '../../helpers/response.js'
import { requireAccess } from '../../middlewares/auth.middleware.js'
import { getValidated } from '../../middlewares/validation.middleware.js'
import {
  checkAvailability,
  createAssignment,
  listAssignments,
  releaseAssignment,
} from '../../services/vehicles/availability.service.js'
import {
  archiveDocument,
  createDocument,
  listDocuments,
} from '../../services/vehicles/document.service.js'
import { createRate, listRates } from '../../services/vehicles/rate.service.js'
import {
  downloadVehiclePhoto,
  uploadVehiclePhoto,
} from '../../services/vehicles/vehicle-photo.service.js'
import {
  addVehicle,
  changeVehicle,
  changeVehicleStatus,
  deleteVehicle,
  getVehicle,
  getVehicleRegisterStats,
  listVehicleDirectory,
  listVehicleMakes,
  listVehicleStatusHistory,
  listVehicleTypes,
} from '../../services/vehicles/vehicle.service.js'
import type { ValidatedRequest } from '../../types/http.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import type {
  ChangeVehicleStatusBody,
  CheckAvailabilityBody,
  CreateVehicleAssignmentBody,
  CreateVehicleBody,
  CreateVehicleDocumentBody,
  CreateVehicleRateBody,
  ListVehicleAssignmentsQuery,
  ListVehicleDocumentsQuery,
  ListVehicleRatesQuery,
  ListVehiclesQuery,
  UpdateVehicleBody,
  UploadVehiclePhotoBody,
  VehicleAssignmentParams,
  VehicleDocumentParams,
  VehicleIdParams,
  VehicleStatsQuery,
  VehicleStatusHistoryQuery,
} from '../../validations/vehicle.validation.js'

function asciiFilename(filename: string): string {
  return filename.replace(/[^A-Za-z0-9._-]/g, '_')
}

export const listVehiclesHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, ListVehiclesQuery>>(req)
  const result = await listVehicleDirectory(requireAccess(req), query)
  sendSuccess(res, 'Vehicles retrieved successfully.', result)
})

export const getVehicleStatsHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, VehicleStatsQuery>>(req)
  const result = await getVehicleRegisterStats(requireAccess(req), query)
  sendSuccess(res, 'Vehicle stats retrieved successfully.', result)
})

export const listVehicleMakesHandler = asyncHandler(async (req, res) => {
  const organizationId =
    typeof req.query.organizationId === 'string' ? req.query.organizationId : undefined
  const result = await listVehicleMakes(requireAccess(req), organizationId)
  sendSuccess(res, 'Vehicle makes retrieved successfully.', result)
})

export const listVehicleTypesHandler = asyncHandler(async (req, res) => {
  const organizationId =
    typeof req.query.organizationId === 'string' ? req.query.organizationId : undefined
  const result = await listVehicleTypes(requireAccess(req), organizationId)
  sendSuccess(res, 'Vehicle types retrieved successfully.', result)
})

export const createVehicleHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<CreateVehicleBody>>(req)
  const vehicle = await addVehicle(requireAccess(req), body, getRequestMeta(req))
  sendSuccess(res, 'Vehicle created successfully.', vehicle, 201)
})

export const uploadVehiclePhotoHandler = asyncHandler(async (req, res) => {
  const { body, params } =
    getValidated<ValidatedRequest<UploadVehiclePhotoBody, unknown, VehicleIdParams>>(req)
  const vehicle = await uploadVehiclePhoto(
    requireAccess(req),
    params.id,
    body,
    getRequestMeta(req),
  )
  sendSuccess(res, 'Vehicle photo uploaded successfully.', vehicle)
})

export const downloadVehiclePhotoHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, VehicleIdParams>>(req)
  const file = await downloadVehiclePhoto(requireAccess(req), params.id)
  res.setHeader('Content-Type', file.mimeType)
  res.setHeader('Content-Length', String(file.bytes.length))
  res.setHeader(
    'Content-Disposition',
    `inline; filename="${asciiFilename(file.filename)}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
  )
  res.setHeader('Cache-Control', 'private, max-age=300')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.status(200).end(file.bytes)
})

export const getVehicleHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, VehicleIdParams>>(req)
  const vehicle = await getVehicle(requireAccess(req), params.id)
  sendSuccess(res, 'Vehicle retrieved successfully.', vehicle)
})

export const updateVehicleHandler = asyncHandler(async (req, res) => {
  const { body, params } =
    getValidated<ValidatedRequest<UpdateVehicleBody, unknown, VehicleIdParams>>(req)
  const vehicle = await changeVehicle(requireAccess(req), params.id, body, getRequestMeta(req))
  sendSuccess(res, 'Vehicle updated successfully.', vehicle)
})

export const deleteVehicleHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, VehicleIdParams>>(req)
  await deleteVehicle(requireAccess(req), params.id, getRequestMeta(req))
  sendSuccess(res, 'Vehicle deleted successfully.', null)
})

export const changeVehicleStatusHandler = asyncHandler(async (req, res) => {
  const { body, params } =
    getValidated<ValidatedRequest<ChangeVehicleStatusBody, unknown, VehicleIdParams>>(req)
  const vehicle = await changeVehicleStatus(requireAccess(req), params.id, body, getRequestMeta(req))
  sendSuccess(res, 'Vehicle status updated successfully.', vehicle)
})

export const listVehicleStatusHistoryHandler = asyncHandler(async (req, res) => {
  const { query, params } =
    getValidated<ValidatedRequest<unknown, VehicleStatusHistoryQuery, VehicleIdParams>>(req)
  const result = await listVehicleStatusHistory(requireAccess(req), params.id, query)
  sendSuccess(res, 'Vehicle status history retrieved successfully.', result)
})

export const listVehicleRatesHandler = asyncHandler(async (req, res) => {
  const { query, params } =
    getValidated<ValidatedRequest<unknown, ListVehicleRatesQuery, VehicleIdParams>>(req)
  const result = await listRates(requireAccess(req), params.id, query)
  sendSuccess(res, 'Vehicle rates retrieved successfully.', result)
})

export const createVehicleRateHandler = asyncHandler(async (req, res) => {
  const { body, params } =
    getValidated<ValidatedRequest<CreateVehicleRateBody, unknown, VehicleIdParams>>(req)
  const rate = await createRate(requireAccess(req), params.id, body, getRequestMeta(req))
  sendSuccess(res, 'Vehicle rate created successfully.', rate, 201)
})

export const listVehicleDocumentsHandler = asyncHandler(async (req, res) => {
  const { query, params } =
    getValidated<ValidatedRequest<unknown, ListVehicleDocumentsQuery, VehicleIdParams>>(req)
  const result = await listDocuments(requireAccess(req), params.id, query)
  sendSuccess(res, 'Vehicle documents retrieved successfully.', result)
})

export const createVehicleDocumentHandler = asyncHandler(async (req, res) => {
  const { body, params } =
    getValidated<ValidatedRequest<CreateVehicleDocumentBody, unknown, VehicleIdParams>>(req)
  const document = await createDocument(requireAccess(req), params.id, body, getRequestMeta(req))
  sendSuccess(res, 'Vehicle document created successfully.', document, 201)
})

export const archiveVehicleDocumentHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, VehicleDocumentParams>>(req)
  const document = await archiveDocument(
    requireAccess(req),
    params.id,
    params.documentId,
    getRequestMeta(req),
  )
  sendSuccess(res, 'Vehicle document archived successfully.', document)
})

export const checkVehicleAvailabilityHandler = asyncHandler(async (req, res) => {
  const { body, params } =
    getValidated<ValidatedRequest<CheckAvailabilityBody, unknown, VehicleIdParams>>(req)
  const result = await checkAvailability(requireAccess(req), params.id, body)
  sendSuccess(res, 'Vehicle availability checked successfully.', result)
})

export const listVehicleAssignmentsHandler = asyncHandler(async (req, res) => {
  const { query, params } =
    getValidated<ValidatedRequest<unknown, ListVehicleAssignmentsQuery, VehicleIdParams>>(req)
  const result = await listAssignments(requireAccess(req), params.id, query)
  sendSuccess(res, 'Vehicle assignments retrieved successfully.', result)
})

export const createVehicleAssignmentHandler = asyncHandler(async (req, res) => {
  const { body, params } =
    getValidated<ValidatedRequest<CreateVehicleAssignmentBody, unknown, VehicleIdParams>>(req)
  const assignment = await createAssignment(requireAccess(req), params.id, body, getRequestMeta(req))
  sendSuccess(res, 'Vehicle assignment created successfully.', assignment, 201)
})

export const releaseVehicleAssignmentHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, VehicleAssignmentParams>>(req)
  const assignment = await releaseAssignment(
    requireAccess(req),
    params.id,
    params.assignmentId,
    getRequestMeta(req),
  )
  sendSuccess(res, 'Vehicle assignment released successfully.', assignment)
})
