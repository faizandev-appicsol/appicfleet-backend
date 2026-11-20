import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { BOOKING_STATUSES } from '../../src/constants/bookings.js'
import { ASSIGNMENT_STATUSES } from '../../src/constants/vehicles.js'
import { AppError } from '../../src/exceptions/AppError.js'
import {
  bookingIntervalsOverlap,
  canTransition,
  decideIdempotency,
  decideWebhook,
  holdIsOpen,
} from '../../src/services/bookings/booking-rules.js'
import { intervalsOverlap } from '../../src/services/vehicles/intervals.js'
import {
  decideAssignment,
  type AssignmentWindow,
} from '../../src/services/vehicles/availability-rules.js'
import {
  runWithVehicleLock,
  VEHICLE_LOCK_BUSY_MESSAGE,
  type VehicleLockStore,
} from '../../src/services/vehicles/vehicle-lock.js'
import { conflict } from '../../src/utils/httpErrors.js'
import { multiplyMoney } from '../../src/utils/money.js'

const at = (iso: string) => new Date(iso)
const interval = (from: string, to: string) => ({ starts: at(from), ends: at(to) })

describe('booking transitions', () => {
  it('allows the booking lifecycle', () => {
    assert.equal(canTransition(BOOKING_STATUSES.DRAFT, BOOKING_STATUSES.HOLD), true)
    assert.equal(canTransition(BOOKING_STATUSES.HOLD, BOOKING_STATUSES.CONFIRMED), true)
    assert.equal(canTransition(BOOKING_STATUSES.HOLD, BOOKING_STATUSES.EXPIRED), true)
    assert.equal(canTransition(BOOKING_STATUSES.HOLD, BOOKING_STATUSES.CANCELLED), true)
    assert.equal(canTransition(BOOKING_STATUSES.CONFIRMED, BOOKING_STATUSES.CANCELLED), true)
    assert.equal(canTransition(BOOKING_STATUSES.CONFIRMED, BOOKING_STATUSES.CONVERTED), true)
  })

  it('rejects invalid transitions', () => {
    assert.equal(canTransition(BOOKING_STATUSES.DRAFT, BOOKING_STATUSES.CONFIRMED), false)
    assert.equal(canTransition(BOOKING_STATUSES.CANCELLED, BOOKING_STATUSES.CONFIRMED), false)
    assert.equal(canTransition(BOOKING_STATUSES.EXPIRED, BOOKING_STATUSES.CONFIRMED), false)
    assert.equal(canTransition(BOOKING_STATUSES.RELEASED, BOOKING_STATUSES.CONFIRMED), false)
    assert.equal(canTransition(BOOKING_STATUSES.CONVERTED, BOOKING_STATUSES.CANCELLED), false)
    assert.equal(canTransition(BOOKING_STATUSES.CONFIRMED, BOOKING_STATUSES.RELEASED), false)
  })
})

describe('half-open booking intervals', () => {
  const window = (from: string, to: string, status = ASSIGNMENT_STATUSES.ACTIVE): AssignmentWindow => ({
    startsAt: at(from),
    endsAt: at(to),
    status,
  })

  it('allows a booking that starts when another ends', () => {
    const existing = interval('2026-07-01T10:00:00Z', '2026-07-01T12:00:00Z')
    const next = interval('2026-07-01T12:00:00Z', '2026-07-01T14:00:00Z')
    assert.equal(intervalsOverlap(existing, next), false)
    assert.equal(bookingIntervalsOverlap(existing, next), false)
    const decision = decideAssignment([window('2026-07-01T10:00:00Z', '2026-07-01T12:00:00Z')], {
      startsAt: at('2026-07-01T12:00:00Z'),
      endsAt: at('2026-07-01T12:01:00Z'),
    })
    assert.equal(decision.accepted, true)
  })

  it('rejects overlap, the same interval, and a contained interval', () => {
    const existing = [window('2026-07-01T10:00:00Z', '2026-07-01T12:00:00Z')]
    assert.equal(
      decideAssignment(existing, {
        startsAt: at('2026-07-01T11:00:00Z'),
        endsAt: at('2026-07-01T13:00:00Z'),
      }).accepted,
      false,
    )
    assert.equal(
      decideAssignment(existing, {
        startsAt: at('2026-07-01T10:00:00Z'),
        endsAt: at('2026-07-01T12:00:00Z'),
      }).accepted,
      false,
    )
    assert.equal(
      decideAssignment(
        [window('2026-07-01T10:00:00Z', '2026-07-01T15:00:00Z')],
        { startsAt: at('2026-07-01T11:00:00Z'), endsAt: at('2026-07-01T12:00:00Z') },
      ).accepted,
      false,
    )
  })
})

