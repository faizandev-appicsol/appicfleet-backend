import {
  DEFAULT_CURRENCY,
  REFUND_SOURCES,
  REFUND_STATUSES,
  type RefundStatus,
} from '../../constants/charges.js'
import { PERMISSIONS } from '../../constants/permissions.js'
import { toPublicEnum } from '../../constants/vehicles.js'
import {
  allocateChargeNumber,
  findRefundByIdempotency,
  insertRefund,
  listChargeStatusEvents,
  listRefunds,
  recordChargeStatusEvent,
  transitionRefund,
  type RefundRecord,
} from '../../repositories/charges/charges.repository.js'
import { findCustomerById } from '../../repositories/customers/customer.repository.js'
import { emitAccountingSourceEvent } from '../../repositories/procurement/procurement.repository.js'
import { findDepositById } from '../../repositories/finance/finance.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import { compareMoney, normalizeMoney } from '../../utils/money.js'
import { conflict, invalidField, notFound } from '../../utils/httpErrors.js'
import { resolvePagination, toPaginated } from '../../utils/pagination.js'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, recordAuditEvent } from '../audit/audit.service.js'
import { assertPermission, hasBranchAccess } from '../authorization/authorization.service.js'
import { canAccessChargeRecord, isOrganizationWide, loadAccessibleRefund, resolveChargeOrganization } from './charges-access.js'
import { canTransitionRefund } from './charges-rules.js'
import { toRefundResource } from './charges.mapper.js'

type CreateRefundBody = {
  organizationId?: string
  legalEntityId: string
  branchId: string
  customerId: string
  contractId?: string
  sourceKind: string
  depositId?: string
  paymentId?: string
  amount: string
  currency?: string
  reason: string
  notes?: string
  evidenceKey?: string
  idempotencyKey: string
}

async function detail(refund: RefundRecord) {
  const history = await listChargeStatusEvents('refund', refund.id)
  return {
    ...toRefundResource(refund),
    history: history.map((row) => ({
      id: String((row as { _id: { toString(): string } })._id),
      fromStatus: (row as { fromStatus?: string }).fromStatus
        ? toPublicEnum(String((row as { fromStatus?: string }).fromStatus))
        : undefined,
      toStatus: toPublicEnum(String((row as { toStatus: string }).toStatus)),
      reason: (row as { reason?: string }).reason ? String((row as { reason?: string }).reason) : undefined,
      createdAt: (row as { createdAt: Date }).createdAt?.toISOString?.(),
    })),
  }
}

export async function listRefundDirectory(ctx: AccessContext, query: Record<string, unknown>) {
  assertPermission(ctx, PERMISSIONS.REFUND_VIEW)
  const organizationId = resolveChargeOrganization(ctx, query.organizationId as string | undefined)
  if (query.branchId && !hasBranchAccess(ctx, String(query.branchId), organizationId)) {
    throw notFound('Branch was not found.')
  }
  const orgWide = isOrganizationWide(ctx)
  const pagination = resolvePagination(query)
  const page = await listRefunds({
    organizationId,
    branchIds: orgWide ? undefined : [...ctx.branchIds],
    skip: pagination.skip,
    take: pagination.take,
    search: query.search as string | undefined,
    status: query.status ? (String(query.status).toUpperCase() as RefundStatus) : undefined,
    customerId: query.customerId as string | undefined,
    branchId: query.branchId as string | undefined,
    sort: (query.sort as 'createdAt') ?? 'createdAt',
    order: (query.order as 'asc' | 'desc') ?? 'desc',
  })
  return toPaginated(page.items.map(toRefundResource), pagination.page, pagination.limit, page.total)
}

export async function getRefund(ctx: AccessContext, id: string) {
  assertPermission(ctx, PERMISSIONS.REFUND_VIEW)
  return detail(await loadAccessibleRefund(ctx, id))
}

