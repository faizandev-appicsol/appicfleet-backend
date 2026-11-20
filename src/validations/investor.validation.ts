import { z } from 'zod'
import { INVESTOR_REPORT_KEYS, INVESTOR_SORT_FIELDS, INVESTOR_STATUSES } from '../constants/investors.js'
import { objectIdSchema, paginationQuerySchema } from './common.validation.js'
import { clearableText, enumInput, instantSchema, optionalText } from './vehicle.validation.js'

const statusInput = enumInput(Object.values(INVESTOR_STATUSES))
const reportKeyInput = enumInput(Object.values(INVESTOR_REPORT_KEYS))

const scopeSchema = z.object({
  legalEntityIds: z.array(objectIdSchema).max(200).optional(),
  branchIds: z.array(objectIdSchema).max(200).optional(),
  vehicleIds: z.array(objectIdSchema).max(500).optional(),
  reportKeys: z.array(reportKeyInput).max(20).optional(),
})

export const listInvestorsQuerySchema = paginationQuerySchema.extend({
  organizationId: objectIdSchema.optional(),
  status: statusInput.optional(),
  sort: z.enum(INVESTOR_SORT_FIELDS).optional(),
  order: z.enum(['asc', 'desc']).optional(),
})

export const createInvestorBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  displayName: z.string().trim().min(2).max(200),
  legalName: optionalText(200),
  contactEmail: z.email('Enter a valid email address'),
  phone: optionalText(40),
  notes: optionalText(2000),
  accessStartsAt: instantSchema.optional(),
  accessEndsAt: instantSchema.optional(),
  scope: scopeSchema.optional(),
})

export const updateInvestorBodySchema = z
  .object({
    displayName: z.string().trim().min(2).max(200).optional(),
    legalName: clearableText(200),
    phone: clearableText(40),
    notes: clearableText(2000),
    accessStartsAt: instantSchema.nullable().optional(),
    accessEndsAt: instantSchema.nullable().optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: 'Provide at least one field',
  })

export const replaceAccessBodySchema = scopeSchema.extend({
  reason: optionalText(500),
})

export const reasonBodySchema = z.object({
  reason: optionalText(500),
})

export const acceptInviteBodySchema = z.object({
  token: z.string().trim().min(20).max(200),
  password: z.string().min(8).max(128),
  name: z.string().trim().min(2).max(200).optional(),
})

export const investorPortalQuerySchema = paginationQuerySchema.extend({
  preset: z.string().trim().max(32).optional(),
  from: instantSchema.optional(),
  to: instantSchema.optional(),
  timezone: z.string().trim().max(64).optional(),
  status: z.string().trim().max(32).optional(),
  category: z.string().trim().max(32).optional(),
})

export const investorExportQuerySchema = investorPortalQuerySchema.extend({
  key: reportKeyInput,
})

export const updateInvestorProfileBodySchema = z
  .object({
    displayName: z.string().trim().min(2).max(200).optional(),
    phone: clearableText(40),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: 'Provide at least one field',
  })

export const idParamsSchema = z.object({ id: objectIdSchema })
export const vehicleParamsSchema = z.object({ vehicleId: objectIdSchema })
export const reportKeyParamsSchema = z.object({
  key: z.string().trim().min(3).max(64),
})