describe('holds and idempotency', () => {
  it('rejects confirmation of an expired hold', () => {
    const now = at('2026-07-01T12:00:00Z')
    assert.equal(holdIsOpen(BOOKING_STATUSES.HOLD, at('2026-07-01T11:00:00Z'), now), false)
    assert.equal(holdIsOpen(BOOKING_STATUSES.HOLD, at('2026-07-01T12:00:01Z'), now), true)
    assert.equal(holdIsOpen(BOOKING_STATUSES.CONFIRMED, at('2026-07-01T13:00:00Z'), now), false)
  })

  it('replays the same key and rejects a different payload', () => {
    assert.deepEqual(decideIdempotency(null, 'hash-a'), { kind: 'proceed' })
    assert.deepEqual(decideIdempotency({ requestHash: 'hash-a', bookingId: 'b1' }, 'hash-a'), {
      kind: 'replay',
      bookingId: 'b1',
    })
    assert.deepEqual(decideIdempotency({ requestHash: 'hash-a', bookingId: 'b1' }, 'hash-b'), {
      kind: 'mismatch',
    })
    assert.equal(decideIdempotency({ requestHash: 'hash-a' }, 'hash-a').kind, 'busy')
  })

  it('treats a repeated webhook as a duplicate only after a booking exists', () => {
    assert.equal(decideWebhook(undefined), 'process')
    assert.equal(decideWebhook('booking-1'), 'duplicate')
  })
})

describe('concurrent reservation', () => {
  function createFakeLockStore(): VehicleLockStore {
    const locks = new Map<string, { token: string; lockedUntil: Date }>()
    return {
      async acquire(vehicleId, token, now, lockedUntil) {
        const current = locks.get(vehicleId)
        if (current && current.lockedUntil.getTime() >= now.getTime()) return false
        locks.set(vehicleId, { token, lockedUntil })
        return true
      },
      async release(vehicleId, token, now) {
        const current = locks.get(vehicleId)
        if (current?.token === token) {
          locks.set(vehicleId, { token, lockedUntil: new Date(now.getTime() - 1) })
        }
      },
    }
  }

  it('lets only one of two overlapping confirms reserve the vehicle', async () => {
    const store = createFakeLockStore()
    const windows: AssignmentWindow[] = []
    const candidate = {
      startsAt: at('2026-07-01T10:00:00Z'),
      endsAt: at('2026-07-01T15:00:00Z'),
    }

    const reserve = () =>
      runWithVehicleLock(store, 'vehicle-100', async () => {
        const decision = decideAssignment(windows, candidate)
        if (!decision.accepted) throw conflict('That vehicle is no longer available for this period.')
        windows.push({ ...candidate, status: ASSIGNMENT_STATUSES.ACTIVE })
        return 'reserved'
      })

    const [first, second] = await Promise.allSettled([reserve(), reserve()])
    const fulfilled = [first, second].filter((result) => result.status === 'fulfilled')
    const rejected = [first, second].filter((result) => result.status === 'rejected')
    assert.equal(fulfilled.length, 1)
    assert.equal(rejected.length, 1)
    assert.equal(windows.length, 1)
    const reason = rejected[0]?.status === 'rejected' ? rejected[0].reason : undefined
    const message = reason instanceof AppError ? reason.message : String(reason)
    assert.ok(
      message.includes('no longer available') || message === VEHICLE_LOCK_BUSY_MESSAGE,
    )
  })
})

describe('money quote', () => {
  it('multiplies a daily rate without using floating point', () => {
    assert.equal(multiplyMoney('120.50', 3), '361.50')
    assert.equal(multiplyMoney('0.10', 2), '0.20')
  })
})
