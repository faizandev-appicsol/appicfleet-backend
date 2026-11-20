import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { ASSIGNMENT_STATUSES } from '../src/constants/vehicles.js'
import { AppError } from '../src/exceptions/AppError.js'
import {
  decideAssignment,
  type AssignmentWindow,
} from '../src/services/vehicles/availability-rules.js'
import {
  runWithVehicleLock,
  VEHICLE_LOCK_BUSY_MESSAGE,
  type VehicleLockStore,
} from '../src/services/vehicles/vehicle-lock.js'

const at = (iso: string) => new Date(iso)
const window = (from: string, to: string, status = ASSIGNMENT_STATUSES.ACTIVE): AssignmentWindow => ({
  startsAt: at(from),
  endsAt: at(to),
  status,
})

describe('decideAssignment (pure race rule)', () => {
  const existing = [window('2026-07-01T00:00:00Z', '2026-07-05T00:00:00Z')]

  it('rejects a candidate that overlaps an active assignment', () => {
    const decision = decideAssignment(existing, {
      startsAt: at('2026-07-04T00:00:00Z'),
      endsAt: at('2026-07-08T00:00:00Z'),
    })
    assert.equal(decision.accepted, false)
    assert.equal(decision.conflicts.length, 1)
  })

  it('accepts a non-overlapping candidate, including one that starts when another ends', () => {
    const touching = decideAssignment(existing, {
      startsAt: at('2026-07-05T00:00:00Z'),
      endsAt: at('2026-07-09T00:00:00Z'),
    })
    assert.equal(touching.accepted, true)
    const later = decideAssignment(existing, {
      startsAt: at('2026-08-01T00:00:00Z'),
      endsAt: at('2026-08-02T00:00:00Z'),
    })
    assert.equal(later.accepted, true)
  })

  it('ignores released assignments', () => {
    const released = [window('2026-07-01T00:00:00Z', '2026-07-05T00:00:00Z', ASSIGNMENT_STATUSES.RELEASED)]
    const decision = decideAssignment(released, {
      startsAt: at('2026-07-02T00:00:00Z'),
      endsAt: at('2026-07-03T00:00:00Z'),
    })
    assert.equal(decision.accepted, true)
  })
})

/**
 * In-memory stand-in for the Mongo lock collection. `acquire` is synchronous inside, which mirrors
 * the atomic findOneAndUpdate + unique index on vehicleId: only one caller can take a live lock.
 */
function createFakeLockStore(): VehicleLockStore & {
  locks: Map<string, { token: string; lockedUntil: Date }>
} {
  const locks = new Map<string, { token: string; lockedUntil: Date }>()
  return {
    locks,
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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('vehicle lock: two concurrent overlapping assignment requests, only one wins', () => {
  /** Mirrors availability.service createAssignment: lock -> overlap decision -> insert. */
  function makeAssigner(store: VehicleLockStore, table: AssignmentWindow[]) {
    return (startsAt: string, endsAt: string) =>
      runWithVehicleLock(store, 'vehicle-1', async () => {
        const candidate = { startsAt: at(startsAt), endsAt: at(endsAt) }
        await sleep(10) // widen the race window: both requests are "inside" at the same time
        const decision = decideAssignment(table, candidate)
        if (!decision.accepted) throw new AppError('overlap', 409, 'CONFLICT')
        table.push({ ...candidate, status: ASSIGNMENT_STATUSES.ACTIVE })
      })
  }

  it('lets exactly one of two simultaneous overlapping requests succeed; the other gets 409', async () => {
    const store = createFakeLockStore()
    const table: AssignmentWindow[] = []
    const assign = makeAssigner(store, table)

    const results = await Promise.allSettled([
      assign('2026-07-01T00:00:00Z', '2026-07-05T00:00:00Z'),
      assign('2026-07-03T00:00:00Z', '2026-07-08T00:00:00Z'),
    ])

    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
    const rejected = results.filter((result) => result.status === 'rejected')
    assert.equal(rejected.length, 1)
    const reason = (rejected[0] as PromiseRejectedResult).reason as AppError
    assert.equal(reason.statusCode, 409)
    assert.equal(reason.message, VEHICLE_LOCK_BUSY_MESSAGE)
    assert.equal(table.length, 1)
  })

  it('releases the lock afterwards, so a later non-overlapping request is accepted and an overlapping one is rejected', async () => {
    const store = createFakeLockStore()
    const table: AssignmentWindow[] = []
    const assign = makeAssigner(store, table)

    await assign('2026-07-01T00:00:00Z', '2026-07-05T00:00:00Z')
    await assign('2026-07-05T00:00:00Z', '2026-07-09T00:00:00Z')
    await assert.rejects(
      assign('2026-07-02T00:00:00Z', '2026-07-03T00:00:00Z'),
      (error: unknown) => error instanceof AppError && error.statusCode === 409,
    )
    assert.equal(table.length, 2)
  })

  it('releases the lock even when the work throws', async () => {
    const store = createFakeLockStore()
    await assert.rejects(
      runWithVehicleLock(store, 'vehicle-1', async () => {
        throw new Error('boom')
      }),
      /boom/,
    )
    const second = await runWithVehicleLock(store, 'vehicle-1', async () => 'ok')
    assert.equal(second, 'ok')
  })

  it('does not block different vehicles against each other', async () => {
    const store = createFakeLockStore()
    const results = await Promise.all([
      runWithVehicleLock(store, 'vehicle-1', async () => {
        await sleep(10)
        return 'one'
      }),
      runWithVehicleLock(store, 'vehicle-2', async () => 'two'),
    ])
    assert.deepEqual(results, ['one', 'two'])
  })

  it('takes over an expired lock, and a stale holder cannot release the new owner', async () => {
    const store = createFakeLockStore()
    // A crashed holder left a lock that expired one second ago.
    store.locks.set('vehicle-1', { token: 'stale', lockedUntil: new Date(Date.now() - 1000) })

    let during: string | undefined
    await runWithVehicleLock(store, 'vehicle-1', async () => {
      during = store.locks.get('vehicle-1')?.token
      // The stale holder wakes up and tries to release: must not free the new owner's lock.
      await store.release('vehicle-1', 'stale', new Date())
      const live = store.locks.get('vehicle-1')
      assert.ok(live && live.lockedUntil.getTime() > Date.now())
    })
    assert.notEqual(during, 'stale')
    assert.ok(during)
  })
})
