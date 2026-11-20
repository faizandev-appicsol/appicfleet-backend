import { PERIOD_STATUSES } from '../../constants/accounting.js'
import { PERMISSIONS } from '../../constants/permissions.js'
import { toPublicEnum } from '../../constants/vehicles.js'
import {
  findFiscalYearById,
  insertFiscalPeriod,
  insertFiscalYear,
  listFiscalPeriods,
  listFiscalYears,
  recordAccountingStatusEvent,
  transitionFiscalPeriod,
} from '../../repositories/accounting/accounting.repository.js'
import { emitAccountingSourceEvent } from '../../repositories/procurement/procurement.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import { conflict, invalidField, notFound } from '../../utils/httpErrors.js'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, recordAuditEvent } from '../audit/audit.service.js'
import { assertPermission } from '../authorization/authorization.service.js'
import { canTransitionPeriod } from './accounting-rules.js'
import { canAccessAccountingScope, loadAccessiblePeriod, resolveAccountingOrganization } from './accounting-access.js'
import { toFiscalPeriodResource, toFiscalYearResource } from './accounting.mapper.js'

export async function listYears(ctx: AccessContext, query: Record<string, unknown>) {
  assertPermission(ctx, PERMISSIONS.ACCOUNTING_VIEW)
  const organizationId = resolveAccountingOrganization(ctx, query.organizationId as string | undefined)
  const years = await listFiscalYears(organizationId, query.legalEntityId as string | undefined)
  return years
    .filter((year) => canAccessAccountingScope(ctx, year))
    .map(toFiscalYearResource)
}

export async function listPeriods(ctx: AccessContext, query: Record<string, unknown>) {
  assertPermission(ctx, PERMISSIONS.ACCOUNTING_VIEW)
  const organizationId = resolveAccountingOrganization(ctx, query.organizationId as string | undefined)
  const periods = await listFiscalPeriods(
    organizationId,
    query.legalEntityId as string | undefined,
    query.fiscalYearId as string | undefined,
  )
  return periods.filter((period) => canAccessAccountingScope(ctx, period)).map(toFiscalPeriodResource)
}

export async function createFiscalYear(
  ctx: AccessContext,
  body: { organizationId?: string; legalEntityId: string; name: string; startDate: Date; endDate: Date },
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.ACCOUNTING_CREATE)
  const organizationId = resolveAccountingOrganization(ctx, body.organizationId)
  if (body.endDate <= body.startDate) throw invalidField('endDate', 'End date must be after start date.')
  const year = await insertFiscalYear({
    organizationId,
    legalEntityId: body.legalEntityId,
    name: body.name.trim(),
    startDate: body.startDate,
    endDate: body.endDate,
    status: PERIOD_STATUSES.OPEN,
    createdBy: ctx.userId,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.PERIOD_CREATE,
    entityType: AUDIT_ENTITY_TYPES.FISCAL_PERIOD,
    entityId: year.id,
    actorUserId: ctx.userId,
    organizationId,
    metadata: { kind: 'fiscal_year', name: year.name },
    meta,
  })
  return toFiscalYearResource(year)
}

export async function createFiscalPeriod(
  ctx: AccessContext,
  body: {
    organizationId?: string
    legalEntityId: string
    fiscalYearId: string
    name: string
    periodNumber: number
    startDate: Date
    endDate: Date
  },
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.ACCOUNTING_CREATE)
  const organizationId = resolveAccountingOrganization(ctx, body.organizationId)
  const year = await findFiscalYearById(body.fiscalYearId)
  if (!year || year.organizationId !== organizationId || year.legalEntityId !== body.legalEntityId) {
    throw notFound('Fiscal year was not found.')
  }
  if (body.endDate <= body.startDate) throw invalidField('endDate', 'End date must be after start date.')
  const period = await insertFiscalPeriod({
    organizationId,
    legalEntityId: body.legalEntityId,
    fiscalYearId: body.fiscalYearId,
    name: body.name.trim(),
    periodNumber: body.periodNumber,
    startDate: body.startDate,
    endDate: body.endDate,
    status: PERIOD_STATUSES.OPEN,
    createdBy: ctx.userId,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.PERIOD_CREATE,
    entityType: AUDIT_ENTITY_TYPES.FISCAL_PERIOD,
    entityId: period.id,
    actorUserId: ctx.userId,
    organizationId,
    metadata: { name: period.name, periodNumber: period.periodNumber },
    meta,
  })
  return toFiscalPeriodResource(period)
}

