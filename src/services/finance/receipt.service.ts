import { PERMISSIONS } from '../../constants/permissions.js'
import { listReceipts } from '../../repositories/finance/finance.repository.js'
import type { AccessContext } from '../../types/access.js'
import { notFound } from '../../utils/httpErrors.js'
import { resolvePagination, toPaginated } from '../../utils/pagination.js'
import { assertPermission, hasBranchAccess } from '../authorization/authorization.service.js'
import { DOC_STATUSES, type DocStatus } from '../../constants/finance.js'
import {
  isOrganizationWide,
  loadAccessibleReceipt,
  resolveFinanceOrganization,
} from './finance-access.js'
import { toReceiptResource } from './finance.mapper.js'

type ListQuery = {
  organizationId?: string
  search?: string
  status?: string
  branchId?: string
  customerId?: string
  paymentId?: string
  issuedFrom?: Date
  issuedTo?: Date
  order?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  limit?: number
}

export async function listReceiptDirectory(ctx: AccessContext, query: ListQuery) {
  assertPermission(ctx, PERMISSIONS.RECEIPT_VIEW)
  const organizationId = resolveFinanceOrganization(ctx, query.organizationId)
  if (query.branchId && !hasBranchAccess(ctx, query.branchId, organizationId)) {
    throw notFound('Branch was not found.')
  }
  const orgWide = isOrganizationWide(ctx)
  const pagination = resolvePagination(query)
  const page = await listReceipts({
    organizationId,
    branchIds: orgWide ? undefined : [...ctx.branchIds],
    legalEntityIds: !orgWide && ctx.legalEntityIds.length > 0 ? [...ctx.legalEntityIds] : undefined,
    skip: pagination.skip,
    take: pagination.take,
    search: query.search,
    status: query.status ? (query.status.toUpperCase() as DocStatus) : undefined,
    branchId: query.branchId,
    customerId: query.customerId,
    paymentId: query.paymentId,
    issuedFrom: query.issuedFrom,
    issuedTo: query.issuedTo,
    order: query.order ?? 'desc',
  })
  void DOC_STATUSES
  return toPaginated(page.items.map(toReceiptResource), pagination.page, pagination.limit, page.total)
}

export async function getReceipt(ctx: AccessContext, id: string) {
  assertPermission(ctx, PERMISSIONS.RECEIPT_VIEW)
  return toReceiptResource(await loadAccessibleReceipt(ctx, id))
}
