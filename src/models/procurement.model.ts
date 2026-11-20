import { Schema, model } from 'mongoose'
import {
  BILL_PAYMENT_STATUSES,
  BORROW_RATE_TYPES,
  EXPENSE_STATUSES,
  LPO_STATUSES,
  MATCH_RESULTS,
  PAYMENT_TERMS,
  REMINDER_BASES,
  REMINDER_STATUSES,
  SERVICE_PRIORITIES,
  SERVICE_TYPES,
  VENDOR_BILL_STATUSES,
  VENDOR_CONTACT_ROLES,
  VENDOR_STATUSES,
  VENDOR_TYPES,
  WORK_ORDER_STATUSES,
} from '../constants/procurement.js'

const money = { type: String, required: true, trim: true, maxlength: 20 }

const vendorSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    vendorCode: { type: String, required: true, trim: true, maxlength: 32 },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    vendorType: { type: String, required: true, enum: Object.values(VENDOR_TYPES) },
    partyKind: { type: String, required: true, enum: ['COMPANY', 'INDIVIDUAL'], default: 'COMPANY' },
    status: { type: String, required: true, enum: Object.values(VENDOR_STATUSES) },
    phone: { type: String, trim: true, maxlength: 40 },
    email: { type: String, trim: true, maxlength: 200 },
    addressLine1: { type: String, trim: true, maxlength: 200 },
    city: { type: String, trim: true, maxlength: 100 },
    country: { type: String, trim: true, uppercase: true, maxlength: 2 },
    taxRegistration: { type: String, trim: true, maxlength: 64 },
    paymentTerms: { type: String, required: true, enum: Object.values(PAYMENT_TERMS) },
    customPaymentDays: { type: Number, min: 1, max: 365 },
    bankName: { type: String, trim: true, maxlength: 120 },
    bankAccountMasked: { type: String, trim: true, maxlength: 64 },
    notes: { type: String, trim: true, maxlength: 2000 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'vendors' },
)
vendorSchema.index({ organizationId: 1, vendorCode: 1 }, { unique: true })
vendorSchema.index({ organizationId: 1, branchId: 1, status: 1, name: 1 })
vendorSchema.index({ organizationId: 1, vendorType: 1, status: 1 })
vendorSchema.index({ organizationId: 1, name: 1 })

const vendorContactSchema = new Schema(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    role: { type: String, required: true, enum: Object.values(VENDOR_CONTACT_ROLES) },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    phone: { type: String, trim: true, maxlength: 40 },
    email: { type: String, trim: true, maxlength: 200 },
    isPrimary: { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'vendor_contacts' },
)
vendorContactSchema.index({ vendorId: 1, role: 1, name: 1 })

const vendorDocumentSchema = new Schema(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    documentType: { type: String, required: true, trim: true, maxlength: 64 },
    fileName: { type: String, required: true, trim: true, maxlength: 255 },
    storageKey: { type: String, required: true, trim: true, maxlength: 500 },
    mimeType: { type: String, trim: true, maxlength: 120 },
    expiresAt: { type: Date },
    notes: { type: String, trim: true, maxlength: 500 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    archivedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'vendor_documents' },
)
vendorDocumentSchema.index({ vendorId: 1, createdAt: 1 })

const lineFields = {
  description: { type: String, required: true, trim: true, maxlength: 500 },
  quantity: { type: Number, required: true, min: 0 },
  unitPrice: money,
  discountAmount: { ...money, default: '0.00' },
  taxRatePercent: { ...money, default: '0.00' },
  lineSubtotal: money,
  taxableAmount: money,
  taxAmount: money,
  lineTotal: money,
  vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle' },
  sortOrder: { type: Number, required: true, min: 0 },
  notes: { type: String, trim: true, maxlength: 500 },
}

const lpoSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    documentNumber: { type: String, trim: true, maxlength: 32 },
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
    vendorName: { type: String, required: true, trim: true, maxlength: 200 },
    orderDate: { type: Date, required: true },
    expectedAt: { type: Date },
    currency: { type: String, required: true, trim: true, uppercase: true, maxlength: 3 },
    paymentTerms: { type: String, required: true, enum: Object.values(PAYMENT_TERMS) },
    status: { type: String, required: true, enum: Object.values(LPO_STATUSES) },
    subtotal: money,
    discountTotal: money,
    taxableAmount: money,
    taxAmount: money,
    totalAmount: money,
    approvalLevel: { type: String, trim: true, maxlength: 32 },
    notes: { type: String, trim: true, maxlength: 2000 },
    workOrderId: { type: Schema.Types.ObjectId, ref: 'WorkOrder' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    submittedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    submittedAt: { type: Date },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelledAt: { type: Date },
  },
  { timestamps: true, collection: 'lpos' },
)
lpoSchema.index(
  { organizationId: 1, documentNumber: 1 },
  { unique: true, partialFilterExpression: { documentNumber: { $type: 'string' } } },
)
lpoSchema.index({ organizationId: 1, vendorId: 1, orderDate: 1 })
lpoSchema.index({ organizationId: 1, branchId: 1, status: 1, orderDate: 1 })

const lpoLineSchema = new Schema(
  {
    lpoId: { type: Schema.Types.ObjectId, ref: 'Lpo', required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    ...lineFields,
    billedQuantity: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'lpo_lines' },
)
lpoLineSchema.index({ lpoId: 1, sortOrder: 1 })

const vendorBillSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    documentNumber: { type: String, trim: true, maxlength: 32 },
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
    vendorName: { type: String, required: true, trim: true, maxlength: 200 },
    vendorInvoiceNumber: { type: String, required: true, trim: true, maxlength: 64 },
    lpoId: { type: Schema.Types.ObjectId, ref: 'Lpo' },
    workOrderId: { type: Schema.Types.ObjectId, ref: 'WorkOrder' },
    currency: { type: String, required: true, trim: true, uppercase: true, maxlength: 3 },
    billDate: { type: Date, required: true },
    dueDate: { type: Date, required: true },
    status: { type: String, required: true, enum: Object.values(VENDOR_BILL_STATUSES) },
    matchResult: { type: String, enum: Object.values(MATCH_RESULTS) },
    subtotal: money,
    discountTotal: money,
    taxableAmount: money,
    taxAmount: money,
    totalAmount: money,
    paidAmount: { ...money, default: '0.00' },
    outstandingAmount: money,
    paymentStatus: {
      type: String,
      required: true,
      enum: Object.values(BILL_PAYMENT_STATUSES),
      default: BILL_PAYMENT_STATUSES.UNPAID,
    },
    notes: { type: String, trim: true, maxlength: 2000 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    postedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    postedAt: { type: Date },
  },
  { timestamps: true, collection: 'vendor_bills' },
)
vendorBillSchema.index(
  { organizationId: 1, documentNumber: 1 },
  { unique: true, partialFilterExpression: { documentNumber: { $type: 'string' } } },
)
vendorBillSchema.index(
  { organizationId: 1, vendorId: 1, vendorInvoiceNumber: 1 },
  { unique: true },
)
vendorBillSchema.index({ organizationId: 1, lpoId: 1, status: 1 })
vendorBillSchema.index({ organizationId: 1, branchId: 1, status: 1, billDate: 1 })

const vendorBillLineSchema = new Schema(
  {
    vendorBillId: { type: Schema.Types.ObjectId, ref: 'VendorBill', required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    lpoLineId: { type: Schema.Types.ObjectId, ref: 'LpoLine' },
    ...lineFields,
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'vendor_bill_lines' },
)
vendorBillLineSchema.index({ vendorBillId: 1, sortOrder: 1 })

const expenseCategorySchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 40 },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'expense_categories' },
)
expenseCategorySchema.index({ organizationId: 1, code: 1 }, { unique: true })

const expenseSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    documentNumber: { type: String, trim: true, maxlength: 32 },
    categoryCode: { type: String, required: true, trim: true, uppercase: true, maxlength: 40 },
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor' },
    vendorName: { type: String, trim: true, maxlength: 200 },
    vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle' },
    vehiclePlate: { type: String, trim: true, maxlength: 20 },
    contractId: { type: Schema.Types.ObjectId, ref: 'Contract' },
    employeeUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    currency: { type: String, required: true, trim: true, uppercase: true, maxlength: 3 },
    expenseDate: { type: Date, required: true },
    description: { type: String, required: true, trim: true, maxlength: 500 },
    status: { type: String, required: true, enum: Object.values(EXPENSE_STATUSES) },
    amount: money,
    taxRatePercent: { ...money, default: '0.00' },
    taxAmount: money,
    totalAmount: money,
    notes: { type: String, trim: true, maxlength: 2000 },
    attachmentKey: { type: String, trim: true, maxlength: 500 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    submittedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    submittedAt: { type: Date },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    postedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    postedAt: { type: Date },
  },
  { timestamps: true, collection: 'expenses' },
)
expenseSchema.index(
  { organizationId: 1, documentNumber: 1 },
  { unique: true, partialFilterExpression: { documentNumber: { $type: 'string' } } },
)
expenseSchema.index({ organizationId: 1, branchId: 1, status: 1, expenseDate: 1 })
expenseSchema.index({ organizationId: 1, vehicleId: 1, expenseDate: 1 })
expenseSchema.index({ organizationId: 1, categoryCode: 1, expenseDate: 1 })

const workOrderSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    documentNumber: { type: String, trim: true, maxlength: 32 },
    vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },
    vehiclePlate: { type: String, required: true, trim: true, maxlength: 20 },
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor' },
    vendorName: { type: String, trim: true, maxlength: 200 },
    lpoId: { type: Schema.Types.ObjectId, ref: 'Lpo' },
    serviceType: { type: String, required: true, enum: Object.values(SERVICE_TYPES) },
    priority: { type: String, required: true, enum: Object.values(SERVICE_PRIORITIES) },
    status: { type: String, required: true, enum: Object.values(WORK_ORDER_STATUSES) },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    issue: { type: String, trim: true, maxlength: 2000 },
    requestedAt: { type: Date },
    scheduledAt: { type: Date },
    startedAt: { type: Date },
    completedAt: { type: Date },
    downtimeStartsAt: { type: Date },
    downtimeEndsAt: { type: Date },
    assignmentId: { type: Schema.Types.ObjectId, ref: 'VehicleAssignment' },
    estimatedCost: { ...money, default: '0.00' },
    actualCost: { type: String, trim: true, maxlength: 20 },
    currency: { type: String, required: true, trim: true, uppercase: true, maxlength: 3 },
    notes: { type: String, trim: true, maxlength: 2000 },
    assignedUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
  },
  { timestamps: true, collection: 'work_orders' },
)
workOrderSchema.index(
  { organizationId: 1, documentNumber: 1 },
  { unique: true, partialFilterExpression: { documentNumber: { $type: 'string' } } },
)
workOrderSchema.index({ organizationId: 1, vehicleId: 1, status: 1, scheduledAt: 1 })
workOrderSchema.index({ organizationId: 1, vendorId: 1, status: 1 })
workOrderSchema.index({ organizationId: 1, branchId: 1, status: 1 })

const workOrderLineSchema = new Schema(
  {
    workOrderId: { type: Schema.Types.ObjectId, ref: 'WorkOrder', required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    kind: { type: String, required: true, enum: ['PART', 'LABOR', 'OTHER'] },
    description: { type: String, required: true, trim: true, maxlength: 500 },
    quantity: { type: Number, required: true, min: 0 },
    unitPrice: money,
    lineTotal: money,
    sortOrder: { type: Number, required: true, min: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'work_order_lines' },
)
workOrderLineSchema.index({ workOrderId: 1, sortOrder: 1 })

const serviceReminderSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },
    vehiclePlate: { type: String, required: true, trim: true, maxlength: 20 },
    serviceType: { type: String, required: true, enum: Object.values(SERVICE_TYPES) },
    basis: { type: String, required: true, enum: Object.values(REMINDER_BASES) },
    dueAt: { type: Date },
    dueMileage: { type: Number, min: 0 },
    intervalDays: { type: Number, min: 1 },
    intervalKm: { type: Number, min: 1 },
    status: { type: String, required: true, enum: Object.values(REMINDER_STATUSES) },
    notes: { type: String, trim: true, maxlength: 500 },
    completedAt: { type: Date },
    workOrderId: { type: Schema.Types.ObjectId, ref: 'WorkOrder' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, collection: 'service_reminders' },
)
serviceReminderSchema.index({ organizationId: 1, vehicleId: 1, status: 1, dueAt: 1 })
serviceReminderSchema.index({ organizationId: 1, status: 1, dueAt: 1 })

const borrowCostTermSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },
    currency: { type: String, required: true, trim: true, uppercase: true, maxlength: 3 },
    rateType: { type: String, required: true, enum: Object.values(BORROW_RATE_TYPES) },
    unitAmount: money,
    effectiveFrom: { type: Date, required: true },
    effectiveTo: { type: Date },
    notes: { type: String, trim: true, maxlength: 500 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'borrow_cost_terms' },
)
borrowCostTermSchema.index({ organizationId: 1, vehicleId: 1, effectiveFrom: 1 })

const apPaymentSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    paymentNumber: { type: String, trim: true, maxlength: 32 },
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
    vendorName: { type: String, required: true, trim: true, maxlength: 200 },
    currency: { type: String, required: true, trim: true, uppercase: true, maxlength: 3 },
    amount: money,
    allocatedAmount: { ...money, default: '0.00' },
    unallocatedAmount: money,
    method: { type: String, required: true, trim: true, maxlength: 32 },
    paymentDate: { type: Date, required: true },
    status: { type: String, required: true, enum: ['PENDING', 'COMPLETED', 'CANCELLED'], default: 'PENDING' },
    notes: { type: String, trim: true, maxlength: 2000 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    completedAt: { type: Date },
  },
  { timestamps: true, collection: 'ap_payments' },
)
apPaymentSchema.index(
  { organizationId: 1, paymentNumber: 1 },
  { unique: true, partialFilterExpression: { paymentNumber: { $type: 'string' } } },
)
apPaymentSchema.index({ organizationId: 1, vendorId: 1, paymentDate: 1 })

const apAllocationSchema = new Schema(
  {
    apPaymentId: { type: Schema.Types.ObjectId, ref: 'ApPayment', required: true },
    vendorBillId: { type: Schema.Types.ObjectId, ref: 'VendorBill', required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    amount: money,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'ap_payment_allocations' },
)
apAllocationSchema.index({ apPaymentId: 1, vendorBillId: 1 }, { unique: true })
apAllocationSchema.index({ vendorBillId: 1, createdAt: 1 })

const procurementCounterSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    name: { type: String, required: true, trim: true, maxlength: 32 },
    seq: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: true, collection: 'procurement_counters' },
)
procurementCounterSchema.index({ organizationId: 1, name: 1 }, { unique: true })

const procurementStatusEventSchema = new Schema(
  {
    entityType: { type: String, required: true, maxlength: 40 },
    entityId: { type: Schema.Types.ObjectId, required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
    fromStatus: { type: String, maxlength: 40 },
    toStatus: { type: String, required: true, maxlength: 40 },
    reason: { type: String, trim: true, maxlength: 500 },
    actorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'procurement_status_events' },
)
procurementStatusEventSchema.index({ entityType: 1, entityId: 1, createdAt: 1 })

const accountingSourceEventSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    eventType: { type: String, required: true, trim: true, maxlength: 64 },
    entityType: { type: String, required: true, trim: true, maxlength: 40 },
    entityId: { type: Schema.Types.ObjectId, required: true },
    idempotencyKey: { type: String, required: true, trim: true, maxlength: 128 },
    payload: { type: Schema.Types.Mixed, required: true },
    processedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'accounting_source_events' },
)
accountingSourceEventSchema.index({ organizationId: 1, idempotencyKey: 1 }, { unique: true })
accountingSourceEventSchema.index({ organizationId: 1, eventType: 1, createdAt: 1 })

export const Vendor = model('Vendor', vendorSchema)
export const VendorContact = model('VendorContact', vendorContactSchema)
export const VendorDocument = model('VendorDocument', vendorDocumentSchema)
export const Lpo = model('Lpo', lpoSchema)
export const LpoLine = model('LpoLine', lpoLineSchema)
export const VendorBill = model('VendorBill', vendorBillSchema)
export const VendorBillLine = model('VendorBillLine', vendorBillLineSchema)
export const ExpenseCategory = model('ExpenseCategory', expenseCategorySchema)
export const Expense = model('Expense', expenseSchema)
export const WorkOrder = model('WorkOrder', workOrderSchema)
export const WorkOrderLine = model('WorkOrderLine', workOrderLineSchema)
export const ServiceReminder = model('ServiceReminder', serviceReminderSchema)
export const BorrowCostTerm = model('BorrowCostTerm', borrowCostTermSchema)
export const ApPayment = model('ApPayment', apPaymentSchema)
export const ApPaymentAllocation = model('ApPaymentAllocation', apAllocationSchema)
export const ProcurementCounter = model('ProcurementCounter', procurementCounterSchema)
export const ProcurementStatusEvent = model('ProcurementStatusEvent', procurementStatusEventSchema)
export const AccountingSourceEvent = model('AccountingSourceEvent', accountingSourceEventSchema)
