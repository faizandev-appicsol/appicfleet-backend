import { RATE_TYPES } from '../../constants/vehicles.js'
import type { BookingPricing } from '../../repositories/bookings/booking.repository.js'
import { findActiveRates } from '../../repositories/vehicles/vehicle-rate.repository.js'
import { multiplyMoney } from '../../utils/money.js'
import { billableDays } from './booking-rules.js'

/**
 * Copies the daily rate card that covers the pickup instant, if one exists.
 * Rate ranges are half-open [effectiveFrom, effectiveTo). No card means no quote.
 */
export async function quoteBooking(input: {
  vehicleId: string
  organizationId: string
  startsAt: Date
  endsAt: Date
}): Promise<BookingPricing | undefined> {
  const days = billableDays(input.startsAt, input.endsAt)
  if (days < 1) return undefined
  const cards = await findActiveRates(input.vehicleId, input.organizationId, RATE_TYPES.DAILY)
  const at = input.startsAt.getTime()
  const covering = cards
    .filter(
      (card) =>
        card.effectiveFrom.getTime() <= at &&
        (card.effectiveTo === null || at < card.effectiveTo.getTime()),
    )
    .sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime())
  const card = covering[0]
  if (!card) return undefined
  return {
    currency: card.currency,
    unitAmount: card.amount,
    quantityDays: days,
    totalAmount: multiplyMoney(card.amount, days),
    rateType: RATE_TYPES.DAILY,
  }
}