export async function createRefund(ctx: AccessContext, body: CreateRefundBody, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.REFUND_CREATE)
  const organizationId = resolveChargeOrganization(ctx, body.organizationId)
  if (!hasBranchAccess(ctx, body.branchId, organizationId)) throw notFound('Branch was not found.')

  const existing = await findRefundByIdempotency(organizationId, body.idempotencyKey)
  if (existing) return detail(existing)

  const sourceKind = body.sourceKind.toUpperCase()
  if (!(Object.values(REFUND_SOURCES) as string[]).includes(sourceKind)) {
    throw invalidField('sourceKind', 'Unsupported refund source.')
  }
  const amount = normalizeMoney(body.amount)
  if (compareMoney(amount, '0.00') <= 0) throw invalidField('amount', 'Amount must be greater than zero.')

  const customer = await findCustomerById(body.customerId)
  if (!customer || customer.organizationId !== organizationId) throw notFound('Customer was not found.')

  if (sourceKind === REFUND_SOURCES.DEPOSIT) {
    if (!body.depositId) throw invalidField('depositId', 'depositId is required for deposit refunds.')
    const deposit = await findDepositById(body.depositId)
    if (!deposit || deposit.organizationId !== organizationId) throw notFound('Deposit was not found.')
    if (deposit.customerId !== body.customerId) {
      throw invalidField('depositId', 'Deposit customer must match refund customer.')
    }
    if (compareMoney(amount, deposit.remainingAmount) > 0) {
      throw invalidField('amount', 'Refund amount exceeds refundable deposit balance.')
    }
  }

  if (sourceKind === REFUND_SOURCES.PAYMENT && !body.paymentId) {
    throw invalidField('paymentId', 'paymentId is required for payment refunds.')
  }

  const documentNumber = await allocateChargeNumber(organizationId, 'refund')
  const refund = await insertRefund({
    organizationId,
    legalEntityId: body.legalEntityId,
    branchId: body.branchId,
    documentNumber,
    customerId: body.customerId,
    customerName: customer.displayName,
    contractId: body.contractId,
    sourceKind,
    depositId: body.depositId,
    paymentId: body.paymentId,
    currency: (body.currency ?? DEFAULT_CURRENCY).toUpperCase(),
    amount,
    reason: body.reason.trim(),
    notes: body.notes,
    status: REFUND_STATUSES.DRAFT,
    evidenceKey: body.evidenceKey,
    idempotencyKey: body.idempotencyKey,
    requestedBy: ctx.userId,
    createdBy: ctx.userId,
  })
  await recordChargeStatusEvent({
    entityType: 'refund',
    entityId: refund.id,
    organizationId,
    branchId: body.branchId,
    toStatus: REFUND_STATUSES.DRAFT,
    reason: 'created',
    actorUserId: ctx.userId,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.REFUND_CREATE,
    entityType: AUDIT_ENTITY_TYPES.REFUND,
    entityId: refund.id,
    actorUserId: ctx.userId,
    organizationId,
    branchId: body.branchId,
    metadata: { amount, sourceKind },
    meta,
  })
  return detail(refund)
}

export async function requestRefund(ctx: AccessContext, id: string, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.REFUND_CREATE)
  const existing = await loadAccessibleRefund(ctx, id)
  if (!canTransitionRefund(existing.status, REFUND_STATUSES.REQUESTED)) {
    throw invalidField('status', `Refund cannot move from ${toPublicEnum(existing.status)} to requested`)
  }
  const requested = await transitionRefund(existing.id, REFUND_STATUSES.DRAFT, REFUND_STATUSES.REQUESTED, {
    requestedAt: new Date(),
    requestedBy: ctx.userId,
  })
  if (!requested) throw conflict('Refund could not be requested.')
  await recordChargeStatusEvent({
    entityType: 'refund',
    entityId: requested.id,
    organizationId: requested.organizationId,
    branchId: requested.branchId,
    fromStatus: REFUND_STATUSES.DRAFT,
    toStatus: REFUND_STATUSES.REQUESTED,
    reason: 'requested',
    actorUserId: ctx.userId,
  })
  await emitAccountingSourceEvent({
    organizationId: requested.organizationId,
    eventType: 'refund.requested',
    entityType: 'refund',
    entityId: requested.id,
    idempotencyKey: `refund.requested:${requested.id}`,
    payload: { refundId: requested.id, amount: requested.amount },
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.REFUND_REQUEST,
    entityType: AUDIT_ENTITY_TYPES.REFUND,
    entityId: requested.id,
    actorUserId: ctx.userId,
    organizationId: requested.organizationId,
    branchId: requested.branchId,
    metadata: {},
    meta,
  })
  return detail(requested)
}

