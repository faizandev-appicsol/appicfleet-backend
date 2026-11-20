import {
  DEFAULT_PAYROLL_CURRENCY,
  PAYROLL_FREQUENCIES,
  PAYROLL_PERIOD_STATUSES,
} from '../../constants/payroll.js'
import { PERMISSIONS } from '../../constants/permissions.js'
import {
  findOverlappingPeriods,
  findPayrollPeriodById,
  insertPayrollPeriod,
  listPayrollPeriods,
  updatePayrollPeriod,
} from '../../repositories/payroll/payroll.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import { conflict, invalidField, notFound } from '../../utils/httpErrors.js'
import { assertPermission } from '../authorization/authorization.service.js'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, recordAuditEvent } from '../audit/audit.service.js'
import {
  assertBranchInOrg,
  assertLegalEntityInOrg,
  requirePayrollOrganization,
} from './payroll-access.js'
import { mapPeriod } from './payroll.mapper.js'
import { emitPayrollNotificationIntent } from './payroll-notifications.js'

function parsePage(query: { page?: number; pageSize?: number }) {
  const page = Math.max(1, Number(query.page ?? 1))
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? 20)))
  return { page, pageSize, skip: (page - 1) * pageSize }
}

export async function createPayrollPeriod(
  ctx: AccessContext,
  body: Record<string, unknown>,
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.PAYROLL_CREATE)
  const organizationId = await requirePayrollOrganization(ctx, body.organizationId as string | undefined)
  const legalEntityId = String(body.legalEntityId)
  await assertLegalEntityInOrg(legalEntityId, organizationId)
  if (body.branchId) await assertBranchInOrg(String(body.branchId), organizationId)

  const frequency = String(body.frequency ?? PAYROLL_FREQUENCIES.MONTHLY).toUpperCase()
  if (!(Object.values(PAYROLL_FREQUENCIES) as string[]).includes(frequency)) {
    throw invalidField('frequency', 'Unsupported payroll frequency.')
  }

  const startDate = new Date(String(body.startDate))
  const endDate = new Date(String(body.endDate))
  const payDate = new Date(String(body.payDate))
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || Number.isNaN(payDate.getTime())) {
    throw invalidField('startDate', 'Invalid payroll period dates.')
  }
  if (endDate < startDate) {
    throw invalidField('endDate', 'End date cannot be before start date.')
  }

  const overlapping = await findOverlappingPeriods({
    organizationId,
    legalEntityId,
    frequency,
    startDate,
    endDate,
  })
  if (overlapping.length) {
    throw conflict('An overlapping payroll period already exists for this scope and frequency.')
  }

  const created = await insertPayrollPeriod({
    organizationId,
    legalEntityId,
    branchId: body.branchId,
    name: String(body.name).trim(),
    periodNumber: String(body.periodNumber).trim(),
    frequency,
    startDate,
    endDate,
    payDate,
    status: PAYROLL_PERIOD_STATUSES.OPEN,
    currency: String(body.currency ?? DEFAULT_PAYROLL_CURRENCY).toUpperCase(),
    notes: body.notes ? String(body.notes).trim() : undefined,
    createdBy: ctx.userId,
  })

  await recordAuditEvent({
    action: AUDIT_ACTIONS.PAYROLL_PERIOD_CREATED,
    entityType: AUDIT_ENTITY_TYPES.PAYROLL_PERIOD,
    entityId: created.id,
    actorUserId: ctx.userId,
    organizationId,
    metadata: { periodNumber: created.periodNumber, frequency },
    meta,
  })

  await emitPayrollNotificationIntent({
    organizationId,
    kind: 'payroll.period.created',
    intentKey: `payroll.period.created:${created.id}`,
    payload: { periodNumber: created.periodNumber },
    meta,
  })

  return mapPeriod(created)
}

export async function listPayrollPeriodsService(ctx: AccessContext, query: Record<string, unknown>) {
  assertPermission(ctx, PERMISSIONS.PAYROLL_VIEW)
  const organizationId = await requirePayrollOrganization(ctx, query.organizationId as string | undefined)
  const { page, pageSize, skip } = parsePage(query as { page?: number; pageSize?: number })
  const result = await listPayrollPeriods({
    organizationId,
    legalEntityId: query.legalEntityId ? String(query.legalEntityId) : undefined,
    status: query.status ? String(query.status).toUpperCase() : undefined,
    limit: pageSize,
    skip,
  })
  return { items: result.items.map(mapPeriod), page, pageSize, total: result.total }
}

