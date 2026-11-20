import { PERMISSIONS } from '../../constants/permissions.js'
import {
  findEInvoiceById,
  findTaxCodeById,
  findTaxPeriodById,
} from '../../repositories/tax/tax.repository.js'
import type { AccessContext } from '../../types/access.js'
import { notFound } from '../../utils/httpErrors.js'
import { assertPermission, hasBranchAccess, hasOrganizationAccess } from '../authorization/authorization.service.js'
import {
  hasVehicleLegalEntityScope,
  resolveVehicleOrganization,
} from '../vehicles/vehicle-access.js'

export function resolveTaxOrganization(ctx: AccessContext, requested?: string): string {
  return resolveVehicleOrganization(ctx, requested)
}

export function canAccessTaxScope(
  ctx: AccessContext,
  record: { organizationId: string; branchId?: string; legalEntityId?: string },
): boolean {
  if (!hasOrganizationAccess(ctx, record.organizationId)) return false
  if (record.branchId && !hasBranchAccess(ctx, record.branchId, record.organizationId)) return false
  if (record.legalEntityId && !hasVehicleLegalEntityScope(ctx, record.legalEntityId, record.organizationId)) {
    return false
  }
  return true
}

export async function loadAccessibleTaxCode(ctx: AccessContext, taxCodeId: string) {
  assertPermission(ctx, PERMISSIONS.TAX_VIEW)
  const row = await findTaxCodeById(taxCodeId)
  if (!row || !canAccessTaxScope(ctx, { organizationId: String(row.organizationId), legalEntityId: row.legalEntityId ? String(row.legalEntityId) : undefined })) {
    throw notFound('Tax code was not found.')
  }
  return row
}

export async function loadAccessibleTaxPeriod(ctx: AccessContext, periodId: string) {
  assertPermission(ctx, PERMISSIONS.TAX_VIEW)
  const row = await findTaxPeriodById(periodId)
  if (!row || !canAccessTaxScope(ctx, { organizationId: String(row.organizationId), legalEntityId: String(row.legalEntityId) })) {
    throw notFound('Tax period was not found.')
  }
  return row
}

export async function loadAccessibleEInvoice(ctx: AccessContext, documentId: string) {
  assertPermission(ctx, PERMISSIONS.EINVOICE_VIEW)
  const row = await findEInvoiceById(documentId)
  if (
    !row ||
    !canAccessTaxScope(ctx, {
      organizationId: String(row.organizationId),
      branchId: String(row.branchId),
      legalEntityId: String(row.legalEntityId),
    })
  ) {
    throw notFound('E-invoice was not found.')
  }
  return row
}
