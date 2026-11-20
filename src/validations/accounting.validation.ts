import { z } from 'zod'
import {
  ACCOUNT_ROLES,
  ACCOUNT_SORT_FIELDS,
  ACCOUNT_TYPES,
  JOURNAL_SORT_FIELDS,
  JOURNAL_STATUSES,
  JOURNAL_TYPES,
  PERIOD_STATUSES,
  SOURCE_MODULES,
} from '../constants/accounting.js'
import { currencySchema, objectIdSchema, paginationQuerySchema } from './common.validation.js'
import { enumInput, instantSchema, moneySchema, optionalText } from './vehicle.validation.js'

const accountTypeInput = enumInput(Object.values(ACCOUNT_TYPES))
const journalTypeInput = enumInput(Object.values(JOURNAL_TYPES))
const journalStatusInput = enumInput(Object.values(JOURNAL_STATUSES))
const periodStatusInput = enumInput(Object.values(PERIOD_STATUSES))
const accountRoleInput = enumInput(Object.values(ACCOUNT_ROLES))
const sourceModuleInput = enumInput(Object.values(SOURCE_MODULES))

export const listAccountsQuerySchema = paginationQuerySchema.extend({
  organizationId: objectIdSchema.optional(),
  accountType: accountTypeInput.optional(),
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
  sort: z.enum(ACCOUNT_SORT_FIELDS).optional(),
  order: z.enum(['asc', 'desc']).optional(),
})

export const createAccountBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  legalEntityId: objectIdSchema.optional(),
  code: z.string().trim().min(1).max(32),
  name: z.string().trim().min(1).max(200),
  accountType: accountTypeInput,
  parentAccountId: objectIdSchema.optional(),
  description: optionalText(2000),
  systemRole: accountRoleInput.optional(),
  isSystem: z.boolean().optional(),
})

export const updateAccountBodySchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: optionalText(2000),
  parentAccountId: objectIdSchema.nullable().optional(),
  isActive: z.boolean().optional(),
})

export const seedChartBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  legalEntityId: objectIdSchema,
})

export const journalLineSchema = z.object({
  accountId: objectIdSchema,
  debit: moneySchema.optional(),
  credit: moneySchema.optional(),
  description: optionalText(2000),
  customerId: objectIdSchema.optional(),
  vendorId: objectIdSchema.optional(),
  vehicleId: objectIdSchema.optional(),
  contractId: objectIdSchema.optional(),
  invoiceId: objectIdSchema.optional(),
  paymentId: objectIdSchema.optional(),
  reference: optionalText(120),
})

export const listJournalsQuerySchema = paginationQuerySchema.extend({
  organizationId: objectIdSchema.optional(),
  branchId: objectIdSchema.optional(),
  legalEntityId: objectIdSchema.optional(),
  status: journalStatusInput.optional(),
  journalType: journalTypeInput.optional(),
  sourceModule: sourceModuleInput.optional(),
  accountingFrom: instantSchema.optional(),
  accountingTo: instantSchema.optional(),
  sort: z.enum(JOURNAL_SORT_FIELDS).optional(),
  order: z.enum(['asc', 'desc']).optional(),
})

export const createJournalBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  legalEntityId: objectIdSchema,
  branchId: objectIdSchema,
  journalType: journalTypeInput,
  accountingDate: instantSchema,
  description: z.string().trim().min(1).max(2000),
  reference: optionalText(120),
  currency: currencySchema.optional(),
  sourceModule: sourceModuleInput.optional(),
  sourceType: z.string().trim().max(64).optional(),
  sourceId: objectIdSchema.optional(),
  sourceIdempotencyKey: z.string().trim().min(8).max(160).optional(),
  lines: z.array(journalLineSchema).min(2).max(200),
})

export const updateJournalBodySchema = createJournalBodySchema.partial().extend({
  lines: z.array(journalLineSchema).min(2).max(200).optional(),
})

export const reasonBodySchema = z.object({
  reason: z.string().trim().min(1).max(500),
})

export const createFiscalYearBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  legalEntityId: objectIdSchema,
  name: z.string().trim().min(1).max(80),
  startDate: instantSchema,
  endDate: instantSchema,
})

export const createFiscalPeriodBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  legalEntityId: objectIdSchema,
  fiscalYearId: objectIdSchema,
  name: z.string().trim().min(1).max(80),
  periodNumber: z.coerce.number().int().min(1).max(24),
  startDate: instantSchema,
  endDate: instantSchema,
})

export const listPeriodsQuerySchema = z.object({
  organizationId: objectIdSchema.optional(),
  legalEntityId: objectIdSchema.optional(),
  fiscalYearId: objectIdSchema.optional(),
})

export const ledgerQuerySchema = paginationQuerySchema.extend({
  organizationId: objectIdSchema.optional(),
  accountId: objectIdSchema,
  from: instantSchema.optional(),
  to: instantSchema.optional(),
  branchId: objectIdSchema.optional(),
  legalEntityId: objectIdSchema.optional(),
  customerId: objectIdSchema.optional(),
  vendorId: objectIdSchema.optional(),
})

export const trialBalanceQuerySchema = z.object({
  organizationId: objectIdSchema.optional(),
  fiscalPeriodId: objectIdSchema,
  legalEntityId: objectIdSchema.optional(),
})

export const mappingBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  legalEntityId: objectIdSchema,
  role: accountRoleInput,
  accountId: objectIdSchema,
})

export const listMappingsQuerySchema = z.object({
  organizationId: objectIdSchema.optional(),
  legalEntityId: objectIdSchema,
})

export const sourcePostBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  legalEntityId: objectIdSchema,
  branchId: objectIdSchema,
  sourceModule: z.enum(['finance', 'charges', 'procurement']),
  sourceType: z.string().trim().min(1).max(64),
  sourceId: objectIdSchema,
  accountingDate: instantSchema,
  amount: moneySchema,
  currency: currencySchema.optional(),
  description: z.string().trim().min(1).max(2000),
  customerId: objectIdSchema.optional(),
  vendorId: objectIdSchema.optional(),
  invoiceId: objectIdSchema.optional(),
  paymentId: objectIdSchema.optional(),
  contractId: objectIdSchema.optional(),
  idempotencyKey: z.string().trim().min(8).max(160),
})

export const overviewQuerySchema = z.object({
  organizationId: objectIdSchema.optional(),
  legalEntityId: objectIdSchema.optional(),
})

export type ListAccountsQuery = z.infer<typeof listAccountsQuerySchema>
export type CreateAccountBody = z.infer<typeof createAccountBodySchema>
export type UpdateAccountBody = z.infer<typeof updateAccountBodySchema>
export type CreateJournalBody = z.infer<typeof createJournalBodySchema>
export type UpdateJournalBody = z.infer<typeof updateJournalBodySchema>
export type ListJournalsQuery = z.infer<typeof listJournalsQuerySchema>
export type CreateFiscalYearBody = z.infer<typeof createFiscalYearBodySchema>
export type CreateFiscalPeriodBody = z.infer<typeof createFiscalPeriodBodySchema>
export type LedgerQuery = z.infer<typeof ledgerQuerySchema>
export type TrialBalanceQuery = z.infer<typeof trialBalanceQuerySchema>
export type MappingBody = z.infer<typeof mappingBodySchema>
export type SourcePostBody = z.infer<typeof sourcePostBodySchema>
export type OverviewQuery = z.infer<typeof overviewQuerySchema>

void periodStatusInput