export async function approveRefund(ctx: AccessContext, id: string, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.REFUND_APPROVE)
  const existing = await loadAccessibleRefund(ctx, id)
  const from =
    existing.status === REFUND_STATUSES.REQUESTED
      ? REFUND_STATUSES.REQUESTED
      : existing.status === REFUND_STATUSES.UNDER_REVIEW
        ? REFUND_STATUSES.UNDER_REVIEW
        : null
  if (!from || !canTransitionRefund(from, REFUND_STATUSES.APPROVED)) {
    throw invalidField('status', `Refund cannot be approved from ${toPublicEnum(existing.status)}`)
  }
  if (existing.createdBy === ctx.userId || existing.requestedBy === ctx.userId) {
    throw conflict('Requester cannot approve their own refund.')
  }
  if (existing.status === REFUND_STATUSES.REQUESTED) {
    await transitionRefund(existing.id, REFUND_STATUSES.REQUESTED, REFUND_STATUSES.UNDER_REVIEW, {})
  }
  const approved = await transitionRefund(
    existing.id,
    existing.status === REFUND_STATUSES.REQUESTED ? REFUND_STATUSES.UNDER_REVIEW : existing.status,
    REFUND_STATUSES.APPROVED,
    { approvedBy: ctx.userId, approvedAt: new Date() },
  )
  if (!approved) {
    const retry = await transitionRefund(existing.id, REFUND_STATUSES.UNDER_REVIEW, REFUND_STATUSES.APPROVED, {
      approvedBy: ctx.userId,
      approvedAt: new Date(),
    })
    if (!retry) throw conflict('Refund could not be approved.')
    return finishApprove(ctx, retry, meta)
  }
  return finishApprove(ctx, approved, meta)
}

async function finishApprove(ctx: AccessContext, approved: RefundRecord, meta: RequestMeta) {
  await recordChargeStatusEvent({
    entityType: 'refund',
    entityId: approved.id,
    organizationId: approved.organizationId,
    branchId: approved.branchId,
    toStatus: REFUND_STATUSES.APPROVED,
    reason: 'approved',
    actorUserId: ctx.userId,
  })
  await emitAccountingSourceEvent({
    organizationId: approved.organizationId,
    eventType: 'refund.approved',
    entityType: 'refund',
    entityId: approved.id,
    idempotencyKey: `refund.approved:${approved.id}`,
    payload: { refundId: approved.id, amount: approved.amount },
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.REFUND_APPROVE,
    entityType: AUDIT_ENTITY_TYPES.REFUND,
    entityId: approved.id,
    actorUserId: ctx.userId,
    organizationId: approved.organizationId,
    branchId: approved.branchId,
    metadata: {},
    meta,
  })
  return detail(approved)
}

export async function rejectRefund(ctx: AccessContext, id: string, reason: string, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.REFUND_REJECT)
  const existing = await loadAccessibleRefund(ctx, id)
  if (!canTransitionRefund(existing.status, REFUND_STATUSES.REJECTED) && existing.status !== REFUND_STATUSES.REQUESTED) {
    throw invalidField('status', `Refund cannot be rejected from ${toPublicEnum(existing.status)}`)
  }
  const from = existing.status === REFUND_STATUSES.REQUESTED ? REFUND_STATUSES.REQUESTED : REFUND_STATUSES.UNDER_REVIEW
  if (existing.status === REFUND_STATUSES.REQUESTED) {
    await transitionRefund(existing.id, REFUND_STATUSES.REQUESTED, REFUND_STATUSES.UNDER_REVIEW, {})
  }
  const rejected = await transitionRefund(existing.id, from === REFUND_STATUSES.REQUESTED ? REFUND_STATUSES.UNDER_REVIEW : from, REFUND_STATUSES.REJECTED, {
    rejectedBy: ctx.userId,
    rejectedAt: new Date(),
    rejectionReason: reason,
  })
  if (!rejected) throw conflict('Refund could not be rejected.')
  await recordAuditEvent({
    action: AUDIT_ACTIONS.REFUND_REJECT,
    entityType: AUDIT_ENTITY_TYPES.REFUND,
    entityId: rejected.id,
    actorUserId: ctx.userId,
    organizationId: rejected.organizationId,
    branchId: rejected.branchId,
    metadata: { reason },
    meta,
  })
  return detail(rejected)
}

