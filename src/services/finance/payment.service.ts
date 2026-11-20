import {
  DEFAULT_CURRENCY,
  DOC_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  type PaymentMethod,
  type PaymentStatus,
} from '../../constants/finance.js'
import { PERMISSIONS } from '../../constants/permissions.js'
import { toPublicEnum } from '../../constants/vehicles.js'
import { findCustomerById } from '../../repositories/customers/customer.repository.js'
import {
  allocateDocumentNumber,
  applyInvoicePaidDelta,
  attachIdempotencyPayment,
  claimIdempotencyKey,
  claimWebhookEvent,
  findReceiptByPaymentId,
  hashFinanceRequest,
  insertAllocation,
  insertPayment,
  insertReceipt,
  listAllocationsByPayment,
  listFinanceStatusEvents,
  listPayments,
  recordFinanceStatusEvent,
  transitionPayment,
  updatePaymentAllocationTotals,
  type PaymentRecord,
} from '../../repositories/finance/finance.repository.js'
import { emitAccountingSourceEvent } from '../../repositories/procurement/procurement.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import { addMoney, compareMoney, normalizeMoney, subtractMoney } from '../../utils/money.js'
import { conflict, invalidField, notFound } from '../../utils/httpErrors.js'
import { resolvePagination, toPaginated } from '../../utils/pagination.js'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, recordAuditEvent } from '../audit/audit.service.js'
import { assertPermission, hasBranchAccess } from '../authorization/authorization.service.js'
import { canAccessCustomer } from '../customers/customer-access.js'
import {
  isOrganizationWide,
  loadAccessibleInvoice,
  loadAccessiblePayment,
  resolveFinanceOrganization,
} from './finance-access.js'
import { canTransitionPayment, decidePaymentIdempotency } from './finance-rules.js'
import { toPaymentDetail, toPaymentResource, toReceiptResource } from './finance.mapper.js'

type CreatePaymentBody = {
  organizationId?: string
  customerId: string
  currency?: string
  amount: string
  method: string
  paymentDate: Date
  externalReference?: string
  provider?: string
  notes?: string
  idempotencyKey?: string
  allocations?: Array<{ invoiceId: string; amount: string }>
}

type ListQuery = {
  organizationId?: string
  search?: string
  status?: string
  method?: string
  branchId?: string
  customerId?: string
  legalEntityId?: string
  invoiceId?: string
  paymentFrom?: Date
  paymentTo?: Date
  sort?: string
  order?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  limit?: number
}

type WebhookBody = {
  organizationId?: string
  provider: string
  externalEventId: string
  externalReference: string
  status: string
  amount?: string
  signature?: string
}

function upperMethod(value: string): PaymentMethod {
  return value.toUpperCase() as PaymentMethod
}

function upperPaymentStatus(value?: string): PaymentStatus | undefined {
  if (!value) return undefined
  return value.toUpperCase() as PaymentStatus
}

async function audit(
  action: (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS],
  payment: PaymentRecord,
  actorUserId: string | undefined,
  meta: RequestMeta | undefined,
  metadata: Record<string, unknown>,
) {
  await recordAuditEvent({
    action,
    entityType: AUDIT_ENTITY_TYPES.PAYMENT,
    entityId: payment.id,
    actorUserId,
    organizationId: payment.organizationId,
    branchId: payment.branchId,
    metadata,
    meta,
  })
}

async function detail(payment: PaymentRecord) {
  const [allocations, receipt, history] = await Promise.all([
    listAllocationsByPayment(payment.id),
    findReceiptByPaymentId(payment.id),
    listFinanceStatusEvents('payment', payment.id),
  ])
  return toPaymentDetail(
    payment,
    allocations as Array<Record<string, unknown>>,
    receipt,
    history as Array<Record<string, unknown>>,
  )
}

