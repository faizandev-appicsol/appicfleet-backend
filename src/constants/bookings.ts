/**
 * Booking domain enums. Stored in UPPERCASE, exposed in lowercase via `toPublicEnum`.
 * Intervals are half-open [startsAt, endsAt): a return at 12:00 does not overlap a pickup at 12:00.
 */
export const BOOKING_STATUSES = {
  DRAFT: 'DRAFT',
  HOLD: 'HOLD',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
  RELEASED: 'RELEASED',
  CONVERTED: 'CONVERTED',
} as const
export type BookingStatus = (typeof BOOKING_STATUSES)[keyof typeof BOOKING_STATUSES]

export const BOOKING_SOURCES = {
  ADMIN: 'ADMIN',
  WEBSITE: 'WEBSITE',
  MOBILE: 'MOBILE',
  API: 'API',
  PARTNER: 'PARTNER',
  WALK_IN: 'WALK_IN',
  OTHER: 'OTHER',
} as const
export type BookingSource = (typeof BOOKING_SOURCES)[keyof typeof BOOKING_SOURCES]

/** Statuses that keep a vehicle assignment window active. */
export const BLOCKING_BOOKING_STATUSES: readonly BookingStatus[] = [
  BOOKING_STATUSES.HOLD,
  BOOKING_STATUSES.CONFIRMED,
]

export const BOOKING_SORT_FIELDS = [
  'bookingNumber',
  'startsAt',
  'endsAt',
  'createdAt',
  'status',
] as const
export type BookingSortField = (typeof BOOKING_SORT_FIELDS)[number]

/** Default hold length. The backend, not the browser timer, decides when a hold is still valid. */
export const HOLD_DEFAULT_MINUTES = 15
export const HOLD_MIN_MINUTES = 5
export const HOLD_MAX_MINUTES = 120

/** Calendar responses never return an unbounded set. */
export const CALENDAR_RESULT_LIMIT = 300

export const MS_PER_DAY = 86_400_000
