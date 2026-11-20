import { ACCOUNT_ROLES, type AccountRole } from '../../constants/accounting.js'
import { PERMISSIONS } from '../../constants/permissions.js'
import { toPublicEnum } from '../../constants/vehicles.js'
import {
  findAccountById,
  listAccountMappings,
  listJournals,
  listFiscalPeriods,
  upsertAccountMapping,
} from '../../repositories/accounting/accounting.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import { addMoney } from '../../utils/money.js'
import { invalidField, notFound } from '../../utils/httpErrors.js'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, recordAuditEvent } from '../audit/audit.service.js'
import { assertPermission } from '../authorization/authorization.service.js'
import { resolveAccountingOrganization } from './accounting-access.js'

export async function listMappings(
  ctx: AccessContext,
  query: { organizationId?: string; legalEntityId: string },
) {
  assertPermission(ctx, PERMISSIONS.ACCOUNTING_VIEW)
  const organizationId = resolveAccountingOrganization(ctx, query.organizationId)
  const rows = await listAccountMappings(organizationId, query.legalEntityId)
  return rows.map((row) => ({
    id: String((row as { _id: { toString(): string } })._id),
    role: toPublicEnum(String((row as { role: string }).role)),
    accountId: String((row as { accountId: unknown }).accountId),
  }))
}

export async function upsertMapping(
  ctx: AccessContext,
  body: { organizationId?: string; legalEntityId: string; role: string; accountId: string },
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.ACCOUNTING_MANAGE_ACCOUNTS)
  const organizationId = resolveAccountingOrganization(ctx, body.organizationId)
  const role = body.role.toUpperCase() as AccountRole
  if (!(Object.values(ACCOUNT_ROLES) as string[]).includes(role)) {
    throw invalidField('role', 'Unsupported account role.')
  }
  const account = await findAccountById(body.accountId)
  if (!account || account.organizationId !== organizationId) throw notFound('Account was not found.')
  const mapping = await upsertAccountMapping({
    organizationId,
    legalEntityId: body.legalEntityId,
    role,
    accountId: body.accountId,
    updatedBy: ctx.userId,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.MAPPING_UPDATE,
    entityType: AUDIT_ENTITY_TYPES.ACCOUNT_MAPPING,
    entityId: String((mapping as { _id: { toString(): string } })._id),
    actorUserId: ctx.userId,
    organizationId,
    metadata: { role, accountId: body.accountId },
    meta,
  })
  return {
    id: String((mapping as { _id: { toString(): string } })._id),
    role: toPublicEnum(role),
    accountId: body.accountId,
  }
}

export async function getAccountingOverview(
  ctx: AccessContext,
  query: { organizationId?: string; legalEntityId?: string },
) {
  assertPermission(ctx, PERMISSIONS.ACCOUNTING_VIEW)
  const organizationId = resolveAccountingOrganization(ctx, query.organizationId)
  const periods = await listFiscalPeriods(organizationId, query.legalEntityId)
  const openPeriod = periods.find((period) => period.status === 'OPEN')
  const recent = await listJournals({
    organizationId,
    legalEntityId: query.legalEntityId,
    skip: 0,
    take: 8,
    sort: 'createdAt',
    order: 'desc',
  })
  const posted = recent.items.filter((row) => row.status === 'POSTED')
  return {
    currentPeriod: openPeriod
      ? {
          id: openPeriod.id,
          name: openPeriod.name,
          status: toPublicEnum(openPeriod.status),
          startDate: openPeriod.startDate.toISOString(),
          endDate: openPeriod.endDate.toISOString(),
        }
      : null,
    recentJournals: recent.items.map((row) => ({
      id: row.id,
      journalNumber: row.journalNumber,
      description: row.description,
      status: toPublicEnum(row.status),
      totalDebit: row.totalDebit,
      totalCredit: row.totalCredit,
      accountingDate: row.accountingDate.toISOString(),
    })),
    periodPostedDebit: posted.reduce((sum, row) => addMoney(sum, row.totalDebit), '0.00'),
    periodPostedCredit: posted.reduce((sum, row) => addMoney(sum, row.totalCredit), '0.00'),
    openPeriodCount: periods.filter((period) => period.status === 'OPEN').length,
    closedPeriodCount: periods.filter((period) => period.status === 'CLOSED').length,
  }
}