export async function listPaymentDirectory(ctx: AccessContext, query: ListQuery) {
  assertPermission(ctx, PERMISSIONS.PAYMENT_VIEW)
  const organizationId = resolveFinanceOrganization(ctx, query.organizationId)
  if (query.branchId && !hasBranchAccess(ctx, query.branchId, organizationId)) {
    throw notFound('Branch was not found.')
  }
  const orgWide = isOrganizationWide(ctx)
  const pagination = resolvePagination(query)
  const page = await listPayments({
    organizationId,
    branchIds: orgWide ? undefined : [...ctx.branchIds],
    legalEntityIds: !orgWide && ctx.legalEntityIds.length > 0 ? [...ctx.legalEntityIds] : undefined,
    skip: pagination.skip,
    take: pagination.take,
    search: query.search,
    status: upperPaymentStatus(query.status),
    method: query.method ? upperMethod(query.method) : undefined,
    branchId: query.branchId,
    customerId: query.customerId,
    legalEntityId: query.legalEntityId,
    invoiceId: query.invoiceId,
    paymentFrom: query.paymentFrom,
    paymentTo: query.paymentTo,
    sort: (query.sort as 'createdAt') ?? 'createdAt',
    order: query.order ?? 'desc',
  })
  return toPaginated(page.items.map(toPaymentResource), pagination.page, pagination.limit, page.total)
}

export async function getPayment(ctx: AccessContext, id: string) {
  assertPermission(ctx, PERMISSIONS.PAYMENT_VIEW)
  return detail(await loadAccessiblePayment(ctx, id))
}

async function allocateToInvoices(
  ctx: AccessContext,
  payment: PaymentRecord,
  allocations: Array<{ invoiceId: string; amount: string }>,
  meta: RequestMeta,
) {
  let runningAllocated = payment.allocatedAmount
  let runningUnallocated = payment.unallocatedAmount
  for (const item of allocations) {
    const amount = normalizeMoney(item.amount)
    if (compareMoney(amount, '0.00') <= 0) throw invalidField('allocations', 'Allocation amount must be positive.')
    if (compareMoney(amount, runningUnallocated) > 0) {
      throw invalidField('allocations', 'Allocated amount cannot exceed the unallocated payment balance.')
    }
    const invoice = await loadAccessibleInvoice(ctx, item.invoiceId)
    if (invoice.status !== DOC_STATUSES.POSTED) {
      throw invalidField('allocations', 'Payments can only be allocated to posted invoices.')
    }
    if (invoice.customerId !== payment.customerId) {
      throw invalidField('allocations', 'Invoice customer must match the payment customer.')
    }
    if (invoice.currency !== payment.currency) {
      throw invalidField('allocations', 'Invoice currency must match the payment currency.')
    }
    if (compareMoney(amount, invoice.outstandingAmount) > 0) {
      throw invalidField('allocations', 'Allocated amount cannot exceed invoice outstanding.')
    }
    await insertAllocation({
      paymentId: payment.id,
      invoiceId: invoice.id,
      organizationId: payment.organizationId,
      amount,
      createdBy: ctx.userId,
    })
    const newPaid = addMoney(invoice.paidAmount, amount)
    const newOutstanding = subtractMoney(invoice.outstandingAmount, amount)
    const updatedInvoice = await applyInvoicePaidDelta(invoice.id, amount, newOutstanding, newPaid)
    if (!updatedInvoice) throw conflict('Invoice balance could not be updated.')
    runningAllocated = addMoney(runningAllocated, amount)
    runningUnallocated = subtractMoney(runningUnallocated, amount)
  }
  const updatedPayment = await updatePaymentAllocationTotals(payment.id, runningAllocated, runningUnallocated)
  if (!updatedPayment) throw conflict('Payment allocation totals could not be updated.')
  await audit(AUDIT_ACTIONS.PAYMENT_ALLOCATE, updatedPayment, ctx.userId, meta, {
    allocations: allocations.length,
  })
  return updatedPayment
}

