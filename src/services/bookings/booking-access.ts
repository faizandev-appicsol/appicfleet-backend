import type { BookingRecord } from '../../repositories/bookings/booking.repository.js'
import { findBookingById } from '../../repositories/bookings/booking.repository.js'
import type { AccessContext } from '../../types/access.js'
import { notFound } from '../../utils/httpErrors.js'
import { hasBranchAccess, hasOrganizationAccess } from '../authorization/authorization.service.js'
import {
  hasVehicleLegalEntityScope,
  isOrganizationWide,
  resolveVehicleOrganization,
} from '../vehicles/vehicle-access.js'

export { isOrganizationWide }

export function resolveBookingOrganization(ctx: AccessContext, requested?: string): string {
  return resolveVehicleOrganization(ctx, requested)
}

/** Pickup branch is the scope boundary. The return branch is checked when it is written. */
export function canAccessBooking(ctx: AccessContext, booking: BookingRecord): boolean {
  return (
    hasOrganizationAccess(ctx, booking.organizationId) &&
    hasBranchAccess(ctx, booking.branchId, booking.organizationId) &&
    hasVehicleLegalEntityScope(ctx, booking.legalEntityId, booking.organizationId)
  )
}

export async function loadAccessibleBooking(ctx: AccessContext, id: string): Promise<BookingRecord> {
  const booking = await findBookingById(id)
  if (!booking || !canAccessBooking(ctx, booking)) throw notFound('Booking was not found.')
  return booking
}
