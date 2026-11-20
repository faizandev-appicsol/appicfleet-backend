import { Router } from 'express'
import { PERMISSIONS } from '../constants/permissions.js'
import {
  archiveDocumentHandler,
  changeStatusHandler,
  createDepartmentHandler,
  createEmployeeHandler,
  createPositionHandler,
  deactivateHandler,
  documentExpiryHandler,
  downloadDocumentHandler,
  getDepartmentHandler,
  getEmployeeHandler,
  getPositionHandler,
  historyHandler,
  hrSummaryHandler,
  linkUserHandler,
  listDepartmentsHandler,
  listDocumentsHandler,
  listEmployeesHandler,
  listPositionsHandler,
  reportsHandler,
  transferHandler,
  unlinkUserHandler,
  updateDepartmentHandler,
  updateEmployeeHandler,
  updatePositionHandler,
  uploadDocumentHandler,
} from '../controllers/hr/hr.controller.js'
import { authenticate, requirePermission } from '../middlewares/auth.middleware.js'
import { validate } from '../middlewares/validation.middleware.js'
import { idParamsSchema } from '../validations/common.validation.js'
import {
  changeStatusBodySchema,
  createDepartmentBodySchema,
  createEmployeeBodySchema,
  createPositionBodySchema,
  documentParamsSchema,
  linkUserBodySchema,
  hrSummaryQuerySchema,
  listDepartmentsQuerySchema,
  listEmployeesQuerySchema,
  listExpiryQuerySchema,
  listPositionsQuerySchema,
  transferBodySchema,
  updateDepartmentBodySchema,
  updateEmployeeBodySchema,
  updatePositionBodySchema,
  uploadHrDocumentBodySchema,
} from '../validations/hr.validation.js'

export const hrRouter = Router()
hrRouter.use(authenticate)

hrRouter.get(
  '/summary',
  requirePermission(PERMISSIONS.HR_EMPLOYEE_VIEW),
  validate({ query: hrSummaryQuerySchema }),
  hrSummaryHandler,
)

hrRouter.get(
  '/document-expiry',
  requirePermission(PERMISSIONS.HR_EMPLOYEE_DOCUMENT_VIEW),
  validate({ query: listExpiryQuerySchema }),
  documentExpiryHandler,
)

hrRouter.get(
  '/employees',
  requirePermission(PERMISSIONS.HR_EMPLOYEE_VIEW),
  validate({ query: listEmployeesQuerySchema }),
  listEmployeesHandler,
)
hrRouter.post(
  '/employees',
  requirePermission(PERMISSIONS.HR_EMPLOYEE_CREATE),
  validate({ body: createEmployeeBodySchema }),
  createEmployeeHandler,
)
hrRouter.get(
  '/employees/:id',
  requirePermission(PERMISSIONS.HR_EMPLOYEE_VIEW),
  validate({ params: idParamsSchema }),
  getEmployeeHandler,
)
hrRouter.patch(
  '/employees/:id',
  requirePermission(PERMISSIONS.HR_EMPLOYEE_UPDATE),
  validate({ params: idParamsSchema, body: updateEmployeeBodySchema }),
  updateEmployeeHandler,
)
hrRouter.post(
  '/employees/:id/status',
  requirePermission(PERMISSIONS.HR_EMPLOYEE_STATUS_MANAGE),
  validate({ params: idParamsSchema, body: changeStatusBodySchema }),
  changeStatusHandler,
)
hrRouter.post(
  '/employees/:id/transfer',
  requirePermission(PERMISSIONS.HR_EMPLOYEE_TRANSFER_MANAGE),
  validate({ params: idParamsSchema, body: transferBodySchema }),
  transferHandler,
)
hrRouter.post(
  '/employees/:id/link-user',
  requirePermission(PERMISSIONS.HR_EMPLOYEE_UPDATE),
  validate({ params: idParamsSchema, body: linkUserBodySchema }),
  linkUserHandler,
)
hrRouter.post(
  '/employees/:id/unlink-user',
  requirePermission(PERMISSIONS.HR_EMPLOYEE_UPDATE),
  validate({ params: idParamsSchema }),
  unlinkUserHandler,
)
hrRouter.get(
  '/employees/:id/history',
  requirePermission(PERMISSIONS.HR_EMPLOYEE_VIEW),
  validate({ params: idParamsSchema }),
  historyHandler,
)
hrRouter.get(
  '/employees/:id/reports',
  requirePermission(PERMISSIONS.HR_EMPLOYEE_VIEW),
  validate({ params: idParamsSchema }),
  reportsHandler,
)
hrRouter.post(
  '/employees/:id/deactivate',
  requirePermission(PERMISSIONS.HR_EMPLOYEE_DELETE),
  validate({ params: idParamsSchema }),
  deactivateHandler,
)

hrRouter.get(
  '/employees/:id/documents',
  requirePermission(PERMISSIONS.HR_EMPLOYEE_DOCUMENT_VIEW),
  validate({ params: idParamsSchema }),
  listDocumentsHandler,
)
hrRouter.post(
  '/employees/:id/documents',
  requirePermission(PERMISSIONS.HR_EMPLOYEE_DOCUMENT_MANAGE),
  validate({ params: idParamsSchema, body: uploadHrDocumentBodySchema }),
  uploadDocumentHandler,
)
hrRouter.post(
  '/employees/:id/documents/:documentId/archive',
  requirePermission(PERMISSIONS.HR_EMPLOYEE_DOCUMENT_MANAGE),
  validate({ params: documentParamsSchema }),
  archiveDocumentHandler,
)
hrRouter.get(
  '/employees/:id/documents/:documentId/download',
  requirePermission(PERMISSIONS.HR_EMPLOYEE_DOCUMENT_VIEW),
  validate({ params: documentParamsSchema }),
  downloadDocumentHandler,
)

hrRouter.get(
  '/departments',
  requirePermission(PERMISSIONS.HR_DEPARTMENT_VIEW),
  validate({ query: listDepartmentsQuerySchema }),
  listDepartmentsHandler,
)
hrRouter.post(
  '/departments',
  requirePermission(PERMISSIONS.HR_DEPARTMENT_MANAGE),
  validate({ body: createDepartmentBodySchema }),
  createDepartmentHandler,
)
hrRouter.get(
  '/departments/:id',
  requirePermission(PERMISSIONS.HR_DEPARTMENT_VIEW),
  validate({ params: idParamsSchema }),
  getDepartmentHandler,
)
hrRouter.patch(
  '/departments/:id',
  requirePermission(PERMISSIONS.HR_DEPARTMENT_MANAGE),
  validate({ params: idParamsSchema, body: updateDepartmentBodySchema }),
  updateDepartmentHandler,
)

hrRouter.get(
  '/positions',
  requirePermission(PERMISSIONS.HR_POSITION_VIEW),
  validate({ query: listPositionsQuerySchema }),
  listPositionsHandler,
)
hrRouter.post(
  '/positions',
  requirePermission(PERMISSIONS.HR_POSITION_MANAGE),
  validate({ body: createPositionBodySchema }),
  createPositionHandler,
)
hrRouter.get(
  '/positions/:id',
  requirePermission(PERMISSIONS.HR_POSITION_VIEW),
  validate({ params: idParamsSchema }),
  getPositionHandler,
)
hrRouter.patch(
  '/positions/:id',
  requirePermission(PERMISSIONS.HR_POSITION_MANAGE),
  validate({ params: idParamsSchema, body: updatePositionBodySchema }),
  updatePositionHandler,
)