export async function createPayment(ctx: AccessContext, body: CreatePaymentBody, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.PAYMENT_CREATE)
  const organizationId = resolveFinanceOrganization(ctx, body.organizationId)
  const amount = normalizeMoney(body.amount)
  if (compareMoney(amount, '0.00') <= 0) throw invalidField('amount', 'Payment amount must be positive.')
  const method = upperMethod(body.method)
  if (!Object.values(PAYMENT_METHODS).includes(method)) {
    throw invalidField('method', 'Unsupported payment method.')
  }
  const requestHash = hashFinanceRequest({
    customerId: body.customerId,
    amount,
    method,
    paymentDate: body.paymentDate.toISOString(),
    externalReference: body.externalReference ?? null,
    allocations: body.allocations ?? [],
  })
  if (body.idempotencyKey) {
    const claim = await claimIdempotencyKey(organizationId, body.idempotencyKey, requestHash)
    if (claim.kind === 'existing') {
      const decision = decidePaymentIdempotency(
        { requestHash: claim.requestHash, paymentId: claim.paymentId },
        requestHash,
      )
      if (decision === 'mismatch') throw conflict('Idempotency key was reused with a different payload.')
      if (decision === 'busy') throw conflict('A payment with this idempotency key is still being processed.')
      if (decision === 'replay' && claim.paymentId) {
        return detail(await loadAccessiblePayment(ctx, claim.paymentId))
      }
    }
  }
  const customer = await findCustomerById(body.customerId)
  if (!customer || customer.organizationId !== organizationId || !canAccessCustomer(ctx, customer)) {
    throw notFound('Customer was not found.')
  }
  const payment = await insertPayment({
    organizationId,
    legalEntityId: customer.legalEntityId,
    branchId: customer.branchId,
    customerId: customer.id,
    customerDisplayName: customer.displayName,
    currency: (body.currency ?? DEFAULT_CURRENCY).toUpperCase(),
    amount,
    allocatedAmount: '0.00',
    unallocatedAmount: amount,
    method,
    paymentDate: body.paymentDate,
    status: PAYMENT_STATUSES.PENDING,
    externalReference: body.externalReference,
    provider: body.provider,
    notes: body.notes,
    createdBy: ctx.userId,
  })
  if (body.idempotencyKey) {
    await attachIdempotencyPayment(organizationId, body.idempotencyKey, payment.id)
  }
  await recordFinanceStatusEvent({
    entityType: 'payment',
    entityId: payment.id,
    organizationId,
    branchId: payment.branchId,
    toStatus: PAYMENT_STATUSES.PENDING,
    reason: 'created',
    actorUserId: ctx.userId,
  })
  await audit(AUDIT_ACTIONS.PAYMENT_CREATE, payment, ctx.userId, meta, { amount, method })
  let current = payment
  if (body.allocations?.length) {
    current = await allocateToInvoices(ctx, payment, body.allocations, meta)
  }
  return detail(current)
}

export async function completePayment(ctx: AccessContext, id: string, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.PAYMENT_COMPLETE)
  const existing = await loadAccessiblePayment(ctx, id)
  if (!canTransitionPayment(existing.status, PAYMENT_STATUSES.COMPLETED)) {
    throw invalidField('status', `A payment cannot move from ${toPublicEnum(existing.status)} to completed`)
  }
  const paymentNumber = existing.paymentNumber ?? (await allocateDocumentNumber(existing.organizationId, 'payment'))
  const completed = await transitionPayment(existing.id, existing.status, PAYMENT_STATUSES.COMPLETED, {
    paymentNumber,
    completedAt: new Date(),
  })
  if (!completed) throw conflict('Payment could not be completed.')
  await recordFinanceStatusEvent({
    entityType: 'payment',
    entityId: completed.id,
    organizationId: completed.organizationId,
    branchId: completed.branchId,
    fromStatus: existing.status,
    toStatus: PAYMENT_STATUSES.COMPLETED,
    reason: 'completed',
    actorUserId: ctx.userId,
  })
  const existingReceipt = await findReceiptByPaymentId(completed.id)
  if (!existingReceipt) {
    const receiptNumber = await allocateDocumentNumber(completed.organizationId, 'receipt')
    await insertReceipt({
      organizationId: completed.organizationId,
      legalEntityId: completed.legalEntityId,
      branchId: completed.branchId,
      receiptNumber,
      paymentId: completed.id,
      customerId: completed.customerId,
      customerDisplayName: completed.customerDisplayName,
      currency: completed.currency,
      amount: completed.amount,
      method: completed.method,
      issuedAt: new Date(),
      status: DOC_STATUSES.POSTED,
      createdBy: ctx.userId,
    })
    await audit(AUDIT_ACTIONS.RECEIPT_ISSUE, completed, ctx.userId, meta, { receiptNumber })
  }
  await audit(AUDIT_ACTIONS.PAYMENT_COMPLETE, completed, ctx.userId, meta, { paymentNumber })
  await emitAccountingSourceEvent({
    organizationId: completed.organizationId,
    eventType: 'payment.completed',
    entityType: 'payment',
    entityId: completed.id,
    idempotencyKey: `payment.completed:${completed.id}`,
    payload: {
      paymentId: completed.id,
      paymentNumber: completed.paymentNumber,
      legalEntityId: completed.legalEntityId,
      branchId: completed.branchId,
      customerId: completed.customerId,
      amount: completed.amount,
      currency: completed.currency,
      accountingDate: completed.completedAt?.toISOString?.() ?? new Date().toISOString(),
    },
  })
  return detail(completed)
}

