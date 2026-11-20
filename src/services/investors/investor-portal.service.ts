import { INVESTOR_REPORT_KEYS, type InvestorReportKey } from '../../constants/investors.js'
import { PERMISSIONS } from '../../constants/permissions.js'
import { CONTRACT_STATUSES } from '../../constants/contracts.js'
import { toPublicEnum } from '../../constants/vehicles.js'
import type { InvestorRecord } from '../../repositories/investors/investor.repository.js'
import { updateInvestor } from '../../repositories/investors/investor.repository.js'
import * as reportRepo from '../../repositories/reporting/reporting.repository.js'
import { findVehicleById } from '../../repositories/vehicles/vehicle.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import { resolvePagination, toPaginated } from '../../utils/pagination.js'
import { forbiddenError, invalidField, notFound } from '../../utils/httpErrors.js'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, recordAuditEvent } from '../audit/audit.service.js'
import { assertPermission } from '../authorization/authorization.service.js'
import { resolveReportDateRange } from '../reporting/date-range.js'
import { toInvestorProfileResource } from './investor.mapper.js'
import {
  canAccessReport,
  canAccessVehicleId,
  resolveEffectiveScope,
  toReportingScope,
  type InvestorEffectiveScope,
} from './investor-scope.js'

function requireScope(investor: InvestorRecord): InvestorEffectiveScope {
  return resolveEffectiveScope(investor)
}

function emptyOverview(investor: InvestorRecord, generatedAt: string) {
  return {
    generatedAt,
    investor: toInvestorProfileResource(investor),
    kpis: {
      fleetSize: 0,
      activeVehicles: 0,
      utilizationPercent: null as number | null,
      revenue: null as string | null,
      currency: null as string | null,
      activeContracts: 0,
      averageRevenuePerVehicle: null as string | null,
    },
    charts: {
      fleetStatus: {} as Record<string, number>,
      revenueTrend: [] as Array<{ period: string; amount: string; count: number }>,
    },
    permissions: {
      financial: false,
      reports: investor.scope.reportKeys.map((key) => key.toLowerCase()),
    },
  }
}

async function buildInvestorOverview(
  ctx: AccessContext,
  investor: InvestorRecord,
  query: { preset?: string; from?: Date; to?: Date; timezone?: string },
) {
  const generatedAt = new Date().toISOString()
  const effective = requireScope(investor)
  const reportingScope = toReportingScope(effective)
  if (!reportingScope) return emptyOverview(investor, generatedAt)

  const range = resolveReportDateRange({
    preset: query.preset,
    from: query.from,
    to: query.to,
    timezone: query.timezone,
  })

  const financialAllowed = ctx.permissions.has(PERMISSIONS.INVESTOR_VIEW_FINANCIAL)

  const [fleet, utilization, contracts, revenue, revenueTrend] = await Promise.all([
    reportRepo.fleetStatusCounts(reportingScope),
    reportRepo.fleetUtilizationSnapshot(reportingScope),
    reportRepo.countActiveContracts(reportingScope),
    financialAllowed
      ? reportRepo.sumPostedInvoiceRevenue(reportingScope, range.from, range.toExclusive)
      : Promise.resolve({ amount: null as string | null, count: 0, currency: null }),
    financialAllowed
      ? reportRepo.revenueTrend(reportingScope, range.from, range.toExclusive, 'DAY')
      : Promise.resolve([]),
  ])

  // When vehicleIds are explicit, re-filter counts via vehicle report page size.
  let fleetSize = Object.values(fleet).reduce((a, b) => a + b, 0)
  let rented = utilization.rented
  let eligible = utilization.eligible
  let utilizationPercent = utilization.utilizationPercent
  if (effective.vehicleIds.length > 0) {
    const page = await reportRepo.listVehiclesReport(reportingScope, {
      skip: 0,
      take: 500,
      sort: 'plateNumber',
      order: 'asc',
    })
    const allowed = page.items.filter((row) =>
      canAccessVehicleId(effective, {
        id: row.id,
        branchId: row.branchId,
        legalEntityId: row.legalEntityId,
        organizationId: investor.organizationId,
      }),
    )
    fleetSize = allowed.length
    rented = allowed.filter((row) => row.status === 'RENTED').length
    eligible = allowed.filter((row) => row.status !== 'INACTIVE' && row.status !== 'OUT_OF_SERVICE').length
    utilizationPercent = eligible === 0 ? null : Math.round((rented / eligible) * 10000) / 100
  }

  const avg =
    financialAllowed && fleetSize > 0 && revenue.amount
      ? (Number(revenue.amount) / fleetSize).toFixed(2)
      : null

  return {
    generatedAt,
    investor: toInvestorProfileResource(investor),
    kpis: {
      fleetSize,
      activeVehicles: rented,
      utilizationPercent,
      revenue: financialAllowed ? revenue.amount : null,
      currency: financialAllowed ? revenue.currency : null,
      activeContracts: contracts,
      averageRevenuePerVehicle: avg,
    },
    charts: {
      fleetStatus: Object.fromEntries(Object.entries(fleet).map(([k, v]) => [k.toLowerCase(), v])),
      revenueTrend,
    },
    permissions: {
      financial: financialAllowed,
      reports: effective.reportKeys.map((key) => key.toLowerCase()),
    },
  }
}

