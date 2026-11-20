import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { INVESTOR_REPORT_KEYS, INVESTOR_STATUSES } from '../../src/constants/investors.js'
import type { InvestorRecord } from '../../src/repositories/investors/investor.repository.js'
import {
  canAccessReport,
  canAccessVehicleId,
  isInvestorPortalStatus,
  normalizeScopeInput,
  resolveEffectiveScope,
  toReportingScope,
} from '../../src/services/investors/investor-scope.js'

function investor(overrides: Partial<InvestorRecord> = {}): InvestorRecord {
  return {
    id: '507f1f77bcf86cd799439011',
    organizationId: '507f1f77bcf86cd799439012',
    userId: '507f1f77bcf86cd799439013',
    investorNumber: 'INV-000001',
    displayName: 'Test Investor',
    contactEmail: 'investor@example.com',
    status: INVESTOR_STATUSES.ACTIVE,
    scope: {
      legalEntityIds: [],
      branchIds: [],
      vehicleIds: [],
      reportKeys: [],
    },
    createdBy: '507f1f77bcf86cd799439014',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('investor scope', () => {
  it('default-denies when scope grants are empty', () => {
    const effective = resolveEffectiveScope(investor())
    assert.equal(effective.hasDataAccess, false)
    assert.equal(toReportingScope(effective), null)
  })

  it('allows vehicle only when branch/vehicle grants match', () => {
    const effective = resolveEffectiveScope(
      investor({
        scope: {
          legalEntityIds: [],
          branchIds: ['b1'],
          vehicleIds: ['v1'],
          reportKeys: [INVESTOR_REPORT_KEYS.FLEET_PERFORMANCE],
        },
      }),
    )
    assert.equal(effective.hasDataAccess, true)
    assert.equal(
      canAccessVehicleId(effective, {
        id: 'v1',
        branchId: 'b1',
        legalEntityId: 'le1',
        organizationId: '507f1f77bcf86cd799439012',
      }),
      true,
    )
    assert.equal(
      canAccessVehicleId(effective, {
        id: 'v2',
        branchId: 'b1',
        legalEntityId: 'le1',
        organizationId: '507f1f77bcf86cd799439012',
      }),
      false,
    )
    assert.equal(canAccessReport(effective, INVESTOR_REPORT_KEYS.FLEET_PERFORMANCE), true)
    assert.equal(canAccessReport(effective, INVESTOR_REPORT_KEYS.REVENUE_SUMMARY), false)
  })

  it('blocks suspended investors from portal status', () => {
    assert.equal(isInvestorPortalStatus(INVESTOR_STATUSES.SUSPENDED), false)
    assert.equal(isInvestorPortalStatus(INVESTOR_STATUSES.ACTIVE), true)
  })

  it('normalizes scope input uniquely', () => {
    const scope = normalizeScopeInput({
      branchIds: ['a', 'a', 'b'],
      reportKeys: ['fleet_performance', 'FLEET_PERFORMANCE'],
    })
    assert.deepEqual(scope.branchIds, ['a', 'b'])
    assert.deepEqual(scope.reportKeys, ['FLEET_PERFORMANCE'])
  })
})
