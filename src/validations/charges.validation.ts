import { z } from 'zod'
import {
  CHARGE_SOURCES,
  FINE_SORT_FIELDS,
  FINE_STATUSES,
  FINE_TYPES,
  IMPORT_BATCH_STATUSES,
  REFUND_SORT_FIELDS,
  REFUND_SOURCES,
  REFUND_STATUSES,
  RECOVERY_POLICIES,
  TOLL_PROVIDERS,
  TOLL_SORT_FIELDS,
  TOLL_STATUSES,
} from '../constants/charges.js'
import { objectIdSchema, paginationQuerySchema } from './common.validation.js'
import { currencySchema } from './common.validation.js'
import { enumInput, instantSchema, moneySchema, optionalText } from './vehicle.validation.js'

const fineStatusInput = enumInput(Object.values(FINE_STATUSES))
const fineTypeInput = enumInput(Object.values(FINE_TYPES))
const tollStatusInput = enumInput(Object.values(TOLL_STATUSES))
const tollProviderInput = enumInput(Object.values(TOLL_PROVIDERS))
const chargeSourceInput = enumInput(Object.values(CHARGE_SOURCES))
const refundStatusInput = enumInput(Object.values(REFUND_STATUSES))
const refundSourceInput = enumInput(Object.values(REFUND_SOURCES))
const recoveryPolicyInput = enumInput(Object.values(RECOVERY_POLICIES))
const importStatusInput = enumInput(Object.values(IMPORT_BATCH_STATUSES))

export const listFinesQuerySchema = paginationQuerySchema.extend({
  organizationId: objectIdSchema.optional(),
  branchId: objectIdSchema.optional(),
  status: fineStatusInput.optional(),
  fineType: fineTypeInput.optional(),
  provider: z.string().trim().max(64).optional(),
  vehicleId: objectIdSchema.optional(),
  customerId: objectIdSchema.optional(),
  contractId: objectIdSchema.optional(),
  eventFrom: instantSchema.optional(),
  eventTo: instantSchema.optional(),
  sort: z.enum(FINE_SORT_FIELDS).optional(),
  order: z.enum(['asc', 'desc']).optional(),
})

export const createFineBodySchema = z
  .object({
    organizationId: objectIdSchema.optional(),
    legalEntityId: objectIdSchema.optional(),
    branchId: objectIdSchema.optional(),
    externalReference: z.string().trim().min(1).max(128),
    provider: z.string().trim().min(1).max(64),
    fineType: fineTypeInput,
    source: chargeSourceInput.optional(),
    eventAt: instantSchema,
    vehicleId: objectIdSchema.optional(),
    vehiclePlate: z.string().trim().min(1).max(32).optional(),
    amount: moneySchema,
    currency: currencySchema.optional(),
    description: optionalText(2000),
    location: optionalText(200),
    authority: optionalText(200),
    evidenceKey: optionalText(500),
  })
  .refine((value) => Boolean(value.vehicleId || value.vehiclePlate), {
    message: 'Provide vehicleId or vehiclePlate',
    path: ['vehicleId'],
  })

export const updateFineBodySchema = z.object({
  description: optionalText(2000),
  location: optionalText(200),
  authority: optionalText(200),
  evidenceKey: optionalText(500),
})

export const reviewFineBodySchema = z.object({
  contractId: objectIdSchema,
  customerId: objectIdSchema,
  customerName: z.string().trim().max(200).optional(),
  notes: optionalText(2000),
})

export const reasonBodySchema = z.object({
  reason: z.string().trim().min(1).max(500),
})

export const disputeFineBodySchema = z.object({
  reason: z.string().trim().min(1).max(500),
  description: optionalText(2000),
  evidenceKey: optionalText(500),
})

export const resolveDisputeBodySchema = z.object({
  disputeId: objectIdSchema,
  decision: z.enum(['accepted', 'rejected']),
  resolution: optionalText(2000),
})

export const recoverBodySchema = z.object({
  policy: recoveryPolicyInput.optional(),
  adminFee: moneySchema.optional(),
})

export const listTollsQuerySchema = paginationQuerySchema.extend({
  organizationId: objectIdSchema.optional(),
  branchId: objectIdSchema.optional(),
  status: tollStatusInput.optional(),
  provider: tollProviderInput.optional(),
  vehicleId: objectIdSchema.optional(),
  customerId: objectIdSchema.optional(),
  contractId: objectIdSchema.optional(),
  eventFrom: instantSchema.optional(),
  eventTo: instantSchema.optional(),
  sort: z.enum(TOLL_SORT_FIELDS).optional(),
  order: z.enum(['asc', 'desc']).optional(),
})

