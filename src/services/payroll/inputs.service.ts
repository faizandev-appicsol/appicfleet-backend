import {
  ADVANCE_STATUSES,
  BONUS_TYPES,
  DEDUCTION_TYPES,
  PAYROLL_ADJUSTMENT_DIRECTIONS,
  PAYROLL_INPUT_STATUSES,
  PAYROLL_PAYMENT_STATUSES,
} from '../../constants/payroll.js'
import { PERMISSIONS } from '../../constants/permissions.js'
import {
  findAdjustmentById,
  findAdvanceById,
  findBonusById,
  findDeductionById,
  findOvertimeById,
  findPayrollPeriodById,
  insertAdjustment,
  insertAdvance,
  insertBonus,
  insertDeduction,
  insertOvertime,
  listAdjustments,
  listAdvances,
  listBonuses,
  listDeductions,
  listPayments,
  updateAdjustment,
  updateAdvance,
  updateBonus,
  updateDeduction,
  updateOvertime,
} from '../../repositories/payroll/payroll.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import { conflict, invalidField, notFound } from '../../utils/httpErrors.js'
import { isMoneyString, normalizeMoney } from '../../utils/money.js'
import { assertPermission } from '../authorization/authorization.service.js'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, recordAuditEvent } from '../audit/audit.service.js'
import { loadAccessiblePayrollEmployee, requirePayrollOrganization } from './payroll-access.js'
import {
  mapAdjustment,
  mapAdvance,
  mapBonus,
  mapDeduction,
  mapOvertime,
  mapPayment,
} from './payroll.mapper.js'

function parsePage(query: { page?: number; pageSize?: number }) {
  const page = Math.max(1, Number(query.page ?? 1))
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? 20)))
  return { page, pageSize, skip: (page - 1) * pageSize }
}

function requireMoney(field: string, value: unknown) {
  if (!value || !isMoneyString(String(value))) {
    throw invalidField(field, 'A valid money amount is required.')
  }
  return normalizeMoney(String(value))
}

async function resolveEmployeePeriod(
  ctx: AccessContext,
  body: Record<string, unknown>,
) {
  const employee = await loadAccessiblePayrollEmployee(
    ctx,
    String(body.employeeId),
    body.organizationId as string | undefined,
  )
  let periodId = body.payrollPeriodId ? String(body.payrollPeriodId) : undefined
  if (periodId) {
    const period = await findPayrollPeriodById(periodId)
    if (!period || period.organizationId !== employee.organizationId) {
      throw notFound('Payroll period was not found.')
    }
  }
  return { employee, periodId }
}

export async function createBonus(ctx: AccessContext, body: Record<string, unknown>, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.PAYROLL_ADJUST)
  const { employee, periodId } = await resolveEmployeePeriod(ctx, body)
  const bonusType = String(body.bonusType ?? BONUS_TYPES.OTHER).toUpperCase()
  if (!(Object.values(BONUS_TYPES) as string[]).includes(bonusType)) {
    throw invalidField('bonusType', 'Unsupported bonus type.')
  }
  const created = await insertBonus({
    organizationId: employee.organizationId,
    legalEntityId: employee.legalEntityId,
    branchId: employee.branchId,
    employeeId: employee.id,
    payrollPeriodId: periodId,
    bonusType,
    amount: requireMoney('amount', body.amount),
    currency: String(body.currency ?? 'AED').toUpperCase(),
    reason: body.reason ? String(body.reason).trim() : undefined,
    notes: body.notes ? String(body.notes).trim() : undefined,
    effectiveDate: new Date(String(body.effectiveDate ?? new Date().toISOString())),
    status: PAYROLL_INPUT_STATUSES.DRAFT,
    createdBy: ctx.userId,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.PAYROLL_ADJUSTMENT_CREATED,
    entityType: AUDIT_ENTITY_TYPES.PAYROLL_ADJUSTMENT,
    entityId: created.id,
    actorUserId: ctx.userId,
    organizationId: employee.organizationId,
    metadata: { kind: 'bonus' },
    meta,
  })
  return mapBonus(created)
}

