import { Router } from 'express'
import { PERMISSIONS } from '../constants/permissions.js'
import {
  addTaxRateHandler,
  cancelEInvoiceHandler,
  createTaxCodeHandler,
  createTaxPeriodHandler,
  generateEInvoiceHandler,
  getEInvoiceHandler,
  getTaxConfigHandler,
  listEInvoicesHandler,
  listTaxCodesHandler,
  listTaxPeriodsHandler,
  listTaxRatesHandler,
  listTaxTransactionsHandler,
  lockTaxPeriodHandler,
  overviewHandler,
  reopenTaxPeriodHandler,
  retryEInvoiceHandler,
  seedTaxCodesHandler,
  submitEInvoiceHandler,
  updateTaxCodeHandler,
  updateTaxConfigHandler,
  validateTaxPeriodHandler,
  vatReportHandler,
} from '../controllers/tax/tax.controller.js'
import { authenticate, requirePermission } from '../middlewares/auth.middleware.js'
import { validate } from '../middlewares/validation.middleware.js'
import {
  addTaxRateBodySchema,
  createTaxCodeBodySchema,
  createTaxPeriodBodySchema,
  generateEInvoiceBodySchema,
  idParamsSchema,
  listEInvoicesQuerySchema,
  listTaxCodesQuerySchema,
  listTaxPeriodsQuerySchema,
  listTaxTransactionsQuerySchema,
  overviewQuerySchema,
  reasonBodySchema,
  seedTaxCodesBodySchema,
  taxConfigQuerySchema,
  updateTaxCodeBodySchema,
  updateTaxConfigBodySchema,
  vatReportQuerySchema,
} from '../validations/tax.validation.js'

export const taxRouter = Router()
taxRouter.use(authenticate)

taxRouter.get('/overview', requirePermission(PERMISSIONS.TAX_VIEW), validate({ query: overviewQuerySchema }), overviewHandler)

taxRouter.get('/codes', requirePermission(PERMISSIONS.TAX_VIEW), validate({ query: listTaxCodesQuerySchema }), listTaxCodesHandler)
taxRouter.post('/codes', requirePermission(PERMISSIONS.TAX_MANAGE_CODES), validate({ body: createTaxCodeBodySchema }), createTaxCodeHandler)
taxRouter.post('/codes/seed', requirePermission(PERMISSIONS.TAX_MANAGE_CODES), validate({ body: seedTaxCodesBodySchema }), seedTaxCodesHandler)
taxRouter.patch('/codes/:id', requirePermission(PERMISSIONS.TAX_MANAGE_CODES), validate({ params: idParamsSchema, body: updateTaxCodeBodySchema }), updateTaxCodeHandler)
taxRouter.get('/codes/:id/rates', requirePermission(PERMISSIONS.TAX_VIEW), validate({ params: idParamsSchema }), listTaxRatesHandler)
taxRouter.post('/codes/:id/rates', requirePermission(PERMISSIONS.TAX_MANAGE_CODES), validate({ params: idParamsSchema, body: addTaxRateBodySchema }), addTaxRateHandler)

taxRouter.get('/periods', requirePermission(PERMISSIONS.TAX_VIEW), validate({ query: listTaxPeriodsQuerySchema }), listTaxPeriodsHandler)
taxRouter.post('/periods', requirePermission(PERMISSIONS.TAX_MANAGE_PERIODS), validate({ body: createTaxPeriodBodySchema }), createTaxPeriodHandler)
taxRouter.get('/periods/:id/validate', requirePermission(PERMISSIONS.TAX_VIEW), validate({ params: idParamsSchema }), validateTaxPeriodHandler)
taxRouter.post('/periods/:id/lock', requirePermission(PERMISSIONS.TAX_MANAGE_PERIODS), validate({ params: idParamsSchema, body: reasonBodySchema }), lockTaxPeriodHandler)
taxRouter.post('/periods/:id/reopen', requirePermission(PERMISSIONS.TAX_MANAGE_PERIODS), validate({ params: idParamsSchema, body: reasonBodySchema }), reopenTaxPeriodHandler)

taxRouter.get('/transactions', requirePermission(PERMISSIONS.TAX_VIEW), validate({ query: listTaxTransactionsQuerySchema }), listTaxTransactionsHandler)
taxRouter.get('/reports/vat', requirePermission(PERMISSIONS.TAX_VIEW_REPORTS), validate({ query: vatReportQuerySchema }), vatReportHandler)

taxRouter.get('/configuration', requirePermission(PERMISSIONS.TAX_VIEW), validate({ query: taxConfigQuerySchema }), getTaxConfigHandler)
taxRouter.put('/configuration', requirePermission(PERMISSIONS.EINVOICE_MANAGE_SETTINGS), validate({ body: updateTaxConfigBodySchema }), updateTaxConfigHandler)

taxRouter.get('/einvoices', requirePermission(PERMISSIONS.EINVOICE_VIEW), validate({ query: listEInvoicesQuerySchema }), listEInvoicesHandler)
taxRouter.get('/einvoices/:id', requirePermission(PERMISSIONS.EINVOICE_VIEW), validate({ params: idParamsSchema }), getEInvoiceHandler)
taxRouter.post('/einvoices/generate', requirePermission(PERMISSIONS.EINVOICE_GENERATE), validate({ body: generateEInvoiceBodySchema }), generateEInvoiceHandler)
taxRouter.post('/einvoices/:id/submit', requirePermission(PERMISSIONS.EINVOICE_SUBMIT), validate({ params: idParamsSchema }), submitEInvoiceHandler)
taxRouter.post('/einvoices/:id/retry', requirePermission(PERMISSIONS.EINVOICE_RETRY), validate({ params: idParamsSchema }), retryEInvoiceHandler)
taxRouter.post('/einvoices/:id/cancel', requirePermission(PERMISSIONS.EINVOICE_CANCEL), validate({ params: idParamsSchema, body: reasonBodySchema }), cancelEInvoiceHandler)