export async function closePeriod(ctx: AccessContext, id: string, reason: string, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.ACCOUNTING_CLOSE_PERIOD)
  const existing = await loadAccessiblePeriod(ctx, id)
  if (!canTransitionPeriod(existing.status, PERIOD_STATUSES.CLOSED)) {
    throw invalidField('status', `Period cannot close from ${toPublicEnum(existing.status)}`)
  }
  const closed = await transitionFiscalPeriod(existing.id, PERIOD_STATUSES.OPEN, PERIOD_STATUSES.CLOSED, {
    closedAt: new Date(),
    closedBy: ctx.userId,
    closeReason: reason,
  })
  if (!closed) throw conflict('Period could not be closed.')
  await recordAccountingStatusEvent({
    entityType: 'fiscal_period',
    entityId: closed.id,
    organizationId: closed.organizationId,
    fromStatus: PERIOD_STATUSES.OPEN,
    toStatus: PERIOD_STATUSES.CLOSED,
    reason,
    actorUserId: ctx.userId,
  })
  await emitAccountingSourceEvent({
    organizationId: closed.organizationId,
    eventType: 'accounting.period.closed',
    entityType: 'fiscal_period',
    entityId: closed.id,
    idempotencyKey: `accounting.period.closed:${closed.id}:${closed.closedAt?.toISOString() ?? Date.now()}`,
    payload: { periodId: closed.id, reason },
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.PERIOD_CLOSE,
    entityType: AUDIT_ENTITY_TYPES.FISCAL_PERIOD,
    entityId: closed.id,
    actorUserId: ctx.userId,
    organizationId: closed.organizationId,
    metadata: { reason },
    meta,
  })
  return toFiscalPeriodResource(closed)
}

export async function reopenPeriod(ctx: AccessContext, id: string, reason: string, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.ACCOUNTING_REOPEN_PERIOD)
  const existing = await loadAccessiblePeriod(ctx, id)
  if (!canTransitionPeriod(existing.status, PERIOD_STATUSES.OPEN)) {
    throw invalidField('status', `Period cannot reopen from ${toPublicEnum(existing.status)}`)
  }
  if (!reason.trim()) throw invalidField('reason', 'Reopen reason is required.')
  const reopened = await transitionFiscalPeriod(existing.id, PERIOD_STATUSES.CLOSED, PERIOD_STATUSES.OPEN, {
    reopenedAt: new Date(),
    reopenedBy: ctx.userId,
    reopenReason: reason,
  })
  if (!reopened) throw conflict('Period could not be reopened.')
  await recordAccountingStatusEvent({
    entityType: 'fiscal_period',
    entityId: reopened.id,
    organizationId: reopened.organizationId,
    fromStatus: PERIOD_STATUSES.CLOSED,
    toStatus: PERIOD_STATUSES.OPEN,
    reason,
    actorUserId: ctx.userId,
  })
  await emitAccountingSourceEvent({
    organizationId: reopened.organizationId,
    eventType: 'accounting.period.reopened',
    entityType: 'fiscal_period',
    entityId: reopened.id,
    idempotencyKey: `accounting.period.reopened:${reopened.id}:${Date.now()}`,
    payload: { periodId: reopened.id, reason },
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.PERIOD_REOPEN,
    entityType: AUDIT_ENTITY_TYPES.FISCAL_PERIOD,
    entityId: reopened.id,
    actorUserId: ctx.userId,
    organizationId: reopened.organizationId,
    metadata: { reason },
    meta,
  })
  return toFiscalPeriodResource(reopened)
}
