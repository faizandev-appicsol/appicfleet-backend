import type {
  ExpenseRecord,
  LpoRecord,
  VendorBillRecord,
  VendorRecord,
  WorkOrderRecord,
} from '../../repositories/procurement/procurement.repository.js'
import {
  findExpenseById,
  findLpoById,
  findVendorBillById,
  findVendorById,
  findWorkOrderById,
} from '../../repositories/procurement/procurement.repository.js'
import type { AccessContext } from '../../types/access.js'
import { notFound } from '../../utils/httpErrors.js'
import { hasBranchAccess, hasOrganizationAccess } from '../authorization/authorization.service.js'
import {
  hasVehicleLegalEntityScope,
  isOrganizationWide,
  resolveVehicleOrganization,
} from '../vehicles/vehicle-access.js'

export { isOrganizationWide }

export function resolveProcurementOrganization(ctx: AccessContext, requested?: string): string {
  return resolveVehicleOrganization(ctx, requested)
}

type Scoped = { organizationId: string; branchId: string; legalEntityId: string }

export function canAccessProcurementRecord(ctx: AccessContext, record: Scoped): boolean {
  return (
    hasOrganizationAccess(ctx, record.organizationId) &&
    hasBranchAccess(ctx, record.branchId, record.organizationId) &&
    hasVehicleLegalEntityScope(ctx, record.legalEntityId, record.organizationId)
  )
}

export async function loadAccessibleVendor(ctx: AccessContext, id: string): Promise<VendorRecord> {
  const vendor = await findVendorById(id)
  if (!vendor || !canAccessProcurementRecord(ctx, vendor)) throw notFound('Vendor was not found.')
  return vendor
}

export async function loadAccessibleLpo(ctx: AccessContext, id: string): Promise<LpoRecord> {
  const lpo = await findLpoById(id)
  if (!lpo || !canAccessProcurementRecord(ctx, lpo)) throw notFound('LPO was not found.')
  return lpo
}

export async function loadAccessibleVendorBill(ctx: AccessContext, id: string): Promise<VendorBillRecord> {
  const bill = await findVendorBillById(id)
  if (!bill || !canAccessProcurementRecord(ctx, bill)) throw notFound('Vendor bill was not found.')
  return bill
}

export async function loadAccessibleExpense(ctx: AccessContext, id: string): Promise<ExpenseRecord> {
  const expense = await findExpenseById(id)
  if (!expense || !canAccessProcurementRecord(ctx, expense)) throw notFound('Expense was not found.')
  return expense
}

export async function loadAccessibleWorkOrder(ctx: AccessContext, id: string): Promise<WorkOrderRecord> {
  const order = await findWorkOrderById(id)
  if (!order || !canAccessProcurementRecord(ctx, order)) throw notFound('Work order was not found.')
  return order
}
