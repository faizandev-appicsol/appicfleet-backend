import { BOOKING_STATUSES } from '../../constants/bookings.js'
import { REVENUE_GROUP_BY, type RevenueGroupBy } from '../../constants/reporting.js'
import { toPublicEnum } from '../../constants/vehicles.js'
import * as repo from '../../repositories/reporting/reporting.repository.js'
import type { AccessContext } from '../../types/access.js'
import { resolvePagination, toPaginated } from '../../utils/pagination.js'
import { getVatReport } from '../tax/tax-config.service.js'
import {
  assertFinancialReports,
  assertOperationalReports,
  assertReportsAccess,
  resolveReportScope,
} from './reporting-access.js'
import { resolveReportDateRange, resolveUpcomingWindow } from './date-range.js'

type CommonQuery = {
  organizationId?: string
  branchId?: string
  legalEntityId?: string
  preset?: string
  from?: Date
  to?: Date
  timezone?: string
  page?: number
  pageSize?: number
  limit?: number
  sort?: string
  order?: 'asc' | 'desc'
}

function rangeFrom(query: CommonQuery) {
  return resolveReportDateRange({
    preset: query.preset,
    from: query.from,
    to: query.to,
    timezone: query.timezone,
  })
}

function pickGroupBy(from: Date, toExclusive: Date): RevenueGroupBy {
  const days = (toExclusive.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)
  if (days <= 14) return REVENUE_GROUP_BY.DAY
  if (days <= 90) return REVENUE_GROUP_BY.WEEK
  return REVENUE_GROUP_BY.MONTH
}

export async function getReportsOverview(ctx: AccessContext, query: CommonQuery) {
  assertReportsAccess(ctx)
  const scope = resolveReportScope(ctx, query)
  const range = rangeFrom(query)
  const groupBy = pickGroupBy(range.from, range.toExclusive)
  const [bookingStatuses, fleet, contracts, revenue, utilization] = await Promise.all([
    repo.countBookingsByStatus(scope, range.from, range.toExclusive),
    repo.fleetStatusCounts(scope),
    repo.countContractsByStatus(scope),
    repo.sumPostedInvoiceRevenue(scope, range.from, range.toExclusive),
    repo.fleetUtilizationSnapshot(scope),
  ])
  return {
    generatedAt: new Date().toISOString(),
    range: {
      from: range.from.toISOString(),
      toExclusive: range.toExclusive.toISOString(),
      preset: range.preset.toLowerCase(),
    },
    bookingPerformance: {
      total: Object.values(bookingStatuses).reduce((a, b) => a + b, 0),
      confirmed: bookingStatuses[BOOKING_STATUSES.CONFIRMED] ?? 0,
      cancelled: bookingStatuses[BOOKING_STATUSES.CANCELLED] ?? 0,
      completed: bookingStatuses[BOOKING_STATUSES.CONVERTED] ?? 0,
      pending: (bookingStatuses[BOOKING_STATUSES.DRAFT] ?? 0) + (bookingStatuses[BOOKING_STATUSES.HOLD] ?? 0),
      byStatus: Object.fromEntries(Object.entries(bookingStatuses).map(([k, v]) => [k.toLowerCase(), v])),
      cancellationRate:
        Object.values(bookingStatuses).reduce((a, b) => a + b, 0) === 0
          ? null
          : Math.round(
              ((bookingStatuses[BOOKING_STATUSES.CANCELLED] ?? 0) /
                Object.values(bookingStatuses).reduce((a, b) => a + b, 0)) *
                10000,
            ) / 100,
    },
    fleetStatus: Object.fromEntries(Object.entries(fleet).map(([k, v]) => [k.toLowerCase(), v])),
    contractStatus: Object.fromEntries(Object.entries(contracts).map(([k, v]) => [k.toLowerCase(), v])),
    revenue: {
      amount: revenue.amount,
      count: revenue.count,
      currency: revenue.currency,
      trendGroupBy: groupBy.toLowerCase(),
    },
    utilization,
  }
}

