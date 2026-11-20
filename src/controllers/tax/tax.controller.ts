import { getRequestMeta } from '../../helpers/requestMeta.js'
import { sendSuccess } from '../../helpers/response.js'
import { requireAccess } from '../../middlewares/auth.middleware.js'
import { getValidated } from '../../middlewares/validation.middleware.js'
import {
  cancelEInvoice,
  generateEInvoiceFromInvoice,
  getEInvoiceDetail,
  listEInvoiceDirectory,
  retryEInvoice,
  submitEInvoice,
} from '../../services/einvoice/einvoice.service.js'
import {
  addTaxRate,
  createTaxCode,
  getTaxCodeRates,
  listTaxCodeDirectory,
  seedDefaultTaxCodes,
  updateTaxCodeRecord,
} from '../../services/tax/tax-code.service.js'
import {
  getTaxConfiguration,
  getTaxOverview,
  getVatReport,
  updateTaxConfiguration,
} from '../../services/tax/tax-config.service.js'
import {
  createTaxPeriodRecord,
  listTaxPeriodDirectory,
  lockTaxPeriod,
  reopenTaxPeriod,
  validateTaxPeriod,
} from '../../services/tax/tax-period.service.js'
import { listTaxTransactionDirectory } from '../../services/tax/tax-transaction.service.js'
import type { ValidatedRequest } from '../../types/http.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import type { CustomerIdParams } from '../../validations/customer.validation.js'
import type {
  AddTaxRateBody,
  CreateTaxCodeBody,
  CreateTaxPeriodBody,
  GenerateEInvoiceBody,
  UpdateTaxCodeBody,
  UpdateTaxConfigBody,
} from '../../validations/tax.validation.js'

export const overviewHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, { organizationId?: string; legalEntityId?: string }>>(req)
  sendSuccess(res, 'Tax overview loaded.', await getTaxOverview(requireAccess(req), query))
})

export const listTaxCodesHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, Record<string, unknown>>>(req)
  sendSuccess(res, 'Tax codes loaded.', await listTaxCodeDirectory(requireAccess(req), query))
})

export const createTaxCodeHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<CreateTaxCodeBody>>(req)
  sendSuccess(res, 'Tax code created.', await createTaxCode(requireAccess(req), body, getRequestMeta(req)), 201)
})

export const updateTaxCodeHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<ValidatedRequest<UpdateTaxCodeBody, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Tax code updated.', await updateTaxCodeRecord(requireAccess(req), params.id, body, getRequestMeta(req)))
})

export const seedTaxCodesHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<{ organizationId?: string; legalEntityId?: string }>>(req)
  sendSuccess(res, 'Tax codes seeded.', await seedDefaultTaxCodes(requireAccess(req), body, getRequestMeta(req)))
})

export const listTaxRatesHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Tax rates loaded.', await getTaxCodeRates(requireAccess(req), params.id))
})

export const addTaxRateHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<ValidatedRequest<AddTaxRateBody, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Tax rate added.', await addTaxRate(requireAccess(req), params.id, body, getRequestMeta(req)), 201)
})

export const listTaxPeriodsHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, Record<string, unknown>>>(req)
  sendSuccess(res, 'Tax periods loaded.', await listTaxPeriodDirectory(requireAccess(req), query))
})

export const createTaxPeriodHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<CreateTaxPeriodBody>>(req)
  sendSuccess(res, 'Tax period created.', await createTaxPeriodRecord(requireAccess(req), body, getRequestMeta(req)), 201)
})

export const validateTaxPeriodHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Tax period validated.', await validateTaxPeriod(requireAccess(req), params.id))
})

export const lockTaxPeriodHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<ValidatedRequest<{ reason: string }, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Tax period locked.', await lockTaxPeriod(requireAccess(req), params.id, body.reason, getRequestMeta(req)))
})

export const reopenTaxPeriodHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<ValidatedRequest<{ reason: string }, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'Tax period reopened.', await reopenTaxPeriod(requireAccess(req), params.id, body.reason, getRequestMeta(req)))
})

export const listTaxTransactionsHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, Record<string, unknown>>>(req)
  sendSuccess(res, 'Tax transactions loaded.', await listTaxTransactionDirectory(requireAccess(req), query))
})

export const getTaxConfigHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, { organizationId?: string; legalEntityId: string }>>(req)
  sendSuccess(res, 'Tax configuration loaded.', await getTaxConfiguration(requireAccess(req), query.legalEntityId, query.organizationId))
})

export const updateTaxConfigHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<UpdateTaxConfigBody>>(req)
  sendSuccess(res, 'Tax configuration updated.', await updateTaxConfiguration(requireAccess(req), body, getRequestMeta(req)))
})

export const vatReportHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, { organizationId?: string; legalEntityId: string; taxPeriodId?: string }>>(req)
  sendSuccess(res, 'VAT report loaded.', await getVatReport(requireAccess(req), query))
})

export const listEInvoicesHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, Record<string, unknown>>>(req)
  sendSuccess(res, 'E-invoices loaded.', await listEInvoiceDirectory(requireAccess(req), query))
})

export const getEInvoiceHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'E-invoice loaded.', await getEInvoiceDetail(requireAccess(req), params.id))
})

export const generateEInvoiceHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<GenerateEInvoiceBody>>(req)
  sendSuccess(
    res,
    'E-invoice generated.',
    await generateEInvoiceFromInvoice(requireAccess(req), body.invoiceId, getRequestMeta(req)),
    201,
  )
})

export const submitEInvoiceHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'E-invoice submitted.', await submitEInvoice(requireAccess(req), params.id, getRequestMeta(req)))
})

export const retryEInvoiceHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'E-invoice retry started.', await retryEInvoice(requireAccess(req), params.id, getRequestMeta(req)))
})

export const cancelEInvoiceHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<ValidatedRequest<{ reason: string }, unknown, CustomerIdParams>>(req)
  sendSuccess(res, 'E-invoice cancelled.', await cancelEInvoice(requireAccess(req), params.id, body.reason, getRequestMeta(req)))
})
