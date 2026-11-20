import {
  DEFAULT_CURRENCY,
  DEFAULT_TAX_RATE,
  EXPENSE_STATUSES,
  type ExpenseStatus,
} from '../../constants/procurement.js'
import { PERMISSIONS } from '../../constants/permissions.js'
import { toPublicEnum } from '../../constants/vehicles.js'
import {
  allocateProcurementNumber,
  emitAccountingSourceEvent,
  ensureDefaultExpenseCategories,
  insertExpense,
  listExpenseCategories,
  listExpenses,
  listStatusEvents,
  recordStatusEvent,
  transitionExpense,
  updateExpenseDraft,
  type ExpenseRecord,
} from '../../repositories/procurement/procurement.repository.js'
import { findVehicleById } from '../../repositories/vehicles/vehicle.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import { addMoney, normalizeMoney, percentOfMoney } from '../../utils/money.js'
import { conflict, invalidField, notFound } from '../../utils/httpErrors.js'
import { resolvePagination, toPaginated } from '../../utils/pagination.js'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, recordAuditEvent } from '../audit/audit.service.js'
import { assertPermission, hasBranchAccess } from '../authorization/authorization.service.js'
import { canAccessProcurementRecord, isOrganizationWide, loadAccessibleExpense, resolveProcurementOrganization } from './procurement-access.js'
import { assertExpenseMutable, canTransitionExpense } from './procurement-rules.js'
import { toExpenseResource } from './procurement.mapper.js'
import { requireActiveVendor } from './vendor.service.js'

type CreateExpenseBody = {
  organizationId?: string
  legalEntityId: string
  branchId: string
  categoryCode: string
  vendorId?: string
  vehicleId?: string
  contractId?: string
  employeeUserId?: string
  currency?: string
  expenseDate: Date
  description: string
  amount: string
  taxRatePercent?: string
  notes?: string
  attachmentKey?: string
}

function calcExpense(amount: string, taxRatePercent: string) {
  const normalizedAmount = normalizeMoney(amount)
  const rate = normalizeMoney(taxRatePercent)
  const taxAmount = percentOfMoney(normalizedAmount, rate)
  return {
    amount: normalizedAmount,
    taxRatePercent: rate,
    taxAmount,
    totalAmount: addMoney(normalizedAmount, taxAmount),
  }
}