export async function approveBonus(ctx: AccessContext, id: string, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.PAYROLL_APPROVE)
  const bonus = await findBonusById(id)
  if (!bonus) throw notFound('Bonus was not found.')
  await requirePayrollOrganization(ctx, bonus.organizationId)
  if (bonus.status !== PAYROLL_INPUT_STATUSES.DRAFT && bonus.status !== PAYROLL_INPUT_STATUSES.PENDING_APPROVAL) {
    throw conflict('Bonus cannot be approved in its current status.')
  }
  const updated = await updateBonus(id, {
    status: PAYROLL_INPUT_STATUSES.APPROVED,
    approvedBy: ctx.userId,
    approvedAt: new Date(),
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.PAYROLL_ADJUSTMENT_APPROVED,
    entityType: AUDIT_ENTITY_TYPES.PAYROLL_ADJUSTMENT,
    entityId: id,
    actorUserId: ctx.userId,
    organizationId: bonus.organizationId,
    metadata: { kind: 'bonus' },
    meta,
  })
  return mapBonus(updated!)
}

export async function listBonusesService(ctx: AccessContext, query: Record<string, unknown>) {
  assertPermission(ctx, PERMISSIONS.PAYROLL_VIEW)
  const organizationId = await requirePayrollOrganization(ctx, query.organizationId as string | undefined)
  const { page, pageSize, skip } = parsePage(query as { page?: number; pageSize?: number })
  const result = await listBonuses({
    organizationId,
    employeeId: query.employeeId ? String(query.employeeId) : undefined,
    payrollPeriodId: query.payrollPeriodId ? String(query.payrollPeriodId) : undefined,
    status: query.status ? String(query.status).toUpperCase() : undefined,
    limit: pageSize,
    skip,
  })
  return { items: result.items.map(mapBonus), page, pageSize, total: result.total }
}

export async function createDeduction(
  ctx: AccessContext,
  body: Record<string, unknown>,
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.PAYROLL_ADJUST)
  const { employee, periodId } = await resolveEmployeePeriod(ctx, body)
  const deductionType = String(body.deductionType ?? DEDUCTION_TYPES.OTHER).toUpperCase()
  if (!(Object.values(DEDUCTION_TYPES) as string[]).includes(deductionType)) {
    throw invalidField('deductionType', 'Unsupported deduction type.')
  }
  const created = await insertDeduction({
    organizationId: employee.organizationId,
    legalEntityId: employee.legalEntityId,
    branchId: employee.branchId,
    employeeId: employee.id,
    payrollPeriodId: periodId,
    deductionType,
    amount: requireMoney('amount', body.amount),
    currency: String(body.currency ?? 'AED').toUpperCase(),
    reason: body.reason ? String(body.reason).trim() : undefined,
    effectiveDate: new Date(String(body.effectiveDate ?? new Date().toISOString())),
    advanceId: body.advanceId,
    status: PAYROLL_INPUT_STATUSES.DRAFT,
    createdBy: ctx.userId,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.PAYROLL_ADJUSTMENT_CREATED,
    entityType: AUDIT_ENTITY_TYPES.PAYROLL_ADJUSTMENT,
    entityId: created.id,
    actorUserId: ctx.userId,
    organizationId: employee.organizationId,
    metadata: { kind: 'deduction' },
    meta,
  })
  return mapDeduction(created)
}

export async function approveDeduction(ctx: AccessContext, id: string, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.PAYROLL_APPROVE)
  const row = await findDeductionById(id)
  if (!row) throw notFound('Deduction was not found.')
  await requirePayrollOrganization(ctx, row.organizationId)
  const updated = await updateDeduction(id, {
    status: PAYROLL_INPUT_STATUSES.APPROVED,
    approvedBy: ctx.userId,
    approvedAt: new Date(),
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.PAYROLL_ADJUSTMENT_APPROVED,
    entityType: AUDIT_ENTITY_TYPES.PAYROLL_ADJUSTMENT,
    entityId: id,
    actorUserId: ctx.userId,
    organizationId: row.organizationId,
    metadata: { kind: 'deduction' },
    meta,
  })
  return mapDeduction(updated!)
}

export async function listDeductionsService(ctx: AccessContext, query: Record<string, unknown>) {
  assertPermission(ctx, PERMISSIONS.PAYROLL_VIEW)
  const organizationId = await requirePayrollOrganization(ctx, query.organizationId as string | undefined)
  const { page, pageSize, skip } = parsePage(query as { page?: number; pageSize?: number })
  const result = await listDeductions({
    organizationId,
    employeeId: query.employeeId ? String(query.employeeId) : undefined,
    payrollPeriodId: query.payrollPeriodId ? String(query.payrollPeriodId) : undefined,
    status: query.status ? String(query.status).toUpperCase() : undefined,
    limit: pageSize,
    skip,
  })
  return { items: result.items.map(mapDeduction), page, pageSize, total: result.total }
}