export async function getPayrollPeriodService(ctx: AccessContext, id: string) {
  assertPermission(ctx, PERMISSIONS.PAYROLL_VIEW)
  const period = await findPayrollPeriodById(id)
  if (!period) throw notFound('Payroll period was not found.')
  await requirePayrollOrganization(ctx, period.organizationId)
  return mapPeriod(period)
}

export async function updatePayrollPeriodService(
  ctx: AccessContext,
  id: string,
  body: Record<string, unknown>,
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.PAYROLL_CREATE)
  const period = await findPayrollPeriodById(id)
  if (!period) throw notFound('Payroll period was not found.')
  await requirePayrollOrganization(ctx, period.organizationId)

  if (
    period.status === PAYROLL_PERIOD_STATUSES.PAID ||
    period.status === PAYROLL_PERIOD_STATUSES.APPROVED
  ) {
    throw conflict('Approved or paid payroll periods are immutable.')
  }
  if (period.status === PAYROLL_PERIOD_STATUSES.CANCELLED) {
    throw conflict('Cancelled payroll periods cannot be edited.')
  }

  const patch: Record<string, unknown> = { updatedBy: ctx.userId }
  if (body.name !== undefined) patch.name = String(body.name).trim()
  if (body.notes !== undefined) patch.notes = String(body.notes).trim()
  if (body.payDate !== undefined) {
    const payDate = new Date(String(body.payDate))
    if (Number.isNaN(payDate.getTime())) throw invalidField('payDate', 'Invalid pay date.')
    patch.payDate = payDate
  }
  if (body.startDate !== undefined || body.endDate !== undefined) {
    if (period.status !== PAYROLL_PERIOD_STATUSES.OPEN) {
      throw conflict('Only open periods allow date changes.')
    }
    const startDate = body.startDate ? new Date(String(body.startDate)) : period.startDate
    const endDate = body.endDate ? new Date(String(body.endDate)) : period.endDate
    if (endDate < startDate) throw invalidField('endDate', 'End date cannot be before start date.')
    const overlapping = await findOverlappingPeriods({
      organizationId: period.organizationId,
      legalEntityId: period.legalEntityId,
      frequency: period.frequency,
      startDate,
      endDate,
      excludeId: period.id,
    })
    if (overlapping.length) {
      throw conflict('An overlapping payroll period already exists for this scope and frequency.')
    }
    patch.startDate = startDate
    patch.endDate = endDate
  }

  const updated = await updatePayrollPeriod(id, patch)
  if (!updated) throw notFound('Payroll period was not found.')

  await recordAuditEvent({
    action: AUDIT_ACTIONS.PAYROLL_PERIOD_UPDATED,
    entityType: AUDIT_ENTITY_TYPES.PAYROLL_PERIOD,
    entityId: id,
    actorUserId: ctx.userId,
    organizationId: period.organizationId,
    metadata: { fields: Object.keys(patch) },
    meta,
  })

  return mapPeriod(updated)
}

export async function cancelPayrollPeriodService(
  ctx: AccessContext,
  id: string,
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.PAYROLL_CANCEL)
  const period = await findPayrollPeriodById(id)
  if (!period) throw notFound('Payroll period was not found.')
  await requirePayrollOrganization(ctx, period.organizationId)
  if (
    period.status === PAYROLL_PERIOD_STATUSES.PAID ||
    period.status === PAYROLL_PERIOD_STATUSES.APPROVED
  ) {
    throw conflict('Approved or paid periods cannot be cancelled directly.')
  }
  const updated = await updatePayrollPeriod(id, {
    status: PAYROLL_PERIOD_STATUSES.CANCELLED,
    updatedBy: ctx.userId,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.PAYROLL_PERIOD_UPDATED,
    entityType: AUDIT_ENTITY_TYPES.PAYROLL_PERIOD,
    entityId: id,
    actorUserId: ctx.userId,
    organizationId: period.organizationId,
    metadata: { status: PAYROLL_PERIOD_STATUSES.CANCELLED },
    meta,
  })
  return mapPeriod(updated!)
}