async function detail(expense: ExpenseRecord) {
  const history = await listStatusEvents('expense', expense.id)
  return {
    ...toExpenseResource(expense),
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

export async function listExpenseCategoryDirectory(ctx: AccessContext, organizationId?: string) {
  assertPermission(ctx, PERMISSIONS.EXPENSE_VIEW)
  const orgId = resolveProcurementOrganization(ctx, organizationId)
  await ensureDefaultExpenseCategories(orgId)
  const rows = await listExpenseCategories(orgId)
  return rows.map((row) => ({
    id: String((row as { _id: { toString(): string } })._id),
    code: String((row as { code: string }).code),
    name: String((row as { name: string }).name),
  }))
}

export async function listExpenseDirectory(ctx: AccessContext, query: Record<string, unknown>) {
  assertPermission(ctx, PERMISSIONS.EXPENSE_VIEW)
  const organizationId = resolveProcurementOrganization(ctx, query.organizationId as string | undefined)
  if (query.branchId && !hasBranchAccess(ctx, String(query.branchId), organizationId)) {
    throw notFound('Branch was not found.')
  }
  const orgWide = isOrganizationWide(ctx)
  const pagination = resolvePagination(query)
  const page = await listExpenses({
    organizationId,
    branchIds: orgWide ? undefined : [...ctx.branchIds],
    legalEntityIds: !orgWide && ctx.legalEntityIds.length > 0 ? [...ctx.legalEntityIds] : undefined,
    skip: pagination.skip,
    take: pagination.take,
    search: query.search as string | undefined,
    status: query.status ? (String(query.status).toUpperCase() as ExpenseStatus) : undefined,
    categoryCode: query.categoryCode ? String(query.categoryCode).toUpperCase() : undefined,
    vendorId: query.vendorId as string | undefined,
    vehicleId: query.vehicleId as string | undefined,
    contractId: query.contractId as string | undefined,
    branchId: query.branchId as string | undefined,
    expenseFrom: query.expenseFrom as Date | undefined,
    expenseTo: query.expenseTo as Date | undefined,
    sort: (query.sort as 'createdAt') ?? 'createdAt',
    order: (query.order as 'asc' | 'desc') ?? 'desc',
  })
  return toPaginated(page.items.map(toExpenseResource), pagination.page, pagination.limit, page.total)
}

export async function getExpense(ctx: AccessContext, id: string) {
  assertPermission(ctx, PERMISSIONS.EXPENSE_VIEW)
  return detail(await loadAccessibleExpense(ctx, id))
}

export async function createExpenseDraft(ctx: AccessContext, body: CreateExpenseBody, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.EXPENSE_CREATE)
  const organizationId = resolveProcurementOrganization(ctx, body.organizationId)
  if (!hasBranchAccess(ctx, body.branchId, organizationId)) throw notFound('Branch was not found.')
  await ensureDefaultExpenseCategories(organizationId)
  const categories = await listExpenseCategories(organizationId)
  const categoryCode = body.categoryCode.toUpperCase()
  if (!categories.some((row) => String((row as { code: string }).code) === categoryCode)) {
    throw invalidField('categoryCode', 'Expense category is not configured for this organization.')
  }

  let vendorId: string | undefined
  let vendorName: string | undefined
  if (body.vendorId) {
    const vendor = await requireActiveVendor(ctx, body.vendorId)
    vendorId = vendor.id
    vendorName = vendor.name
  }

  let vehicleId: string | undefined
  let vehiclePlate: string | undefined
  if (body.vehicleId) {
    const vehicle = await findVehicleById(body.vehicleId)
    if (!vehicle || !canAccessProcurementRecord(ctx, vehicle)) throw notFound('Vehicle was not found.')
    vehicleId = vehicle.id
    vehiclePlate = vehicle.plateNumber
  }

  const money = calcExpense(body.amount, body.taxRatePercent ?? DEFAULT_TAX_RATE)
  const expense = await insertExpense({
    organizationId,
    legalEntityId: body.legalEntityId,
    branchId: body.branchId,
    categoryCode,
    vendorId,
    vendorName,
    vehicleId,
    vehiclePlate,
    contractId: body.contractId,
    employeeUserId: body.employeeUserId,
    currency: (body.currency ?? DEFAULT_CURRENCY).toUpperCase(),
    expenseDate: body.expenseDate,
    description: body.description.trim(),
    status: EXPENSE_STATUSES.DRAFT,
    ...money,
    notes: body.notes,
    attachmentKey: body.attachmentKey,
    createdBy: ctx.userId,
  })
  await recordStatusEvent({
    entityType: 'expense',
    entityId: expense.id,
    organizationId: expense.organizationId,
    branchId: expense.branchId,
    toStatus: EXPENSE_STATUSES.DRAFT,
    reason: 'created',
    actorUserId: ctx.userId,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.EXPENSE_CREATE,
    entityType: AUDIT_ENTITY_TYPES.EXPENSE,
    entityId: expense.id,
    actorUserId: ctx.userId,
    organizationId: expense.organizationId,
    branchId: expense.branchId,
    metadata: { categoryCode, totalAmount: expense.totalAmount },
    meta,
  })
  return detail(expense)
}

export async function updateExpense(ctx: AccessContext, id: string, body: Partial<CreateExpenseBody>, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.EXPENSE_EDIT)
  const existing = await loadAccessibleExpense(ctx, id)
  try {
    assertExpenseMutable(existing.status)
  } catch {
    throw conflict('Only draft expenses can be edited.')
  }
  const patch: Record<string, unknown> = {}
  if (body.categoryCode) patch.categoryCode = body.categoryCode.toUpperCase()
  if (body.description !== undefined) patch.description = body.description.trim()
  if (body.expenseDate) patch.expenseDate = body.expenseDate
  if (body.notes !== undefined) patch.notes = body.notes
  if (body.attachmentKey !== undefined) patch.attachmentKey = body.attachmentKey
  if (body.currency) patch.currency = body.currency.toUpperCase()
  if (body.contractId !== undefined) patch.contractId = body.contractId
  if (body.employeeUserId !== undefined) patch.employeeUserId = body.employeeUserId
  if (body.vendorId) {
    const vendor = await requireActiveVendor(ctx, body.vendorId)
    patch.vendorId = vendor.id
    patch.vendorName = vendor.name
  }
  if (body.vehicleId) {
    const vehicle = await findVehicleById(body.vehicleId)
    if (!vehicle || !canAccessProcurementRecord(ctx, vehicle)) throw notFound('Vehicle was not found.')
    patch.vehicleId = vehicle.id
    patch.vehiclePlate = vehicle.plateNumber
  }
  if (body.amount || body.taxRatePercent) {
    Object.assign(
      patch,
      calcExpense(body.amount ?? existing.amount, body.taxRatePercent ?? existing.taxRatePercent),
    )
  }
  const updated = await updateExpenseDraft(existing.id, patch)
  if (!updated) throw conflict('Expense could not be updated.')
  await recordAuditEvent({
    action: AUDIT_ACTIONS.EXPENSE_UPDATE,
    entityType: AUDIT_ENTITY_TYPES.EXPENSE,
    entityId: updated.id,
    actorUserId: ctx.userId,
    organizationId: updated.organizationId,
    branchId: updated.branchId,
    metadata: { fields: Object.keys(patch) },
    meta,
  })
  return detail(updated)
}