export async function failPayment(ctx: AccessContext, id: string, reason: string, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.PAYMENT_COMPLETE)
  const existing = await loadAccessiblePayment(ctx, id)
  if (!canTransitionPayment(existing.status, PAYMENT_STATUSES.FAILED)) {
    throw invalidField('status', `A payment cannot move from ${toPublicEnum(existing.status)} to failed`)
  }
  const failed = await transitionPayment(existing.id, existing.status, PAYMENT_STATUSES.FAILED, {})
  if (!failed) throw conflict('Payment could not be marked failed.')
  await recordFinanceStatusEvent({
    entityType: 'payment',
    entityId: failed.id,
    organizationId: failed.organizationId,
    branchId: failed.branchId,
    fromStatus: existing.status,
    toStatus: PAYMENT_STATUSES.FAILED,
    reason,
    actorUserId: ctx.userId,
  })
  await audit(AUDIT_ACTIONS.PAYMENT_FAIL, failed, ctx.userId, meta, { reason })
  return detail(failed)
}

export async function cancelPayment(ctx: AccessContext, id: string, reason: string, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.PAYMENT_COMPLETE)
  const existing = await loadAccessiblePayment(ctx, id)
  if (!canTransitionPayment(existing.status, PAYMENT_STATUSES.CANCELLED)) {
    throw invalidField('status', `A payment cannot move from ${toPublicEnum(existing.status)} to cancelled`)
  }
  if (compareMoney(existing.allocatedAmount, '0.00') > 0) {
    throw conflict('Allocated payments cannot be cancelled. Reverse them instead.')
  }
  const cancelled = await transitionPayment(existing.id, existing.status, PAYMENT_STATUSES.CANCELLED, {})
  if (!cancelled) throw conflict('Payment could not be cancelled.')
  await recordFinanceStatusEvent({
    entityType: 'payment',
    entityId: cancelled.id,
    organizationId: cancelled.organizationId,
    branchId: cancelled.branchId,
    fromStatus: existing.status,
    toStatus: PAYMENT_STATUSES.CANCELLED,
    reason,
    actorUserId: ctx.userId,
  })
  await audit(AUDIT_ACTIONS.PAYMENT_CANCEL, cancelled, ctx.userId, meta, { reason })
  return detail(cancelled)
}

export async function reversePayment(ctx: AccessContext, id: string, reason: string, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.PAYMENT_REVERSE)
  const existing = await loadAccessiblePayment(ctx, id)
  if (!canTransitionPayment(existing.status, PAYMENT_STATUSES.REVERSED)) {
    throw invalidField('status', `A payment cannot move from ${toPublicEnum(existing.status)} to reversed`)
  }
  const allocations = await listAllocationsByPayment(existing.id)
  for (const row of allocations) {
    const invoice = await loadAccessibleInvoice(ctx, String(row.invoiceId))
    const amount = normalizeMoney(String(row.amount))
    const newPaid = subtractMoney(invoice.paidAmount, amount)
    const newOutstanding = addMoney(invoice.outstandingAmount, amount)
    const updated = await applyInvoicePaidDelta(invoice.id, amount, newOutstanding, newPaid)
    if (!updated) throw conflict('Invoice balance could not be reversed.')
  }
  const reversed = await transitionPayment(existing.id, existing.status, PAYMENT_STATUSES.REVERSED, {
    reversedAt: new Date(),
  })
  if (!reversed) throw conflict('Payment could not be reversed.')
  await updatePaymentAllocationTotals(reversed.id, '0.00', reversed.amount)
  await recordFinanceStatusEvent({
    entityType: 'payment',
    entityId: reversed.id,
    organizationId: reversed.organizationId,
    branchId: reversed.branchId,
    fromStatus: existing.status,
    toStatus: PAYMENT_STATUSES.REVERSED,
    reason,
    actorUserId: ctx.userId,
  })
  await audit(AUDIT_ACTIONS.PAYMENT_REVERSE, reversed, ctx.userId, meta, { reason })
  return detail(reversed)
}

