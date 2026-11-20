import { toPublicEnum } from '../../constants/vehicles.js'
import { billPaymentStatus } from './procurement-rules.js'
import type {
  ExpenseRecord,
  LpoRecord,
  VendorBillRecord,
  VendorRecord,
  WorkOrderRecord,
} from '../../repositories/procurement/procurement.repository.js'

function iso(value?: Date) {
  return value ? value.toISOString() : undefined
}
function idOf(value: unknown) {
  return value && typeof value === 'object' && 'toString' in value ? String(value) : String(value ?? '')
}

export function toVendorResource(vendor: VendorRecord) {
  return {
    id: vendor.id,
    vendorCode: vendor.vendorCode,
    name: vendor.name,
    organizationId: vendor.organizationId,
    legalEntityId: vendor.legalEntityId,
    branchId: vendor.branchId,
    vendorType: toPublicEnum(vendor.vendorType),
    partyKind: toPublicEnum(vendor.partyKind),
    status: toPublicEnum(vendor.status),
    phone: vendor.phone,
    email: vendor.email,
    addressLine1: vendor.addressLine1,
    city: vendor.city,
    country: vendor.country,
    taxRegistration: vendor.taxRegistration,
    paymentTerms: toPublicEnum(vendor.paymentTerms),
    customPaymentDays: vendor.customPaymentDays,
    notes: vendor.notes,
    createdAt: vendor.createdAt.toISOString(),
    updatedAt: vendor.updatedAt.toISOString(),
  }
}

export function toLpoResource(lpo: LpoRecord) {
  return {
    id: lpo.id,
    documentNumber: lpo.documentNumber,
    organizationId: lpo.organizationId,
    legalEntityId: lpo.legalEntityId,
    branchId: lpo.branchId,
    vendorId: lpo.vendorId,
    vendorName: lpo.vendorName,
    orderDate: lpo.orderDate.toISOString(),
    expectedAt: iso(lpo.expectedAt),
    currency: lpo.currency,
    paymentTerms: toPublicEnum(lpo.paymentTerms),
    status: toPublicEnum(lpo.status),
    subtotal: lpo.subtotal,
    discountTotal: lpo.discountTotal,
    taxableAmount: lpo.taxableAmount,
    taxAmount: lpo.taxAmount,
    totalAmount: lpo.totalAmount,
    approvalLevel: lpo.approvalLevel ? toPublicEnum(lpo.approvalLevel) : undefined,
    notes: lpo.notes,
    workOrderId: lpo.workOrderId,
    approvedAt: iso(lpo.approvedAt),
    createdAt: lpo.createdAt.toISOString(),
    updatedAt: lpo.updatedAt.toISOString(),
  }
}

export function toLpoDetail(lpo: LpoRecord, lines: Array<Record<string, unknown>>, history: Array<Record<string, unknown>>) {
  return {
    ...toLpoResource(lpo),
    lines: lines.map((row) => ({
      id: idOf(row._id),
      description: String(row.description),
      quantity: Number(row.quantity),
      unitPrice: String(row.unitPrice),
      discountAmount: String(row.discountAmount),
      taxRatePercent: String(row.taxRatePercent),
      lineSubtotal: String(row.lineSubtotal),
      taxableAmount: String(row.taxableAmount),
      taxAmount: String(row.taxAmount),
      lineTotal: String(row.lineTotal),
      billedQuantity: Number(row.billedQuantity ?? 0),
      vehicleId: row.vehicleId ? idOf(row.vehicleId) : undefined,
      sortOrder: Number(row.sortOrder),
    })),
    history: history.map((row) => ({
      id: idOf(row._id),
      fromStatus: row.fromStatus ? toPublicEnum(String(row.fromStatus)) : undefined,
      toStatus: toPublicEnum(String(row.toStatus)),
      reason: row.reason ? String(row.reason) : undefined,
      createdAt: iso(row.createdAt as Date),
    })),
  }
}

export function toVendorBillResource(bill: VendorBillRecord) {
  return {
    id: bill.id,
    documentNumber: bill.documentNumber,
    organizationId: bill.organizationId,
    legalEntityId: bill.legalEntityId,
    branchId: bill.branchId,
    vendorId: bill.vendorId,
    vendorName: bill.vendorName,
    vendorInvoiceNumber: bill.vendorInvoiceNumber,
    lpoId: bill.lpoId,
    workOrderId: bill.workOrderId,
    currency: bill.currency,
    billDate: bill.billDate.toISOString(),
    dueDate: bill.dueDate.toISOString(),
    status: toPublicEnum(bill.status),
    matchResult: bill.matchResult ? toPublicEnum(bill.matchResult) : undefined,
    subtotal: bill.subtotal,
    discountTotal: bill.discountTotal,
    taxableAmount: bill.taxableAmount,
    taxAmount: bill.taxAmount,
    totalAmount: bill.totalAmount,
    paidAmount: bill.paidAmount,
    outstandingAmount: bill.outstandingAmount,
    paymentStatus: toPublicEnum(billPaymentStatus(bill.totalAmount, bill.paidAmount)),
    notes: bill.notes,
    postedAt: iso(bill.postedAt),
    createdAt: bill.createdAt.toISOString(),
    updatedAt: bill.updatedAt.toISOString(),
  }
}