export async function getInvestorOverview(
  ctx: AccessContext,
  investor: InvestorRecord,
  query: { preset?: string; from?: Date; to?: Date; timezone?: string },
) {
  assertPermission(ctx, PERMISSIONS.INVESTOR_VIEW_OVERVIEW)
  return buildInvestorOverview(ctx, investor, query)
}

export async function listInvestorFleet(
  ctx: AccessContext,
  investor: InvestorRecord,
  query: { page?: number; pageSize?: number; status?: string; category?: string },
) {
  assertPermission(ctx, PERMISSIONS.INVESTOR_VIEW_FLEET)
  const effective = requireScope(investor)
  const reportingScope = toReportingScope(effective)
  if (!reportingScope) {
    return toPaginated([], 1, 20, 0)
  }
  const pagination = resolvePagination(query)
  const page = await reportRepo.listVehiclesReport(reportingScope, {
    status: query.status?.toUpperCase(),
    category: query.category?.toUpperCase(),
    skip: 0,
    take: 500,
    sort: 'plateNumber',
    order: 'asc',
  })
  const filtered = page.items.filter((row) =>
    canAccessVehicleId(effective, {
      id: row.id,
      branchId: row.branchId,
      legalEntityId: row.legalEntityId,
      organizationId: investor.organizationId,
    }),
  )
  const slice = filtered.slice(pagination.skip, pagination.skip + pagination.take)
  return toPaginated(
    slice.map((row) => ({
      id: row.id,
      plateNumber: row.plateNumber,
      make: row.make,
      model: row.model,
      year: row.year,
      category: toPublicEnum(row.category as never),
      status: toPublicEnum(row.status as never),
      branchId: row.branchId,
      legalEntityId: row.legalEntityId,
      currentContractNumber: row.currentContractNumber,
      available: row.available,
    })),
    pagination.page,
    pagination.limit,
    filtered.length,
  )
}

export async function getInvestorVehicle(ctx: AccessContext, investor: InvestorRecord, vehicleId: string) {
  assertPermission(ctx, PERMISSIONS.INVESTOR_VIEW_FLEET)
  const effective = requireScope(investor)
  const vehicle = await findVehicleById(vehicleId)
  if (
    !vehicle ||
    !canAccessVehicleId(effective, {
      id: vehicle.id,
      branchId: vehicle.branchId,
      legalEntityId: vehicle.legalEntityId,
      organizationId: vehicle.organizationId,
    })
  ) {
    throw notFound('Vehicle was not found.')
  }
  return {
    id: vehicle.id,
    plateNumber: vehicle.plateNumber,
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year,
    category: toPublicEnum(vehicle.category as never),
    status: toPublicEnum(vehicle.status as never),
    branchId: vehicle.branchId,
    legalEntityId: vehicle.legalEntityId,
  }
}

export async function getInvestorPerformance(
  ctx: AccessContext,
  investor: InvestorRecord,
  query: { preset?: string; from?: Date; to?: Date; timezone?: string },
) {
  assertPermission(ctx, PERMISSIONS.INVESTOR_VIEW_PERFORMANCE)
  const overview = await buildInvestorOverview(ctx, investor, query)
  return {
    generatedAt: overview.generatedAt,
    metrics: overview.kpis,
    fleetStatus: overview.charts.fleetStatus,
  }
}

