/**
 * Module 13 — Dashboard & Reports.
 * KPI definitions are documented in docs/architecture/reporting.md.
 * Money amounts use decimal strings; never JS floats.
 */

export const REPORT_DATE_PRESETS = {
  TODAY: 'TODAY',
  YESTERDAY: 'YESTERDAY',
  THIS_WEEK: 'THIS_WEEK',
  LAST_WEEK: 'LAST_WEEK',
  THIS_MONTH: 'THIS_MONTH',
  LAST_MONTH: 'LAST_MONTH',
  THIS_QUARTER: 'THIS_QUARTER',
  THIS_YEAR: 'THIS_YEAR',
  CUSTOM: 'CUSTOM',
} as const
export type ReportDatePreset = (typeof REPORT_DATE_PRESETS)[keyof typeof REPORT_DATE_PRESETS]

export const REVENUE_GROUP_BY = {
  DAY: 'DAY',
  WEEK: 'WEEK',
  MONTH: 'MONTH',
} as const
export type RevenueGroupBy = (typeof REVENUE_GROUP_BY)[keyof typeof REVENUE_GROUP_BY]

export const UPCOMING_RETURN_WINDOWS = {
  TODAY: 'TODAY',
  NEXT_24H: 'NEXT_24H',
  NEXT_3_DAYS: 'NEXT_3_DAYS',
  NEXT_7_DAYS: 'NEXT_7_DAYS',
} as const
export type UpcomingReturnWindow = (typeof UPCOMING_RETURN_WINDOWS)[keyof typeof UPCOMING_RETURN_WINDOWS]

/** Eligible fleet for utilization excludes inactive / out-of-service. */
export const UTILIZATION_ELIGIBLE_STATUSES = [
  'AVAILABLE',
  'RESERVED',
  'RENTED',
  'MAINTENANCE',
  'INSPECTION',
] as const

/**
 * Operational revenue source: posted invoices in range (documentDate).
 * Official GL revenue remains Module 11 — this is management operational revenue.
 */
export const REVENUE_SOURCE = 'posted_invoices' as const

export const RECEIVABLE_AGING_BUCKETS = [
  { id: 'current', label: 'Current', minDays: Number.NEGATIVE_INFINITY, maxDays: 0 },
  { id: '1_30', label: '1–30 Days', minDays: 1, maxDays: 30 },
  { id: '31_60', label: '31–60 Days', minDays: 31, maxDays: 60 },
  { id: '61_90', label: '61–90 Days', minDays: 61, maxDays: 90 },
  { id: '90_plus', label: '90+ Days', minDays: 91, maxDays: Number.POSITIVE_INFINITY },
] as const