export async function allocatePayment(
  ctx: AccessContext,
  id: string,
  allocations: Array<{ invoiceId: string; amount: string }>,
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.PAYMENT_COMPLETE)
  const payment = await loadAccessiblePayment(ctx, id)
  if (payment.status !== PAYMENT_STATUSES.COMPLETED && payment.status !== PAYMENT_STATUSES.PENDING) {
    throw conflict('Only pending or completed payments can receive allocations.')
  }
  const updated = await allocateToInvoices(ctx, payment, allocations, meta)
  return detail(updated)
}

export async function issueReceipt(ctx: AccessContext, paymentId: string, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.RECEIPT_ISSUE)
  const payment = await loadAccessiblePayment(ctx, paymentId)
  if (payment.status !== PAYMENT_STATUSES.COMPLETED) {
    throw conflict('Receipts can only be issued for completed payments.')
  }
  const existing = await findReceiptByPaymentId(payment.id)
  if (existing) return toReceiptResource(existing)
  const receiptNumber = await allocateDocumentNumber(payment.organizationId, 'receipt')
  const receipt = await insertReceipt({
    organizationId: payment.organizationId,
    legalEntityId: payment.legalEntityId,
    branchId: payment.branchId,
    receiptNumber,
    paymentId: payment.id,
    customerId: payment.customerId,
    customerDisplayName: payment.customerDisplayName,
    currency: payment.currency,
    amount: payment.amount,
    method: payment.method,
    issuedAt: new Date(),
    status: DOC_STATUSES.POSTED,
    createdBy: ctx.userId,
  })
  await audit(AUDIT_ACTIONS.RECEIPT_ISSUE, payment, ctx.userId, meta, { receiptNumber })
  return toReceiptResource(receipt)
}

/**
 * Provider-agnostic webhook foundation. Verifies an optional shared signature header pattern,
 * claims the external event id once, and completes/fails the matching payment by external reference.
 */
export async function processPaymentWebhook(ctx: AccessContext, body: WebhookBody, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.PAYMENT_COMPLETE)
  const organizationId = resolveFinanceOrganization(ctx, body.organizationId)
  const payloadHash = hashFinanceRequest({
    provider: body.provider,
    externalEventId: body.externalEventId,
    externalReference: body.externalReference,
    status: body.status,
    amount: body.amount ?? null,
  })
  const claim = await claimWebhookEvent({
    organizationId,
    provider: body.provider,
    externalEventId: body.externalEventId,
    payloadHash,
  })
  if (claim.duplicate) {
    await recordAuditEvent({
      action: AUDIT_ACTIONS.PAYMENT_WEBHOOK_DUPLICATE,
      entityType: AUDIT_ENTITY_TYPES.PAYMENT,
      actorUserId: ctx.userId,
      organizationId,
      metadata: { provider: body.provider, externalEventId: body.externalEventId },
      meta,
    })
    return { duplicate: true }
  }
  const page = await listPayments({
    organizationId,
    skip: 0,
    take: 1,
    search: body.externalReference,
    sort: 'createdAt',
    order: 'desc',
  })
  const payment = page.items.find((row) => row.externalReference === body.externalReference)
  if (!payment || !payment.id) throw notFound('Payment was not found for webhook reference.')
  const status = body.status.toUpperCase()
  if (status === 'COMPLETED' || status === 'SUCCESS') {
    return { duplicate: false, payment: await completePayment(ctx, payment.id, meta) }
  }
  if (status === 'FAILED') {
    return { duplicate: false, payment: await failPayment(ctx, payment.id, 'provider webhook', meta) }
  }
  return { duplicate: false, payment: await detail(payment) }
}
