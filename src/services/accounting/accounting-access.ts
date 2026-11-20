import type { FiscalPeriodRecord, GlAccountRecord, JournalRecord } from '../../repositories/accounting/accounting.repository.js'
import {
  findAccountById,
  findFiscalPeriodById,
  findJournalById,
} from '../../repositories/accounting/accounting.repository.js'
import type { AccessContext } from '../../types/access.js'
import { notFound } from '../../utils/httpErrors.js'
import { hasBranchAccess, hasOrganizationAccess } from '../authorization/authorization.service.js'
import {
  hasVehicleLegalEntityScope,
  isOrganizationWide,
  resolveVehicleOrganization,
} from '../vehicles/vehicle-access.js'

export { isOrganizationWide }

export function resolveAccountingOrganization(ctx: AccessContext, requested?: string): string {
  return resolveVehicleOrganization(ctx, requested)
}

export function canAccessAccountingScope(
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

export async function loadAccessibleAccount(ctx: AccessContext, id: string): Promise<GlAccountRecord> {
  const account = await findAccountById(id)
  if (!account || !hasOrganizationAccess(ctx, account.organizationId)) throw notFound('Account was not found.')
  if (account.legalEntityId && !hasVehicleLegalEntityScope(ctx, account.legalEntityId, account.organizationId)) {
    throw notFound('Account was not found.')
  }
  return account
}

export async function loadAccessibleJournal(ctx: AccessContext, id: string): Promise<JournalRecord> {
  const journal = await findJournalById(id)
  if (
    !journal ||
    !canAccessAccountingScope(ctx, {
      organizationId: journal.organizationId,
      branchId: journal.branchId,
      legalEntityId: journal.legalEntityId,
    })
  ) {
    throw notFound('Journal was not found.')
  }
  return journal
}

export async function loadAccessiblePeriod(ctx: AccessContext, id: string): Promise<FiscalPeriodRecord> {
  const period = await findFiscalPeriodById(id)
  if (
    !period ||
    !canAccessAccountingScope(ctx, {
      organizationId: period.organizationId,
      legalEntityId: period.legalEntityId,
    })
  ) {
    throw notFound('Fiscal period was not found.')
  }
  return period
}
