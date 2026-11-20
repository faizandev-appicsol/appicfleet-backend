import {
  DEFAULT_CURRENCY,
  DEPOSIT_EVENT_KINDS,
  DEPOSIT_STATUSES,
  DOC_STATUSES,
  type DepositStatus,
} from '../../constants/finance.js'
import { PERMISSIONS } from '../../constants/permissions.js'
import { toPublicEnum } from '../../constants/vehicles.js'
import { findCustomerById } from '../../repositories/customers/customer.repository.js'
import { findContractById } from '../../repositories/contracts/contract.repository.js'
import {
  allocateDocumentNumber,
  applyInvoicePaidDelta,
  insertDeposit,
  insertDepositEvent,
  listDepositEvents,
  listDeposits,
  updateDepositAmounts,
  type DepositRecord,
} from '../../repositories/finance/finance.repository.js'
import { emitAccountingSourceEvent } from '../../repositories/procurement/procurement.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import { addMoney, compareMoney, normalizeMoney, subtractMoney } from '../../utils/money.js'
import { conflict, invalidField, notFound } from '../../utils/httpErrors.js'
import { resolvePagination, toPaginated } from '../../utils/pagination.js'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, recordAuditEvent } from '../audit/audit.service.js'
import { assertPermission, hasBranchAccess } from '../authorization/authorization.service.js'
import { canAccessContract } from '../contracts/contract-access.js'
import { canAccessCustomer } from '../customers/customer-access.js'
import {
  isOrganizationWide,
  loadAccessibleDeposit,
  loadAccessibleInvoice,
  resolveFinanceOrganization,
} from './finance-access.js'
import { canApplyDeposit, canReleaseDeposit } from './finance-rules.js'
import { toDepositDetail, toDepositResource } from './finance.mapper.js'

type CreateDepositBody = {
  organizationId?: string
  customerId: string
  contractId: string
  currency?: string
  amount: string
  paymentId?: string
  heldAt?: Date
  notes?: string
}

type ListQuery = {
  organizationId?: string
  search?: string
  status?: string
  branchId?: string
  customerId?: string
  contractId?: string
  legalEntityId?: string
  heldFrom?: Date
  heldTo?: Date
  sort?: string
  order?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  limit?: number
}

function depositStatusAfter(remaining: string, applied: string, released: string): DepositStatus {
  if (compareMoney(remaining, '0.00') === 0) {
    return compareMoney(released, '0.00') > 0 && compareMoney(applied, '0.00') === 0
      ? DEPOSIT_STATUSES.RELEASED
      : compareMoney(applied, '0.00') > 0 && compareMoney(released, '0.00') === 0
        ? DEPOSIT_STATUSES.APPLIED
        : DEPOSIT_STATUSES.RELEASED
  }
  if (compareMoney(applied, '0.00') > 0 || compareMoney(released, '0.00') > 0) {
    return DEPOSIT_STATUSES.PARTIALLY_APPLIED
  }
  return DEPOSIT_STATUSES.HELD
}

async function detail(deposit: DepositRecord) {
  const events = await listDepositEvents(deposit.id)
  return toDepositDetail(deposit, events as Array<Record<string, unknown>>)
}

export async function listDepositDirectory(ctx: AccessContext, query: ListQuery) {
  assertPermission(ctx, PERMISSIONS.DEPOSIT_VIEW)
  const organizationId = resolveFinanceOrganization(ctx, query.organizationId)
  if (query.branchId && !hasBranchAccess(ctx, query.branchId, organizationId)) {
    throw notFound('Branch was not found.')
  }
  const orgWide = isOrganizationWide(ctx)
  const pagination = resolvePagination(query)
  const page = await listDeposits({
    organizationId,
    branchIds: orgWide ? undefined : [...ctx.branchIds],
    legalEntityIds: !orgWide && ctx.legalEntityIds.length > 0 ? [...ctx.legalEntityIds] : undefined,
    skip: pagination.skip,
    take: pagination.take,
    search: query.search,
    status: query.status?.toUpperCase() as DepositStatus | undefined,
    branchId: query.branchId,
    customerId: query.customerId,
    contractId: query.contractId,
    legalEntityId: query.legalEntityId,
    heldFrom: query.heldFrom,
    heldTo: query.heldTo,
    sort: (query.sort as 'createdAt') ?? 'createdAt',
    order: query.order ?? 'desc',
  })
  return toPaginated(page.items.map(toDepositResource), pagination.page, pagination.limit, page.total)
}

