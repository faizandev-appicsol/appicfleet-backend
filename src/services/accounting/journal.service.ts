import type { JournalStatus, JournalType } from '../../constants/accounting.js'
import { PERMISSIONS } from '../../constants/permissions.js'
import { listJournals } from '../../repositories/accounting/accounting.repository.js'
import type { AccessContext } from '../../types/access.js'
import { notFound } from '../../utils/httpErrors.js'
import { resolvePagination, toPaginated } from '../../utils/pagination.js'
import { assertPermission, hasBranchAccess } from '../authorization/authorization.service.js'
import { isOrganizationWide, loadAccessibleJournal, resolveAccountingOrganization } from './accounting-access.js'
import { toJournalResource } from './accounting.mapper.js'
import { journalDetail } from './posting.service.js'

export async function listJournalDirectory(ctx: AccessContext, query: Record<string, unknown>) {
  assertPermission(ctx, PERMISSIONS.ACCOUNTING_VIEW)
  const organizationId = resolveAccountingOrganization(ctx, query.organizationId as string | undefined)
  if (query.branchId && !hasBranchAccess(ctx, String(query.branchId), organizationId)) {
    throw notFound('Branch was not found.')
  }
  const orgWide = isOrganizationWide(ctx)
  const pagination = resolvePagination(query)
  const page = await listJournals({
    organizationId,
    branchIds: orgWide ? undefined : [...ctx.branchIds],
    legalEntityIds: !orgWide && ctx.legalEntityIds.length > 0 ? [...ctx.legalEntityIds] : undefined,
    skip: pagination.skip,
    take: pagination.take,
    search: query.search as string | undefined,
    status: query.status ? (String(query.status).toUpperCase() as JournalStatus) : undefined,
    journalType: query.journalType ? (String(query.journalType).toUpperCase() as JournalType) : undefined,
    branchId: query.branchId as string | undefined,
    legalEntityId: query.legalEntityId as string | undefined,
    sourceModule: query.sourceModule as string | undefined,
    accountingFrom: query.accountingFrom as Date | undefined,
    accountingTo: query.accountingTo as Date | undefined,
    sort: (query.sort as 'createdAt') ?? 'createdAt',
    order: (query.order as 'asc' | 'desc') ?? 'desc',
  })
  return toPaginated(page.items.map(toJournalResource), pagination.page, pagination.limit, page.total)
}

export async function getJournal(ctx: AccessContext, id: string) {
  assertPermission(ctx, PERMISSIONS.ACCOUNTING_VIEW)
  return journalDetail(await loadAccessibleJournal(ctx, id))
}