export async function createAdjustment(
  ctx: AccessContext,
  body: Record<string, unknown>,
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.PAYROLL_ADJUST)
  const { employee, periodId } = await resolveEmployeePeriod(ctx, body)
  if (!periodId) throw invalidField('payrollPeriodId', 'Payroll period is required for adjustments.')
  const direction = String(body.direction ?? '').toUpperCase()
  if (!(Object.values(PAYROLL_ADJUSTMENT_DIRECTIONS) as string[]).includes(direction)) {
    throw invalidField('direction', 'Adjustment direction must be positive or negative.')
  }
  if (!body.reason || !String(body.reason).trim()) {
    throw invalidField('reason', 'A reason is required for payroll adjustments.')
  }
  const created = await insertAdjustment({
    organizationId: employee.organizationId,
    legalEntityId: employee.legalEntityId,
    branchId: employee.branchId,
    employeeId: employee.id,
    payrollPeriodId: periodId,
    direction,
    amount: requireMoney('amount', body.amount),
    currency: String(body.currency ?? 'AED').toUpperCase(),
    reason: String(body.reason).trim(),
    status: PAYROLL_INPUT_STATUSES.DRAFT,
    createdBy: ctx.userId,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.PAYROLL_ADJUSTMENT_CREATED,
    entityType: AUDIT_ENTITY_TYPES.PAYROLL_ADJUSTMENT,
    entityId: created.id,
    actorUserId: ctx.userId,
    organizationId: employee.organizationId,
    metadata: { kind: 'adjustment', direction },
    meta,
  })
  return mapAdjustment(created)
}

export async function approveAdjustment(ctx: AccessContext, id: string, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.PAYROLL_APPROVE)
  const row = await findAdjustmentById(id)
  if (!row) throw notFound('Adjustment was not found.')
  await requirePayrollOrganization(ctx, row.organizationId)
  const updated = await updateAdjustment(id, {
    status: PAYROLL_INPUT_STATUSES.APPROVED,
    approvedBy: ctx.userId,
    approvedAt: new Date(),
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.PAYROLL_ADJUSTMENT_APPROVED,
    entityType: AUDIT_ENTITY_TYPES.PAYROLL_ADJUSTMENT,
    entityId: id,
    actorUserId: ctx.userId,
    organizationId: row.organizationId,
    metadata: { kind: 'adjustment' },
    meta,
  })
  return mapAdjustment(updated!)
}

export async function listAdjustmentsService(ctx: AccessContext, query: Record<string, unknown>) {
  assertPermission(ctx, PERMISSIONS.PAYROLL_VIEW)
  const organizationId = await requirePayrollOrganization(ctx, query.organizationId as string | undefined)
  const { page, pageSize, skip } = parsePage(query as { page?: number; pageSize?: number })
  const result = await listAdjustments({
    organizationId,
    employeeId: query.employeeId ? String(query.employeeId) : undefined,
    payrollPeriodId: query.payrollPeriodId ? String(query.payrollPeriodId) : undefined,
    status: query.status ? String(query.status).toUpperCase() : undefined,
    limit: pageSize,
    skip,
  })
  return { items: result.items.map(mapAdjustment), page, pageSize, total: result.total }
}

export async function createOvertime(
  ctx: AccessContext,
  body: Record<string, unknown>,
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.PAYROLL_ADJUST)
  const { employee, periodId } = await resolveEmployeePeriod(ctx, body)
  const created = await insertOvertime({
    organizationId: employee.organizationId,
    legalEntityId: employee.legalEntityId,
    branchId: employee.branchId,
    employeeId: employee.id,
    payrollPeriodId: periodId,
    workDate: new Date(String(body.workDate)),
    hours: String(body.hours),
    rate: requireMoney('rate', body.rate),
    amount: requireMoney('amount', body.amount),
    currency: String(body.currency ?? 'AED').toUpperCase(),
    reason: body.reason ? String(body.reason).trim() : undefined,
    status: PAYROLL_INPUT_STATUSES.DRAFT,
    createdBy: ctx.userId,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.PAYROLL_ADJUSTMENT_CREATED,
    entityType: AUDIT_ENTITY_TYPES.PAYROLL_ADJUSTMENT,
    entityId: created.id,
    actorUserId: ctx.userId,
    organizationId: employee.organizationId,
    metadata: { kind: 'overtime' },
    meta,
  })
  return mapOvertime(created)
}

