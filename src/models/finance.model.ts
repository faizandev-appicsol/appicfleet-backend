import { Schema, model } from 'mongoose'
import {
  DEPOSIT_EVENT_KINDS,
  DEPOSIT_STATUSES,
  DOC_STATUSES,
  INVOICE_LINE_SOURCES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
} from '../constants/finance.js'

const money = { type: String, required: true, trim: true, maxlength: 20 }
const optionalMoney = { type: String, trim: true, maxlength: 20 }

const invoiceSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    documentNumber: { type: String, trim: true, maxlength: 32 },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    customerDisplayName: { type: String, required: true, trim: true, maxlength: 200 },
    contractId: { type: Schema.Types.ObjectId, ref: 'Contract' },
    currency: { type: String, required: true, trim: true, uppercase: true, maxlength: 3 },
    documentDate: { type: Date, required: true },
    dueDate: { type: Date, required: true },
    status: { type: String, required: true, enum: Object.values(DOC_STATUSES) },
    subtotal: money,
    discountTotal: money,
    taxableAmount: money,
    taxAmount: money,
    totalAmount: money,
    paidAmount: { ...money, default: '0.00' },
    creditedAmount: { ...optionalMoney, default: '0.00' },
    outstandingAmount: money,
    notes: { type: String, trim: true, maxlength: 2000 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    postedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    postedAt: { type: Date },
    voidedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    voidedAt: { type: Date },
  },
  { timestamps: true, collection: 'invoices' },
)
invoiceSchema.index(
  { organizationId: 1, documentNumber: 1 },
  { unique: true, partialFilterExpression: { documentNumber: { $type: 'string' } } },
)
invoiceSchema.index({ organizationId: 1, branchId: 1, status: 1, documentDate: 1 })
invoiceSchema.index({ organizationId: 1, customerId: 1, documentDate: 1 })
invoiceSchema.index({ organizationId: 1, contractId: 1, documentDate: 1 })
invoiceSchema.index({ organizationId: 1, dueDate: 1, status: 1 })

const invoiceLineSchema = new Schema(
  {
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    description: { type: String, required: true, trim: true, maxlength: 500 },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: money,
    discountAmount: { ...money, default: '0.00' },
    taxRatePercent: { ...money, default: '0.00' },
    taxCode: { type: String, trim: true, uppercase: true, maxlength: 32 },
    taxCodeId: { type: Schema.Types.ObjectId, ref: 'TaxCode' },
    taxTreatment: { type: String, trim: true, uppercase: true, maxlength: 32 },
    taxCategory: { type: String, trim: true, maxlength: 64 },
    pricingMode: { type: String, trim: true, uppercase: true, maxlength: 16, default: 'EXCLUSIVE' },
    lineSubtotal: money,
    taxableAmount: money,
    taxAmount: money,
    lineTotal: money,
    sourceType: { type: String, enum: Object.values(INVOICE_LINE_SOURCES), default: INVOICE_LINE_SOURCES.MANUAL },
    sourceId: { type: String, trim: true, maxlength: 64 },
    sortOrder: { type: Number, required: true, min: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'invoice_lines' },
)
invoiceLineSchema.index({ invoiceId: 1, sortOrder: 1 })
invoiceLineSchema.index(
  { organizationId: 1, sourceType: 1, sourceId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      sourceType: INVOICE_LINE_SOURCES.CONTRACT_CHARGE,
      sourceId: { $type: 'string' },
    },
  },
)

const paymentSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    paymentNumber: { type: String, trim: true, maxlength: 32 },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    customerDisplayName: { type: String, required: true, trim: true, maxlength: 200 },
    currency: { type: String, required: true, trim: true, uppercase: true, maxlength: 3 },
    amount: money,
    allocatedAmount: { ...money, default: '0.00' },
    unallocatedAmount: money,
    method: { type: String, required: true, enum: Object.values(PAYMENT_METHODS) },
    paymentDate: { type: Date, required: true },
    status: { type: String, required: true, enum: Object.values(PAYMENT_STATUSES) },
    externalReference: { type: String, trim: true, maxlength: 120 },
    provider: { type: String, trim: true, maxlength: 64 },
    notes: { type: String, trim: true, maxlength: 2000 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    completedAt: { type: Date },
    reversedAt: { type: Date },
  },
  { timestamps: true, collection: 'payments' },
)
paymentSchema.index(
  { organizationId: 1, paymentNumber: 1 },
  { unique: true, partialFilterExpression: { paymentNumber: { $type: 'string' } } },
)
paymentSchema.index(
  { organizationId: 1, externalReference: 1 },
  { unique: true, partialFilterExpression: { externalReference: { $type: 'string' } } },
)
paymentSchema.index({ organizationId: 1, branchId: 1, status: 1, paymentDate: 1 })
paymentSchema.index({ organizationId: 1, customerId: 1, paymentDate: 1 })