export async function getDeposit(ctx: AccessContext, id: string) {
  assertPermission(ctx, PERMISSIONS.DEPOSIT_VIEW)
  return detail(await loadAccessibleDeposit(ctx, id))
}

export async function createDeposit(ctx: AccessContext, body: CreateDepositBody, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.DEPOSIT_CREATE)
  const organizationId = resolveFinanceOrganization(ctx, body.organizationId)
  const amount = normalizeMoney(body.amount)
  if (compareMoney(amount, '0.00') <= 0) throw invalidField('amount', 'Deposit amount must be positive.')
  const customer = await findCustomerById(body.customerId)
  if (!customer || customer.organizationId !== organizationId || !canAccessCustomer(ctx, customer)) {
    throw notFound('Customer was not found.')
  }
  const contract = await findContractById(body.contractId)
  if (!contract || contract.organizationId !== organizationId || !canAccessContract(ctx, contract)) {
    throw notFound('Contract was not found.')
  }
  if (contract.customerId !== customer.id) {
    throw invalidField('contractId', 'Contract does not belong to the selected customer.')
  }
  const depositNumber = await allocateDocumentNumber(organizationId, 'deposit')
  const deposit = await insertDeposit({
    organizationId,
    legalEntityId: customer.legalEntityId,
    branchId: customer.branchId,
    depositNumber,
    customerId: customer.id,
    customerDisplayName: customer.displayName,
    contractId: contract.id,
    currency: (body.currency ?? contract.currency ?? DEFAULT_CURRENCY).toUpperCase(),
    amount,
    appliedAmount: '0.00',
    releasedAmount: '0.00',
    remainingAmount: amount,
    status: DEPOSIT_STATUSES.HELD,
    paymentId: body.paymentId,
    heldAt: body.heldAt ?? new Date(),
    notes: body.notes,
    createdBy: ctx.userId,
  })
  await insertDepositEvent({
    depositId: deposit.id,
    organizationId,
    kind: DEPOSIT_EVENT_KINDS.CREATED,
    amount,
    actorUserId: ctx.userId,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.DEPOSIT_CREATE,
    entityType: AUDIT_ENTITY_TYPES.DEPOSIT,
    entityId: deposit.id,
    actorUserId: ctx.userId,
    organizationId,
    branchId: deposit.branchId,
    metadata: { depositNumber, amount },
    meta,
  })
  await emitAccountingSourceEvent({
    organizationId,
    eventType: 'deposit.created',
    entityType: 'deposit',
    entityId: deposit.id,
    idempotencyKey: `deposit.created:${deposit.id}`,
    payload: {
      depositId: deposit.id,
      legalEntityId: deposit.legalEntityId,
      branchId: deposit.branchId,
      customerId: deposit.customerId,
      contractId: deposit.contractId,
      amount,
      currency: deposit.currency,
      accountingDate: deposit.heldAt.toISOString(),
    },
  })
  return detail(deposit)
}