export async function getInvestorFinancialSummary(
  ctx: AccessContext,
  investor: InvestorRecord,
  query: { preset?: string; from?: Date; to?: Date; timezone?: string },
) {
  assertPermission(ctx, PERMISSIONS.INVESTOR_VIEW_FINANCIAL)
  const effective = requireScope(investor)
  const reportingScope = toReportingScope(effective)
  if (!reportingScope) {
    return {
      generatedAt: new Date().toISOString(),
      revenue: '0.00',
      currency: null as string | null,
      payments: '0.00',
      outstandingReceivables: '0.00',
      note: 'No data in investor scope.',
      expensesAvailable: false,
      netPerformanceAvailable: false,
    }
  }
  const range = resolveReportDateRange({
    preset: query.preset,
    from: query.from,
    to: query.to,
    timezone: query.timezone,
  })
  const [revenue, payments, receivables] = await Promise.all([
    reportRepo.sumPostedInvoiceRevenue(reportingScope, range.from, range.toExclusive),
    reportRepo.sumCompletedPayments(reportingScope, range.from, range.toExclusive),
    reportRepo.sumOutstandingReceivables(reportingScope),
  ])
  return {
    generatedAt: new Date().toISOString(),
    revenue: revenue.amount,
    currency: revenue.currency,
    invoiceCount: revenue.count,
    payments: payments.amount,
    paymentCount: payments.count,
    outstandingReceivables: receivables.amount,
    note: 'Operational finance projection from posted invoices/payments. Full GL is not exposed.',
    expensesAvailable: false,
    netPerformanceAvailable: false,
  }
}

export async function listInvestorContracts(
  ctx: AccessContext,
  investor: InvestorRecord,
  query: { page?: number; pageSize?: number; status?: string },
) {
  assertPermission(ctx, PERMISSIONS.INVESTOR_VIEW_CONTRACTS)
  const effective = requireScope(investor)
  const reportingScope = toReportingScope(effective)
  if (!reportingScope) return toPaginated([], 1, 20, 0)
  const pagination = resolvePagination(query)
  const page = await reportRepo.listContractsReport(reportingScope, {
    status: query.status?.toUpperCase() ?? CONTRACT_STATUSES.ACTIVE,
    skip: 0,
    take: 500,
    sort: 'startsAt',
    order: 'desc',
  })
  const filtered = page.items.filter((row) => {
    if (effective.branchIds.length > 0 && !effective.branchIds.includes(row.branchId)) return false
    if (effective.vehicleIds.length > 0) {
      if (!row.vehicleId || !effective.vehicleIds.includes(row.vehicleId)) return false
    }
    return true
  })
  const slice = filtered.slice(pagination.skip, pagination.skip + pagination.take)
  return toPaginated(
    slice.map((row) => ({
      id: row.id,
      contractNumber: row.contractNumber,
      vehiclePlate: row.vehiclePlate,
      vehicleId: row.vehicleId,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      status: toPublicEnum(row.status as never),
      branchId: row.branchId,
      // Customer PII withheld from investor projection.
      customerName: null as string | null,
      outstandingBalance: row.outstandingBalance,
      currency: row.currency,
    })),
    pagination.page,
    pagination.limit,
    filtered.length,
  )
}

export async function listInvestorReports(ctx: AccessContext, investor: InvestorRecord) {
  assertPermission(ctx, PERMISSIONS.INVESTOR_VIEW_REPORTS)
  const effective = requireScope(investor)
  return {
    items: Object.values(INVESTOR_REPORT_KEYS).map((key) => ({
      key: key.toLowerCase(),
      allowed: canAccessReport(effective, key),
    })),
  }
}