const paymentAllocationSchema = new Schema(
  {
    paymentId: { type: Schema.Types.ObjectId, ref: 'Payment', required: true },
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    amount: money,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'payment_allocations' },
)
paymentAllocationSchema.index({ paymentId: 1, invoiceId: 1 }, { unique: true })
paymentAllocationSchema.index({ invoiceId: 1, createdAt: 1 })

const receiptSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    receiptNumber: { type: String, required: true, trim: true, maxlength: 32 },
    paymentId: { type: Schema.Types.ObjectId, ref: 'Payment', required: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    customerDisplayName: { type: String, required: true, trim: true, maxlength: 200 },
    currency: { type: String, required: true, trim: true, uppercase: true, maxlength: 3 },
    amount: money,
    method: { type: String, required: true, enum: Object.values(PAYMENT_METHODS) },
    issuedAt: { type: Date, required: true },
    status: { type: String, required: true, enum: [DOC_STATUSES.POSTED, DOC_STATUSES.VOIDED] },
    notes: { type: String, trim: true, maxlength: 2000 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, collection: 'receipts' },
)
receiptSchema.index({ organizationId: 1, receiptNumber: 1 }, { unique: true })
receiptSchema.index({ paymentId: 1 }, { unique: true })
receiptSchema.index({ organizationId: 1, customerId: 1, issuedAt: 1 })

const noteLineFields = {
  description: { type: String, required: true, trim: true, maxlength: 500 },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: money,
  discountAmount: { ...money, default: '0.00' },
  taxRatePercent: { ...money, default: '0.00' },
  taxCode: { type: String, trim: true, uppercase: true, maxlength: 32 },
  taxTreatment: { type: String, trim: true, uppercase: true, maxlength: 32 },
  pricingMode: { type: String, trim: true, uppercase: true, maxlength: 16, default: 'EXCLUSIVE' },
  lineSubtotal: money,
  taxableAmount: money,
  taxAmount: money,
  lineTotal: money,
  sortOrder: { type: Number, required: true, min: 0 },
}

const creditNoteSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    documentNumber: { type: String, trim: true, maxlength: 32 },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    customerDisplayName: { type: String, required: true, trim: true, maxlength: 200 },
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true },
    contractId: { type: Schema.Types.ObjectId, ref: 'Contract' },
    currency: { type: String, required: true, trim: true, uppercase: true, maxlength: 3 },
    documentDate: { type: Date, required: true },
    reason: { type: String, required: true, trim: true, maxlength: 500 },
    status: { type: String, required: true, enum: Object.values(DOC_STATUSES) },
    subtotal: money,
    discountTotal: money,
    taxableAmount: money,
    taxAmount: money,
    totalAmount: money,
    notes: { type: String, trim: true, maxlength: 2000 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    postedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    postedAt: { type: Date },
    voidedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    voidedAt: { type: Date },
  },
  { timestamps: true, collection: 'credit_notes' },
)
creditNoteSchema.index(
  { organizationId: 1, documentNumber: 1 },
  { unique: true, partialFilterExpression: { documentNumber: { $type: 'string' } } },
)
creditNoteSchema.index({ organizationId: 1, invoiceId: 1, status: 1 })
creditNoteSchema.index({ organizationId: 1, customerId: 1, documentDate: 1 })

const creditNoteLineSchema = new Schema(
  {
    creditNoteId: { type: Schema.Types.ObjectId, ref: 'CreditNote', required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    ...noteLineFields,
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'credit_note_lines' },
)
creditNoteLineSchema.index({ creditNoteId: 1, sortOrder: 1 })

const debitNoteSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    documentNumber: { type: String, trim: true, maxlength: 32 },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    customerDisplayName: { type: String, required: true, trim: true, maxlength: 200 },
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice' },
    contractId: { type: Schema.Types.ObjectId, ref: 'Contract' },
    currency: { type: String, required: true, trim: true, uppercase: true, maxlength: 3 },
    documentDate: { type: Date, required: true },
    reason: { type: String, required: true, trim: true, maxlength: 500 },
    status: { type: String, required: true, enum: Object.values(DOC_STATUSES) },
    subtotal: money,
    discountTotal: money,
    taxableAmount: money,
    taxAmount: money,
    totalAmount: money,
    notes: { type: String, trim: true, maxlength: 2000 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    postedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    postedAt: { type: Date },
    voidedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    voidedAt: { type: Date },
  },
  { timestamps: true, collection: 'debit_notes' },
)
debitNoteSchema.index(
  { organizationId: 1, documentNumber: 1 },
  { unique: true, partialFilterExpression: { documentNumber: { $type: 'string' } } },
)
debitNoteSchema.index({ organizationId: 1, customerId: 1, documentDate: 1 })
debitNoteSchema.index({ organizationId: 1, invoiceId: 1 })