export const createTollBodySchema = z
  .object({
    organizationId: objectIdSchema.optional(),
    legalEntityId: objectIdSchema.optional(),
    branchId: objectIdSchema.optional(),
    externalReference: z.string().trim().min(1).max(128),
    provider: tollProviderInput,
    source: chargeSourceInput.optional(),
    eventAt: instantSchema,
    vehicleId: objectIdSchema.optional(),
    vehiclePlate: z.string().trim().min(1).max(32).optional(),
    amount: moneySchema,
    currency: currencySchema.optional(),
    location: optionalText(200),
    gate: optionalText(120),
    description: optionalText(2000),
    evidenceKey: optionalText(500),
  })
  .refine((value) => Boolean(value.vehicleId || value.vehiclePlate), {
    message: 'Provide vehicleId or vehiclePlate',
    path: ['vehicleId'],
  })

export const updateTollBodySchema = z.object({
  description: optionalText(2000),
  location: optionalText(200),
  gate: optionalText(120),
  evidenceKey: optionalText(500),
})

export const reviewTollBodySchema = reviewFineBodySchema

export const listImportsQuerySchema = paginationQuerySchema.extend({
  organizationId: objectIdSchema.optional(),
  status: importStatusInput.optional(),
})

export const importRowSchema = z.object({
  externalReference: z.string().trim().min(1).max(128),
  vehicleRegistration: z.string().trim().max(32).optional(),
  vehicleId: objectIdSchema.optional(),
  eventAt: z.string().trim().min(1),
  amount: moneySchema,
  currency: currencySchema.optional(),
  type: z.string().trim().max(64).optional(),
  provider: z.string().trim().max(64).optional(),
  location: optionalText(200),
  description: optionalText(2000),
  gate: optionalText(120),
})

export const createImportBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  legalEntityId: objectIdSchema,
  branchId: objectIdSchema,
  kind: enumInput(['FINE', 'TOLL']),
  provider: z.string().trim().min(1).max(64),
  fileName: z.string().trim().max(255).optional(),
  rows: z.array(importRowSchema).min(1).max(5000),
})

export const listRefundsQuerySchema = paginationQuerySchema.extend({
  organizationId: objectIdSchema.optional(),
  branchId: objectIdSchema.optional(),
  status: refundStatusInput.optional(),
  customerId: objectIdSchema.optional(),
  sort: z.enum(REFUND_SORT_FIELDS).optional(),
  order: z.enum(['asc', 'desc']).optional(),
})

export const createRefundBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  legalEntityId: objectIdSchema,
  branchId: objectIdSchema,
  customerId: objectIdSchema,
  contractId: objectIdSchema.optional(),
  sourceKind: refundSourceInput,
  depositId: objectIdSchema.optional(),
  paymentId: objectIdSchema.optional(),
  amount: moneySchema,
  currency: currencySchema.optional(),
  reason: z.string().trim().min(1).max(500),
  notes: optionalText(2000),
  evidenceKey: optionalText(500),
  idempotencyKey: z.string().trim().min(8).max(128),
})

export type ListFinesQuery = z.infer<typeof listFinesQuerySchema>
export type CreateFineBody = z.infer<typeof createFineBodySchema>
export type UpdateFineBody = z.infer<typeof updateFineBodySchema>
export type ReviewFineBody = z.infer<typeof reviewFineBodySchema>
export type DisputeFineBody = z.infer<typeof disputeFineBodySchema>
export type ResolveDisputeBody = z.infer<typeof resolveDisputeBodySchema>
export type RecoverBody = z.infer<typeof recoverBodySchema>
export type ListTollsQuery = z.infer<typeof listTollsQuerySchema>
export type CreateTollBody = z.infer<typeof createTollBodySchema>
export type UpdateTollBody = z.infer<typeof updateTollBodySchema>
export type ListImportsQuery = z.infer<typeof listImportsQuerySchema>
export type CreateImportBody = z.infer<typeof createImportBodySchema>
export type ListRefundsQuery = z.infer<typeof listRefundsQuerySchema>
export type CreateRefundBody = z.infer<typeof createRefundBodySchema>
