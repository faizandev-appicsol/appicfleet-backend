import { PERMISSIONS } from '../../constants/permissions.js'
import type { AccessContext } from '../../types/access.js'
import { forbiddenError, notFound } from '../../utils/httpErrors.js'
import {
  assertPermission,
  hasBranchAccess,
  hasLegalEntityAccess,
  hasPermission,
} from '../authorization/authorization.service.js'
import { isOrganizationWide, resolveVehicleOrganization } from '../vehicles/vehicle-access.js'

export type ReportScope = {
  organizationId: string
  branchIds?: string[]
  legalEntityIds?: string[]
  branchId?: string
  legalEntityId?: string
}

export function resolveReportOrganization(ctx: AccessContext, requested?: string): string {
  return resolveVehicleOrganization(ctx, requested)
}

export function assertDashboardAccess(ctx: AccessContext): void {
  assertPermission(ctx, PERMISSIONS.DASHBOARD_VIEW)
}

export function assertReportsAccess(ctx: AccessContext): void {
  assertPermission(ctx, PERMISSIONS.REPORTS_VIEW)
}

export function assertOperationalReports(ctx: AccessContext): void {
  assertPermission(ctx, PERMISSIONS.REPORTS_OPERATIONAL)
}

export function assertFinancialReports(ctx: AccessContext): void {
  assertPermission(ctx, PERMISSIONS.REPORTS_FINANCIAL)
}

export function assertExportAccess(ctx: AccessContext): void {
  assertPermission(ctx, PERMISSIONS.REPORTS_EXPORT)
}

export function canViewFinancialReports(ctx: AccessContext): boolean {
  return hasPermission(ctx, PERMISSIONS.REPORTS_FINANCIAL)
}

export function resolveReportScope(
  ctx: AccessContext,
  query: { organizationId?: string; branchId?: string; legalEntityId?: string },
): ReportScope {
  const organizationId = resolveReportOrganization(ctx, query.organizationId)
  if (query.branchId && !hasBranchAccess(ctx, query.branchId, organizationId)) {
    throw notFound('Branch was not found.')
  }
  if (query.legalEntityId && !hasLegalEntityAccess(ctx, query.legalEntityId, organizationId)) {
    throw notFound('Legal entity was not found.')
  }

  const orgWide = isOrganizationWide(ctx)
  let branchIds: string[] | undefined = orgWide ? undefined : [...ctx.branchIds]
  if (query.branchId) {
    branchIds = branchIds ? branchIds.filter((id) => id === query.branchId) : [query.branchId]
    if (branchIds.length === 0) throw forbiddenError('You do not have access to this branch.')
  }

  let legalEntityIds: string[] | undefined =
    !orgWide && ctx.legalEntityIds.length > 0 ? [...ctx.legalEntityIds] : undefined
  if (query.legalEntityId) {
    legalEntityIds = legalEntityIds
      ? legalEntityIds.filter((id) => id === query.legalEntityId)
      : [query.legalEntityId]
    if (legalEntityIds.length === 0) throw forbiddenError('You do not have access to this legal entity.')
  }

  return {
    organizationId,
    branchIds,
    legalEntityIds,
    branchId: query.branchId,
    legalEntityId: query.legalEntityId,
  }
}
