import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { CONTRACT_STATUSES, CONTRACT_TYPES } from '../../src/constants/contracts.js'
import { ASSIGNMENT_STATUSES } from '../../src/constants/vehicles.js'
import { AppError } from '../../src/exceptions/AppError.js'
import {
  assignmentsOverlap,
  canTransition,
  decideConversion,
  extensionContinuity,
  freezeSnapshot,
  isDraftType,
  projectReplacement,
  requiredCustomerType,
  selectBillableCharges,
  type ReplacementWindow,
} from '../../src/services/contracts/contract-rules.js'
import { decideAssignment, type AssignmentWindow } from '../../src/services/vehicles/availability-rules.js'
import {
  runWithVehicleLock,
  VEHICLE_LOCK_BUSY_MESSAGE,
  type VehicleLockStore,
} from '../../src/services/vehicles/vehicle-lock.js'
import { conflict } from '../../src/utils/httpErrors.js'
import { multiplyMoney } from '../../src/utils/money.js'

const DAY = 24 * 60 * 60 * 1000
const at = (iso: string) => new Date(iso).getTime()

describe('contract types and lifecycle', () => {
  it('treats draft B2C and draft B2B as a type plus draft', () => {
    assert.equal(isDraftType(CONTRACT_TYPES.B2C, CONTRACT_STATUSES.DRAFT), true)
    assert.equal(isDraftType(CONTRACT_TYPES.B2B, CONTRACT_STATUSES.DRAFT), true)
    assert.equal(isDraftType(CONTRACT_TYPES.BORROW, CONTRACT_STATUSES.DRAFT), false)
    assert.equal(requiredCustomerType(CONTRACT_TYPES.B2C), 'INDIVIDUAL')
    assert.equal(requiredCustomerType(CONTRACT_TYPES.B2B), 'CORPORATE')
    assert.equal(requiredCustomerType(CONTRACT_TYPES.BORROW), undefined)
  })

  it('allows the contract lifecycle and rejects a closed contract becoming active', () => {
    assert.equal(canTransition(CONTRACT_STATUSES.DRAFT, CONTRACT_STATUSES.PENDING_APPROVAL), true)
    assert.equal(canTransition(CONTRACT_STATUSES.PENDING_APPROVAL, CONTRACT_STATUSES.APPROVED), true)
    assert.equal(canTransition(CONTRACT_STATUSES.PENDING_APPROVAL, CONTRACT_STATUSES.CANCELLED), true)
    assert.equal(canTransition(CONTRACT_STATUSES.APPROVED, CONTRACT_STATUSES.ACTIVE), true)
    assert.equal(canTransition(CONTRACT_STATUSES.ACTIVE, CONTRACT_STATUSES.SUSPENDED), true)
    assert.equal(canTransition(CONTRACT_STATUSES.SUSPENDED, CONTRACT_STATUSES.ACTIVE), true)
    assert.equal(canTransition(CONTRACT_STATUSES.ACTIVE, CONTRACT_STATUSES.COMPLETED), true)
    assert.equal(canTransition(CONTRACT_STATUSES.ACTIVE, CONTRACT_STATUSES.TERMINATED), true)
    assert.equal(canTransition(CONTRACT_STATUSES.CANCELLED, CONTRACT_STATUSES.ACTIVE), false)
    assert.equal(canTransition(CONTRACT_STATUSES.COMPLETED, CONTRACT_STATUSES.ACTIVE), false)
    assert.equal(canTransition(CONTRACT_STATUSES.DRAFT, CONTRACT_STATUSES.ACTIVE), false)
  })
})

describe('5-day allocation and extensions', () => {
  const start = at('2026-01-01T10:00:00Z')
  const day6 = start + 5 * DAY
  const day11 = day6 + 5 * DAY
  const day16 = day11 + 5 * DAY

  it('allows the next 5 days to start when the first 5 days end', () => {
    assert.equal(
      assignmentsOverlap(
        { starts: new Date(start), ends: new Date(day6) },
        { starts: new Date(day6), ends: new Date(day11) },
      ),
      false,
    )
    assert.equal(extensionContinuity(new Date(day6), new Date(day6), new Date(day11)), 'ok')
  })

  it('rejects an overlapping extension and a gap', () => {
    const overlapStart = day6 - DAY
    assert.equal(extensionContinuity(new Date(day6), new Date(overlapStart), new Date(day11)), 'overlap')
    assert.equal(extensionContinuity(new Date(day6), new Date(day6 + DAY), new Date(day11)), 'gap')
  })

  it('keeps two extensions continuous and bills each slice once', () => {
    assert.equal(extensionContinuity(new Date(day6), new Date(day6), new Date(day11)), 'ok')
    assert.equal(extensionContinuity(new Date(day11), new Date(day11), new Date(day16)), 'ok')
    const charges = selectBillableCharges([
      { id: 'rent', kind: 'RENTAL', sourceId: 'contract-1' },
      { id: 'ext-1', kind: 'EXTENSION', sourceId: 'ext-1' },
      { id: 'ext-2', kind: 'EXTENSION', sourceId: 'ext-2' },
    ])
    assert.deepEqual(charges.map((charge) => charge.id), ['rent', 'ext-1', 'ext-2'])
    assert.equal(multiplyMoney('100.00', 5), '500.00')
  })
})

