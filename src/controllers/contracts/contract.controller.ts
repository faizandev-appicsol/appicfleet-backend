import { getRequestMeta } from '../../helpers/requestMeta.js'
import { sendSuccess } from '../../helpers/response.js'
import { requireAccess } from '../../middlewares/auth.middleware.js'
import { getValidated } from '../../middlewares/validation.middleware.js'
import {
  activateContract,
  addTerms,
  amendPricing,
  applySignatureCallback,
  approveContract,
  cancelContract,
  completeContract,
  convertBookingToContract,
  createDraft,
  extendContract,
  getContract,
  listContractDirectory,
  quoteForCaller,
  recordHandover,
  recordReturn,
  rejectContract,
  replaceVehicle,
  resumeContract,
  signContract,
  submitForApproval,
  suspendContract,
  terminateContract,
  updateDraft,
} from '../../services/contracts/contract.service.js'
import type { ValidatedRequest } from '../../types/http.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import type { CustomerIdParams } from '../../validations/customer.validation.js'
import type {
  AmendPricingBody,
  CreateContractBody,
  ExtendContractBody,
  HandoverBody,
  ListContractsQuery,
  QuoteQuery,
  ReplaceVehicleBody,
  ReturnBody,
  SignatureBody,
  SignatureCallbackBody,
  UpdateContractBody,
} from '../../validations/contract.validation.js'

const reasonOf = (body: { reason: string }) => body.reason

export const listContractsHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, ListContractsQuery>>(req)
  const page = await listContractDirectory(requireAccess(req), query)
  sendSuccess(res, 'Contracts loaded successfully.', page)
})

export const quoteHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, QuoteQuery>>(req)
  const quote = await quoteForCaller(requireAccess(req), query)
  sendSuccess(res, 'Contract quote loaded successfully.', quote)
})

export const createContractHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<CreateContractBody>>(req)
  const contract = await createDraft(requireAccess(req), body, getRequestMeta(req))
  sendSuccess(res, 'Contract draft saved successfully.', contract, 201)
})

export const convertFromBookingHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerIdParams>>(req)
  const contract = await convertBookingToContract(requireAccess(req), params.id, getRequestMeta(req))
  sendSuccess(res, 'Booking converted to a contract.', contract, contract.bookingId ? 200 : 201)
})

export const signatureCallbackHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<SignatureCallbackBody>>(req)
  const result = await applySignatureCallback(requireAccess(req), body, getRequestMeta(req))
  sendSuccess(res, result.duplicate ? 'Signature event already processed.' : 'Signature event processed.', result)
})

export const getContractHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerIdParams>>(req)
  const contract = await getContract(requireAccess(req), params.id)
  sendSuccess(res, 'Contract loaded successfully.', contract)
})

export const updateContractHandler = asyncHandler(async (req, res) => {
  const { body, params } = getValidated<ValidatedRequest<UpdateContractBody, unknown, CustomerIdParams>>(req)
  const contract = await updateDraft(requireAccess(req), params.id, body, getRequestMeta(req))
  sendSuccess(res, 'Contract draft updated successfully.', contract)
})

export const submitContractHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerIdParams>>(req)
  const contract = await submitForApproval(requireAccess(req), params.id, getRequestMeta(req))
  sendSuccess(res, 'Contract submitted for approval.', contract)
})

export const approveContractHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerIdParams>>(req)
  const contract = await approveContract(requireAccess(req), params.id, getRequestMeta(req))
  sendSuccess(res, 'Contract approved successfully.', contract)
})

export const rejectContractHandler = asyncHandler(async (req, res) => {
  const { body, params } = getValidated<ValidatedRequest<{ reason: string }, unknown, CustomerIdParams>>(req)
  const contract = await rejectContract(requireAccess(req), params.id, reasonOf(body), getRequestMeta(req))
  sendSuccess(res, 'Contract rejected successfully.', contract)
})

