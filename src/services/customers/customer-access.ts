import { PERMISSIONS } from '../../constants/permissions.js'
import { findCustomerById, type CustomerRecord } from '../../repositories/customers/customer.repository.js'
import type { AccessContext } from '../../types/access.js'
import { notFound } from '../../utils/httpErrors.js'
import { hasBranchAccess, hasOrganizationAccess, hasPermission } from '../authorization/authorization.service.js'
import {
  hasVehicleLegalEntityScope,
  isOrganizationWide,
  resolveVehicleOrganization,
} from '../vehicles/vehicle-access.js'

export { isOrganizationWide }

/**
 * Organization the request acts on. A client-supplied organizationId is ignored for
 * organization-bound accounts; only platform-wide accounts choose (and must name) one.
 */
export function resolveCustomerOrganization(ctx: AccessContext, requested?: string): string {
  return resolveVehicleOrganization(ctx, requested)
}

/** Same scope rules as vehicles: organization, then branch, then legal entity when assigned. */
export function canAccessCustomer(ctx: AccessContext, customer: CustomerRecord): boolean {
  return (
    hasOrganizationAccess(ctx, customer.organizationId) &&
    hasBranchAccess(ctx, customer.branchId, customer.organizationId) &&
    hasVehicleLegalEntityScope(ctx, customer.legalEntityId, customer.organizationId)
  )
}

/** Loads a customer the caller may reach; other tenants' or out-of-scope customers are 404. */
export async function loadAccessibleCustomer(ctx: AccessContext, id: string): Promise<CustomerRecord> {
  const customer = await findCustomerById(id)
  if (!customer || !canAccessCustomer(ctx, customer)) throw notFound('Customer was not found.')
  return customer
}

/**
 * Whether sensitive values may be shown: the caller must hold customer.view_sensitive AND ask
 * for them (`reveal=true`). The default is always masked.
 */
export function canReveal(ctx: AccessContext, requested: boolean | undefined): boolean {
  return requested === true && hasPermission(ctx, PERMISSIONS.CUSTOMER_VIEW_SENSITIVE)
}