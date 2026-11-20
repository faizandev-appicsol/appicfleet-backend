import { Router } from 'express'
import { PERMISSIONS } from '../constants/permissions.js'
import {
  allocatePaymentHandler,
  applyDepositHandler,
  cancelPaymentHandler,
  completePaymentHandler,
  createCreditNoteHandler,
  createDebitNoteHandler,
  createDepositHandler,
  createInvoiceHandler,
  createPaymentHandler,
  failPaymentHandler,
  getCreditNoteHandler,
  getDebitNoteHandler,
  getDepositHandler,
  getInvoiceHandler,
  getPaymentHandler,
  getReceiptHandler,
  issueReceiptHandler,
  listCreditNotesHandler,
  listDebitNotesHandler,
  listDepositsHandler,
  listInvoicesHandler,
  listPaymentsHandler,
  listReceiptsHandler,
  paymentWebhookHandler,
  postCreditNoteHandler,
  postDebitNoteHandler,
  postInvoiceHandler,
  releaseDepositHandler,
  reversePaymentHandler,
  updateCreditNoteHandler,
  updateDebitNoteHandler,
  updateInvoiceHandler,
  voidInvoiceHandler,
} from '../controllers/finance/finance.controller.js'
import { authenticate, requirePermission } from '../middlewares/auth.middleware.js'
import { validate } from '../middlewares/validation.middleware.js'
import { idParamsSchema } from '../validations/common.validation.js'
import {
  allocatePaymentBodySchema,
  applyDepositBodySchema,
  createCreditNoteBodySchema,
  createDebitNoteBodySchema,
  createDepositBodySchema,
  createInvoiceBodySchema,
  createPaymentBodySchema,
  listDepositsQuerySchema,
  listInvoicesQuerySchema,
  listNotesQuerySchema,
  listPaymentsQuerySchema,
  listReceiptsQuerySchema,
  paymentWebhookBodySchema,
  reasonBodySchema,
  releaseDepositBodySchema,
  updateInvoiceBodySchema,
  updateNoteBodySchema,
} from '../validations/finance.validation.js'

export const invoiceRouter = Router()
export const paymentRouter = Router()
export const receiptRouter = Router()
export const creditNoteRouter = Router()
export const debitNoteRouter = Router()
export const depositRouter = Router()

invoiceRouter.use(authenticate)
paymentRouter.use(authenticate)
receiptRouter.use(authenticate)
creditNoteRouter.use(authenticate)
debitNoteRouter.use(authenticate)
depositRouter.use(authenticate)

invoiceRouter.get('/', requirePermission(PERMISSIONS.INVOICE_VIEW), validate({ query: listInvoicesQuerySchema }), listInvoicesHandler)
invoiceRouter.post('/', requirePermission(PERMISSIONS.INVOICE_CREATE), validate({ body: createInvoiceBodySchema }), createInvoiceHandler)
invoiceRouter.get('/:id', requirePermission(PERMISSIONS.INVOICE_VIEW), validate({ params: idParamsSchema }), getInvoiceHandler)
invoiceRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.INVOICE_EDIT),
  validate({ params: idParamsSchema, body: updateInvoiceBodySchema }),
  updateInvoiceHandler,
)
invoiceRouter.post('/:id/post', requirePermission(PERMISSIONS.INVOICE_POST), validate({ params: idParamsSchema }), postInvoiceHandler)
invoiceRouter.post(
  '/:id/void',
  requirePermission(PERMISSIONS.INVOICE_VOID),
  validate({ params: idParamsSchema, body: reasonBodySchema }),
  voidInvoiceHandler,
)

