import { BOOKING_STATUSES, MS_PER_DAY, type BookingStatus } from '../../constants/bookings.js'
import { intervalsOverlap, type Interval } from '../vehicles/intervals.js'

const S = BOOKING_STATUSES

/** Allowed transitions. Anything else is rejected. Same-status is not a transition. */
export const BOOKING_TRANSITIONS: Readonly<Record<BookingStatus, readonly BookingStatus[]>> = {
  [S.DRAFT]: [S.HOLD, S.CANCELLED],
  [S.HOLD]: [S.CONFIRMED, S.EXPIRED, S.CANCELLED, S.RELEASED],
  [S.CONFIRMED]: [S.CANCELLED, S.CONVERTED],
  [S.CANCELLED]: [],
  [S.EXPIRED]: [],
  [S.RELEASED]: [],
  [S.CONVERTED]: [],
}

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return BOOKING_TRANSITIONS[from].includes(to)
}

/** Whole days used only for the stored quote. A partial day counts as one. Not a pricing engine. */
export function billableDays(startsAt: Date, endsAt: Date): number {
  const span = endsAt.getTime() - startsAt.getTime()
  if (span <= 0) return 0
  return Math.max(1, Math.ceil(span / MS_PER_DAY))
}

export function isValidInterval(startsAt: Date, endsAt: Date): boolean {
  return endsAt.getTime() > startsAt.getTime()
}

/** Half-open overlap. Touching endpoints (end === next start) do not overlap. */
export function bookingIntervalsOverlap(a: Interval, b: Interval): boolean {
  return intervalsOverlap(a, b)
}

export type IdempotencyRow = { bookingId?: string; requestHash: string }

export type IdempotencyDecision =
  | { kind: 'proceed' }
  | { kind: 'replay'; bookingId: string }
  | { kind: 'mismatch' }
  | { kind: 'busy' }

/**
 * Decides what a repeated key means. `proceed` is only for a key this caller just claimed.
 * A row that already points at a booking is a replay when the payload hash matches.
 */
export function decideIdempotency(existing: IdempotencyRow | null, requestHash: string): IdempotencyDecision {
  if (!existing) return { kind: 'proceed' }
  if (existing.requestHash !== requestHash) return { kind: 'mismatch' }
  if (existing.bookingId) return { kind: 'replay', bookingId: existing.bookingId }
  return { kind: 'busy' }
}

export type WebhookDecision = 'process' | 'duplicate'

export function decideWebhook(existingBookingId: string | undefined): WebhookDecision {
  return existingBookingId ? 'duplicate' : 'process'
}

/** A hold can be confirmed only while it is still a hold and its expiry is strictly in the future. */
export function holdIsOpen(status: BookingStatus, holdExpiresAt: Date | undefined, now: Date): boolean {
  return (
    status === S.HOLD &&
    holdExpiresAt !== undefined &&
    holdExpiresAt.getTime() > now.getTime()
  )
}