describe('replacements do not duplicate the contract or the rental charge', () => {
  const old: ReplacementWindow = {
    id: 'a',
    contractId: 'C-100',
    vehicleId: 'vehicle-a',
    startsAt: at('2026-01-01T10:00:00Z'),
    endsAt: at('2026-01-10T10:00:00Z'),
  }

  it('keeps the contract id and the original vehicle on the closed window', () => {
    const first = projectReplacement({
      contractId: 'C-100',
      customerId: 'customer-1',
      termsVersionId: 'terms-1',
      old,
      replacementVehicleId: 'vehicle-b',
      at: at('2026-01-05T10:00:00Z'),
      available: true,
    })
    assert.equal(first.ok, true)
    if (!first.ok) return
    assert.equal(first.contractId, 'C-100')
    assert.equal(first.customerId, 'customer-1')
    assert.equal(first.termsVersionId, 'terms-1')
    assert.equal(first.assignments[0]?.vehicleId, 'vehicle-a')
    assert.equal(first.assignments[1]?.vehicleId, 'vehicle-b')
    assert.equal(first.assignments[1]?.contractId, 'C-100')

    const second = projectReplacement({
      contractId: first.contractId,
      customerId: first.customerId,
      termsVersionId: first.termsVersionId,
      old: first.assignments[1]!,
      replacementVehicleId: 'vehicle-c',
      at: at('2026-01-07T10:00:00Z'),
      available: true,
    })
    assert.equal(second.ok, true)
    if (!second.ok) return
    const third = projectReplacement({
      contractId: second.contractId,
      customerId: second.customerId,
      termsVersionId: second.termsVersionId,
      old: second.assignments[1]!,
      replacementVehicleId: 'vehicle-d',
      at: at('2026-01-08T10:00:00Z'),
      available: true,
    })
    assert.equal(third.ok, true)
    if (!third.ok) return
    assert.equal(third.contractId, 'C-100')
    assert.deepEqual(
      [first.assignments[0]?.vehicleId, second.assignments[0]?.vehicleId, third.assignments[0]?.vehicleId, third.assignments[1]?.vehicleId],
      ['vehicle-a', 'vehicle-b', 'vehicle-c', 'vehicle-d'],
    )
  })

  it('rejects an unavailable replacement and leaves the old window unchanged', () => {
    const before = { ...old }
    const rejected = projectReplacement({
      contractId: 'C-100',
      customerId: 'customer-1',
      old: before,
      replacementVehicleId: 'vehicle-b',
      at: at('2026-01-05T10:00:00Z'),
      available: false,
    })
    assert.deepEqual(rejected, { ok: false, reason: 'unavailable' })
    assert.equal(before.vehicleId, 'vehicle-a')
    assert.equal(before.endsAt, old.endsAt)
    const charges = selectBillableCharges([
      { id: 'rent', kind: 'RENTAL', sourceId: 'C-100', supersededBy: 'amend-1' },
      { id: 'amend-1', kind: 'AMENDMENT', sourceId: 'amend-1' },
    ])
    assert.deepEqual(charges.map((charge) => charge.id), ['amend-1'])
  })
})

describe('booking conversion and snapshots', () => {
  it('replays a booking that already has a contract', () => {
    assert.equal(decideConversion(undefined), 'create')
    assert.equal(decideConversion('contract-1'), 'replay')
  })

  it('does not let a later customer edit rewrite the frozen snapshot', () => {
    const customer = { displayName: 'Demo Individual', phone: '+000' }
    const frozen = freezeSnapshot(customer)
    customer.displayName = 'Changed'
    assert.equal(frozen.displayName, 'Demo Individual')
  })
})

describe('concurrent assignment', () => {
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
        if (current?.token === token) locks.set(vehicleId, { token, lockedUntil: new Date(now.getTime() - 1) })
      },
    }
  }

  it('lets only one overlapping replacement reserve the vehicle', async () => {
    const store = createFakeLockStore()
    const windows: AssignmentWindow[] = []
    const candidate = {
      startsAt: new Date('2026-01-05T10:00:00Z'),
      endsAt: new Date('2026-01-10T10:00:00Z'),
    }
    const reserve = () =>
      runWithVehicleLock(store, 'vehicle-b', async () => {
        const decision = decideAssignment(windows, candidate)
        if (!decision.accepted) throw conflict('The replacement vehicle is not available for this period.')
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
    assert.ok(message.includes('not available') || message === VEHICLE_LOCK_BUSY_MESSAGE)
  })
})