const debitNoteLineSchema = new Schema(
  {
    debitNoteId: { type: Schema.Types.ObjectId, ref: 'DebitNote', required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    ...noteLineFields,
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'debit_note_lines' },
)
debitNoteLineSchema.index({ debitNoteId: 1, sortOrder: 1 })

const depositSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    depositNumber: { type: String, required: true, trim: true, maxlength: 32 },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    customerDisplayName: { type: String, required: true, trim: true, maxlength: 200 },
    contractId: { type: Schema.Types.ObjectId, ref: 'Contract', required: true },
    currency: { type: String, required: true, trim: true, uppercase: true, maxlength: 3 },
    amount: money,
    appliedAmount: { ...money, default: '0.00' },
    releasedAmount: { ...money, default: '0.00' },
    remainingAmount: money,
    status: { type: String, required: true, enum: Object.values(DEPOSIT_STATUSES) },
    paymentId: { type: Schema.Types.ObjectId, ref: 'Payment' },
    heldAt: { type: Date, required: true },
    releasedAt: { type: Date },
    notes: { type: String, trim: true, maxlength: 2000 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, collection: 'deposits' },
)
depositSchema.index({ organizationId: 1, depositNumber: 1 }, { unique: true })
depositSchema.index({ organizationId: 1, contractId: 1, status: 1 })
depositSchema.index({ organizationId: 1, customerId: 1, heldAt: 1 })
depositSchema.index({ organizationId: 1, branchId: 1, status: 1 })

const depositEventSchema = new Schema(
  {
    depositId: { type: Schema.Types.ObjectId, ref: 'Deposit', required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    kind: { type: String, required: true, enum: Object.values(DEPOSIT_EVENT_KINDS) },
    amount: money,
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice' },
    reason: { type: String, trim: true, maxlength: 500 },
    actorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'deposit_events' },
)
depositEventSchema.index({ depositId: 1, createdAt: 1 })

const financeStatusEventSchema = new Schema(
  {
    entityType: { type: String, required: true, maxlength: 32 },
    entityId: { type: Schema.Types.ObjectId, required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
    fromStatus: { type: String, maxlength: 32 },
    toStatus: { type: String, required: true, maxlength: 32 },
    reason: { type: String, trim: true, maxlength: 500 },
    actorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'finance_status_events' },
)
financeStatusEventSchema.index({ entityType: 1, entityId: 1, createdAt: 1 })

const financeCounterSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    name: { type: String, required: true, trim: true, maxlength: 32 },
    seq: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: true, collection: 'finance_counters' },
)
financeCounterSchema.index({ organizationId: 1, name: 1 }, { unique: true })

const financeIdempotencySchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    key: { type: String, required: true, trim: true, maxlength: 128 },
    requestHash: { type: String, required: true, maxlength: 64 },
    paymentId: { type: Schema.Types.ObjectId, ref: 'Payment' },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'finance_idempotency_keys' },
)
financeIdempotencySchema.index({ organizationId: 1, key: 1 }, { unique: true })

const webhookEventSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    provider: { type: String, required: true, trim: true, maxlength: 64 },
    externalEventId: { type: String, required: true, trim: true, maxlength: 128 },
    paymentId: { type: Schema.Types.ObjectId, ref: 'Payment' },
    payloadHash: { type: String, required: true, maxlength: 64 },
    processedAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'payment_webhook_events' },
)
webhookEventSchema.index({ organizationId: 1, provider: 1, externalEventId: 1 }, { unique: true })

export const Invoice = model('Invoice', invoiceSchema)
export const InvoiceLine = model('InvoiceLine', invoiceLineSchema)
export const Payment = model('Payment', paymentSchema)
export const PaymentAllocation = model('PaymentAllocation', paymentAllocationSchema)
export const Receipt = model('Receipt', receiptSchema)
export const CreditNote = model('CreditNote', creditNoteSchema)
export const CreditNoteLine = model('CreditNoteLine', creditNoteLineSchema)
export const DebitNote = model('DebitNote', debitNoteSchema)
export const DebitNoteLine = model('DebitNoteLine', debitNoteLineSchema)
export const Deposit = model('Deposit', depositSchema)
export const DepositEvent = model('DepositEvent', depositEventSchema)
export const FinanceStatusEvent = model('FinanceStatusEvent', financeStatusEventSchema)
export const FinanceCounter = model('FinanceCounter', financeCounterSchema)
export const FinanceIdempotency = model('FinanceIdempotency', financeIdempotencySchema)
export const PaymentWebhookEvent = model('PaymentWebhookEvent', webhookEventSchema)