export async function approveOvertime(ctx: AccessContext, id: string, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.PAYROLL_APPROVE)
  const row = await findOvertimeById(id)
  if (!row) throw notFound('Overtime was not found.')
  await requirePayrollOrganization(ctx, row.organizationId)
  const updated = await updateOvertime(id, {
    status: PAYROLL_INPUT_STATUSES.APPROVED,
    approvedBy: ctx.userId,
    approvedAt: new Date(),
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.PAYROLL_ADJUSTMENT_APPROVED,
    entityType: AUDIT_ENTITY_TYPES.PAYROLL_ADJUSTMENT,
    entityId: id,
    actorUserId: ctx.userId,
    organizationId: row.organizationId,
    metadata: { kind: 'overtime' },
    meta,
  })
  return mapOvertime(updated!)
}

export async function createAdvance(
  ctx: AccessContext,
  body: Record<string, unknown>,
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.PAYROLL_ADJUST)
  const employee = await loadAccessiblePayrollEmployee(
    ctx,
    String(body.employeeId),
    body.organizationId as string | undefined,
  )
  const principal = requireMoney('principalAmount', body.principalAmount)
  const installment = requireMoney('installmentAmount', body.installmentAmount)
  const created = await insertAdvance({
    organizationId: employee.organizationId,
    legalEntityId: employee.legalEntityId,
    branchId: employee.branchId,
    employeeId: employee.id,
    principalAmount: principal,
    installmentAmount: installment,
    remainingBalance: principal,
    currency: String(body.currency ?? 'AED').toUpperCase(),
    startDate: new Date(String(body.startDate ?? new Date().toISOString())),
    status: ADVANCE_STATUSES.DRAFT,
    notes: body.notes ? String(body.notes).trim() : undefined,
    createdBy: ctx.userId,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.PAYROLL_ADJUSTMENT_CREATED,
    entityType: AUDIT_ENTITY_TYPES.PAYROLL_ADJUSTMENT,
    entityId: created.id,
    actorUserId: ctx.userId,
    organizationId: employee.organizationId,
    metadata: { kind: 'advance' },
    meta,
  })
  return mapAdvance(created)
}

export async function approveAdvance(ctx: AccessContext, id: string, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.PAYROLL_APPROVE)
  const row = await findAdvanceById(id)
  if (!row) throw notFound('Advance was not found.')
  await requirePayrollOrganization(ctx, row.organizationId)
  const updated = await updateAdvance(id, {
    status: ADVANCE_STATUSES.ACTIVE,
    approvedBy: ctx.userId,
    approvedAt: new Date(),
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.PAYROLL_ADJUSTMENT_APPROVED,
    entityType: AUDIT_ENTITY_TYPES.PAYROLL_ADJUSTMENT,
    entityId: id,
    actorUserId: ctx.userId,
    organizationId: row.organizationId,
    metadata: { kind: 'advance' },
    meta,
  })
  return mapAdvance(updated!)
}

export async function listAdvancesService(ctx: AccessContext, query: Record<string, unknown>) {
  assertPermission(ctx, PERMISSIONS.PAYROLL_VIEW)
  const organizationId = await requirePayrollOrganization(ctx, query.organizationId as string | undefined)
  const { page, pageSize, skip } = parsePage(query as { page?: number; pageSize?: number })
  const result = await listAdvances({
    organizationId,
    employeeId: query.employeeId ? String(query.employeeId) : undefined,
    status: query.status ? String(query.status).toUpperCase() : undefined,
    limit: pageSize,
    skip,
  })
  return { items: result.items.map(mapAdvance), page, pageSize, total: result.total }
}

export async function listPaymentsService(ctx: AccessContext, query: Record<string, unknown>) {
  assertPermission(ctx, PERMISSIONS.PAYROLL_PAYMENT_VIEW)
  const organizationId = await requirePayrollOrganization(ctx, query.organizationId as string | undefined)
  const { page, pageSize, skip } = parsePage(query as { page?: number; pageSize?: number })
  const result = await listPayments({
    organizationId,
    payrollRunId: query.payrollRunId ? String(query.payrollRunId) : undefined,
    employeeId: query.employeeId ? String(query.employeeId) : undefined,
    status: query.status ? String(query.status).toUpperCase() : undefined,
    limit: pageSize,
    skip,
  })
  return { items: result.items.map(mapPayment), page, pageSize, total: result.total }
}

export { PAYROLL_PAYMENT_STATUSES }
