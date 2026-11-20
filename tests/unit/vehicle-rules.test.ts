import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import {
  ASSIGNMENT_STATUSES,
  COMPLIANCE_STATES,
  OWNERSHIP_TYPES,
  VEHICLE_STATUSES,
  type VehicleStatus,
} from '../../src/constants/vehicles.js'
import { AppError } from '../../src/exceptions/AppError.js'
import {
  AVAILABILITY_REASONS,
  decideAvailability,
  type AssignmentWindow,
} from '../../src/services/vehicles/availability-rules.js'
import {
  COMPLIANCE_SOON_DAYS,
  evaluateCompliance,
  evaluateDate,
} from '../../src/services/vehicles/compliance.js'
import {
  findOverlappingRate,
  intervalsOverlap,
  rateRangesOverlap,
} from '../../src/services/vehicles/intervals.js'
import { validateOwnership } from '../../src/services/vehicles/ownership-rules.js'
import {
  assertTransition,
  canTransition,
  isNonOperationalStatus,
} from '../../src/services/vehicles/status-rules.js'
import { isZeroMoney, MONEY_REGEX, normalizeMoney } from '../../src/utils/money.js'

const S = VEHICLE_STATUSES
const at = (iso: string) => new Date(iso)

describe('vehicle status transitions', () => {
  // Independent copy of the specification table, so the test fails if the rules drift.
  const allowed: Record<VehicleStatus, VehicleStatus[]> = {
    [S.AVAILABLE]: [S.RESERVED, S.MAINTENANCE, S.INSPECTION, S.OUT_OF_SERVICE, S.INACTIVE],
    [S.RESERVED]: [S.AVAILABLE, S.RENTED, S.OUT_OF_SERVICE],
    [S.RENTED]: [S.AVAILABLE, S.MAINTENANCE, S.INSPECTION],
    [S.MAINTENANCE]: [S.AVAILABLE, S.INSPECTION, S.OUT_OF_SERVICE, S.INACTIVE],
    [S.INSPECTION]: [S.AVAILABLE, S.MAINTENANCE, S.OUT_OF_SERVICE, S.INACTIVE],
    [S.OUT_OF_SERVICE]: [S.AVAILABLE, S.MAINTENANCE, S.INACTIVE],
    [S.INACTIVE]: [S.AVAILABLE],
  }

  it('allows exactly the specified transitions and denies every other pair', () => {
    for (const from of Object.values(S)) {
      for (const to of Object.values(S)) {
        assert.equal(canTransition(from, to), allowed[from].includes(to), `${from} -> ${to}`)
      }
    }
  })

  it('denies a few notable transitions', () => {
    assert.equal(canTransition(S.AVAILABLE, S.RENTED), false)
    assert.equal(canTransition(S.RENTED, S.RESERVED), false)
    assert.equal(canTransition(S.INACTIVE, S.MAINTENANCE), false)
    assert.equal(canTransition(S.AVAILABLE, S.AVAILABLE), false)
  })

  it('assertTransition throws a 422 for a denied transition and passes an allowed one', () => {
    assert.doesNotThrow(() => assertTransition(S.AVAILABLE, S.MAINTENANCE))
    assert.throws(
      () => assertTransition(S.INACTIVE, S.RENTED),
      (error: unknown) => error instanceof AppError && error.statusCode === 422,
    )
  })

  it('treats inactive, out of service, maintenance and inspection as non-operational', () => {
    for (const status of [S.INACTIVE, S.OUT_OF_SERVICE, S.MAINTENANCE, S.INSPECTION]) {
      assert.equal(isNonOperationalStatus(status), true, status)
    }
    for (const status of [S.AVAILABLE, S.RESERVED, S.RENTED]) {
      assert.equal(isNonOperationalStatus(status), false, status)
    }
  })
})

describe('interval overlap', () => {
  const a = { starts: at('2026-03-01T00:00:00Z'), ends: at('2026-03-10T00:00:00Z') }

  it('detects partial, containing and contained overlaps', () => {
    assert.equal(intervalsOverlap(a, { starts: at('2026-03-05T00:00:00Z'), ends: at('2026-03-15T00:00:00Z') }), true)
    assert.equal(intervalsOverlap(a, { starts: at('2026-02-20T00:00:00Z'), ends: at('2026-03-02T00:00:00Z') }), true)
    assert.equal(intervalsOverlap(a, { starts: at('2026-02-01T00:00:00Z'), ends: at('2026-04-01T00:00:00Z') }), true)
    assert.equal(intervalsOverlap(a, { starts: at('2026-03-02T00:00:00Z'), ends: at('2026-03-03T00:00:00Z') }), true)
  })

  it('does not overlap when disjoint or merely touching', () => {
    assert.equal(intervalsOverlap(a, { starts: at('2026-03-10T00:00:00Z'), ends: at('2026-03-12T00:00:00Z') }), false)
    assert.equal(intervalsOverlap(a, { starts: at('2026-02-25T00:00:00Z'), ends: at('2026-03-01T00:00:00Z') }), false)
    assert.equal(intervalsOverlap(a, { starts: at('2026-05-01T00:00:00Z'), ends: at('2026-05-02T00:00:00Z') }), false)
  })

  it('is symmetric', () => {
    const b = { starts: at('2026-03-09T00:00:00Z'), ends: at('2026-03-20T00:00:00Z') }
    assert.equal(intervalsOverlap(a, b), intervalsOverlap(b, a))
  })
})

