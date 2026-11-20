import {
  REVENUE_GROUP_BY,
  REVENUE_SOURCE,
  type RevenueGroupBy,
  type UpcomingReturnWindow,
} from '../../constants/reporting.js'
import * as repo from '../../repositories/reporting/reporting.repository.js'
import type { AccessContext } from '../../types/access.js'
import { toPublicEnum } from '../../constants/vehicles.js'
import {
  assertDashboardAccess,
  canViewFinancialReports,
  resolveReportScope,
} from './reporting-access.js'
import { percentChange, previousPeriod, resolveReportDateRange, resolveUpcomingWindow } from './date-range.js'

function pickGroupBy(from: Date, toExclusive: Date): RevenueGroupBy {
  const days = (toExclusive.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)
  if (days <= 14) return REVENUE_GROUP_BY.DAY
  if (days <= 90) return REVENUE_GROUP_BY.WEEK
  return REVENUE_GROUP_BY.MONTH
}

function mapStatusCounts(counts: Record<string, number>) {
  return Object.fromEntries(Object.entries(counts).map(([k, v]) => [k.toLowerCase(), v]))
}

export async function getDashboardOverview(
  ctx: AccessContext,
  query: {
    organizationId?: string
    branchId?: string
    legalEntityId?: string
    preset?: string
    from?: Date
    to?: Date
    timezone?: string
    upcomingWindow?: string
  },
) {
  assertDashboardAccess(ctx)
  const scope = resolveReportScope(ctx, query)
  const range = resolveReportDateRange({
    preset: query.preset,
    from: query.from,
    to: query.to,
    timezone: query.timezone,
  })
  const prev = previousPeriod(range)
  const groupBy = pickGroupBy(range.from, range.toExclusive)
  const upcoming = resolveUpcomingWindow(query.upcomingWindow as UpcomingReturnWindow | undefined)
  const financial = canViewFinancialReports(ctx)
  const generatedAt = new Date().toISOString()

  const [
    revenueCurrent,
    revenuePrevious,
    bookingStatuses,
    bookingStatusesPrev,
    activeContracts,
    overdueCount,
    fleetUtil,
    fleetStatus,
    receivables,
    payments,
    revenueSeries,
    bookingSeries,
    upcomingReturns,
    overdueContracts,
    recentBookingRows,
    recentPaymentRows,
    recentContractRows,
  ] = await Promise.all([
    financial
      ? repo.sumPostedInvoiceRevenue(scope, range.from, range.toExclusive)
      : Promise.resolve({ amount: null as string | null, count: 0, currency: null }),
    financial
      ? repo.sumPostedInvoiceRevenue(scope, prev.from, prev.toExclusive)
      : Promise.resolve({ amount: null as string | null, count: 0, currency: null }),
    repo.countBookingsByStatus(scope, range.from, range.toExclusive),
    repo.countBookingsByStatus(scope, prev.from, prev.toExclusive),
    repo.countActiveContracts(scope),
    repo.countOverdueContracts(scope),
    repo.fleetUtilizationSnapshot(scope),
    repo.fleetStatusCounts(scope),
    financial ? repo.sumOutstandingReceivables(scope) : Promise.resolve({ amount: null as string | null, count: 0, currency: null }),
    financial
      ? repo.sumCompletedPayments(scope, range.from, range.toExclusive)
      : Promise.resolve({ amount: null as string | null, count: 0 }),
    financial ? repo.revenueTrend(scope, range.from, range.toExclusive, groupBy) : Promise.resolve([]),
    repo.bookingTrend(scope, range.from, range.toExclusive, groupBy),
    repo.listUpcomingReturns(scope, upcoming.from, upcoming.toExclusive, 15),
    repo.listOverdueContracts(scope, new Date(), 15),
    repo.recentBookings(scope, 8),
    financial ? repo.recentPayments(scope, 8) : Promise.resolve([]),
    repo.recentContracts(scope, 8),
  ])

  const bookingTotal = Object.values(bookingStatuses).reduce((a, b) => a + b, 0)
  const bookingTotalPrev = Object.values(bookingStatusesPrev).reduce((a, b) => a + b, 0)

  return {
    generatedAt,
    filters: {
      preset: range.preset.toLowerCase(),
      from: range.from.toISOString(),
      toExclusive: range.toExclusive.toISOString(),
      timezone: range.timezone,
      organizationId: scope.organizationId,
      branchId: scope.branchId ?? null,
      legalEntityId: scope.legalEntityId ?? null,
    },
    permissions: {
      financial,
    },
    kpis: {
      revenue: financial
        ? {
            amount: revenueCurrent.amount,
            previousAmount: revenuePrevious.amount,
            changePercent: percentChange(
              Number(revenueCurrent.amount ?? 0),
              Number(revenuePrevious.amount ?? 0),
            ),
            currency: revenueCurrent.currency,
            count: revenueCurrent.count,
            source: REVENUE_SOURCE,
            definition: 'Sum of posted invoice totalAmount in the selected period (documentDate).',
          }
        : null,
      bookings: {
        total: bookingTotal,
        previousTotal: bookingTotalPrev,
        changePercent: percentChange(bookingTotal, bookingTotalPrev),
        byStatus: mapStatusCounts(bookingStatuses),
      },
      activeContracts: {
        count: activeContracts,
        overdueCount,
      },
      fleetUtilization: {
        rented: fleetUtil.rented,
        eligible: fleetUtil.eligible,
        available: fleetUtil.available,
        utilizationPercent: fleetUtil.utilizationPercent,
        definition: 'Rented vehicles / eligible fleet (excludes inactive and out_of_service) × 100.',
      },
      outstandingReceivables: financial
        ? {
            amount: receivables.amount,
            count: receivables.count,
            currency: receivables.currency,
            definition: 'Sum of outstandingAmount on posted invoices with non-zero balance.',
          }
        : null,
      payments: financial
        ? {
            amount: payments.amount,
            count: payments.count,
          }
        : null,
    },
    charts: {
      groupBy: groupBy.toLowerCase(),
      revenueTrend: revenueSeries,
      bookingTrend: bookingSeries,
      fleetStatus: mapStatusCounts(fleetStatus),
    },
    operational: {
      upcomingReturns: upcomingReturns.map((row) => ({
        ...row,
        status: toPublicEnum(row.status as never),
        endsAt: row.endsAt.toISOString(),
      })),
      overdueContracts: overdueContracts.map((row) => ({
        ...row,
        status: toPublicEnum(row.status as never),
        endsAt: row.endsAt.toISOString(),
      })),
    },
    recent: {
      bookings: recentBookingRows.map((row) => ({
        ...row,
        status: toPublicEnum(row.status as never),
        startsAt: row.startsAt.toISOString(),
        endsAt: row.endsAt.toISOString(),
        createdAt: row.createdAt.toISOString(),
      })),
      payments: recentPaymentRows.map((row) => ({
        ...row,
        status: toPublicEnum(row.status as never),
        method: toPublicEnum(row.method as never),
        paymentDate: row.paymentDate.toISOString(),
      })),
      contracts: recentContractRows.map((row) => ({
        ...row,
        status: toPublicEnum(row.status as never),
        startsAt: row.startsAt.toISOString(),
        endsAt: row.endsAt.toISOString(),
      })),
    },
  }
}
