import { DEFAULT_CURRENCY } from '../../constants/procurement.js'
import { PERMISSIONS } from '../../constants/permissions.js'
import {
  allocateProcurementNumber,
  emitAccountingSourceEvent,
  findApPaymentById,
  insertApAllocation,
  insertApPayment,
  updateApPaymentTotals,
  updateVendorBillPaid,
} from '../../repositories/procurement/procurement.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import { addMoney, compareMoney, normalizeMoney, subtractMoney } from '../../utils/money.js'
import { conflict, invalidField, notFound } from '../../utils/httpErrors.js'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, recordAuditEvent } from '../audit/audit.service.js'
import { assertPermission } from '../authorization/authorization.service.js'
import { loadAccessibleVendorBill, resolveProcurementOrganization } from './procurement-access.js'
import { billPaymentStatus } from './procurement-rules.js'
import { requireActiveVendor } from './vendor.service.js'

type CreateApPaymentBody = {
  organizationId?: string
  vendorId: string
  amount: string
  currency?: string
  paymentDate: Date
  method?: string
  notes?: string
  allocations?: Array<{ vendorBillId: string; amount: string }>
}

export async function createApPayment(ctx: AccessContext, body: CreateApPaymentBody, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.AP_PAYMENT_CREATE)
  const vendor = await requireActiveVendor(ctx, body.vendorId)
  const amount = normalizeMoney(body.amount)
  if (compareMoney(amount, '0.00') <= 0) throw invalidField('amount', 'Amount must be greater than zero.')
  const documentNumber = await allocateProcurementNumber(vendor.organizationId, 'ap_payment')
  const payment = await insertApPayment({
    organizationId: vendor.organizationId,
    legalEntityId: vendor.legalEntityId,
    branchId: vendor.branchId,
    documentNumber,
    vendorId: vendor.id,
    vendorName: vendor.name,
    currency: (body.currency ?? DEFAULT_CURRENCY).toUpperCase(),
    amount,
    allocatedAmount: '0.00',
    unallocatedAmount: amount,
    status: 'COMPLETED',
    method: (body.method ?? 'BANK_TRANSFER').toUpperCase(),
    paymentDate: body.paymentDate,
    notes: body.notes,
    createdBy: ctx.userId,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.AP_PAYMENT_CREATE,
    entityType: AUDIT_ENTITY_TYPES.AP_PAYMENT,
    entityId: String(payment!._id),
    actorUserId: ctx.userId,
    organizationId: vendor.organizationId,
    branchId: vendor.branchId,
    metadata: { documentNumber, amount },
    meta,
  })

  if (body.allocations?.length) {
    return allocateApPayment(
      ctx,
      String(payment!._id),
      { allocations: body.allocations },
      meta,
    )
  }

  return {
    id: String(payment!._id),
    documentNumber,
    vendorId: vendor.id,
    vendorName: vendor.name,
    amount,
    allocatedAmount: '0.00',
    unallocatedAmount: amount,
    status: 'completed',
    currency: (body.currency ?? DEFAULT_CURRENCY).toUpperCase(),
    paymentDate: body.paymentDate.toISOString(),
  }
}

export async function allocateApPayment(
  ctx: AccessContext,
  paymentId: string,
  body: { allocations: Array<{ vendorBillId: string; amount: string }> },
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.AP_PAYMENT_ALLOCATE)
  const payment = await findApPaymentById(paymentId)
  if (!payment) throw notFound('AP payment was not found.')
  resolveProcurementOrganization(ctx, String(payment.organizationId))

  let allocated = normalizeMoney(String(payment.allocatedAmount ?? '0.00'))
  let unallocated = normalizeMoney(String(payment.unallocatedAmount ?? payment.amount))

  for (const allocation of body.allocations) {
    const amount = normalizeMoney(allocation.amount)
    if (compareMoney(amount, unallocated) > 0) {
      throw conflict('Allocation exceeds unallocated AP payment amount.')
    }
    const bill = await loadAccessibleVendorBill(ctx, allocation.vendorBillId)
    if (bill.vendorId !== String(payment.vendorId)) {
      throw conflict('Vendor bill vendor does not match the AP payment vendor.')
    }
    if (!['APPROVED', 'POSTED'].includes(bill.status)) {
      throw conflict('Only approved or posted vendor bills can receive AP allocations.')
    }
    if (compareMoney(amount, bill.outstandingAmount) > 0) {
      throw conflict('Allocation exceeds vendor bill outstanding amount.')
    }

    await insertApAllocation({
      apPaymentId: paymentId,
      vendorBillId: bill.id,
      organizationId: String(payment.organizationId),
      amount,
      createdBy: ctx.userId,
    })

    const paidAmount = addMoney(bill.paidAmount, amount)
    const outstandingAmount = subtractMoney(bill.totalAmount, paidAmount)
    const paymentStatus = billPaymentStatus(bill.totalAmount, paidAmount)
    await updateVendorBillPaid(bill.id, paidAmount, outstandingAmount, paymentStatus)

    allocated = addMoney(allocated, amount)
    unallocated = subtractMoney(unallocated, amount)
  }

  const status = compareMoney(unallocated, '0.00') === 0 ? 'ALLOCATED' : 'PARTIAL'
  await updateApPaymentTotals(paymentId, allocated, unallocated, status)
  await emitAccountingSourceEvent({
    organizationId: String(payment.organizationId),
    eventType: 'ap_payment.allocated',
    entityType: 'ap_payment',
    entityId: paymentId,
    idempotencyKey: `ap_payment.allocated:${paymentId}:${allocated}`,
    payload: { apPaymentId: paymentId, allocatedAmount: allocated, unallocatedAmount: unallocated },
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.AP_PAYMENT_ALLOCATE,
    entityType: AUDIT_ENTITY_TYPES.AP_PAYMENT,
    entityId: paymentId,
    actorUserId: ctx.userId,
    organizationId: String(payment.organizationId),
    branchId: String(payment.branchId),
    metadata: { allocatedAmount: allocated, unallocatedAmount: unallocated },
    meta,
  })

  return {
    id: paymentId,
    documentNumber: payment.documentNumber ? String(payment.documentNumber) : undefined,
    allocatedAmount: allocated,
    unallocatedAmount: unallocated,
    status: status.toLowerCase(),
  }
}
