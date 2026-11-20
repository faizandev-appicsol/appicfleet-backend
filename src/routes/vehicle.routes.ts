import { Router } from 'express'
import { PERMISSIONS } from '../constants/permissions.js'
import {
  archiveVehicleDocumentHandler,
  changeVehicleStatusHandler,
  checkVehicleAvailabilityHandler,
  createVehicleAssignmentHandler,
  createVehicleDocumentHandler,
  createVehicleHandler,
  createVehicleRateHandler,
  deleteVehicleHandler,
  downloadVehiclePhotoHandler,
  getVehicleHandler,
  getVehicleStatsHandler,
  listVehicleAssignmentsHandler,
  listVehicleDocumentsHandler,
  listVehicleMakesHandler,
  listVehicleRatesHandler,
  listVehicleTypesHandler,
  listVehiclesHandler,
  listVehicleStatusHistoryHandler,
  releaseVehicleAssignmentHandler,
  updateVehicleHandler,
  uploadVehiclePhotoHandler,
} from '../controllers/vehicles/vehicle.controller.js'
import { authenticate, requirePermission } from '../middlewares/auth.middleware.js'
import { hasPermission } from '../services/authorization/authorization.service.js'
import { AppError } from '../exceptions/AppError.js'
import { ERROR_CODES } from '../exceptions/errorCodes.js'
import type { RequestHandler } from 'express'
import { validate } from '../middlewares/validation.middleware.js'
import {
  changeVehicleStatusBodySchema,
  checkAvailabilityBodySchema,
  createVehicleAssignmentBodySchema,
  createVehicleBodySchema,
  createVehicleDocumentBodySchema,
  createVehicleRateBodySchema,
  listVehicleAssignmentsQuerySchema,
  listVehicleDocumentsQuerySchema,
  listVehicleRatesQuerySchema,
  listVehiclesQuerySchema,
  updateVehicleBodySchema,
  uploadVehiclePhotoBodySchema,
  vehicleAssignmentParamsSchema,
  vehicleDocumentParamsSchema,
  vehicleIdParamsSchema,
  vehicleStatsQuerySchema,
  vehicleStatusHistoryQuerySchema,
} from '../validations/vehicle.validation.js'

export const vehicleRouter = Router()

vehicleRouter.use(authenticate)

/** Create or update may set the primary photo (used right after register and on edit). */
const requireVehiclePhotoWrite: RequestHandler = (req, _res, next) => {
  if (!req.access) {
    next(new AppError('Authentication is required.', 401, ERROR_CODES.UNAUTHENTICATED))
    return
  }
  if (
    hasPermission(req.access, PERMISSIONS.VEHICLE_UPDATE) ||
    hasPermission(req.access, PERMISSIONS.VEHICLE_CREATE)
  ) {
    next()
    return
  }
  next(new AppError('You do not have permission to do that.', 403, ERROR_CODES.FORBIDDEN))
}

vehicleRouter.get(
  '/',
  requirePermission(PERMISSIONS.VEHICLE_VIEW),
  validate({ query: listVehiclesQuerySchema }),
  listVehiclesHandler,
)
vehicleRouter.get(
  '/stats',
  requirePermission(PERMISSIONS.VEHICLE_VIEW),
  validate({ query: vehicleStatsQuerySchema }),
  getVehicleStatsHandler,
)
vehicleRouter.get(
  '/makes',
  requirePermission(PERMISSIONS.VEHICLE_VIEW),
  listVehicleMakesHandler,
)
vehicleRouter.get(
  '/types',
  requirePermission(PERMISSIONS.VEHICLE_VIEW),
  listVehicleTypesHandler,
)
vehicleRouter.post(
  '/',
  requirePermission(PERMISSIONS.VEHICLE_CREATE),
  validate({ body: createVehicleBodySchema }),
  createVehicleHandler,
)
vehicleRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.VEHICLE_VIEW),
  validate({ params: vehicleIdParamsSchema }),
  getVehicleHandler,
)
vehicleRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.VEHICLE_UPDATE),
  validate({ body: updateVehicleBodySchema, params: vehicleIdParamsSchema }),
  updateVehicleHandler,
)
vehicleRouter.get(
  '/:id/photo',
  requirePermission(PERMISSIONS.VEHICLE_VIEW),
  validate({ params: vehicleIdParamsSchema }),
  downloadVehiclePhotoHandler,
)
vehicleRouter.post(
  '/:id/photo',
  requireVehiclePhotoWrite,
  validate({ body: uploadVehiclePhotoBodySchema, params: vehicleIdParamsSchema }),
  uploadVehiclePhotoHandler,
)
vehicleRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.VEHICLE_DEACTIVATE),
  validate({ params: vehicleIdParamsSchema }),
  deleteVehicleHandler,
)