export async function getBookingReport(
  ctx: AccessContext,
  query: CommonQuery & { status?: string; customerId?: string; vehicleId?: string },
) {
  assertOperationalReports(ctx)
  const scope = resolveReportScope(ctx, query)
  const range = rangeFrom(query)
  const pagination = resolvePagination(query)
  const [page, performance] = await Promise.all([
    repo.listBookingsReport(scope, {
      from: range.from,
      toExclusive: range.toExclusive,
      status: query.status?.toUpperCase(),
      customerId: query.customerId,
      vehicleId: query.vehicleId,
      skip: pagination.skip,
      take: pagination.take,
      sort: query.sort ?? 'createdAt',
      order: query.order ?? 'desc',
    }),
    repo.countBookingsByStatus(scope, range.from, range.toExclusive),
  ])
  return {
    summary: {
      total: Object.values(performance).reduce((a, b) => a + b, 0),
      byStatus: Object.fromEntries(Object.entries(performance).map(([k, v]) => [k.toLowerCase(), v])),
    },
    ...toPaginated(
      page.items.map((row) => ({
        ...row,
        status: toPublicEnum(row.status as never),
        createdAt: row.createdAt.toISOString(),
        startsAt: row.startsAt.toISOString(),
        endsAt: row.endsAt.toISOString(),
      })),
      pagination.page,
      pagination.limit,
      page.total,
    ),
  }
}

export async function getVehicleReport(
  ctx: AccessContext,
  query: CommonQuery & { status?: string; category?: string },
) {
  assertOperationalReports(ctx)
  const scope = resolveReportScope(ctx, query)
  const pagination = resolvePagination(query)
  const [page, fleetStatus] = await Promise.all([
    repo.listVehiclesReport(scope, {
      status: query.status?.toUpperCase(),
      category: query.category?.toUpperCase(),
      skip: pagination.skip,
      take: pagination.take,
      sort: query.sort ?? 'plateNumber',
      order: query.order ?? 'asc',
    }),
    repo.fleetStatusCounts(scope),
  ])
  return {
    summary: { byStatus: Object.fromEntries(Object.entries(fleetStatus).map(([k, v]) => [k.toLowerCase(), v])) },
    ...toPaginated(
      page.items.map((row) => ({
        ...row,
        status: toPublicEnum(row.status as never),
        category: toPublicEnum(row.category as never),
      })),
      pagination.page,
      pagination.limit,
      page.total,
    ),
  }
}

export async function getFleetUtilizationReport(
  ctx: AccessContext,
  query: CommonQuery & { vehicleId?: string; category?: string },
) {
  assertOperationalReports(ctx)
  const scope = resolveReportScope(ctx, query)
  const range = rangeFrom(query)
  const pagination = resolvePagination(query)
  const [page, snapshot] = await Promise.all([
    repo.fleetUtilizationByVehicle(scope, range.from, range.toExclusive, {
      vehicleId: query.vehicleId,
      category: query.category?.toUpperCase(),
      skip: pagination.skip,
      take: pagination.take,
    }),
    repo.fleetUtilizationSnapshot(scope),
  ])
  return {
    summary: snapshot,
    periodDays: page.availableDays,
    ...toPaginated(
      page.items.map((row) => ({
        ...row,
        status: toPublicEnum(row.status as never),
        category: toPublicEnum(row.category as never),
      })),
      pagination.page,
      pagination.limit,
      page.total,
    ),
  }
}

export async function getCustomerReport(ctx: AccessContext, query: CommonQuery & { search?: string }) {
  assertOperationalReports(ctx)
  const scope = resolveReportScope(ctx, query)
  const range = rangeFrom(query)
  const pagination = resolvePagination(query)
  const [page, performance] = await Promise.all([
    repo.listCustomersReport(scope, {
      skip: pagination.skip,
      take: pagination.take,
      search: query.search,
    }),
    repo.customerPerformance(scope, range.from, range.toExclusive),
  ])
  return {
    summary: performance,
    ...toPaginated(
      page.items.map((row) => ({
        ...row,
        type: toPublicEnum(row.type as never),
        lastActivityAt: row.lastActivityAt ? row.lastActivityAt.toISOString() : null,
      })),
      pagination.page,
      pagination.limit,
      page.total,
    ),
  }
}