describe('compliance', () => {
  const now = at('2026-06-15T10:00:00Z')
  const day = (offset: number) => new Date(Date.UTC(2026, 5, 15 + offset))

  it('exposes the 30 day window', () => {
    assert.equal(COMPLIANCE_SOON_DAYS, 30)
  })

  it('evaluates one date as missing, expired, expiring or valid', () => {
    assert.equal(evaluateDate(undefined, now), COMPLIANCE_STATES.MISSING)
    assert.equal(evaluateDate(null, now), COMPLIANCE_STATES.MISSING)
    assert.equal(evaluateDate(day(-1), now), COMPLIANCE_STATES.EXPIRED)
    assert.equal(evaluateDate(day(0), now), COMPLIANCE_STATES.EXPIRING)
    assert.equal(evaluateDate(day(30), now), COMPLIANCE_STATES.EXPIRING)
    assert.equal(evaluateDate(day(31), now), COMPLIANCE_STATES.VALID)
  })

  it('is valid when every date is comfortably in the future', () => {
    const result = evaluateCompliance(
      { registrationExpiresOn: day(200), insuranceExpiresOn: day(120), inspectionExpiresOn: day(90) },
      now,
    )
    assert.equal(result.overall, COMPLIANCE_STATES.VALID)
  })

  it('takes the worst state: expired > expiring > missing > valid', () => {
    const valid = day(200)
    assert.equal(
      evaluateCompliance({ registrationExpiresOn: valid, insuranceExpiresOn: valid }, now).overall,
      COMPLIANCE_STATES.MISSING,
    )
    assert.equal(
      evaluateCompliance(
        { registrationExpiresOn: valid, insuranceExpiresOn: day(10), inspectionExpiresOn: valid },
        now,
      ).overall,
      COMPLIANCE_STATES.EXPIRING,
    )
    // expiring beats missing
    assert.equal(
      evaluateCompliance({ registrationExpiresOn: valid, insuranceExpiresOn: day(10) }, now).overall,
      COMPLIANCE_STATES.EXPIRING,
    )
    // expired beats everything
    const expired = evaluateCompliance(
      { registrationExpiresOn: day(-3), insuranceExpiresOn: day(10) },
      now,
    )
    assert.equal(expired.registration, COMPLIANCE_STATES.EXPIRED)
    assert.equal(expired.inspection, COMPLIANCE_STATES.MISSING)
    assert.equal(expired.overall, COMPLIANCE_STATES.EXPIRED)
  })

  it('reports missing when no dates are set', () => {
    assert.equal(evaluateCompliance({}, now).overall, COMPLIANCE_STATES.MISSING)
  })
})

describe('rate range overlap', () => {
  const range = (from: string, to: string | null) => ({
    effectiveFrom: at(from),
    effectiveTo: to === null ? null : at(to),
  })

  it('overlaps when ranges intersect', () => {
    assert.equal(
      rateRangesOverlap(range('2026-01-01T00:00:00Z', '2026-06-01T00:00:00Z'), range('2026-05-01T00:00:00Z', '2026-09-01T00:00:00Z')),
      true,
    )
  })

  it('allows a card to start exactly where the previous one ends', () => {
    assert.equal(
      rateRangesOverlap(range('2026-01-01T00:00:00Z', '2026-06-01T00:00:00Z'), range('2026-06-01T00:00:00Z', null)),
      false,
    )
  })

  it('treats an open end as far future', () => {
    const open = range('2026-01-01T00:00:00Z', null)
    assert.equal(rateRangesOverlap(open, range('2030-01-01T00:00:00Z', '2030-02-01T00:00:00Z')), true)
    assert.equal(rateRangesOverlap(open, range('2025-01-01T00:00:00Z', '2026-01-01T00:00:00Z')), false)
    assert.equal(rateRangesOverlap(open, range('2027-01-01T00:00:00Z', null)), true)
  })

  it('finds the first overlapping card, or null', () => {
    const cards = [
      { id: 'old', ...range('2025-01-01T00:00:00Z', '2026-01-01T00:00:00Z') },
      { id: 'current', ...range('2026-01-01T00:00:00Z', null) },
    ]
    assert.equal(findOverlappingRate(cards, range('2026-03-01T00:00:00Z', '2026-04-01T00:00:00Z'))?.id, 'current')
    assert.equal(findOverlappingRate(cards.slice(0, 1), range('2026-03-01T00:00:00Z', null)), null)
  })
})