export const activateContractHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerIdParams>>(req)
  const contract = await activateContract(requireAccess(req), params.id, getRequestMeta(req))
  sendSuccess(res, 'Contract activated successfully.', contract)
})

export const suspendContractHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerIdParams>>(req)
  const contract = await suspendContract(requireAccess(req), params.id, getRequestMeta(req))
  sendSuccess(res, 'Contract suspended successfully.', contract)
})

export const resumeContractHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerIdParams>>(req)
  const contract = await resumeContract(requireAccess(req), params.id, getRequestMeta(req))
  sendSuccess(res, 'Contract resumed successfully.', contract)
})

export const completeContractHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerIdParams>>(req)
  const contract = await completeContract(requireAccess(req), params.id, getRequestMeta(req))
  sendSuccess(res, 'Contract completed successfully.', contract)
})

export const cancelContractHandler = asyncHandler(async (req, res) => {
  const { body, params } = getValidated<ValidatedRequest<{ reason: string }, unknown, CustomerIdParams>>(req)
  const contract = await cancelContract(requireAccess(req), params.id, reasonOf(body), getRequestMeta(req))
  sendSuccess(res, 'Contract cancelled successfully.', contract)
})

export const terminateContractHandler = asyncHandler(async (req, res) => {
  const { body, params } = getValidated<ValidatedRequest<{ reason: string }, unknown, CustomerIdParams>>(req)
  const contract = await terminateContract(requireAccess(req), params.id, reasonOf(body), getRequestMeta(req))
  sendSuccess(res, 'Contract terminated successfully.', contract)
})

export const extendContractHandler = asyncHandler(async (req, res) => {
  const { body, params } = getValidated<ValidatedRequest<ExtendContractBody, unknown, CustomerIdParams>>(req)
  const contract = await extendContract(requireAccess(req), params.id, body, getRequestMeta(req))
  sendSuccess(res, 'Contract extended successfully.', contract)
})

export const amendPricingHandler = asyncHandler(async (req, res) => {
  const { body, params } = getValidated<ValidatedRequest<AmendPricingBody, unknown, CustomerIdParams>>(req)
  const contract = await amendPricing(requireAccess(req), params.id, body, getRequestMeta(req))
  sendSuccess(res, 'Pricing amendment saved successfully.', contract)
})

export const replaceVehicleHandler = asyncHandler(async (req, res) => {
  const { body, params } = getValidated<ValidatedRequest<ReplaceVehicleBody, unknown, CustomerIdParams>>(req)
  const contract = await replaceVehicle(requireAccess(req), params.id, body, getRequestMeta(req))
  sendSuccess(res, 'Vehicle replaced on the same contract.', contract)
})

export const handoverHandler = asyncHandler(async (req, res) => {
  const { body, params } = getValidated<ValidatedRequest<HandoverBody, unknown, CustomerIdParams>>(req)
  const contract = await recordHandover(requireAccess(req), params.id, body, getRequestMeta(req))
  sendSuccess(res, 'Handover recorded successfully.', contract)
})

export const returnHandler = asyncHandler(async (req, res) => {
  const { body, params } = getValidated<ValidatedRequest<ReturnBody, unknown, CustomerIdParams>>(req)
  const contract = await recordReturn(requireAccess(req), params.id, body, getRequestMeta(req))
  sendSuccess(res, 'Return recorded successfully.', contract)
})

export const termsHandler = asyncHandler(async (req, res) => {
  const { body, params } = getValidated<ValidatedRequest<{ content: string }, unknown, CustomerIdParams>>(req)
  const contract = await addTerms(requireAccess(req), params.id, body.content, getRequestMeta(req))
  sendSuccess(res, 'Terms version saved successfully.', contract)
})

export const signHandler = asyncHandler(async (req, res) => {
  const { body, params } = getValidated<ValidatedRequest<SignatureBody, unknown, CustomerIdParams>>(req)
  const contract = await signContract(requireAccess(req), params.id, body, getRequestMeta(req))
  sendSuccess(res, 'Signature recorded successfully.', contract)
})
