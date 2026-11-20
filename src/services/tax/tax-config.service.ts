import { EINVOICE_ENVIRONMENTS, EINVOICE_PROVIDERS, TAX_PRICING_MODES, VAT_REGISTRATION_STATUSES } from '../../constants/tax.js'
import { PERMISSIONS } from '../../constants/permissions.js'
import {
  countEInvoicesByStatus,
  findTaxConfiguration,
  listTaxPeriods,
  listTaxTransactions,
  upsertTaxConfiguration,
} from '../../repositories/tax/tax.repository.js'
import type { AccessContext } from '../../types/access.js'
import type { RequestMeta } from '../../types/http.js'
import { addMoney, normalizeMoney } from '../../utils/money.js'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, recordAuditEvent } from '../audit/audit.service.js'
import { assertPermission } from '../authorization/authorization.service.js'
import { resolveTaxOrganization } from './tax-access.js'
import { toTaxConfigurationResource, toTaxPeriodResource } from './tax.mapper.js'

export async function getTaxConfiguration(ctx: AccessContext, legalEntityId: string, organizationId?: string) {
  assertPermission(ctx, PERMISSIONS.TAX_VIEW)
  const orgId = resolveTaxOrganization(ctx, organizationId)
  const row = await findTaxConfiguration(orgId, legalEntityId)
  if (!row) {
    return {
      organizationId: orgId,
      legalEntityId,
      vatRegistrationStatus: 'not_registered',
      defaultPricingMode: 'exclusive',
      einvoicingEnabled: false,
      einvoiceEnvironment: 'sandbox',
    }
  }
  return toTaxConfigurationResource(row)
}

export async function updateTaxConfiguration(
  ctx: AccessContext,
  body: {
    organizationId?: string
    legalEntityId: string
    vatRegistrationStatus?: string
    vatRegistrationNumber?: string
    registeredName?: string
    registeredAddress?: string
    vatEffectiveDate?: Date
    defaultTaxCodeId?: string
    defaultPricingMode?: string
    einvoicingEnabled?: boolean
    einvoiceProvider?: string
    einvoiceEnvironment?: string
  },
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.EINVOICE_MANAGE_SETTINGS)
  const organizationId = resolveTaxOrganization(ctx, body.organizationId)
  const updated = await upsertTaxConfiguration(organizationId, body.legalEntityId, {
    vatRegistrationStatus: (body.vatRegistrationStatus ?? VAT_REGISTRATION_STATUSES.NOT_REGISTERED).toUpperCase(),
    vatRegistrationNumber: body.vatRegistrationNumber,
    registeredName: body.registeredName,
    registeredAddress: body.registeredAddress,
    vatEffectiveDate: body.vatEffectiveDate,
    defaultTaxCodeId: body.defaultTaxCodeId,
    defaultPricingMode: (body.defaultPricingMode ?? TAX_PRICING_MODES.EXCLUSIVE).toUpperCase(),
    einvoicingEnabled: body.einvoicingEnabled ?? false,
    einvoiceProvider: body.einvoiceProvider
      ? body.einvoiceProvider.toUpperCase()
      : EINVOICE_PROVIDERS.SANDBOX,
    einvoiceEnvironment: (body.einvoiceEnvironment ?? EINVOICE_ENVIRONMENTS.SANDBOX).toUpperCase(),
    updatedBy: ctx.userId,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.TAX_CONFIG_UPDATE,
    entityType: AUDIT_ENTITY_TYPES.TAX_CONFIGURATION,
    entityId: updated?.id,
    actorUserId: ctx.userId,
    organizationId,
    meta,
    metadata: { legalEntityId: body.legalEntityId },
  })
  return toTaxConfigurationResource(updated!)
}

export async function getTaxOverview(ctx: AccessContext, query: { organizationId?: string; legalEntityId?: string }) {
  assertPermission(ctx, PERMISSIONS.TAX_VIEW)
  const organizationId = resolveTaxOrganization(ctx, query.organizationId)
  const periodFilter: Record<string, unknown> = { organizationId, status: 'OPEN' }
  if (query.legalEntityId) periodFilter.legalEntityId = query.legalEntityId
  const periods = await listTaxPeriods(periodFilter)
  const currentPeriod = periods[0] ? toTaxPeriodResource(periods[0]) : null

  const txFilter: Record<string, unknown> = { organizationId }
  if (query.legalEntityId) txFilter.legalEntityId = query.legalEntityId
  if (currentPeriod) txFilter.taxPeriodId = currentPeriod.id
  const tx = await listTaxTransactions(txFilter, 0, 5000)

  let taxableSales = '0.00'
  let outputVat = '0.00'
  let adjustments = '0.00'
  for (const row of tx.items) {
    const source = String(row.sourceType)
    if (source === 'CREDIT_NOTE') {
      adjustments = addMoney(adjustments, normalizeMoney(String(row.taxAmount)))
      continue
    }
    taxableSales = addMoney(taxableSales, normalizeMoney(String(row.taxableAmount)))
    outputVat = addMoney(outputVat, normalizeMoney(String(row.taxAmount)))
  }

  const einvoiceStatusCounts = await countEInvoicesByStatus(organizationId, query.legalEntityId)
  return {
    currentPeriod,
    taxableSales,
    outputVat,
    adjustments,
    transactionCount: tx.total,
    openIssues: 0,
    einvoiceStatusCounts,
  }
}

export async function getVatReport(ctx: AccessContext, query: { organizationId?: string; legalEntityId: string; taxPeriodId?: string }) {
  assertPermission(ctx, PERMISSIONS.TAX_VIEW_REPORTS)
  const organizationId = resolveTaxOrganization(ctx, query.organizationId)
  const filter: Record<string, unknown> = { organizationId, legalEntityId: query.legalEntityId }
  if (query.taxPeriodId) filter.taxPeriodId = query.taxPeriodId
  const page = await listTaxTransactions(filter, 0, 10000)
  const grouped = new Map<
    string,
    { taxCode: string; taxTreatment: string; sourceType: string; taxableAmount: string; taxAmount: string; grossAmount: string; count: number }
  >()
  for (const row of page.items) {
    const taxCode = String(row.taxCode)
    const taxTreatment = String(row.taxTreatment)
    const sourceType = String(row.sourceType)
    const key = `${taxCode}|${taxTreatment}|${sourceType}`
    const current = grouped.get(key) ?? {
      taxCode,
      taxTreatment,
      sourceType,
      taxableAmount: '0.00',
      taxAmount: '0.00',
      grossAmount: '0.00',
      count: 0,
    }
    grouped.set(key, {
      ...current,
      taxableAmount: addMoney(current.taxableAmount, normalizeMoney(String(row.taxableAmount))),
      taxAmount: addMoney(current.taxAmount, normalizeMoney(String(row.taxAmount))),
      grossAmount: addMoney(current.grossAmount, normalizeMoney(String(row.grossAmount))),
      count: current.count + 1,
    })
  }
  return {
    legalEntityId: query.legalEntityId,
    taxPeriodId: query.taxPeriodId,
    rows: [...grouped.values()],
    note: 'Aggregated from immutable tax transaction snapshots. Not a filed tax return.',
  }
}