export async function getContractReport(
  ctx: AccessContext,
  query: CommonQuery & { status?: string; customerId?: string; vehicleId?: string; upcomingWindow?: string },
) {
  assertOperationalReports(ctx)
  const scope = resolveReportScope(ctx, query)
  const range = rangeFrom(query)
  const pagination = resolvePagination(query)
  const upcoming = resolveUpcomingWindow(query.upcomingWindow)
  const [page, active, overdue, upcomingReturns, byStatus] = await Promise.all([
    repo.listContractsReport(scope, {
      from: range.from,
      toExclusive: range.toExclusive,
      status: query.status?.toUpperCase(),
      customerId: query.customerId,
      vehicleId: query.vehicleId,
      skip: pagination.skip,
      take: pagination.take,
      sort: query.sort ?? 'createdAt',
      order: query.order ?? 'desc',
    }),
    repo.countActiveContracts(scope),
    repo.countOverdueContracts(scope),
    repo.listUpcomingReturns(scope, upcoming.from, upcoming.toExclusive, 20),
    repo.countContractsByStatus(scope),
  ])
  return {
    summary: {
      active,
      overdue,
      byStatus: Object.fromEntries(Object.entries(byStatus).map(([k, v]) => [k.toLowerCase(), v])),
      upcomingReturns: upcomingReturns.length,
    },
    upcomingReturns: upcomingReturns.map((row) => ({
      ...row,
      status: toPublicEnum(row.status as never),
      endsAt: row.endsAt.toISOString(),
    })),
    ...toPaginated(
      page.items.map((row) => ({
        ...row,
        status: toPublicEnum(row.status as never),
        startsAt: row.startsAt.toISOString(),
        endsAt: row.endsAt.toISOString(),
      })),
      pagination.page,
      pagination.limit,
      page.total,
    ),
  }
}

export async function getPaymentReport(
  ctx: AccessContext,
  query: CommonQuery & { status?: string; method?: string; customerId?: string },
) {
  assertFinancialReports(ctx)
  const scope = resolveReportScope(ctx, query)
  const range = rangeFrom(query)
  const pagination = resolvePagination(query)
  const [page, totals] = await Promise.all([
    repo.listPaymentsReport(scope, {
      from: range.from,
      toExclusive: range.toExclusive,
      status: query.status?.toUpperCase(),
      method: query.method?.toUpperCase(),
      customerId: query.customerId,
      skip: pagination.skip,
      take: pagination.take,
      sort: query.sort ?? 'paymentDate',
      order: query.order ?? 'desc',
    }),
    repo.sumCompletedPayments(scope, range.from, range.toExclusive),
  ])
  return {
    summary: totals,
    ...toPaginated(
      page.items.map((row) => ({
        ...row,
        status: toPublicEnum(row.status as never),
        method: toPublicEnum(row.method as never),
        paymentDate: row.paymentDate.toISOString(),
      })),
      pagination.page,
      pagination.limit,
      page.total,
    ),
  }
}

export async function getReceivablesReport(ctx: AccessContext, query: CommonQuery) {
  assertFinancialReports(ctx)
  const scope = resolveReportScope(ctx, query)
  const [customers, aging, totals] = await Promise.all([
    repo.receivablesSummaryByCustomer(scope),
    repo.listReceivablesAging(scope),
    repo.sumOutstandingReceivables(scope),
  ])
  return {
    summary: totals,
    customers,
    aging: aging.map((row) => ({
      ...row,
      dueDate: row.dueDate.toISOString(),
    })),
  }
}

export async function getExpenseReport(
  ctx: AccessContext,
  query: CommonQuery & { status?: string; vendorId?: string; vehicleId?: string; category?: string },
) {
  assertFinancialReports(ctx)
  const scope = resolveReportScope(ctx, query)
  const range = rangeFrom(query)
  const pagination = resolvePagination(query)
  const page = await repo.listExpensesReport(scope, {
    from: range.from,
    toExclusive: range.toExclusive,
    status: query.status?.toUpperCase(),
    vendorId: query.vendorId,
    vehicleId: query.vehicleId,
    category: query.category?.toUpperCase(),
    skip: pagination.skip,
    take: pagination.take,
  })
  return toPaginated(
    page.items.map((row) => ({
      ...row,
      status: toPublicEnum(row.status as never),
      expenseDate: row.expenseDate.toISOString(),
    })),
    pagination.page,
    pagination.limit,
    page.total,
  )
}

export async function getMaintenanceReport(
  ctx: AccessContext,
  query: CommonQuery & { vehicleId?: string; vendorId?: string },
) {
  assertOperationalReports(ctx)
  const scope = resolveReportScope(ctx, query)
  const range = rangeFrom(query)
  const pagination = resolvePagination(query)
  const page = await repo.listMaintenanceReport(scope, {
    from: range.from,
    toExclusive: range.toExclusive,
    vehicleId: query.vehicleId,
    vendorId: query.vendorId,
    skip: pagination.skip,
    take: pagination.take,
  })
  return toPaginated(
    page.items.map((row) => ({
      ...row,
      status: toPublicEnum(row.status as never),
      maintenanceType: row.maintenanceType ? toPublicEnum(row.maintenanceType as never) : null,
      scheduledAt: row.scheduledAt?.toISOString() ?? null,
      completedAt: row.completedAt?.toISOString() ?? null,
    })),
    pagination.page,
    pagination.limit,
    page.total,
  )
}

