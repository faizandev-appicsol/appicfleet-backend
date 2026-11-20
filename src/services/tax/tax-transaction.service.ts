import { TAX_PRICING_MODES, TAX_SOURCE_TYPES, TAX_TREATMENTS } from '../../constants/tax.js'
import { PERMISSIONS } from '../../constants/permissions.js'
import {
  findOpenTaxPeriodForDate,
  insertTaxTransaction,
  listTaxTransactions,
} from '../../repositories/tax/tax.repository.js'
import { emitAccountingSourceEvent } from '../../repositories/procurement/procurement.repository.js'
import type { AccessContext } from '../../types/access.js'
import { resolvePagination, toPaginated } from '../../utils/pagination.js'
import { assertPermission } from '../authorization/authorization.service.js'
import { addMoney } from '../../utils/money.js'
import { resolveTaxOrganization } from './tax-access.js'
import { toTaxTransactionResource } from './tax.mapper.js'

export async function listTaxTransactionDirectory(ctx: AccessContext, query: Record<string, unknown>) {
  assertPermission(ctx, PERMISSIONS.TAX_VIEW)
  const organizationId = resolveTaxOrganization(ctx, query.organizationId as string | undefined)
  const pagination = resolvePagination(query)
  const filter: Record<string, unknown> = { organizationId }
  if (query.legalEntityId) filter.legalEntityId = query.legalEntityId
  if (query.branchId) filter.branchId = query.branchId
  if (query.taxPeriodId) filter.taxPeriodId = query.taxPeriodId
  if (query.taxCode) filter.taxCode = String(query.taxCode).toUpperCase()
  if (query.sourceType) filter.sourceType = String(query.sourceType).toUpperCase()
  if (query.customerId) filter.customerId = query.customerId
  if (typeof query.search === 'string' && query.search.trim()) {
    filter.documentNumber = new RegExp(query.search.trim(), 'i')
  }
  const page = await listTaxTransactions(filter, pagination.skip, pagination.take)
  return toPaginated(page.items.map(toTaxTransactionResource), pagination.page, pagination.limit, page.total)
}

type SnapshotLine = {
  taxCode: string
  taxCodeId?: string
  taxRatePercent: string
  taxTreatment: string
  taxableAmount: string
  taxAmount: string
  grossAmount: string
  pricingMode?: string
}

/** Immutable tax snapshots for a posted finance document. Idempotent per source + tax code. */
export async function recordTaxSnapshots(input: {
  organizationId: string
  legalEntityId: string
  branchId: string
  sourceType: string
  sourceId: string
  documentNumber?: string
  customerId?: string
  customerDisplayName?: string
  transactionDate: Date
  currency: string
  lines: SnapshotLine[]
  actorUserId?: string
}) {
  const period = await findOpenTaxPeriodForDate(input.organizationId, input.legalEntityId, input.transactionDate)
  const byCode = new Map<string, SnapshotLine>()
  for (const line of input.lines) {
    const key = `${line.taxCode}|${line.taxRatePercent}|${line.taxTreatment}`
    const current = byCode.get(key)
    if (!current) {
      byCode.set(key, { ...line })
      continue
    }
    byCode.set(key, {
      ...current,
      taxableAmount: addMoney(current.taxableAmount, line.taxableAmount),
      taxAmount: addMoney(current.taxAmount, line.taxAmount),
      grossAmount: addMoney(current.grossAmount, line.grossAmount),
    })
  }

  const created = []
  for (const line of byCode.values()) {
    const idempotencyKey = `tax.tx:${input.sourceType}:${input.sourceId}:${line.taxCode}:${line.taxRatePercent}`
    const row = await insertTaxTransaction({
      organizationId: input.organizationId,
      legalEntityId: input.legalEntityId,
      branchId: input.branchId,
      sourceType: input.sourceType.toUpperCase(),
      sourceId: input.sourceId,
      documentNumber: input.documentNumber,
      customerId: input.customerId,
      customerDisplayName: input.customerDisplayName,
      transactionDate: input.transactionDate,
      taxCodeId: line.taxCodeId,
      taxCode: line.taxCode.toUpperCase(),
      taxRatePercent: line.taxRatePercent,
      taxTreatment: (line.taxTreatment || TAX_TREATMENTS.STANDARD_RATED).toUpperCase(),
      taxableAmount: line.taxableAmount,
      taxAmount: line.taxAmount,
      grossAmount: line.grossAmount,
      currency: input.currency,
      taxPeriodId: period?.id,
      pricingMode: (line.pricingMode || TAX_PRICING_MODES.EXCLUSIVE).toUpperCase(),
      idempotencyKey,
      createdBy: input.actorUserId,
    })
    created.push(row)
    await emitAccountingSourceEvent({
      organizationId: input.organizationId,
      eventType: 'tax.transaction.created',
      entityType: 'tax_transaction',
      entityId: row.id,
      idempotencyKey: `tax.transaction.created:${row.id}`,
      payload: {
        taxTransactionId: row.id,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        taxAmount: line.taxAmount,
      },
    })
  }
  return created.map(toTaxTransactionResource)
}

export async function recordInvoiceTaxSnapshots(invoice: {
  id: string
  organizationId: string
  legalEntityId: string
  branchId: string
  documentNumber?: string
  customerId: string
  customerDisplayName: string
  documentDate: Date
  currency: string
  lines: Array<{
    taxCode?: string
    taxCodeId?: string
    taxRatePercent: string
    taxTreatment?: string
    taxableAmount: string
    taxAmount: string
    lineTotal: string
    pricingMode?: string
  }>
  actorUserId?: string
}) {
  return recordTaxSnapshots({
    organizationId: invoice.organizationId,
    legalEntityId: invoice.legalEntityId,
    branchId: invoice.branchId,
    sourceType: TAX_SOURCE_TYPES.INVOICE,
    sourceId: invoice.id,
    documentNumber: invoice.documentNumber,
    customerId: invoice.customerId,
    customerDisplayName: invoice.customerDisplayName,
    transactionDate: invoice.documentDate,
    currency: invoice.currency,
    actorUserId: invoice.actorUserId,
    lines: invoice.lines.map((line) => ({
      taxCode: line.taxCode || 'STANDARD',
      taxCodeId: line.taxCodeId,
      taxRatePercent: line.taxRatePercent,
      taxTreatment: line.taxTreatment || TAX_TREATMENTS.STANDARD_RATED,
      taxableAmount: line.taxableAmount,
      taxAmount: line.taxAmount,
      grossAmount: line.lineTotal,
      pricingMode: line.pricingMode,
    })),
  })
}
