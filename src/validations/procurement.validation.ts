import { z } from 'zod'
import {
  BILL_PAYMENT_STATUSES,
  BILL_SORT_FIELDS,
  BORROW_RATE_TYPES,
  EXPENSE_SORT_FIELDS,
  EXPENSE_STATUSES,
  LPO_SORT_FIELDS,
  LPO_STATUSES,
  PAYMENT_TERMS,
  REMINDER_BASES,
  REMINDER_STATUSES,
  SERVICE_PRIORITIES,
  SERVICE_TYPES,
  VENDOR_BILL_STATUSES,
  VENDOR_CONTACT_ROLES,
  VENDOR_SORT_FIELDS,
  VENDOR_STATUSES,
  VENDOR_TYPES,
  WORK_ORDER_SORT_FIELDS,
  WORK_ORDER_STATUSES,
} from '../constants/procurement.js'
import { currencySchema, objectIdSchema, paginationQuerySchema } from './common.validation.js'
import { enumInput, instantSchema, moneySchema, optionalText } from './vehicle.validation.js'

const vendorStatusInput = enumInput(Object.values(VENDOR_STATUSES))
const vendorTypeInput = enumInput(Object.values(VENDOR_TYPES))
const paymentTermsInput = enumInput(Object.values(PAYMENT_TERMS))
const lpoStatusInput = enumInput(Object.values(LPO_STATUSES))
const billStatusInput = enumInput(Object.values(VENDOR_BILL_STATUSES))
const expenseStatusInput = enumInput(Object.values(EXPENSE_STATUSES))
const workOrderStatusInput = enumInput(Object.values(WORK_ORDER_STATUSES))
const priorityInput = enumInput(Object.values(SERVICE_PRIORITIES))
const serviceTypeInput = enumInput(Object.values(SERVICE_TYPES))
const reminderStatusInput = enumInput(Object.values(REMINDER_STATUSES))
const reminderBasisInput = enumInput(Object.values(REMINDER_BASES))
const borrowRateInput = enumInput(Object.values(BORROW_RATE_TYPES))
const paymentBalanceInput = enumInput(Object.values(BILL_PAYMENT_STATUSES))

const contactSchema = z.object({
  role: enumInput(Object.values(VENDOR_CONTACT_ROLES)),
  name: z.string().trim().min(1).max(120),
  phone: optionalText(40),
  email: z.string().trim().email().max(160).optional().or(z.literal('')),
  isPrimary: z.boolean().optional(),
})

const moneyLineSchema = z.object({
  description: z.string().trim().min(1).max(500),
  quantity: z.coerce.number().int().positive(),
  unitPrice: moneySchema,
  discountAmount: moneySchema.optional(),
  taxRatePercent: moneySchema.optional(),
  vehicleId: objectIdSchema.optional(),
  notes: optionalText(500),
  lpoLineId: objectIdSchema.optional(),
})

const workOrderLineSchema = z.object({
  kind: z.enum(['parts', 'labor', 'other', 'PARTS', 'LABOR', 'OTHER']),
  description: z.string().trim().min(1).max(500),
  quantity: z.coerce.number().int().positive(),
  unitPrice: moneySchema,
})

export const createVendorBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  legalEntityId: objectIdSchema,
  branchId: objectIdSchema,
  name: z.string().trim().min(1).max(200),
  vendorType: vendorTypeInput,
  partyKind: enumInput(['COMPANY', 'INDIVIDUAL']).optional(),
  phone: optionalText(40),
  email: z.string().trim().email().max(160).optional().or(z.literal('')),
  addressLine1: optionalText(200),
  city: optionalText(100),
  country: optionalText(100),
  taxRegistration: optionalText(80),
  paymentTerms: paymentTermsInput.optional(),
  customPaymentDays: z.coerce.number().int().positive().max(365).optional(),
  notes: optionalText(2000),
  contacts: z.array(contactSchema).optional(),
})

export const updateVendorBodySchema = createVendorBodySchema
  .omit({ organizationId: true, legalEntityId: true, branchId: true })
  .partial()
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: 'Provide at least one field',
  })

export const listVendorsQuerySchema = paginationQuerySchema.extend({
  organizationId: objectIdSchema.optional(),
  status: vendorStatusInput.optional(),
  vendorType: vendorTypeInput.optional(),
  branchId: objectIdSchema.optional(),
  legalEntityId: objectIdSchema.optional(),
  sort: z.enum(VENDOR_SORT_FIELDS).optional(),
  order: z.enum(['asc', 'desc']).optional(),
})

export const vendorDocumentBodySchema = z.object({
  documentType: z.string().trim().min(1).max(64),
  fileName: z.string().trim().min(1).max(255),
  storageKey: z.string().trim().min(1).max(500),
  mimeType: optionalText(120),
  expiresAt: instantSchema.optional(),
  notes: optionalText(500),
})