export async function getFinesReport(
  ctx: AccessContext,
  query: CommonQuery & { kind?: 'fine' | 'toll' },
) {
  assertOperationalReports(ctx)
  const scope = resolveReportScope(ctx, query)
  const range = rangeFrom(query)
  const pagination = resolvePagination(query)
  const kind = query.kind?.toUpperCase() as 'FINE' | 'TOLL' | undefined
  const [page, metrics] = await Promise.all([
    repo.listFinesTollsReport(scope, {
      from: range.from,
      toExclusive: range.toExclusive,
      kind,
      skip: pagination.skip,
      take: pagination.take,
    }),
    repo.finesTollsMetrics(scope, range.from, range.toExclusive),
  ])
  return {
    summary: metrics,
    ...toPaginated(
      page.items.map((row) => ({
        ...row,
        kind: row.kind.toLowerCase(),
        recoveryStatus: toPublicEnum(row.recoveryStatus as never),
        responsibility: row.responsibility ? toPublicEnum(row.responsibility as never) : null,
        eventAt: row.eventAt.toISOString(),
      })),
      pagination.page,
      pagination.limit,
      page.total,
    ),
  }
}

export async function getRefundsReport(ctx: AccessContext, query: CommonQuery & { status?: string }) {
  assertFinancialReports(ctx)
  const scope = resolveReportScope(ctx, query)
  const range = rangeFrom(query)
  const pagination = resolvePagination(query)
  const page = await repo.listRefundsReport(scope, {
    from: range.from,
    toExclusive: range.toExclusive,
    status: query.status?.toUpperCase(),
    skip: pagination.skip,
    take: pagination.take,
  })
  return {
    summary: Object.fromEntries(
      Object.entries(page.metrics).map(([k, v]) => [k.toLowerCase(), v]),
    ),
    ...toPaginated(
      page.items.map((row) => ({
        ...row,
        status: toPublicEnum(row.status as never),
        source: row.source ? toPublicEnum(row.source as never) : null,
        createdAt: row.createdAt.toISOString(),
      })),
      pagination.page,
      pagination.limit,
      page.total,
    ),
  }
}

export async function getVatReportForDashboard(
  ctx: AccessContext,
  query: { organizationId?: string; legalEntityId: string; taxPeriodId?: string },
) {
  assertFinancialReports(ctx)
  return getVatReport(ctx, query)
}

export async function getEInvoiceReport(ctx: AccessContext, query: CommonQuery) {
  assertFinancialReports(ctx)
  const scope = resolveReportScope(ctx, query)
  const range = rangeFrom(query)
  const rows = await repo.eInvoiceStatusReport(scope, range.from, range.toExclusive)
  return {
    generatedAt: new Date().toISOString(),
    statuses: rows.map((row) => ({
      status: row.status.toLowerCase(),
      count: row.count,
      amount: row.amount,
    })),
  }
}

export async function getProfitabilityReport(
  ctx: AccessContext,
  query: CommonQuery & { dimension?: 'branch' | 'customer' | 'vehicle' | 'vehicle_type' },
) {
  assertFinancialReports(ctx)
  const scope = resolveReportScope(ctx, query)
  const range = rangeFrom(query)
  const dimension = query.dimension ?? 'branch'
  const rows = await repo.profitabilityFoundation(scope, range.from, range.toExclusive, dimension)
  return {
    generatedAt: new Date().toISOString(),
    dimension,
    note: 'Direct costs and gross contribution are unavailable until cost postings are complete in accounting.',
    rows,
  }
}

export async function getRevenueTrendReport(
  ctx: AccessContext,
  query: CommonQuery & { groupBy?: string },
) {
  assertFinancialReports(ctx)
  const scope = resolveReportScope(ctx, query)
  const range = rangeFrom(query)
  const groupBy = (query.groupBy?.toUpperCase() as RevenueGroupBy) || pickGroupBy(range.from, range.toExclusive)
  const series = await repo.revenueTrend(scope, range.from, range.toExclusive, groupBy)
  return {
    groupBy: groupBy.toLowerCase(),
    from: range.from.toISOString(),
    toExclusive: range.toExclusive.toISOString(),
    series,
  }
}
