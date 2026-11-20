import { TAX_PERIOD_STATUSES } from '../../constants/tax.js'
import { PERMISSIONS } from '../../constants/permissions.js'
import {
  findOpenTaxPeriodForDate,
  insertTaxPeriod,
  listTaxPeriods,
  listTaxTransactions,
  recordTaxStatusEvent,
  transitionTaxPeriod,
} from '../../repositories/tax/tax.repository.js'
import { emitAccountingSourceEvent } from '../../repositories/procurement/procurement.repository.js'
import type { AccessContext } from '../../types/access.js'
import type { RequestMeta } from '../../types/http.js'
import { conflict, invalidField, notFound } from '../../utils/httpErrors.js'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, recordAuditEvent } from '../audit/audit.service.js'
import { assertPermission } from '../authorization/authorization.service.js'
import { canTransitionTaxPeriod } from './tax-rules.js'
import { loadAccessibleTaxPeriod, resolveTaxOrganization } from './tax-access.js'
import { toTaxPeriodResource } from './tax.mapper.js'

export async function listTaxPeriodDirectory(ctx: AccessContext, query: Record<string, unknown>) {
  assertPermission(ctx, PERMISSIONS.TAX_VIEW)
  const organizationId = resolveTaxOrganization(ctx, query.organizationId as string | undefined)
  const filter: Record<string, unknown> = { organizationId }
  if (query.legalEntityId) filter.legalEntityId = query.legalEntityId
  if (query.status) filter.status = String(query.status).toUpperCase()
  return (await listTaxPeriods(filter)).map(toTaxPeriodResource)
}

export async function createTaxPeriodRecord(
  ctx: AccessContext,
  body: {
    organizationId?: string
    legalEntityId: string
    taxYear: number
    name: string
    periodNumber: number
    startDate: Date
    endDate: Date
  },
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.TAX_MANAGE_PERIODS)
  const organizationId = resolveTaxOrganization(ctx, body.organizationId)
  if (body.endDate <= body.startDate) throw invalidField('endDate', 'End date must be after start date.')
  const created = await insertTaxPeriod({
    organizationId,
    legalEntityId: body.legalEntityId,
    taxYear: body.taxYear,
    name: body.name.trim(),
    periodNumber: body.periodNumber,
    startDate: body.startDate,
    endDate: body.endDate,
    status: TAX_PERIOD_STATUSES.OPEN,
    createdBy: ctx.userId,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.TAX_PERIOD_CREATE,
    entityType: AUDIT_ENTITY_TYPES.TAX_PERIOD,
    entityId: created.id,
    actorUserId: ctx.userId,
    organizationId,
    meta,
  })
  return toTaxPeriodResource(created)
}

export async function validateTaxPeriod(ctx: AccessContext, periodId: string) {
  const period = await loadAccessibleTaxPeriod(ctx, periodId)
  const issues: Array<{ code: string; message: string }> = []
  const tx = await listTaxTransactions(
    { organizationId: period.organizationId, taxPeriodId: period.id },
    0,
    5000,
  )
  for (const row of tx.items) {
    if (!row.taxCode) issues.push({ code: 'MISSING_TAX_CODE', message: `Transaction ${row.id} missing tax code.` })
  }
  return {
    period: toTaxPeriodResource(period),
    transactionCount: tx.total,
    issues,
    canLock: issues.length === 0,
    note: 'Validation supports filing readiness; it does not certify a tax return as legally correct.',
  }
}

export async function lockTaxPeriod(ctx: AccessContext, periodId: string, reason: string, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.TAX_MANAGE_PERIODS)
  const period = await loadAccessibleTaxPeriod(ctx, periodId)
  if (!canTransitionTaxPeriod(period.status as 'OPEN', TAX_PERIOD_STATUSES.LOCKED)) {
    throw invalidField('status', 'Only open tax periods can be locked.')
  }
  const validation = await validateTaxPeriod(ctx, periodId)
  if (!validation.canLock) throw conflict('Tax period has validation issues and cannot be locked.')
  const updated = await transitionTaxPeriod(periodId, TAX_PERIOD_STATUSES.OPEN, TAX_PERIOD_STATUSES.LOCKED, {
    lockedAt: new Date(),
    lockedBy: ctx.userId,
    lockReason: reason,
  })
  if (!updated) throw conflict('Tax period could not be locked.')
  await recordTaxStatusEvent({
    entityType: 'tax_period',
    entityId: periodId,
    organizationId: period.organizationId,
    fromStatus: TAX_PERIOD_STATUSES.OPEN,
    toStatus: TAX_PERIOD_STATUSES.LOCKED,
    reason,
    actorUserId: ctx.userId,
  })
  await emitAccountingSourceEvent({
    organizationId: String(period.organizationId),
    eventType: 'tax.period.locked',
    entityType: 'tax_period',
    entityId: periodId,
    idempotencyKey: `tax.period.locked:${periodId}`,
    payload: { taxPeriodId: periodId, reason },
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.TAX_PERIOD_LOCK,
    entityType: AUDIT_ENTITY_TYPES.TAX_PERIOD,
    entityId: periodId,
    actorUserId: ctx.userId,
    organizationId: String(period.organizationId),
    meta,
    metadata: { reason },
  })
  return toTaxPeriodResource(updated)
}

export async function reopenTaxPeriod(ctx: AccessContext, periodId: string, reason: string, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.TAX_MANAGE_PERIODS)
  const period = await loadAccessibleTaxPeriod(ctx, periodId)
  if (!canTransitionTaxPeriod(period.status as 'LOCKED', TAX_PERIOD_STATUSES.OPEN)) {
    throw invalidField('status', 'Only locked tax periods can be reopened.')
  }
  const updated = await transitionTaxPeriod(periodId, TAX_PERIOD_STATUSES.LOCKED, TAX_PERIOD_STATUSES.OPEN, {
    lockedAt: null,
    lockedBy: null,
    lockReason: null,
  })
  if (!updated) throw conflict('Tax period could not be reopened.')
  await recordTaxStatusEvent({
    entityType: 'tax_period',
    entityId: periodId,
    organizationId: period.organizationId,
    fromStatus: TAX_PERIOD_STATUSES.LOCKED,
    toStatus: TAX_PERIOD_STATUSES.OPEN,
    reason,
    actorUserId: ctx.userId,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.TAX_PERIOD_REOPEN,
    entityType: AUDIT_ENTITY_TYPES.TAX_PERIOD,
    entityId: periodId,
    actorUserId: ctx.userId,
    organizationId: String(period.organizationId),
    meta,
    metadata: { reason },
  })
  return toTaxPeriodResource(updated)
}

export async function resolveOpenTaxPeriod(organizationId: string, legalEntityId: string, date: Date) {
  return findOpenTaxPeriodForDate(organizationId, legalEntityId, date)
}
