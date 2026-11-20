import type { ContractRecord } from '../../repositories/contracts/contract.repository.js'
import { findContractById } from '../../repositories/contracts/contract.repository.js'
import type { AccessContext } from '../../types/access.js'
import { notFound } from '../../utils/httpErrors.js'
import { hasBranchAccess, hasOrganizationAccess } from '../authorization/authorization.service.js'
import {
  hasVehicleLegalEntityScope,
  isOrganizationWide,
  resolveVehicleOrganization,
} from '../vehicles/vehicle-access.js'

export { isOrganizationWide }

export function resolveContractOrganization(ctx: AccessContext, requested?: string): string {
  return resolveVehicleOrganization(ctx, requested)
}

export function canAccessContract(ctx: AccessContext, contract: ContractRecord): boolean {
  return (
    hasOrganizationAccess(ctx, contract.organizationId) &&
    hasBranchAccess(ctx, contract.branchId, contract.organizationId) &&
    hasVehicleLegalEntityScope(ctx, contract.legalEntityId, contract.organizationId)
  )
}

export async function loadAccessibleContract(ctx: AccessContext, id: string): Promise<ContractRecord> {
  const contract = await findContractById(id)
  if (!contract || !canAccessContract(ctx, contract)) throw notFound('Contract was not found.')
  return contract
}