export function toVendorBillDetail(
  bill: VendorBillRecord,
  lines: Array<Record<string, unknown>>,
  history: Array<Record<string, unknown>>,
) {
  return {
    ...toVendorBillResource(bill),
    lines: lines.map((row) => ({
      id: idOf(row._id),
      description: String(row.description),
      quantity: Number(row.quantity),
      unitPrice: String(row.unitPrice),
      discountAmount: String(row.discountAmount),
      taxRatePercent: String(row.taxRatePercent),
      lineSubtotal: String(row.lineSubtotal),
      taxableAmount: String(row.taxableAmount),
      taxAmount: String(row.taxAmount),
      lineTotal: String(row.lineTotal),
      lpoLineId: row.lpoLineId ? idOf(row.lpoLineId) : undefined,
      sortOrder: Number(row.sortOrder),
    })),
    history: history.map((row) => ({
      id: idOf(row._id),
      fromStatus: row.fromStatus ? toPublicEnum(String(row.fromStatus)) : undefined,
      toStatus: toPublicEnum(String(row.toStatus)),
      reason: row.reason ? String(row.reason) : undefined,
      createdAt: iso(row.createdAt as Date),
    })),
  }
}

export function toExpenseResource(expense: ExpenseRecord) {
  return {
    id: expense.id,
    documentNumber: expense.documentNumber,
    organizationId: expense.organizationId,
    legalEntityId: expense.legalEntityId,
    branchId: expense.branchId,
    categoryCode: expense.categoryCode,
    vendorId: expense.vendorId,
    vendorName: expense.vendorName,
    vehicleId: expense.vehicleId,
    vehiclePlate: expense.vehiclePlate,
    contractId: expense.contractId,
    currency: expense.currency,
    expenseDate: expense.expenseDate.toISOString(),
    description: expense.description,
    status: toPublicEnum(expense.status),
    amount: expense.amount,
    taxRatePercent: expense.taxRatePercent,
    taxAmount: expense.taxAmount,
    totalAmount: expense.totalAmount,
    notes: expense.notes,
    postedAt: iso(expense.postedAt),
    createdAt: expense.createdAt.toISOString(),
    updatedAt: expense.updatedAt.toISOString(),
  }
}

export function toWorkOrderResource(order: WorkOrderRecord) {
  return {
    id: order.id,
    documentNumber: order.documentNumber,
    organizationId: order.organizationId,
    legalEntityId: order.legalEntityId,
    branchId: order.branchId,
    vehicleId: order.vehicleId,
    vehiclePlate: order.vehiclePlate,
    vendorId: order.vendorId,
    vendorName: order.vendorName,
    lpoId: order.lpoId,
    serviceType: toPublicEnum(order.serviceType),
    priority: toPublicEnum(order.priority),
    status: toPublicEnum(order.status),
    description: order.description,
    issue: order.issue,
    requestedAt: iso(order.requestedAt),
    scheduledAt: iso(order.scheduledAt),
    startedAt: iso(order.startedAt),
    completedAt: iso(order.completedAt),
    downtimeStartsAt: iso(order.downtimeStartsAt),
    downtimeEndsAt: iso(order.downtimeEndsAt),
    estimatedCost: order.estimatedCost,
    actualCost: order.actualCost,
    currency: order.currency,
    notes: order.notes,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  }
}

export function toWorkOrderDetail(
  order: WorkOrderRecord,
  lines: Array<Record<string, unknown>>,
  history: Array<Record<string, unknown>>,
) {
  return {
    ...toWorkOrderResource(order),
    lines: lines.map((row) => ({
      id: idOf(row._id),
      kind: toPublicEnum(String(row.kind)),
      description: String(row.description),
      quantity: Number(row.quantity),
      unitPrice: String(row.unitPrice),
      lineTotal: String(row.lineTotal),
      sortOrder: Number(row.sortOrder),
    })),
    history: history.map((row) => ({
      id: idOf(row._id),
      fromStatus: row.fromStatus ? toPublicEnum(String(row.fromStatus)) : undefined,
      toStatus: toPublicEnum(String(row.toStatus)),
      reason: row.reason ? String(row.reason) : undefined,
      createdAt: iso(row.createdAt as Date),
    })),
  }
}

export function toReminderResource(row: Record<string, unknown>) {
  return {
    id: idOf(row._id),
    organizationId: idOf(row.organizationId),
    legalEntityId: idOf(row.legalEntityId),
    branchId: idOf(row.branchId),
    vehicleId: idOf(row.vehicleId),
    vehiclePlate: String(row.vehiclePlate),
    serviceType: toPublicEnum(String(row.serviceType)),
    basis: toPublicEnum(String(row.basis)),
    dueAt: iso(row.dueAt as Date | undefined),
    dueMileage: row.dueMileage != null ? Number(row.dueMileage) : undefined,
    intervalDays: row.intervalDays != null ? Number(row.intervalDays) : undefined,
    intervalKm: row.intervalKm != null ? Number(row.intervalKm) : undefined,
    status: toPublicEnum(String(row.status)),
    notes: row.notes ? String(row.notes) : undefined,
    completedAt: iso(row.completedAt as Date | undefined),
    workOrderId: row.workOrderId ? idOf(row.workOrderId) : undefined,
    createdAt: iso(row.createdAt as Date),
  }
}