describe('availability decision', () => {
  const window = { startsAt: at('2026-07-01T00:00:00Z'), endsAt: at('2026-07-05T00:00:00Z') }
  const active: AssignmentWindow = {
    startsAt: at('2026-07-03T00:00:00Z'),
    endsAt: at('2026-07-10T00:00:00Z'),
    status: ASSIGNMENT_STATUSES.ACTIVE,
  }

  it('blocks non-operational statuses even with no assignments', () => {
    for (const status of [S.INACTIVE, S.OUT_OF_SERVICE, S.MAINTENANCE, S.INSPECTION]) {
      const decision = decideAvailability(status, [], window)
      assert.equal(decision.available, false, status)
      assert.equal(decision.reasons.length, 1, status)
    }
  })

  it('does not block a rented vehicle for a window that no assignment overlaps', () => {
    const later = {
      startsAt: at('2026-08-01T00:00:00Z'),
      endsAt: at('2026-08-05T00:00:00Z'),
    }
    assert.equal(decideAvailability(S.RENTED, [active], later).available, true)
    assert.equal(decideAvailability(S.RESERVED, [active], later).available, true)
  })

  it('blocks on an overlapping active assignment but ignores released ones', () => {
    const blocked = decideAvailability(S.AVAILABLE, [active], window)
    assert.equal(blocked.available, false)
    assert.deepEqual(blocked.reasons, [AVAILABILITY_REASONS.ASSIGNMENT_OVERLAP])
    const released = { ...active, status: ASSIGNMENT_STATUSES.RELEASED }
    assert.equal(decideAvailability(S.AVAILABLE, [released], window).available, true)
  })
})

describe('ownership rules', () => {
  it('accepts a company vehicle without ownership details', () => {
    assert.deepEqual(validateOwnership(OWNERSHIP_TYPES.COMPANY, undefined), {})
  })

  it('requires the identifying party per ownership type', () => {
    assert.ok(validateOwnership(OWNERSHIP_TYPES.INVESTOR, {}).investorName)
    assert.ok(validateOwnership(OWNERSHIP_TYPES.BORROWED, {}).lenderName)
    assert.ok(validateOwnership(OWNERSHIP_TYPES.LEASED, {}).lessorName)
  })

  it('rejects fields that belong to another ownership type', () => {
    const errors = validateOwnership(OWNERSHIP_TYPES.INVESTOR, {
      investorName: 'Demo Investor',
      lessorName: 'Not allowed',
    })
    assert.ok(errors.lessorName)
    assert.equal(errors.investorName, undefined)
  })

  it('validates lease dates and the amount/currency pair', () => {
    const errors = validateOwnership(OWNERSHIP_TYPES.LEASED, {
      lessorName: 'Demo Leasing Co',
      leaseStartsOn: at('2026-06-01T00:00:00Z'),
      leaseEndsOn: at('2026-05-01T00:00:00Z'),
      leaseAmount: '85000.00',
    })
    assert.ok(errors.leaseEndsOn)
    assert.ok(errors.leaseCurrency)
  })
})

describe('money strings', () => {
  it('matches the decimal-string format only', () => {
    for (const ok of ['0', '150', '150.5', '150.00', '999999999999.99']) {
      assert.equal(MONEY_REGEX.test(ok), true, ok)
    }
    for (const bad of ['', '-1', '1.234', '1,000', '1e3', '.5', '1.', '1234567890123']) {
      assert.equal(MONEY_REGEX.test(bad), false, bad)
    }
  })

  it('normalizes to two decimals without using floats', () => {
    assert.equal(normalizeMoney('150'), '150.00')
    assert.equal(normalizeMoney('150.5'), '150.50')
    assert.equal(normalizeMoney('0.1'), '0.10')
    assert.equal(normalizeMoney('007.25'), '7.25')
  })

  it('detects zero amounts', () => {
    assert.equal(isZeroMoney('0'), true)
    assert.equal(isZeroMoney('0.00'), true)
    assert.equal(isZeroMoney('0.01'), false)
  })
})
