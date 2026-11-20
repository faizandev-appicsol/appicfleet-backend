import { z } from 'zod'
import {
  EINVOICE_ENVIRONMENTS,
  EINVOICE_PROVIDERS,
  EINVOICE_SORT_FIELDS,
  TAX_CODE_SORT_FIELDS,
  TAX_PERIOD_STATUSES,
  TAX_PRICING_MODES,
  TAX_TRANSACTION_SORT_FIELDS,
  TAX_TREATMENTS,
  VAT_REGISTRATION_STATUSES,
} from '../constants/tax.js'
import { currencySchema, objectIdSchema, paginationQuerySchema } from './common.validation.js'
import { enumInput, instantSchema, moneySchema, optionalText } from './vehicle.validation.js'

const treatmentInput = enumInput(Object.values(TAX_TREATMENTS))
const pricingModeInput = enumInput(Object.values(TAX_PRICING_MODES))
const vatStatusInput = enumInput(Object.values(VAT_REGISTRATION_STATUSES))
const periodStatusInput = enumInput(Object.values(TAX_PERIOD_STATUSES))
const environmentInput = enumInput(Object.values(EINVOICE_ENVIRONMENTS))
const providerInput = enumInput(Object.values(EINVOICE_PROVIDERS))

export const idParamsSchema = z.object({ id: objectIdSchema })

export const listTaxCodesQuerySchema = paginationQuerySchema.extend({
  organizationId: objectIdSchema.optional(),
  search: z.string().trim().max(120).optional(),
  isActive: z.coerce.boolean().optional(),
  sort: z.enum(TAX_CODE_SORT_FIELDS).optional(),
  order: z.enum(['asc', 'desc']).optional(),
})

export const createTaxCodeBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  legalEntityId: objectIdSchema.optional(),
  code: z.string().trim().min(1).max(32),
  name: z.string().trim().min(1).max(120),
  description: optionalText(2000),
  treatment: treatmentInput,
  ratePercent: moneySchema,
  effectiveFrom: instantSchema,
})

export const updateTaxCodeBodySchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: optionalText(2000),
  isActive: z.boolean().optional(),
})

export const addTaxRateBodySchema = z.object({
  ratePercent: moneySchema,
  effectiveFrom: instantSchema,
  effectiveTo: instantSchema.optional(),
})

export const seedTaxCodesBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  legalEntityId: objectIdSchema.optional(),
})

export const listTaxPeriodsQuerySchema = z.object({
  organizationId: objectIdSchema.optional(),
  legalEntityId: objectIdSchema.optional(),
  status: periodStatusInput.optional(),
})

export const createTaxPeriodBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  legalEntityId: objectIdSchema,
  taxYear: z.number().int().min(2000).max(2100),
  name: z.string().trim().min(1).max(80),
  periodNumber: z.number().int().min(1).max(24),
  startDate: instantSchema,
  endDate: instantSchema,
})

export const reasonBodySchema = z.object({
  reason: z.string().trim().min(1).max(500),
})

export const listTaxTransactionsQuerySchema = paginationQuerySchema.extend({
  organizationId: objectIdSchema.optional(),
  legalEntityId: objectIdSchema.optional(),
  branchId: objectIdSchema.optional(),
  taxPeriodId: objectIdSchema.optional(),
  taxCode: z.string().trim().max(32).optional(),
  sourceType: z.string().trim().max(32).optional(),
  customerId: objectIdSchema.optional(),
  search: z.string().trim().max(120).optional(),
  sort: z.enum(TAX_TRANSACTION_SORT_FIELDS).optional(),
  order: z.enum(['asc', 'desc']).optional(),
})

export const taxConfigQuerySchema = z.object({
  organizationId: objectIdSchema.optional(),
  legalEntityId: objectIdSchema,
})

export const updateTaxConfigBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  legalEntityId: objectIdSchema,
  vatRegistrationStatus: vatStatusInput.optional(),
  vatRegistrationNumber: optionalText(64),
  registeredName: optionalText(200),
  registeredAddress: optionalText(500),
  vatEffectiveDate: instantSchema.optional(),
  defaultTaxCodeId: objectIdSchema.optional(),
  defaultPricingMode: pricingModeInput.optional(),
  einvoicingEnabled: z.boolean().optional(),
  einvoiceProvider: providerInput.optional(),
  einvoiceEnvironment: environmentInput.optional(),
})

export const overviewQuerySchema = z.object({
  organizationId: objectIdSchema.optional(),
  legalEntityId: objectIdSchema.optional(),
})

export const vatReportQuerySchema = z.object({
  organizationId: objectIdSchema.optional(),
  legalEntityId: objectIdSchema,
  taxPeriodId: objectIdSchema.optional(),
})

export const listEInvoicesQuerySchema = paginationQuerySchema.extend({
  organizationId: objectIdSchema.optional(),
  legalEntityId: objectIdSchema.optional(),
  branchId: objectIdSchema.optional(),
  status: z.string().trim().max(32).optional(),
  customerId: objectIdSchema.optional(),
  provider: z.string().trim().max(64).optional(),
  search: z.string().trim().max(120).optional(),
  sort: z.enum(EINVOICE_SORT_FIELDS).optional(),
  order: z.enum(['asc', 'desc']).optional(),
})

export const generateEInvoiceBodySchema = z.object({
  invoiceId: objectIdSchema,
})

export type CreateTaxCodeBody = z.infer<typeof createTaxCodeBodySchema>
export type UpdateTaxCodeBody = z.infer<typeof updateTaxCodeBodySchema>
export type AddTaxRateBody = z.infer<typeof addTaxRateBodySchema>
export type CreateTaxPeriodBody = z.infer<typeof createTaxPeriodBodySchema>
export type UpdateTaxConfigBody = z.infer<typeof updateTaxConfigBodySchema>
export type GenerateEInvoiceBody = z.infer<typeof generateEInvoiceBodySchema>

void currencySchema
