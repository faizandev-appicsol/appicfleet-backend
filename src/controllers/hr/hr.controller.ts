import { getRequestMeta } from '../../helpers/requestMeta.js'
import { sendSuccess } from '../../helpers/response.js'
import { requireAccess } from '../../middlewares/auth.middleware.js'
import { getValidated } from '../../middlewares/validation.middleware.js'
import {
  changeEmployeeStatus,
  createEmployee,
  deactivateEmployee,
  getDirectReports,
  getEmployee,
  getEmployeeHistory,
  linkEmployeeUser,
  listEmployeeDirectory,
  transferEmployee,
  unlinkEmployeeUser,
  updateEmployeeProfile,
} from '../../services/hr/employee.service.js'
import {
  createDepartment,
  getDepartment,
  listDepartmentDirectory,
  patchDepartment,
} from '../../services/hr/department.service.js'
import {
  createPosition,
  getPosition,
  listPositionDirectory,
  patchPosition,
} from '../../services/hr/position.service.js'
import {
  archiveEmployeeDocument,
  downloadEmployeeDocument,
  listDocumentExpiry,
  listEmployeeDocuments,
  uploadEmployeeDocument,
} from '../../services/hr/hr-document.service.js'
import { getHrSummary } from '../../services/hr/hr-summary.service.js'
import type { ValidatedRequest } from '../../types/http.js'
import { asyncHandler } from '../../utils/asyncHandler.js'

export const hrSummaryHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, { organizationId?: string }>>(req)
  sendSuccess(res, 'HR summary loaded.', await getHrSummary(requireAccess(req), query.organizationId))
})

export const listEmployeesHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, Record<string, unknown>>>(req)
  sendSuccess(res, 'Employees loaded.', await listEmployeeDirectory(requireAccess(req), query as never))
})

export const createEmployeeHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Employee created.',
    await createEmployee(requireAccess(req), body as never, getRequestMeta(req)),
    201,
  )
})

export const getEmployeeHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, { id: string }>>(req)
  sendSuccess(res, 'Employee loaded.', await getEmployee(requireAccess(req), params.id))
})

export const updateEmployeeHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<
    ValidatedRequest<Record<string, unknown>, unknown, { id: string }>
  >(req)
  sendSuccess(
    res,
    'Employee updated.',
    await updateEmployeeProfile(requireAccess(req), params.id, body, getRequestMeta(req)),
  )
})

export const changeStatusHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<
    ValidatedRequest<{ status: string; effectiveAt?: Date; reason?: string }, unknown, { id: string }>
  >(req)
  sendSuccess(
    res,
    'Employee status updated.',
    await changeEmployeeStatus(requireAccess(req), params.id, body, getRequestMeta(req)),
  )
})

export const transferHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<ValidatedRequest<Record<string, unknown>, unknown, { id: string }>>(
    req,
  )
  sendSuccess(
    res,
    'Employee transferred.',
    await transferEmployee(requireAccess(req), params.id, body as never, getRequestMeta(req)),
  )
})

export const linkUserHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<ValidatedRequest<{ userId: string }, unknown, { id: string }>>(req)
  sendSuccess(
    res,
    'Employee linked to user.',
    await linkEmployeeUser(requireAccess(req), params.id, body.userId, getRequestMeta(req)),
  )
})

export const unlinkUserHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, { id: string }>>(req)
  sendSuccess(
    res,
    'Employee unlinked from user.',
    await unlinkEmployeeUser(requireAccess(req), params.id, getRequestMeta(req)),
  )
})

export const historyHandler = asyncHandler(async (req, res) => {
  const { params, query } = getValidated<
    ValidatedRequest<unknown, Record<string, unknown>, { id: string }>
  >(req)
  sendSuccess(
    res,
    'Employee history loaded.',
    await getEmployeeHistory(requireAccess(req), params.id, query as never),
  )
})

export const reportsHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, { id: string }>>(req)
  sendSuccess(res, 'Direct reports loaded.', await getDirectReports(requireAccess(req), params.id))
})

export const deactivateHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, { id: string }>>(req)
  sendSuccess(
    res,
    'Employee deactivated.',
    await deactivateEmployee(requireAccess(req), params.id, getRequestMeta(req)),
  )
})

export const listDepartmentsHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, Record<string, unknown>>>(req)
  sendSuccess(res, 'Departments loaded.', await listDepartmentDirectory(requireAccess(req), query as never))
})

export const createDepartmentHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Department created.',
    await createDepartment(requireAccess(req), body as never, getRequestMeta(req)),
    201,
  )
})

export const getDepartmentHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, { id: string }>>(req)
  sendSuccess(res, 'Department loaded.', await getDepartment(requireAccess(req), params.id))
})

export const updateDepartmentHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<
    ValidatedRequest<Record<string, unknown>, unknown, { id: string }>
  >(req)
  sendSuccess(
    res,
    'Department updated.',
    await patchDepartment(requireAccess(req), params.id, body as never, getRequestMeta(req)),
  )
})

export const listPositionsHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, Record<string, unknown>>>(req)
  sendSuccess(res, 'Positions loaded.', await listPositionDirectory(requireAccess(req), query as never))
})

export const createPositionHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Position created.',
    await createPosition(requireAccess(req), body as never, getRequestMeta(req)),
    201,
  )
})

export const getPositionHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, { id: string }>>(req)
  sendSuccess(res, 'Position loaded.', await getPosition(requireAccess(req), params.id))
})

export const updatePositionHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<
    ValidatedRequest<Record<string, unknown>, unknown, { id: string }>
  >(req)
  sendSuccess(
    res,
    'Position updated.',
    await patchPosition(requireAccess(req), params.id, body as never, getRequestMeta(req)),
  )
})

export const listDocumentsHandler = asyncHandler(async (req, res) => {
  const { params, query } = getValidated<
    ValidatedRequest<unknown, Record<string, unknown>, { id: string }>
  >(req)
  sendSuccess(
    res,
    'Employee documents loaded.',
    await listEmployeeDocuments(requireAccess(req), params.id, query as never),
  )
})

export const uploadDocumentHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<
    ValidatedRequest<Record<string, unknown>, unknown, { id: string }>
  >(req)
  sendSuccess(
    res,
    'Employee document uploaded.',
    await uploadEmployeeDocument(requireAccess(req), params.id, body as never, getRequestMeta(req)),
    201,
  )
})

export const archiveDocumentHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<
    ValidatedRequest<unknown, unknown, { id: string; documentId: string }>
  >(req)
  sendSuccess(
    res,
    'Employee document archived.',
    await archiveEmployeeDocument(
      requireAccess(req),
      params.id,
      params.documentId,
      getRequestMeta(req),
    ),
  )
})

export const downloadDocumentHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<
    ValidatedRequest<unknown, unknown, { id: string; documentId: string }>
  >(req)
  const file = await downloadEmployeeDocument(requireAccess(req), params.id, params.documentId)
  res.setHeader('Content-Type', file.mimeType)
  res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`)
  res.status(200).send(file.bytes)
})

export const documentExpiryHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Document expiry list loaded.',
    await listDocumentExpiry(requireAccess(req), query as never),
  )
})