vehicleRouter.post(
  '/:id/status',
  requirePermission(PERMISSIONS.VEHICLE_CHANGE_STATUS),
  validate({ body: changeVehicleStatusBodySchema, params: vehicleIdParamsSchema }),
  changeVehicleStatusHandler,
)
vehicleRouter.get(
  '/:id/status-history',
  requirePermission(PERMISSIONS.VEHICLE_VIEW_HISTORY),
  validate({ query: vehicleStatusHistoryQuerySchema, params: vehicleIdParamsSchema }),
  listVehicleStatusHistoryHandler,
)

vehicleRouter.get(
  '/:id/rates',
  requirePermission(PERMISSIONS.VEHICLE_VIEW),
  validate({ query: listVehicleRatesQuerySchema, params: vehicleIdParamsSchema }),
  listVehicleRatesHandler,
)
vehicleRouter.post(
  '/:id/rates',
  requirePermission(PERMISSIONS.VEHICLE_MANAGE_RATES),
  validate({ body: createVehicleRateBodySchema, params: vehicleIdParamsSchema }),
  createVehicleRateHandler,
)

vehicleRouter.get(
  '/:id/documents',
  requirePermission(PERMISSIONS.VEHICLE_VIEW),
  validate({ query: listVehicleDocumentsQuerySchema, params: vehicleIdParamsSchema }),
  listVehicleDocumentsHandler,
)
vehicleRouter.post(
  '/:id/documents',
  requirePermission(PERMISSIONS.VEHICLE_MANAGE_DOCUMENTS),
  validate({ body: createVehicleDocumentBodySchema, params: vehicleIdParamsSchema }),
  createVehicleDocumentHandler,
)
vehicleRouter.post(
  '/:id/documents/:documentId/archive',
  requirePermission(PERMISSIONS.VEHICLE_MANAGE_DOCUMENTS),
  validate({ params: vehicleDocumentParamsSchema }),
  archiveVehicleDocumentHandler,
)

vehicleRouter.post(
  '/:id/availability',
  requirePermission(PERMISSIONS.VEHICLE_CHECK_AVAILABILITY),
  validate({ body: checkAvailabilityBodySchema, params: vehicleIdParamsSchema }),
  checkVehicleAvailabilityHandler,
)
vehicleRouter.get(
  '/:id/assignments',
  requirePermission(PERMISSIONS.VEHICLE_CHECK_AVAILABILITY),
  validate({ query: listVehicleAssignmentsQuerySchema, params: vehicleIdParamsSchema }),
  listVehicleAssignmentsHandler,
)
vehicleRouter.post(
  '/:id/assignments',
  requirePermission(PERMISSIONS.VEHICLE_ALLOCATE),
  validate({ body: createVehicleAssignmentBodySchema, params: vehicleIdParamsSchema }),
  createVehicleAssignmentHandler,
)
vehicleRouter.post(
  '/:id/assignments/:assignmentId/release',
  requirePermission(PERMISSIONS.VEHICLE_ALLOCATE),
  validate({ params: vehicleAssignmentParamsSchema }),
  releaseVehicleAssignmentHandler,
)
