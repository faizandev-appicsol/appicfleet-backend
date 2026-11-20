import { getRequestMeta } from '../../helpers/requestMeta.js'
import { sendSuccess } from '../../helpers/response.js'
import { requireAccess } from '../../middlewares/auth.middleware.js'
import { getValidated } from '../../middlewares/validation.middleware.js'
import {
  applyDeposit,
  createDeposit,
  getDeposit,
  listDepositDirectory,
  releaseDeposit,
} from '../../services/finance/deposit.service.js'
import {
  createInvoiceDraft,
  getInvoice,
  listInvoiceDirectory,
  postInvoice,
  updateInvoiceDraft,
  voidInvoice,
} from '../../services/finance/invoice.service.js'
import {
  createCreditNoteDraft,
  createDebitNoteDraft,
  getCreditNote,
  getDebitNote,
  listCreditNoteDirectory,
  listDebitNoteDirectory,
  postCreditNote,
  postDebitNote,
  updateCreditNoteDraft,
  updateDebitNoteDraft,
} from '../../services/finance/note.service.js'
import {
  allocatePayment,
  cancelPayment,
  completePayment,
  createPayment,
  failPayment,
  getPayment,
  issueReceipt,
  listPaymentDirectory,
  processPaymentWebhook,
  reversePayment,
} from '../../services/finance/payment.service.js'
import { listReceiptDirectory, getReceipt } from '../../services/finance/receipt.service.js'
import type { ValidatedRequest } from '../../types/http.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import type { CustomerIdParams } from '../../validations/customer.validation.js'
import type {
  AllocatePaymentBody,
  ApplyDepositBody,
  CreateCreditNoteBody,
  CreateDebitNoteBody,
  CreateDepositBody,
  CreateInvoiceBody,
  CreatePaymentBody,
  ListDepositsQuery,
  ListInvoicesQuery,
  ListNotesQuery,
  ListPaymentsQuery,
  ListReceiptsQuery,
  PaymentWebhookBody,
  ReleaseDepositBody,
  UpdateInvoiceBody,
  UpdateNoteBody,
} from '../../validations/finance.validation.js'

export const listInvoicesHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, ListInvoicesQuery>>(req)
  sendSuccess(res, 'Invoices loaded successfully.', await listInvoiceDirectory(requireAccess(req), query))
})

export const getInvoiceHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Invoice loaded successfully.', await getInvoice(requireAccess(req), params.id))
})

export const createInvoiceHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<CreateInvoiceBody>>(req)
  sendSuccess(res, 'Invoice draft saved successfully.', await createInvoiceDraft(requireAccess(req), body, getRequestMeta(req)), 201)
})

export const updateInvoiceHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<ValidatedRequest<UpdateInvoiceBody, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Invoice draft updated successfully.', await updateInvoiceDraft(requireAccess(req), params.id, body, getRequestMeta(req)))
})

export const postInvoiceHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Invoice posted successfully.', await postInvoice(requireAccess(req), params.id, getRequestMeta(req)))
})

export const voidInvoiceHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<ValidatedRequest<{ reason: string }, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Invoice voided successfully.', await voidInvoice(requireAccess(req), params.id, body.reason, getRequestMeta(req)))
})

export const listPaymentsHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, ListPaymentsQuery>>(req)
  sendSuccess(res, 'Payments loaded successfully.', await listPaymentDirectory(requireAccess(req), query))
})

export const getPaymentHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Payment loaded successfully.', await getPayment(requireAccess(req), params.id))
})

export const createPaymentHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<CreatePaymentBody>>(req)
  sendSuccess(res, 'Payment created successfully.', await createPayment(requireAccess(req), body, getRequestMeta(req)), 201)
})

export const completePaymentHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Payment completed successfully.', await completePayment(requireAccess(req), params.id, getRequestMeta(req)))
})

export const failPaymentHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<ValidatedRequest<{ reason: string }, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Payment marked failed.', await failPayment(requireAccess(req), params.id, body.reason, getRequestMeta(req)))
})