export async function applyDeposit(
  ctx: AccessContext,
  id: string,
  body: { amount: string; invoiceId: string; reason?: string },
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.DEPOSIT_APPLY)
  const deposit = await loadAccessibleDeposit(ctx, id)
  if (deposit.status === DEPOSIT_STATUSES.RELEASED || deposit.status === DEPOSIT_STATUSES.APPLIED) {
    throw conflict('Deposit has no remaining balance to apply.')
  }
  const amount = normalizeMoney(body.amount)
  if (!canApplyDeposit(deposit.remainingAmount, amount)) {
    throw invalidField('amount', 'Apply amount must be positive and not exceed remaining deposit.')
  }
  const invoice = await loadAccessibleInvoice(ctx, body.invoiceId)
  if (invoice.status !== DOC_STATUSES.POSTED) {
    throw invalidField('invoiceId', 'Deposit can only be applied to a posted invoice.')
  }
  if (invoice.customerId !== deposit.customerId) {
    throw invalidField('invoiceId', 'Invoice customer must match the deposit customer.')
  }
  if (invoice.currency !== deposit.currency) {
    throw invalidField('invoiceId', 'Invoice currency must match the deposit currency.')
  }
  if (compareMoney(amount, invoice.outstandingAmount) > 0) {
    throw invalidField('amount', 'Apply amount cannot exceed invoice outstanding.')
  }
  const appliedAmount = addMoney(deposit.appliedAmount, amount)
  const remainingAmount = subtractMoney(deposit.remainingAmount, amount)
  const status = depositStatusAfter(remainingAmount, appliedAmount, deposit.releasedAmount)
  const updated = await updateDepositAmounts(deposit.id, deposit.remainingAmount, {
    appliedAmount,
    releasedAmount: deposit.releasedAmount,
    remainingAmount,
    status,
  })
  if (!updated) throw conflict('Deposit was modified concurrently. Retry the application.')
  const newPaid = addMoney(invoice.paidAmount, amount)
  const newOutstanding = subtractMoney(invoice.outstandingAmount, amount)
  const invoiceUpdated = await applyInvoicePaidDelta(invoice.id, amount, newOutstanding, newPaid)
  if (!invoiceUpdated) throw conflict('Invoice balance could not be updated from deposit.')
  await insertDepositEvent({
    depositId: deposit.id,
    organizationId: deposit.organizationId,
    kind: DEPOSIT_EVENT_KINDS.APPLIED,
    amount,
    invoiceId: invoice.id,
    reason: body.reason,
    actorUserId: ctx.userId,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.DEPOSIT_APPLY,
    entityType: AUDIT_ENTITY_TYPES.DEPOSIT,
    entityId: deposit.id,
    actorUserId: ctx.userId,
    organizationId: deposit.organizationId,
    branchId: deposit.branchId,
    metadata: { amount, invoiceId: invoice.id, status: toPublicEnum(status) },
    meta,
  })
  return detail(updated)
}

export async function releaseDeposit(
  ctx: AccessContext,
  id: string,
  body: { amount: string; reason?: string },
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.DEPOSIT_RELEASE)
  const deposit = await loadAccessibleDeposit(ctx, id)
  if (deposit.status === DEPOSIT_STATUSES.RELEASED || deposit.status === DEPOSIT_STATUSES.APPLIED) {
    throw conflict('Deposit has no remaining balance to release.')
  }
  const amount = normalizeMoney(body.amount)
  if (!canReleaseDeposit(deposit.remainingAmount, amount)) {
    throw invalidField('amount', 'Release amount must be positive and not exceed remaining deposit.')
  }
  const releasedAmount = addMoney(deposit.releasedAmount, amount)
  const remainingAmount = subtractMoney(deposit.remainingAmount, amount)
  const status = depositStatusAfter(remainingAmount, deposit.appliedAmount, releasedAmount)
  const updated = await updateDepositAmounts(deposit.id, deposit.remainingAmount, {
    appliedAmount: deposit.appliedAmount,
    releasedAmount,
    remainingAmount,
    status,
    releasedAt: compareMoney(remainingAmount, '0.00') === 0 ? new Date() : undefined,
  })
  if (!updated) throw conflict('Deposit was modified concurrently. Retry the release.')
  await insertDepositEvent({
    depositId: deposit.id,
    organizationId: deposit.organizationId,
    kind: DEPOSIT_EVENT_KINDS.RELEASED,
    amount,
    reason: body.reason,
    actorUserId: ctx.userId,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.DEPOSIT_RELEASE,
    entityType: AUDIT_ENTITY_TYPES.DEPOSIT,
    entityId: deposit.id,
    actorUserId: ctx.userId,
    organizationId: deposit.organizationId,
    branchId: deposit.branchId,
    metadata: { amount, status: toPublicEnum(status) },
    meta,
  })
  return detail(updated)
}