export const createLpoBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  vendorId: objectIdSchema,
  orderDate: instantSchema,
  expectedAt: instantSchema.optional(),
  currency: currencySchema.optional(),
  paymentTerms: paymentTermsInput.optional(),
  notes: optionalText(2000),
  workOrderId: objectIdSchema.optional(),
  lines: z.array(moneyLineSchema).min(1),
})

export const updateLpoBodySchema = createLpoBodySchema.partial().refine((value) => Object.values(value).some((item) => item !== undefined), {
  message: 'Provide at least one field',
})

export const listLposQuerySchema = paginationQuerySchema.extend({
  organizationId: objectIdSchema.optional(),
  status: lpoStatusInput.optional(),
  vendorId: objectIdSchema.optional(),
  branchId: objectIdSchema.optional(),
  orderFrom: instantSchema.optional(),
  orderTo: instantSchema.optional(),
  sort: z.enum(LPO_SORT_FIELDS).optional(),
  order: z.enum(['asc', 'desc']).optional(),
})

export const createVendorBillBodySchema = z
  .object({
    organizationId: objectIdSchema.optional(),
    vendorId: objectIdSchema,
    vendorInvoiceNumber: z.string().trim().min(1).max(120),
    lpoId: objectIdSchema.optional(),
    workOrderId: objectIdSchema.optional(),
    billDate: instantSchema,
    dueDate: instantSchema,
    currency: currencySchema.optional(),
    notes: optionalText(2000),
    lines: z.array(moneyLineSchema).min(1),
  })
  .superRefine((value, ctx) => {
    if (value.dueDate.getTime() < value.billDate.getTime()) {
      ctx.addIssue({ code: 'custom', message: 'Due date must be on or after bill date', path: ['dueDate'] })
    }
  })

export const listVendorBillsQuerySchema = paginationQuerySchema.extend({
  organizationId: objectIdSchema.optional(),
  status: billStatusInput.optional(),
  vendorId: objectIdSchema.optional(),
  lpoId: objectIdSchema.optional(),
  branchId: objectIdSchema.optional(),
  paymentStatus: paymentBalanceInput.optional(),
  billFrom: instantSchema.optional(),
  billTo: instantSchema.optional(),
  sort: z.enum(BILL_SORT_FIELDS).optional(),
  order: z.enum(['asc', 'desc']).optional(),
})

export const createExpenseBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  legalEntityId: objectIdSchema,
  branchId: objectIdSchema,
  categoryCode: z.string().trim().min(1).max(64),
  vendorId: objectIdSchema.optional(),
  vehicleId: objectIdSchema.optional(),
  contractId: objectIdSchema.optional(),
  employeeUserId: objectIdSchema.optional(),
  currency: currencySchema.optional(),
  expenseDate: instantSchema,
  description: z.string().trim().min(1).max(500),
  amount: moneySchema,
  taxRatePercent: moneySchema.optional(),
  notes: optionalText(2000),
  attachmentKey: optionalText(500),
})

export const updateExpenseBodySchema = createExpenseBodySchema
  .omit({ organizationId: true, legalEntityId: true, branchId: true })
  .partial()
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: 'Provide at least one field',
  })

export const listExpensesQuerySchema = paginationQuerySchema.extend({
  organizationId: objectIdSchema.optional(),
  status: expenseStatusInput.optional(),
  categoryCode: z.string().trim().max(64).optional(),
  vendorId: objectIdSchema.optional(),
  vehicleId: objectIdSchema.optional(),
  contractId: objectIdSchema.optional(),
  branchId: objectIdSchema.optional(),
  expenseFrom: instantSchema.optional(),
  expenseTo: instantSchema.optional(),
  sort: z.enum(EXPENSE_SORT_FIELDS).optional(),
  order: z.enum(['asc', 'desc']).optional(),
})

export const createWorkOrderBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  vehicleId: objectIdSchema,
  vendorId: objectIdSchema.optional(),
  lpoId: objectIdSchema.optional(),
  serviceType: serviceTypeInput,
  priority: priorityInput.optional(),
  description: z.string().trim().min(1).max(1000),
  issue: optionalText(2000),
  requestedAt: instantSchema.optional(),
  estimatedCost: moneySchema.optional(),
  currency: currencySchema.optional(),
  notes: optionalText(2000),
  assignedUserId: objectIdSchema.optional(),
  lines: z.array(workOrderLineSchema).optional(),
})

export const updateWorkOrderBodySchema = createWorkOrderBodySchema.partial().refine((value) => Object.values(value).some((item) => item !== undefined), {
  message: 'Provide at least one field',
})

export const scheduleWorkOrderBodySchema = z
  .object({
    scheduledAt: instantSchema,
    downtimeStartsAt: instantSchema,
    downtimeEndsAt: instantSchema,
  })
  .superRefine((value, ctx) => {
    if (value.downtimeEndsAt.getTime() <= value.downtimeStartsAt.getTime()) {
      ctx.addIssue({ code: 'custom', message: 'Downtime end must be after start', path: ['downtimeEndsAt'] })
    }
  })

