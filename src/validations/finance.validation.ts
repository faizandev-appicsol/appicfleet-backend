import { z } from 'zod'
import {
  DEPOSIT_SORT_FIELDS,
  DOC_STATUSES,
  INVOICE_PAYMENT_STATUSES,
  INVOICE_SORT_FIELDS,
  PAYMENT_METHODS,
  PAYMENT_SORT_FIELDS,
  PAYMENT_STATUSES,
} from '../constants/finance.js'
import { currencySchema, objectIdSchema, paginationQuerySchema } from './common.validation.js'
import { clearableText, enumInput, instantSchema, moneySchema, optionalText } from './vehicle.validation.js'

const docStatusInput = enumInput(Object.values(DOC_STATUSES))
const paymentStatusInput = enumInput(Object.values(PAYMENT_STATUSES))
const paymentMethodInput = enumInput(Object.values(PAYMENT_METHODS))
const paymentBalanceInput = enumInput(Object.values(INVOICE_PAYMENT_STATUSES))

const lineSchema = z.object({
  description: z.string().trim().min(1).max(500),
  quantity: z.coerce.number().int().positive(),
  unitPrice: moneySchema,
  discountAmount: moneySchema.optional(),
  taxRatePercent: moneySchema.optional(),
  sourceType: z.string().trim().max(32).optional(),
  sourceId: z.string().trim().max(64).optional(),
  chargeId: objectIdSchema.optional(),
})

export const createInvoiceBodySchema = z
  .object({
    organizationId: objectIdSchema.optional(),
    customerId: objectIdSchema,
    contractId: objectIdSchema.optional(),
    currency: currencySchema.optional(),
    documentDate: instantSchema,
    dueDate: instantSchema,
    notes: optionalText(2000),
    lines: z.array(lineSchema).optional(),
    chargeIds: z.array(objectIdSchema).optional(),
  })
  .superRefine((value, ctx) => {
    if ((!value.lines || value.lines.length === 0) && (!value.chargeIds || value.chargeIds.length === 0)) {
      ctx.addIssue({ code: 'custom', message: 'Provide lines or chargeIds', path: ['lines'] })
    }
    if (value.dueDate.getTime() < value.documentDate.getTime()) {
      ctx.addIssue({ code: 'custom', message: 'Due date must be on or after invoice date', path: ['dueDate'] })
    }
  })

export const updateInvoiceBodySchema = z
  .object({
    customerId: objectIdSchema.optional(),
    contractId: objectIdSchema.nullable().optional(),
    currency: currencySchema.optional(),
    documentDate: instantSchema.optional(),
    dueDate: instantSchema.optional(),
    notes: clearableText(2000),
    lines: z.array(lineSchema).optional(),
    chargeIds: z.array(objectIdSchema).optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: 'Provide at least one field',
  })

export const listInvoicesQuerySchema = paginationQuerySchema.extend({
  organizationId: objectIdSchema.optional(),
  status: docStatusInput.optional(),
  paymentStatus: paymentBalanceInput.optional(),
  branchId: objectIdSchema.optional(),
  customerId: objectIdSchema.optional(),
  contractId: objectIdSchema.optional(),
  legalEntityId: objectIdSchema.optional(),
  currency: currencySchema.optional(),
  documentFrom: instantSchema.optional(),
  documentTo: instantSchema.optional(),
  dueFrom: instantSchema.optional(),
  dueTo: instantSchema.optional(),
  sort: z.enum(INVOICE_SORT_FIELDS).optional(),
  order: z.enum(['asc', 'desc']).optional(),
})

export const createPaymentBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  customerId: objectIdSchema,
  currency: currencySchema.optional(),
  amount: moneySchema,
  method: paymentMethodInput,
  paymentDate: instantSchema,
  externalReference: optionalText(120),
  provider: optionalText(64),
  notes: optionalText(2000),
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
  allocations: z
    .array(
      z.object({
        invoiceId: objectIdSchema,
        amount: moneySchema,
      }),
    )
    .optional(),
})

export const allocatePaymentBodySchema = z.object({
  allocations: z
    .array(
      z.object({
        invoiceId: objectIdSchema,
        amount: moneySchema,
      }),
    )
    .min(1),
})

export const listPaymentsQuerySchema = paginationQuerySchema.extend({
  organizationId: objectIdSchema.optional(),
  status: paymentStatusInput.optional(),
  method: paymentMethodInput.optional(),
  branchId: objectIdSchema.optional(),
  customerId: objectIdSchema.optional(),
  legalEntityId: objectIdSchema.optional(),
  invoiceId: objectIdSchema.optional(),
  paymentFrom: instantSchema.optional(),
  paymentTo: instantSchema.optional(),
  sort: z.enum(PAYMENT_SORT_FIELDS).optional(),
  order: z.enum(['asc', 'desc']).optional(),
})

