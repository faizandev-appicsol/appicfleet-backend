import { toPublicEnum } from '../../constants/vehicles.js'
import type { InvestorRecord } from '../../repositories/investors/investor.repository.js'
import { scopeSummary } from './investor-scope.js'

export function toInvestorAdminResource(investor: InvestorRecord) {
  return {
    id: investor.id,
    organizationId: investor.organizationId,
    userId: investor.userId,
    investorNumber: investor.investorNumber,
    displayName: investor.displayName,
    legalName: investor.legalName ?? null,
    contactEmail: investor.contactEmail,
    phone: investor.phone ?? null,
    status: toPublicEnum(investor.status as never),
    accessStartsAt: investor.accessStartsAt?.toISOString() ?? null,
    accessEndsAt: investor.accessEndsAt?.toISOString() ?? null,
    scope: {
      legalEntityIds: investor.scope.legalEntityIds,
      branchIds: investor.scope.branchIds,
      vehicleIds: investor.scope.vehicleIds,
      reportKeys: investor.scope.reportKeys.map((key) => key.toLowerCase()),
    },
    accessPreview: scopeSummary(investor.scope),
    notes: investor.notes ?? null,
    invitedAt: investor.invitedAt?.toISOString() ?? null,
    activatedAt: investor.activatedAt?.toISOString() ?? null,
    suspendedAt: investor.suspendedAt?.toISOString() ?? null,
    revokedAt: investor.revokedAt?.toISOString() ?? null,
    createdAt: investor.createdAt.toISOString(),
    updatedAt: investor.updatedAt.toISOString(),
  }
}

export function toInvestorProfileResource(investor: InvestorRecord) {
  return {
    id: investor.id,
    investorNumber: investor.investorNumber,
    displayName: investor.displayName,
    legalName: investor.legalName ?? null,
    contactEmail: investor.contactEmail,
    phone: investor.phone ?? null,
    status: toPublicEnum(investor.status as never),
    organizationId: investor.organizationId,
    accessStartsAt: investor.accessStartsAt?.toISOString() ?? null,
    accessEndsAt: investor.accessEndsAt?.toISOString() ?? null,
  }
}
