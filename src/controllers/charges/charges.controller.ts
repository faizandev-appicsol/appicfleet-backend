import { getRequestMeta } from '../../helpers/requestMeta.js'
import { sendSuccess } from '../../helpers/response.js'
import { requireAccess } from '../../middlewares/auth.middleware.js'
import { getValidated } from '../../middlewares/validation.middleware.js'
import {
  approveFine,
  createFine,
  getFine,
  listFineDirectory,
  reviewFine,
  updateFineDraftFields,
  waiveFine,
} from '../../services/charges/fine.service.js'
import {
  getImportBatch,
  listImportDirectory,
  processImport,
} from '../../services/charges/import.service.js'
import {
  disputeFine,
  recoverFine,
  recoverToll,
  resolveFineDispute,
} from '../../services/charges/recovery.service.js'
import {
  approveRefund,
  createRefund,
  executeRefund,
  getRefund,
  listRefundDirectory,
  rejectRefund,
  requestRefund,
} from '../../services/charges/refund.service.js'
import {
  approveToll,
  createToll,
  getToll,
  listTollDirectory,
  reviewToll,
  updateTollFields,
} from '../../services/charges/toll.service.js'
import type { ValidatedRequest } from '../../types/http.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import type { CustomerIdParams } from '../../validations/customer.validation.js'
import type {
  CreateFineBody,
  CreateImportBody,
  CreateRefundBody,
  CreateTollBody,
  DisputeFineBody,
  ListFinesQuery,
  ListImportsQuery,
  ListRefundsQuery,
  ListTollsQuery,
  RecoverBody,
  ResolveDisputeBody,
  ReviewFineBody,
  UpdateFineBody,
  UpdateTollBody,
} from '../../validations/charges.validation.js'

export const listFinesHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, ListFinesQuery>>(req)
  sendSuccess(res, 'Fines loaded successfully.', await listFineDirectory(requireAccess(req), query))
})

export const getFineHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Fine loaded successfully.', await getFine(requireAccess(req), params.id))
})

export const createFineHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<CreateFineBody>>(req)
  sendSuccess(res, 'Fine created successfully.', await createFine(requireAccess(req), body, getRequestMeta(req)), 201)
})

export const updateFineHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<ValidatedRequest<UpdateFineBody, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Fine updated successfully.', await updateFineDraftFields(requireAccess(req), params.id, body, getRequestMeta(req)))
})

export const reviewFineHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<ValidatedRequest<ReviewFineBody, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Fine reviewed successfully.', await reviewFine(requireAccess(req), params.id, body, getRequestMeta(req)))
})

export const approveFineHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Fine approved successfully.', await approveFine(requireAccess(req), params.id, getRequestMeta(req)))
})

export const waiveFineHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<ValidatedRequest<{ reason: string }, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Fine waived successfully.', await waiveFine(requireAccess(req), params.id, body.reason, getRequestMeta(req)))
})

export const disputeFineHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<ValidatedRequest<DisputeFineBody, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Fine disputed successfully.', await disputeFine(requireAccess(req), params.id, body, getRequestMeta(req)), 201)
})

export const resolveDisputeHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<ValidatedRequest<ResolveDisputeBody, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Dispute resolved successfully.', await resolveFineDispute(requireAccess(req), params.id, body, getRequestMeta(req)))
})

export const recoverFineHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<ValidatedRequest<RecoverBody, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Fine recovery created successfully.', await recoverFine(requireAccess(req), params.id, body ?? {}, getRequestMeta(req)), 201)
})

export const listTollsHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, ListTollsQuery>>(req)
  sendSuccess(res, 'Tolls loaded successfully.', await listTollDirectory(requireAccess(req), query))
})

export const getTollHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Toll loaded successfully.', await getToll(requireAccess(req), params.id))
})

export const createTollHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<CreateTollBody>>(req)
  sendSuccess(res, 'Toll created successfully.', await createToll(requireAccess(req), body, getRequestMeta(req)), 201)
})

export const updateTollHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<ValidatedRequest<UpdateTollBody, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Toll updated successfully.', await updateTollFields(requireAccess(req), params.id, body, getRequestMeta(req)))
})

export const reviewTollHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<ValidatedRequest<ReviewFineBody, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Toll reviewed successfully.', await reviewToll(requireAccess(req), params.id, body, getRequestMeta(req)))
})

export const approveTollHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Toll approved successfully.', await approveToll(requireAccess(req), params.id, getRequestMeta(req)))
})

export const recoverTollHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<ValidatedRequest<RecoverBody, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Toll recovery created successfully.', await recoverToll(requireAccess(req), params.id, body ?? {}, getRequestMeta(req)), 201)
})

export const listImportsHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, ListImportsQuery>>(req)
  sendSuccess(res, 'Import batches loaded successfully.', await listImportDirectory(requireAccess(req), query))
})

export const getImportHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Import batch loaded successfully.', await getImportBatch(requireAccess(req), params.id))
})

export const createImportHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<CreateImportBody>>(req)
  sendSuccess(res, 'Import processed successfully.', await processImport(requireAccess(req), body, getRequestMeta(req)), 201)
})

export const listRefundsHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, ListRefundsQuery>>(req)
  sendSuccess(res, 'Refunds loaded successfully.', await listRefundDirectory(requireAccess(req), query))
})

export const getRefundHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Refund loaded successfully.', await getRefund(requireAccess(req), params.id))
})

export const createRefundHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<CreateRefundBody>>(req)
  sendSuccess(res, 'Refund draft created successfully.', await createRefund(requireAccess(req), body, getRequestMeta(req)), 201)
})

export const requestRefundHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Refund requested successfully.', await requestRefund(requireAccess(req), params.id, getRequestMeta(req)))
})

export const approveRefundHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Refund approved successfully.', await approveRefund(requireAccess(req), params.id, getRequestMeta(req)))
})

export const rejectRefundHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<ValidatedRequest<{ reason: string }, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Refund rejected successfully.', await rejectRefund(requireAccess(req), params.id, body.reason, getRequestMeta(req)))
})

export const executeRefundHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Refund executed successfully.', await executeRefund(requireAccess(req), params.id, getRequestMeta(req)))
})