export const cancelPaymentHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<ValidatedRequest<{ reason: string }, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Payment cancelled.', await cancelPayment(requireAccess(req), params.id, body.reason, getRequestMeta(req)))
})

export const reversePaymentHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<ValidatedRequest<{ reason: string }, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Payment reversed.', await reversePayment(requireAccess(req), params.id, body.reason, getRequestMeta(req)))
})

export const allocatePaymentHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<ValidatedRequest<AllocatePaymentBody, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Payment allocated successfully.', await allocatePayment(requireAccess(req), params.id, body.allocations, getRequestMeta(req)))
})

export const issueReceiptHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Receipt issued successfully.', await issueReceipt(requireAccess(req), params.id, getRequestMeta(req)), 201)
})

export const paymentWebhookHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<PaymentWebhookBody>>(req)
  const result = await processPaymentWebhook(requireAccess(req), body, getRequestMeta(req))
  sendSuccess(res, result.duplicate ? 'Webhook already processed.' : 'Webhook processed.', result)
})

export const listReceiptsHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, ListReceiptsQuery>>(req)
  sendSuccess(res, 'Receipts loaded successfully.', await listReceiptDirectory(requireAccess(req), query))
})

export const getReceiptHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Receipt loaded successfully.', await getReceipt(requireAccess(req), params.id))
})

export const listCreditNotesHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, ListNotesQuery>>(req)
  sendSuccess(res, 'Credit notes loaded successfully.', await listCreditNoteDirectory(requireAccess(req), query))
})

export const getCreditNoteHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Credit note loaded successfully.', await getCreditNote(requireAccess(req), params.id))
})

export const createCreditNoteHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<CreateCreditNoteBody>>(req)
  sendSuccess(res, 'Credit note draft saved.', await createCreditNoteDraft(requireAccess(req), body, getRequestMeta(req)), 201)
})

export const updateCreditNoteHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<ValidatedRequest<UpdateNoteBody, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Credit note draft updated.', await updateCreditNoteDraft(requireAccess(req), params.id, body, getRequestMeta(req)))
})

export const postCreditNoteHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Credit note posted.', await postCreditNote(requireAccess(req), params.id, getRequestMeta(req)))
})

export const listDebitNotesHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, ListNotesQuery>>(req)
  sendSuccess(res, 'Debit notes loaded successfully.', await listDebitNoteDirectory(requireAccess(req), query))
})

export const getDebitNoteHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Debit note loaded successfully.', await getDebitNote(requireAccess(req), params.id))
})

export const createDebitNoteHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<CreateDebitNoteBody>>(req)
  sendSuccess(res, 'Debit note draft saved.', await createDebitNoteDraft(requireAccess(req), body, getRequestMeta(req)), 201)
})

export const updateDebitNoteHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<ValidatedRequest<UpdateNoteBody, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Debit note draft updated.', await updateDebitNoteDraft(requireAccess(req), params.id, body, getRequestMeta(req)))
})

export const postDebitNoteHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Debit note posted.', await postDebitNote(requireAccess(req), params.id, getRequestMeta(req)))
})

export const listDepositsHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, ListDepositsQuery>>(req)
  sendSuccess(res, 'Deposits loaded successfully.', await listDepositDirectory(requireAccess(req), query))
})

export const getDepositHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Deposit loaded successfully.', await getDeposit(requireAccess(req), params.id))
})

export const createDepositHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<CreateDepositBody>>(req)
  sendSuccess(res, 'Deposit created successfully.', await createDeposit(requireAccess(req), body, getRequestMeta(req)), 201)
})

export const applyDepositHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<ValidatedRequest<ApplyDepositBody, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Deposit applied successfully.', await applyDeposit(requireAccess(req), params.id, body, getRequestMeta(req)))
})

export const releaseDepositHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<ValidatedRequest<ReleaseDepositBody, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Deposit released successfully.', await releaseDeposit(requireAccess(req), params.id, body, getRequestMeta(req)))
})