export async function executeRefund(ctx: AccessContext, id: string, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.REFUND_EXECUTE)
  const existing = await loadAccessibleRefund(ctx, id)
  if (existing.status === REFUND_STATUSES.COMPLETED) return detail(existing)
  if (!canTransitionRefund(existing.status, REFUND_STATUSES.PROCESSING) && existing.status !== REFUND_STATUSES.FAILED) {
    throw invalidField('status', `Refund cannot be executed from ${toPublicEnum(existing.status)}`)
  }

  if (existing.sourceKind === REFUND_SOURCES.DEPOSIT && existing.depositId) {
    const deposit = await findDepositById(existing.depositId)
    if (!deposit || !canAccessChargeRecord(ctx, {
      organizationId: deposit.organizationId,
      branchId: deposit.branchId,
      legalEntityId: deposit.legalEntityId,
    })) {
      throw notFound('Deposit was not found.')
    }
    if (compareMoney(existing.amount, deposit.remainingAmount) > 0) {
      const failed = await transitionRefund(existing.id, existing.status, REFUND_STATUSES.FAILED, {
        failedReason: 'Refund exceeds remaining deposit balance.',
      })
      await emitAccountingSourceEvent({
        organizationId: existing.organizationId,
        eventType: 'refund.failed',
        entityType: 'refund',
        entityId: existing.id,
        idempotencyKey: `refund.failed:${existing.id}:${Date.now()}`,
        payload: { refundId: existing.id, reason: 'insufficient_balance' },
      })
      if (!failed) throw conflict('Refund execution failed.')
      return detail(failed)
    }
  }

  const processing = await transitionRefund(
    existing.id,
    existing.status === REFUND_STATUSES.FAILED ? REFUND_STATUSES.FAILED : REFUND_STATUSES.APPROVED,
    REFUND_STATUSES.PROCESSING,
    {},
  )
  if (!processing) throw conflict('Refund could not start processing.')

  // Execution records completion against Module 8 deposit/payment systems without a second gateway.
  // For deposit refunds, remaining balance is reduced via deposit release API by the operator;
  // this module records the refund lifecycle and emits accounting source events.
  const completed = await transitionRefund(processing.id, REFUND_STATUSES.PROCESSING, REFUND_STATUSES.COMPLETED, {
    executedBy: ctx.userId,
    executedAt: new Date(),
    externalReference: `LOCAL-${processing.documentNumber ?? processing.id}`,
  })
  if (!completed) throw conflict('Refund could not be completed.')

  await recordChargeStatusEvent({
    entityType: 'refund',
    entityId: completed.id,
    organizationId: completed.organizationId,
    branchId: completed.branchId,
    fromStatus: REFUND_STATUSES.PROCESSING,
    toStatus: REFUND_STATUSES.COMPLETED,
    reason: 'executed',
    actorUserId: ctx.userId,
  })
  await emitAccountingSourceEvent({
    organizationId: completed.organizationId,
    eventType: 'refund.executed',
    entityType: 'refund',
    entityId: completed.id,
    idempotencyKey: `refund.executed:${completed.id}`,
    payload: {
      refundId: completed.id,
      amount: completed.amount,
      currency: completed.currency,
      depositId: completed.depositId,
      externalReference: completed.externalReference,
    },
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.REFUND_EXECUTE,
    entityType: AUDIT_ENTITY_TYPES.REFUND,
    entityId: completed.id,
    actorUserId: ctx.userId,
    organizationId: completed.organizationId,
    branchId: completed.branchId,
    metadata: { externalReference: completed.externalReference },
    meta,
  })
  return detail(completed)
}