export async function submitExpense(ctx: AccessContext, id: string, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.EXPENSE_SUBMIT)
  const existing = await loadAccessibleExpense(ctx, id)
  if (!canTransitionExpense(existing.status, EXPENSE_STATUSES.SUBMITTED)) {
    throw invalidField('status', `An expense cannot move from ${toPublicEnum(existing.status)} to submitted`)
  }
  const submitted = await transitionExpense(existing.id, EXPENSE_STATUSES.DRAFT, EXPENSE_STATUSES.SUBMITTED, {
    submittedBy: ctx.userId,
    submittedAt: new Date(),
  })
  if (!submitted) throw conflict('Expense could not be submitted.')
  await recordStatusEvent({
    entityType: 'expense',
    entityId: submitted.id,
    organizationId: submitted.organizationId,
    branchId: submitted.branchId,
    fromStatus: EXPENSE_STATUSES.DRAFT,
    toStatus: EXPENSE_STATUSES.SUBMITTED,
    reason: 'submitted',
    actorUserId: ctx.userId,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.EXPENSE_SUBMIT,
    entityType: AUDIT_ENTITY_TYPES.EXPENSE,
    entityId: submitted.id,
    actorUserId: ctx.userId,
    organizationId: submitted.organizationId,
    branchId: submitted.branchId,
    metadata: { totalAmount: submitted.totalAmount },
    meta,
  })
  return detail(submitted)
}

export async function approveExpense(ctx: AccessContext, id: string, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.EXPENSE_APPROVE)
  const existing = await loadAccessibleExpense(ctx, id)
  if (!canTransitionExpense(existing.status, EXPENSE_STATUSES.APPROVED)) {
    throw invalidField('status', `An expense cannot move from ${toPublicEnum(existing.status)} to approved`)
  }
  if (existing.createdBy === ctx.userId) {
    throw conflict('Requester cannot approve their own expense.')
  }
  const documentNumber = existing.documentNumber ?? (await allocateProcurementNumber(existing.organizationId, 'expense'))
  const approved = await transitionExpense(existing.id, existing.status, EXPENSE_STATUSES.APPROVED, {
    documentNumber,
    approvedBy: ctx.userId,
    approvedAt: new Date(),
  })
  if (!approved) throw conflict('Expense could not be approved.')
  await recordStatusEvent({
    entityType: 'expense',
    entityId: approved.id,
    organizationId: approved.organizationId,
    branchId: approved.branchId,
    fromStatus: existing.status,
    toStatus: EXPENSE_STATUSES.APPROVED,
    reason: 'approved',
    actorUserId: ctx.userId,
  })
  await emitAccountingSourceEvent({
    organizationId: approved.organizationId,
    eventType: 'expense.approved',
    entityType: 'expense',
    entityId: approved.id,
    idempotencyKey: `expense.approved:${approved.id}`,
    payload: {
      expenseId: approved.id,
      documentNumber,
      categoryCode: approved.categoryCode,
      totalAmount: approved.totalAmount,
      currency: approved.currency,
      vehicleId: approved.vehicleId,
      contractId: approved.contractId,
    },
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.EXPENSE_APPROVE,
    entityType: AUDIT_ENTITY_TYPES.EXPENSE,
    entityId: approved.id,
    actorUserId: ctx.userId,
    organizationId: approved.organizationId,
    branchId: approved.branchId,
    metadata: { documentNumber },
    meta,
  })
  return detail(approved)
}

export async function postExpense(ctx: AccessContext, id: string, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.EXPENSE_POST)
  const existing = await loadAccessibleExpense(ctx, id)
  if (!canTransitionExpense(existing.status, EXPENSE_STATUSES.POSTED)) {
    throw invalidField('status', `An expense cannot move from ${toPublicEnum(existing.status)} to posted`)
  }
  const posted = await transitionExpense(existing.id, EXPENSE_STATUSES.APPROVED, EXPENSE_STATUSES.POSTED, {
    postedBy: ctx.userId,
    postedAt: new Date(),
  })
  if (!posted) throw conflict('Expense could not be posted.')
  await recordStatusEvent({
    entityType: 'expense',
    entityId: posted.id,
    organizationId: posted.organizationId,
    branchId: posted.branchId,
    fromStatus: EXPENSE_STATUSES.APPROVED,
    toStatus: EXPENSE_STATUSES.POSTED,
    reason: 'posted',
    actorUserId: ctx.userId,
  })
  await emitAccountingSourceEvent({
    organizationId: posted.organizationId,
    eventType: 'expense.posted',
    entityType: 'expense',
    entityId: posted.id,
    idempotencyKey: `expense.posted:${posted.id}`,
    payload: {
      expenseId: posted.id,
      documentNumber: posted.documentNumber,
      totalAmount: posted.totalAmount,
      currency: posted.currency,
    },
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.EXPENSE_POST,
    entityType: AUDIT_ENTITY_TYPES.EXPENSE,
    entityId: posted.id,
    actorUserId: ctx.userId,
    organizationId: posted.organizationId,
    branchId: posted.branchId,
    metadata: { documentNumber: posted.documentNumber },
    meta,
  })
  return detail(posted)
}
