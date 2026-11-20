import { z } from 'zod'
import {
  CONTRACT_SORT_FIELDS,
  CONTRACT_STATUSES,
  CONTRACT_TYPES,
  SIGNATURE_STATUSES,
} from '../constants/contracts.js'
import { objectIdSchema, paginationQuerySchema } from './common.validation.js'
import { enumInput, instantSchema, moneySchema, optionalText } from './vehicle.validation.js'

const typeInput = enumInput(Object.values(CONTRACT_TYPES))
const statusInput = enumInput(Object.values(CONTRACT_STATUSES))
const signatureInput = enumInput(Object.values(SIGNATURE_STATUSES))

const windowFields = {
  startsAt: instantSchema,
  endsAt: instantSchema,
}

export const createContractBodySchema = z
  .object({
    organizationId: objectIdSchema.optional(),
    type: typeInput,
    customerId: objectIdSchema,
    vehicleId: objectIdSchema.optional(),
    ...windowFields,
    terms: z.string().trim().min(3).max(20000),
    driverName: optionalText(200),
    authorizedContactName: optionalText(200),
    lenderName: optionalText(200),
    borrowCost: moneySchema.optional(),
    notes: optionalText(2000),
  })
  .superRefine((value, ctx) => {
    if (value.endsAt.getTime() <= value.startsAt.getTime()) {
      ctx.addIssue({ code: 'custom', message: 'Return must be after pickup', path: ['endsAt'] })
    }
  })

export const updateContractBodySchema = z
  .object({
    type: typeInput.optional(),
    customerId: objectIdSchema.optional(),
    vehicleId: objectIdSchema.nullable().optional(),
    startsAt: instantSchema.optional(),
    endsAt: instantSchema.optional(),
    terms: z.string().trim().min(3).max(20000).optional(),
    driverName: optionalText(200),
    authorizedContactName: optionalText(200),
    lenderName: optionalText(200),
    borrowCost: moneySchema.optional(),
    notes: optionalText(2000),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: 'Provide at least one field',
  })

export const listContractsQuerySchema = paginationQuerySchema.extend({
  organizationId: objectIdSchema.optional(),
  status: statusInput.optional(),
  type: typeInput.optional(),
  branchId: objectIdSchema.optional(),
  customerId: objectIdSchema.optional(),
  vehicleId: objectIdSchema.optional(),
  startsFrom: instantSchema.optional(),
  startsTo: instantSchema.optional(),
  activeOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
  sort: z.enum(CONTRACT_SORT_FIELDS).optional(),
  order: z.enum(['asc', 'desc']).optional(),
})

export const quoteQuerySchema = z
  .object({
    organizationId: objectIdSchema.optional(),
    vehicleId: objectIdSchema,
    ...windowFields,
  })
  .superRefine((value, ctx) => {
    if (value.endsAt.getTime() <= value.startsAt.getTime()) {
      ctx.addIssue({ code: 'custom', message: 'Return must be after pickup', path: ['endsAt'] })
    }
  })

export const reasonBodySchema = z.object({
  reason: z.string().trim().min(3).max(500),
})

export const extendContractBodySchema = z
  .object(windowFields)
  .superRefine((value, ctx) => {
    if (value.endsAt.getTime() <= value.startsAt.getTime()) {
      ctx.addIssue({ code: 'custom', message: 'Return must be after pickup', path: ['endsAt'] })
    }
  })

export const amendPricingBodySchema = z.object({
  unitAmount: moneySchema,
  reason: z.string().trim().min(3).max(500),
  effectiveAt: instantSchema,
})

export const replaceVehicleBodySchema = z.object({
  vehicleId: objectIdSchema,
  occurredAt: instantSchema,
  reason: z.string().trim().min(3).max(500),
  notes: optionalText(2000),
})

const inspectionFields = {
  occurredAt: instantSchema,
  mileageKm: z.coerce.number().int().min(0).max(5_000_000),
  fuelPercent: z.coerce.number().int().min(0).max(100),
  condition: z.string().trim().min(2).max(500),
  notes: optionalText(2000),
  acknowledged: z.boolean(),
}

export const handoverBodySchema = z.object(inspectionFields)

export const returnBodySchema = z.object({
  ...inspectionFields,
  damageNotes: optionalText(2000),
})

export const termsBodySchema = z.object({
  content: z.string().trim().min(3).max(20000),
})

export const signatureBodySchema = z.object({
  signerName: z.string().trim().min(2).max(200),
  provider: z.string().trim().min(2).max(40).optional(),
})

export const signatureCallbackBodySchema = z.object({
  contractId: objectIdSchema,
  termsVersionId: objectIdSchema,
  signerName: z.string().trim().min(2).max(200),
  status: signatureInput,
  provider: z.string().trim().min(2).max(40),
  externalEventId: z.string().trim().min(1).max(120),
})

export type CreateContractBody = z.infer<typeof createContractBodySchema>
export type UpdateContractBody = z.infer<typeof updateContractBodySchema>
export type ListContractsQuery = z.infer<typeof listContractsQuerySchema>
export type QuoteQuery = z.infer<typeof quoteQuerySchema>
export type ExtendContractBody = z.infer<typeof extendContractBodySchema>
export type AmendPricingBody = z.infer<typeof amendPricingBodySchema>
export type ReplaceVehicleBody = z.infer<typeof replaceVehicleBodySchema>
export type HandoverBody = z.infer<typeof handoverBodySchema>
export type ReturnBody = z.infer<typeof returnBodySchema>
export type SignatureBody = z.infer<typeof signatureBodySchema>
export type SignatureCallbackBody = z.infer<typeof signatureCallbackBodySchema>
