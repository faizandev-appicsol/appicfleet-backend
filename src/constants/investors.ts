/**
 * Module 14 — Investor Portal.
 * Access is default-deny: empty scope grants see no operational/financial data.
 */

export const INVESTOR_STATUSES = {
  INVITED: 'INVITED',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  EXPIRED: 'EXPIRED',
  REVOKED: 'REVOKED',
} as const
export type InvestorStatus = (typeof INVESTOR_STATUSES)[keyof typeof INVESTOR_STATUSES]

/** Statuses that may authenticate and call investor portal APIs. */
export const INVESTOR_PORTAL_ACTIVE_STATUSES: readonly InvestorStatus[] = [INVESTOR_STATUSES.ACTIVE]

export const INVESTOR_REPORT_KEYS = {
  FLEET_PERFORMANCE: 'FLEET_PERFORMANCE',
  REVENUE_SUMMARY: 'REVENUE_SUMMARY',
  UTILIZATION: 'UTILIZATION',
  CONTRACT_PERFORMANCE: 'CONTRACT_PERFORMANCE',
  VEHICLE_PERFORMANCE: 'VEHICLE_PERFORMANCE',
  FINANCIAL_SUMMARY: 'FINANCIAL_SUMMARY',
} as const
export type InvestorReportKey = (typeof INVESTOR_REPORT_KEYS)[keyof typeof INVESTOR_REPORT_KEYS]

export const INVESTOR_SORT_FIELDS = ['displayName', 'createdAt', 'status', 'investorNumber'] as const
export type InvestorSortField = (typeof INVESTOR_SORT_FIELDS)[number]

/** Invitation token lifetime. */
export const INVESTOR_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Investor-safe vehicle projection fields (backend response allow-list).
 * Internal notes, employee data, and sensitive ownership internals are excluded.
 */
export const INVESTOR_VEHICLE_PUBLIC_FIELDS = [
  'id',
  'plateNumber',
  'make',
  'model',
  'year',
  'category',
  'status',
  'branchId',
  'legalEntityId',
] as const
