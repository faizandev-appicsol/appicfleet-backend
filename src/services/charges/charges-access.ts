import type { FineRecord, RefundRecord, TollRecord } from '../../repositories/charges/charges.repository.js'
import {
  findFineById,
  findImportBatchById,
  findRefundById,
  findTollById,
} from '../../repositories/charges/charges.repository.js'
import type { AccessContext } from '../../types/access.js'
import { notFound } from '../../utils/httpErrors.js'
import { hasBranchAccess, hasOrganizationAccess } from '../authorization/authorization.service.js'
import {
  hasVehicleLegalEntityScope,
  isOrganizationWide,
  resolveVehicleOrganization,
} from '../vehicles/vehicle-access.js'

export { isOrganizationWide }

export function resolveChargeOrganization(ctx: AccessContext, requested?: string): string {
  return resolveVehicleOrganization(ctx, requested)
}

type Scoped = { organizationId: string; branchId: string; legalEntityId: string }

export function canAccessChargeRecord(ctx: AccessContext, record: Scoped): boolean {
  return (
    hasOrganizationAccess(ctx, record.organizationId) &&
    hasBranchAccess(ctx, record.branchId, record.organizationId) &&
    hasVehicleLegalEntityScope(ctx, record.legalEntityId, record.organizationId)
  )
}

export async function loadAccessibleFine(ctx: AccessContext, id: string): Promise<FineRecord> {
  const fine = await findFineById(id)
  if (!fine || !canAccessChargeRecord(ctx, fine)) throw notFound('Fine was not found.')
  return fine
}

export async function loadAccessibleToll(ctx: AccessContext, id: string): Promise<TollRecord> {
  const toll = await findTollById(id)
  if (!toll || !canAccessChargeRecord(ctx, toll)) throw notFound('Toll was not found.')
  return toll
}

export async function loadAccessibleRefund(ctx: AccessContext, id: string): Promise<RefundRecord> {
  const refund = await findRefundById(id)
  if (!refund || !canAccessChargeRecord(ctx, refund)) throw notFound('Refund was not found.')
  return refund
}

export async function loadAccessibleImportBatch(ctx: AccessContext, id: string) {
  const batch = await findImportBatchById(id)
  if (!batch) throw notFound('Import batch was not found.')
  const scoped = {
    organizationId: String(batch.organizationId),
    branchId: String(batch.branchId),
    legalEntityId: String(batch.legalEntityId),
  }
  if (!canAccessChargeRecord(ctx, scoped)) throw notFound('Import batch was not found.')
  return batch
}