export const completeWorkOrderBodySchema = z.object({
  actualCost: moneySchema.optional(),
  lines: z.array(workOrderLineSchema).optional(),
})

export const listWorkOrdersQuerySchema = paginationQuerySchema.extend({
  organizationId: objectIdSchema.optional(),
  status: workOrderStatusInput.optional(),
  priority: priorityInput.optional(),
  serviceType: serviceTypeInput.optional(),
  vendorId: objectIdSchema.optional(),
  vehicleId: objectIdSchema.optional(),
  branchId: objectIdSchema.optional(),
  sort: z.enum(WORK_ORDER_SORT_FIELDS).optional(),
  order: z.enum(['asc', 'desc']).optional(),
})

export const createReminderBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  vehicleId: objectIdSchema,
  serviceType: serviceTypeInput,
  basis: reminderBasisInput,
  dueAt: instantSchema.optional(),
  dueMileage: z.coerce.number().int().nonnegative().optional(),
  intervalDays: z.coerce.number().int().positive().optional(),
  intervalKm: z.coerce.number().int().positive().optional(),
  notes: optionalText(500),
})

export const listRemindersQuerySchema = paginationQuerySchema.extend({
  organizationId: objectIdSchema.optional(),
  status: reminderStatusInput.optional(),
  vehicleId: objectIdSchema.optional(),
  branchId: objectIdSchema.optional(),
})

export const completeReminderBodySchema = z.object({
  workOrderId: objectIdSchema.optional(),
})

export const createBorrowTermBodySchema = z.object({
  vendorId: objectIdSchema,
  vehicleId: objectIdSchema,
  rateType: borrowRateInput,
  rateAmount: moneySchema,
  currency: currencySchema.optional(),
  effectiveFrom: instantSchema,
  effectiveTo: instantSchema.optional(),
  notes: optionalText(500),
})

export const allocateBorrowCostBodySchema = z.object({
  vehicleId: objectIdSchema,
  usageDays: z.coerce.number().int().positive(),
  asOf: instantSchema.optional(),
})

export const createApPaymentBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  vendorId: objectIdSchema,
  amount: moneySchema,
  currency: currencySchema.optional(),
  paymentDate: instantSchema,
  method: optionalText(40),
  notes: optionalText(2000),
  allocations: z
    .array(
      z.object({
        vendorBillId: objectIdSchema,
        amount: moneySchema,
      }),
    )
    .optional(),
})

export const allocateApPaymentBodySchema = z.object({
  allocations: z
    .array(
      z.object({
        vendorBillId: objectIdSchema,
        amount: moneySchema,
      }),
    )
    .min(1),
})

export const reasonBodySchema = z.object({
  reason: z.string().trim().min(1).max(500),
})

export type CreateVendorBody = z.infer<typeof createVendorBodySchema>
export type UpdateVendorBody = z.infer<typeof updateVendorBodySchema>
export type ListVendorsQuery = z.infer<typeof listVendorsQuerySchema>
export type CreateLpoBody = z.infer<typeof createLpoBodySchema>
export type UpdateLpoBody = z.infer<typeof updateLpoBodySchema>
export type ListLposQuery = z.infer<typeof listLposQuerySchema>
export type CreateVendorBillBody = z.infer<typeof createVendorBillBodySchema>
export type ListVendorBillsQuery = z.infer<typeof listVendorBillsQuerySchema>
export type CreateExpenseBody = z.infer<typeof createExpenseBodySchema>
export type UpdateExpenseBody = z.infer<typeof updateExpenseBodySchema>
export type ListExpensesQuery = z.infer<typeof listExpensesQuerySchema>
export type CreateWorkOrderBody = z.infer<typeof createWorkOrderBodySchema>
export type UpdateWorkOrderBody = z.infer<typeof updateWorkOrderBodySchema>
export type ScheduleWorkOrderBody = z.infer<typeof scheduleWorkOrderBodySchema>
export type CompleteWorkOrderBody = z.infer<typeof completeWorkOrderBodySchema>
export type ListWorkOrdersQuery = z.infer<typeof listWorkOrdersQuerySchema>
export type CreateReminderBody = z.infer<typeof createReminderBodySchema>
export type ListRemindersQuery = z.infer<typeof listRemindersQuerySchema>
export type CreateBorrowTermBody = z.infer<typeof createBorrowTermBodySchema>
export type AllocateBorrowCostBody = z.infer<typeof allocateBorrowCostBodySchema>
export type CreateApPaymentBody = z.infer<typeof createApPaymentBodySchema>
export type AllocateApPaymentBody = z.infer<typeof allocateApPaymentBodySchema>
