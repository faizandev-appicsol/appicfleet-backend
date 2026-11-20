import {
  INVESTOR_PORTAL_ACTIVE_STATUSES,
  INVESTOR_STATUSES,
  type InvestorReportKey,
  type InvestorStatus,
} from '../../constants/investors.js'
import type { InvestorRecord, InvestorScopeRecord } from '../../repositories/investors/investor.repository.js'
import type { ScopeFilter } from '../../repositories/reporting/reporting.repository.js'

/**
 * Effective query scope for an investor.
 * Default deny: if no LE/branch/vehicle grants exist, hasDataAccess is false.
 */
export type InvestorEffectiveScope = {
  organizationId: string
  legalEntityIds: string[]
  branchIds: string[]
  vehicleIds: string[]
  reportKeys: InvestorReportKey[]
  /** False when scope grants are empty — queries must return empty, not org-wide data. */
  hasDataAccess: boolean
}

export function isInvestorPortalStatus(status: InvestorStatus, now = new Date(), investor?: InvestorRecord): boolean {
  if (!INVESTOR_PORTAL_ACTIVE_STATUSES.includes(status)) return false
  if (investor?.accessStartsAt && investor.accessStartsAt.getTime() > now.getTime()) return false
  if (investor?.accessEndsAt && investor.accessEndsAt.getTime() <= now.getTime()) return false
  return true
}

export function resolveEffectiveScope(investor: InvestorRecord): InvestorEffectiveScope {
  const legalEntityIds = [...investor.scope.legalEntityIds]
  const branchIds = [...investor.scope.branchIds]
  const vehicleIds = [...investor.scope.vehicleIds]
  const reportKeys = [...investor.scope.reportKeys]
  const hasDataAccess = legalEntityIds.length > 0 || branchIds.length > 0 || vehicleIds.length > 0
  return {
    organizationId: investor.organizationId,
    legalEntityIds,
    branchIds,
    vehicleIds,
    reportKeys,
    hasDataAccess,
  }
}

/** Convert investor scope into reporting ScopeFilter. Returns null when default-deny. */
export function toReportingScope(effective: InvestorEffectiveScope): ScopeFilter | null {
  if (!effective.hasDataAccess) return null
  return {
    organizationId: effective.organizationId,
    legalEntityIds: effective.legalEntityIds.length > 0 ? effective.legalEntityIds : undefined,
    branchIds: effective.branchIds.length > 0 ? effective.branchIds : undefined,
  }
}

export function canAccessVehicleId(effective: InvestorEffectiveScope, vehicle: {
  id: string
  branchId: string
  legalEntityId: string
  organizationId: string
}): boolean {
  if (!effective.hasDataAccess) return false
  if (vehicle.organizationId !== effective.organizationId) return false
  if (effective.vehicleIds.length > 0 && !effective.vehicleIds.includes(vehicle.id)) return false
  if (effective.branchIds.length > 0 && !effective.branchIds.includes(vehicle.branchId)) return false
  if (effective.legalEntityIds.length > 0 && !effective.legalEntityIds.includes(vehicle.legalEntityId)) {
    return false
  }
  return true
}

export function canAccessBranchId(effective: InvestorEffectiveScope, branchId: string): boolean {
  if (!effective.hasDataAccess) return false
  if (effective.branchIds.length === 0) return effective.vehicleIds.length > 0 || effective.legalEntityIds.length > 0
  return effective.branchIds.includes(branchId)
}

export function canAccessReport(effective: InvestorEffectiveScope, key: InvestorReportKey): boolean {
  return effective.reportKeys.includes(key)
}

export function normalizeScopeInput(input: {
  legalEntityIds?: string[]
  branchIds?: string[]
  vehicleIds?: string[]
  reportKeys?: string[]
}): InvestorScopeRecord {
  return {
    legalEntityIds: [...new Set(input.legalEntityIds ?? [])],
    branchIds: [...new Set(input.branchIds ?? [])],
    vehicleIds: [...new Set(input.vehicleIds ?? [])],
    reportKeys: [...new Set((input.reportKeys ?? []).map((key) => key.toUpperCase()))] as InvestorReportKey[],
  }
}

export function scopeSummary(scope: InvestorScopeRecord) {
  return {
    legalEntityCount: scope.legalEntityIds.length,
    branchCount: scope.branchIds.length,
    vehicleCount: scope.vehicleIds.length,
    reportCount: scope.reportKeys.length,
  }
}

export function maybeExpireStatus(investor: InvestorRecord, now = new Date()): InvestorStatus {
  if (
    investor.status === INVESTOR_STATUSES.ACTIVE &&
    investor.accessEndsAt &&
    investor.accessEndsAt.getTime() <= now.getTime()
  ) {
    return INVESTOR_STATUSES.EXPIRED
  }
  return investor.status
}
