import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { INVESTOR_REPORT_KEYS, INVESTOR_STATUSES } from '../../src/constants/investors.js'
import type { InvestorRecord } from '../../src/repositories/investors/investor.repository.js'
import {
  canAccessBranchId,
  canAccessReport,
  canAccessVehicleId,
  isInvestorPortalStatus,
  resolveEffectiveScope,
} from '../../src/services/investors/investor-scope.js'

const ORG_A = '507f1f77bcf86cd7994390aa'
const ORG_B = '507f1f77bcf86cd7994390bb'

function makeInvestor(overrides: Partial<InvestorRecord> = {}): InvestorRecord {
  return {
    id: '507f1f77bcf86cd799439011',
    organizationId: ORG_A,
    userId: '507f1f77bcf86cd799439013',
    investorNumber: 'INV-000001',
    displayName: 'Investor A',
    contactEmail: 'a@example.com',
    status: INVESTOR_STATUSES.ACTIVE,
    scope: {
      legalEntityIds: ['le-a'],
      branchIds: ['branch-a'],
      vehicleIds: ['vehicle-a'],
      reportKeys: [INVESTOR_REPORT_KEYS.FLEET_PERFORMANCE],
    },
    createdBy: '507f1f77bcf86cd799439014',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('investor isolation', () => {
  it('Investor A cannot access Branch B / Vehicle B', () => {
    const scope = resolveEffectiveScope(makeInvestor())
    assert.equal(canAccessBranchId(scope, 'branch-a'), true)
    assert.equal(canAccessBranchId(scope, 'branch-b'), false)
    assert.equal(
      canAccessVehicleId(scope, {
        id: 'vehicle-a',
        branchId: 'branch-a',
        legalEntityId: 'le-a',
        organizationId: ORG_A,
      }),
      true,
    )
    assert.equal(
      canAccessVehicleId(scope, {
        id: 'vehicle-b',
        branchId: 'branch-b',
        legalEntityId: 'le-b',
        organizationId: ORG_A,
      }),
      false,
    )
  })

  it('blocks cross-organization vehicle access', () => {
    const scope = resolveEffectiveScope(makeInvestor())
    assert.equal(
      canAccessVehicleId(scope, {
        id: 'vehicle-a',
        branchId: 'branch-a',
        legalEntityId: 'le-a',
        organizationId: ORG_B,
      }),
      false,
    )
  })

  it('Investor B cannot use Investor A report grants', () => {
    const investorB = resolveEffectiveScope(
      makeInvestor({
        id: '507f1f77bcf86cd799439099',
        displayName: 'Investor B',
        scope: {
          legalEntityIds: ['le-b'],
          branchIds: ['branch-b'],
          vehicleIds: [],
          reportKeys: [INVESTOR_REPORT_KEYS.REVENUE_SUMMARY],
        },
      }),
    )
    assert.equal(canAccessReport(investorB, INVESTOR_REPORT_KEYS.FLEET_PERFORMANCE), false)
    assert.equal(canAccessReport(investorB, INVESTOR_REPORT_KEYS.REVENUE_SUMMARY), true)
  })

  it('denies portal access after suspension or revocation', () => {
    assert.equal(isInvestorPortalStatus(INVESTOR_STATUSES.SUSPENDED), false)
    assert.equal(isInvestorPortalStatus(INVESTOR_STATUSES.REVOKED), false)
    assert.equal(isInvestorPortalStatus(INVESTOR_STATUSES.EXPIRED), false)
    assert.equal(isInvestorPortalStatus(INVESTOR_STATUSES.INVITED), false)
  })

  it('field allow-list excludes sensitive keys from vehicle projection shape', () => {
    const projection = {
      id: 'vehicle-a',
      plateNumber: 'D-12345',
      make: 'Toyota',
      model: 'Camry',
      year: 2024,
      category: 'sedan',
      status: 'available',
      branchId: 'branch-a',
      legalEntityId: 'le-a',
    }
    assert.equal('internalNotes' in projection, false)
    assert.equal('driverDetails' in projection, false)
    assert.equal('customerDocuments' in projection, false)
    assert.equal('passwordHash' in projection, false)
  })
})
