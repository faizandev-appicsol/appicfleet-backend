import { CHARGE_KINDS, type ChargeKind } from '../../constants/contracts.js'
import type { BookingPricing } from '../../repositories/bookings/booking.repository.js'
import { quoteBooking } from '../bookings/booking-pricing.js'

export type ContractQuote = BookingPricing & { kind: ChargeKind }

/** Authoritative quote. Callers store the result; they do not recompute it in the UI. */
export async function quoteContractWindow(input: {
  vehicleId: string
  organizationId: string
  startsAt: Date
  endsAt: Date
  kind: ChargeKind
}): Promise<ContractQuote | undefined> {
  const quote = await quoteBooking({
    vehicleId: input.vehicleId,
    organizationId: input.organizationId,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
  })
  if (!quote) return undefined
  return { ...quote, kind: input.kind }
}

export { CHARGE_KINDS }