export async function runInvestorReport(
  ctx: AccessContext,
  investor: InvestorRecord,
  keyRaw: string,
  query: { preset?: string; from?: Date; to?: Date; timezone?: string },
) {
  assertPermission(ctx, PERMISSIONS.INVESTOR_VIEW_REPORTS)
  const key = keyRaw.toUpperCase() as InvestorReportKey
  if (!Object.values(INVESTOR_REPORT_KEYS).includes(key)) throw notFound('Report was not found.')
  const effective = requireScope(investor)
  if (!canAccessReport(effective, key)) throw forbiddenError('You do not have access to this report.')

  switch (key) {
    case INVESTOR_REPORT_KEYS.FLEET_PERFORMANCE:
    case INVESTOR_REPORT_KEYS.UTILIZATION:
    case INVESTOR_REPORT_KEYS.VEHICLE_PERFORMANCE:
      return getInvestorPerformance(ctx, investor, query)
    case INVESTOR_REPORT_KEYS.REVENUE_SUMMARY:
    case INVESTOR_REPORT_KEYS.FINANCIAL_SUMMARY:
      return getInvestorFinancialSummary(ctx, investor, query)
    case INVESTOR_REPORT_KEYS.CONTRACT_PERFORMANCE:
      return listInvestorContracts(ctx, investor, {})
    default:
      throw notFound('Report was not found.')
  }
}

export async function exportInvestorReportCsv(
  ctx: AccessContext,
  investor: InvestorRecord,
  keyRaw: string,
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.INVESTOR_EXPORT)
  const key = keyRaw.toUpperCase() as InvestorReportKey
  const effective = requireScope(investor)
  if (!canAccessReport(effective, key)) throw forbiddenError('You do not have access to this report.')

  let rows: Array<Record<string, unknown>> = []
  let headers: string[] = []

  if (
    key === INVESTOR_REPORT_KEYS.FLEET_PERFORMANCE ||
    key === INVESTOR_REPORT_KEYS.VEHICLE_PERFORMANCE ||
    key === INVESTOR_REPORT_KEYS.UTILIZATION
  ) {
    const fleet = await listInvestorFleet(ctx, investor, { page: 1, pageSize: 100 })
    headers = ['plateNumber', 'make', 'model', 'category', 'status', 'branchId']
    rows = fleet.items as Array<Record<string, unknown>>
  } else if (key === INVESTOR_REPORT_KEYS.CONTRACT_PERFORMANCE) {
    const contracts = await listInvestorContracts(ctx, investor, { page: 1, pageSize: 100 })
    headers = ['contractNumber', 'vehiclePlate', 'status', 'startsAt', 'endsAt', 'branchId']
    rows = contracts.items as Array<Record<string, unknown>>
  } else {
    const summary = await getInvestorFinancialSummary(ctx, investor, {})
    headers = ['revenue', 'payments', 'outstandingReceivables', 'currency']
    rows = [summary as unknown as Record<string, unknown>]
  }

  const escape = (value: unknown) => {
    const text = value == null ? '' : String(value)
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  const body = [headers.join(','), ...rows.map((row) => headers.map((h) => escape(row[h])).join(','))].join('\n') + '\n'

  await recordAuditEvent({
    action: AUDIT_ACTIONS.INVESTOR_EXPORT,
    entityType: AUDIT_ENTITY_TYPES.INVESTOR,
    entityId: investor.id,
    actorUserId: ctx.userId,
    organizationId: investor.organizationId,
    metadata: { report: key, rowCount: rows.length, format: 'csv' },
    meta,
  })

  return {
    filename: `investor-${key.toLowerCase()}.csv`,
    contentType: 'text/csv; charset=utf-8',
    body,
  }
}

export async function getInvestorPortalProfile(ctx: AccessContext, investor: InvestorRecord) {
  assertPermission(ctx, PERMISSIONS.INVESTOR_PORTAL)
  return toInvestorProfileResource(investor)
}

export async function updateInvestorPortalProfile(
  ctx: AccessContext,
  investor: InvestorRecord,
  body: { displayName?: string; phone?: string | null },
) {
  assertPermission(ctx, PERMISSIONS.PROFILE_UPDATE)
  if (body.displayName !== undefined && body.displayName.trim().length < 2) {
    throw invalidField('displayName', 'Name must be at least 2 characters.')
  }
  const updated = await updateInvestor(investor.id, {
    displayName: body.displayName?.trim(),
    phone: body.phone === null ? null : body.phone,
  })
  return toInvestorProfileResource(updated!)
}

export function getInvestorFilterOptions(investor: InvestorRecord) {
  const effective = requireScope(investor)
  return {
    branchIds: effective.branchIds,
    legalEntityIds: effective.legalEntityIds,
    vehicleIds: effective.vehicleIds,
    reportKeys: effective.reportKeys.map((key) => key.toLowerCase()),
  }
}