export const paymentWebhookBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  provider: z.string().trim().min(2).max(64),
  externalEventId: z.string().trim().min(2).max(128),
  externalReference: z.string().trim().min(2).max(120),
  status: z.string().trim().min(2).max(32),
  amount: moneySchema.optional(),
  signature: optionalText(256),
})

export const listReceiptsQuerySchema = paginationQuerySchema.extend({
  organizationId: objectIdSchema.optional(),
  status: docStatusInput.optional(),
  branchId: objectIdSchema.optional(),
  customerId: objectIdSchema.optional(),
  paymentId: objectIdSchema.optional(),
  issuedFrom: instantSchema.optional(),
  issuedTo: instantSchema.optional(),
  order: z.enum(['asc', 'desc']).optional(),
})

export const createCreditNoteBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  invoiceId: objectIdSchema,
  documentDate: instantSchema,
  reason: z.string().trim().min(3).max(500),
  notes: optionalText(2000),
  lines: z.array(lineSchema).min(1),
})

export const updateNoteBodySchema = z
  .object({
    reason: z.string().trim().min(3).max(500).optional(),
    documentDate: instantSchema.optional(),
    notes: clearableText(2000),
    lines: z.array(lineSchema).optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: 'Provide at least one field',
  })

export const createDebitNoteBodySchema = z
  .object({
    organizationId: objectIdSchema.optional(),
    invoiceId: objectIdSchema.optional(),
    customerId: objectIdSchema.optional(),
    contractId: objectIdSchema.optional(),
    documentDate: instantSchema,
    reason: z.string().trim().min(3).max(500),
    notes: optionalText(2000),
    lines: z.array(lineSchema).min(1),
  })
  .refine((value) => Boolean(value.invoiceId || value.customerId), {
    message: 'Provide invoiceId or customerId',
  })

export const listNotesQuerySchema = paginationQuerySchema.extend({
  organizationId: objectIdSchema.optional(),
  status: docStatusInput.optional(),
  branchId: objectIdSchema.optional(),
  customerId: objectIdSchema.optional(),
  invoiceId: objectIdSchema.optional(),
  documentFrom: instantSchema.optional(),
  documentTo: instantSchema.optional(),
  order: z.enum(['asc', 'desc']).optional(),
})

export const createDepositBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  customerId: objectIdSchema,
  contractId: objectIdSchema,
  currency: currencySchema.optional(),
  amount: moneySchema,
  paymentId: objectIdSchema.optional(),
  heldAt: instantSchema.optional(),
  notes: optionalText(2000),
})

export const applyDepositBodySchema = z.object({
  amount: moneySchema,
  invoiceId: objectIdSchema,
  reason: optionalText(500),
})

export const releaseDepositBodySchema = z.object({
  amount: moneySchema,
  reason: optionalText(500),
})

export const listDepositsQuerySchema = paginationQuerySchema.extend({
  organizationId: objectIdSchema.optional(),
  status: z.string().trim().optional(),
  branchId: objectIdSchema.optional(),
  customerId: objectIdSchema.optional(),
  contractId: objectIdSchema.optional(),
  legalEntityId: objectIdSchema.optional(),
  heldFrom: instantSchema.optional(),
  heldTo: instantSchema.optional(),
  sort: z.enum(DEPOSIT_SORT_FIELDS).optional(),
  order: z.enum(['asc', 'desc']).optional(),
})

export const reasonBodySchema = z.object({
  reason: z.string().trim().min(3).max(500),
})

export type CreateInvoiceBody = z.infer<typeof createInvoiceBodySchema>
export type UpdateInvoiceBody = z.infer<typeof updateInvoiceBodySchema>
export type ListInvoicesQuery = z.infer<typeof listInvoicesQuerySchema>
export type CreatePaymentBody = z.infer<typeof createPaymentBodySchema>
export type AllocatePaymentBody = z.infer<typeof allocatePaymentBodySchema>
export type ListPaymentsQuery = z.infer<typeof listPaymentsQuerySchema>
export type PaymentWebhookBody = z.infer<typeof paymentWebhookBodySchema>
export type ListReceiptsQuery = z.infer<typeof listReceiptsQuerySchema>
export type CreateCreditNoteBody = z.infer<typeof createCreditNoteBodySchema>
export type UpdateNoteBody = z.infer<typeof updateNoteBodySchema>
export type CreateDebitNoteBody = z.infer<typeof createDebitNoteBodySchema>
export type ListNotesQuery = z.infer<typeof listNotesQuerySchema>
export type CreateDepositBody = z.infer<typeof createDepositBodySchema>
export type ApplyDepositBody = z.infer<typeof applyDepositBodySchema>
export type ReleaseDepositBody = z.infer<typeof releaseDepositBodySchema>
export type ListDepositsQuery = z.infer<typeof listDepositsQuerySchema>