paymentRouter.get('/', requirePermission(PERMISSIONS.PAYMENT_VIEW), validate({ query: listPaymentsQuerySchema }), listPaymentsHandler)
paymentRouter.post('/', requirePermission(PERMISSIONS.PAYMENT_CREATE), validate({ body: createPaymentBodySchema }), createPaymentHandler)
paymentRouter.post(
  '/webhooks',
  requirePermission(PERMISSIONS.PAYMENT_COMPLETE),
  validate({ body: paymentWebhookBodySchema }),
  paymentWebhookHandler,
)
paymentRouter.get('/:id', requirePermission(PERMISSIONS.PAYMENT_VIEW), validate({ params: idParamsSchema }), getPaymentHandler)
paymentRouter.post('/:id/complete', requirePermission(PERMISSIONS.PAYMENT_COMPLETE), validate({ params: idParamsSchema }), completePaymentHandler)
paymentRouter.post(
  '/:id/fail',
  requirePermission(PERMISSIONS.PAYMENT_COMPLETE),
  validate({ params: idParamsSchema, body: reasonBodySchema }),
  failPaymentHandler,
)
paymentRouter.post(
  '/:id/cancel',
  requirePermission(PERMISSIONS.PAYMENT_COMPLETE),
  validate({ params: idParamsSchema, body: reasonBodySchema }),
  cancelPaymentHandler,
)
paymentRouter.post(
  '/:id/reverse',
  requirePermission(PERMISSIONS.PAYMENT_REVERSE),
  validate({ params: idParamsSchema, body: reasonBodySchema }),
  reversePaymentHandler,
)
paymentRouter.post(
  '/:id/allocate',
  requirePermission(PERMISSIONS.PAYMENT_COMPLETE),
  validate({ params: idParamsSchema, body: allocatePaymentBodySchema }),
  allocatePaymentHandler,
)
paymentRouter.post('/:id/receipt', requirePermission(PERMISSIONS.RECEIPT_ISSUE), validate({ params: idParamsSchema }), issueReceiptHandler)

receiptRouter.get('/', requirePermission(PERMISSIONS.RECEIPT_VIEW), validate({ query: listReceiptsQuerySchema }), listReceiptsHandler)
receiptRouter.get('/:id', requirePermission(PERMISSIONS.RECEIPT_VIEW), validate({ params: idParamsSchema }), getReceiptHandler)

creditNoteRouter.get('/', requirePermission(PERMISSIONS.CREDIT_NOTE_VIEW), validate({ query: listNotesQuerySchema }), listCreditNotesHandler)
creditNoteRouter.post('/', requirePermission(PERMISSIONS.CREDIT_NOTE_CREATE), validate({ body: createCreditNoteBodySchema }), createCreditNoteHandler)
creditNoteRouter.get('/:id', requirePermission(PERMISSIONS.CREDIT_NOTE_VIEW), validate({ params: idParamsSchema }), getCreditNoteHandler)
creditNoteRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.CREDIT_NOTE_CREATE),
  validate({ params: idParamsSchema, body: updateNoteBodySchema }),
  updateCreditNoteHandler,
)
creditNoteRouter.post('/:id/post', requirePermission(PERMISSIONS.CREDIT_NOTE_POST), validate({ params: idParamsSchema }), postCreditNoteHandler)

debitNoteRouter.get('/', requirePermission(PERMISSIONS.DEBIT_NOTE_VIEW), validate({ query: listNotesQuerySchema }), listDebitNotesHandler)
debitNoteRouter.post('/', requirePermission(PERMISSIONS.DEBIT_NOTE_CREATE), validate({ body: createDebitNoteBodySchema }), createDebitNoteHandler)
debitNoteRouter.get('/:id', requirePermission(PERMISSIONS.DEBIT_NOTE_VIEW), validate({ params: idParamsSchema }), getDebitNoteHandler)
debitNoteRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.DEBIT_NOTE_CREATE),
  validate({ params: idParamsSchema, body: updateNoteBodySchema }),
  updateDebitNoteHandler,
)
debitNoteRouter.post('/:id/post', requirePermission(PERMISSIONS.DEBIT_NOTE_POST), validate({ params: idParamsSchema }), postDebitNoteHandler)

depositRouter.get('/', requirePermission(PERMISSIONS.DEPOSIT_VIEW), validate({ query: listDepositsQuerySchema }), listDepositsHandler)
depositRouter.post('/', requirePermission(PERMISSIONS.DEPOSIT_CREATE), validate({ body: createDepositBodySchema }), createDepositHandler)
depositRouter.get('/:id', requirePermission(PERMISSIONS.DEPOSIT_VIEW), validate({ params: idParamsSchema }), getDepositHandler)
depositRouter.post(
  '/:id/apply',
  requirePermission(PERMISSIONS.DEPOSIT_APPLY),
  validate({ params: idParamsSchema, body: applyDepositBodySchema }),
  applyDepositHandler,
)
depositRouter.post(
  '/:id/release',
  requirePermission(PERMISSIONS.DEPOSIT_RELEASE),
  validate({ params: idParamsSchema, body: releaseDepositBodySchema }),
  releaseDepositHandler,
)
