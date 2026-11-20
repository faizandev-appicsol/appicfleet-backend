import { findVehicleById, type VehicleRecord } from '../../repositories/vehicles/vehicle.repository.js'
import type { AccessContext } from '../../types/access.js'
import { forbiddenError, notFound } from '../../utils/httpErrors.js'
import {
  assertLegalEntityAccess,
  hasBranchAccess,
  hasLegalEntityAccess,
  hasOrganizationAccess,
  resolveOrganizationScope,
} from '../authorization/authorization.service.js'

/** Platform-wide or organization-wide: not limited to assigned branches. */
export function isOrganizationWide(ctx: AccessContext): boolean {
  return ctx.accessAllOrganizations || ctx.accessAllBranches
}

/**
 * Organization the request acts on. A client-supplied organizationId is ignored for
 * organization-bound accounts; only platform-wide accounts choose (and must name) one.
 */
export function resolveVehicleOrganization(ctx: AccessContext, requested?: string): string {
  if (!ctx.accessAllOrganizations) {
    if (!ctx.organizationId) throw forbiddenError('You do not have access to an organization.')
    return ctx.organizationId
  }
  return resolveOrganizationScope(ctx, requested)
}

/**
 * Legal-entity scope for vehicles. Users with no legal-entity assignment are limited by branch
 * only; users with assignments may only reach vehicles of those entities, unless they hold
 * organization-wide or platform-wide access (handled inside hasLegalEntityAccess).
 */
export function hasVehicleLegalEntityScope(
  ctx: AccessContext,
  legalEntityId: string,
  organizationId: string,
): boolean {
  if (ctx.legalEntityIds.length === 0) return true
  return hasLegalEntityAccess(ctx, legalEntityId, organizationId)
}

export function assertVehicleLegalEntityScope(
  ctx: AccessContext,
  legalEntityId: string,
  organizationId: string,
): void {
  if (ctx.legalEntityIds.length === 0) return
  assertLegalEntityAccess(ctx, legalEntityId, organizationId)
}

export function canAccessVehicle(ctx: AccessContext, vehicle: VehicleRecord): boolean {
  return (
    hasOrganizationAccess(ctx, vehicle.organizationId) &&
    hasBranchAccess(ctx, vehicle.branchId, vehicle.organizationId) &&
    hasVehicleLegalEntityScope(ctx, vehicle.legalEntityId, vehicle.organizationId)
  )
}

/** Loads a vehicle the caller may reach; other tenants' or out-of-scope vehicles are 404. */
export async function loadAccessibleVehicle(ctx: AccessContext, id: string): Promise<VehicleRecord> {
  const vehicle = await findVehicleById(id)
  if (!vehicle || !canAccessVehicle(ctx, vehicle)) throw notFound('Vehicle was not found.')
  return vehicle
}
