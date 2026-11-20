import { BORROW_RATE_TYPES, DEFAULT_CURRENCY } from '../../constants/procurement.js'
import { PERMISSIONS } from '../../constants/permissions.js'
import {
  emitAccountingSourceEvent,
  insertBorrowCostTerm,
  listBorrowCostTerms,
} from '../../repositories/procurement/procurement.repository.js'
import { findVehicleById } from '../../repositories/vehicles/vehicle.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import { multiplyMoney, normalizeMoney } from '../../utils/money.js'
import { invalidField, notFound } from '../../utils/httpErrors.js'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, recordAuditEvent } from '../audit/audit.service.js'
import { assertPermission } from '../authorization/authorization.service.js'
import { canAccessProcurementRecord } from './procurement-access.js'
import { requireActiveVendor } from './vendor.service.js'

type CreateTermBody = {
  vendorId: string
  vehicleId: string
  rateType: string
  rateAmount: string
  currency?: string
  effectiveFrom: Date
  effectiveTo?: Date
  notes?: string
}

export async function createBorrowCostTerm(ctx: AccessContext, body: CreateTermBody, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.VENDOR_EDIT)
  const vendor = await requireActiveVendor(ctx, body.vendorId)
  const vehicle = await findVehicleById(body.vehicleId)
  if (!vehicle || !canAccessProcurementRecord(ctx, vehicle)) throw notFound('Vehicle was not found.')
  const rateType = body.rateType.toUpperCase()
  if (!(Object.values(BORROW_RATE_TYPES) as string[]).includes(rateType)) {
    throw invalidField('rateType', 'Unsupported borrow rate type.')
  }
  const term = await insertBorrowCostTerm({
    organizationId: vendor.organizationId,
    vendorId: vendor.id,
    vehicleId: vehicle.id,
    rateType,
    rateAmount: normalizeMoney(body.rateAmount),
    currency: (body.currency ?? DEFAULT_CURRENCY).toUpperCase(),
    effectiveFrom: body.effectiveFrom,
    effectiveTo: body.effectiveTo,
    notes: body.notes,
    createdBy: ctx.userId,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.BORROW_COST_CREATE,
    entityType: AUDIT_ENTITY_TYPES.BORROW_COST,
    entityId: String(term._id),
    actorUserId: ctx.userId,
    organizationId: vendor.organizationId,
    branchId: vendor.branchId,
    metadata: { vehicleId: vehicle.id, rateType, rateAmount: body.rateAmount },
    meta,
  })
  return {
    id: String(term._id),
    vendorId: vendor.id,
    vehicleId: vehicle.id,
    rateType: rateType.toLowerCase(),
    rateAmount: normalizeMoney(body.rateAmount),
    currency: (body.currency ?? DEFAULT_CURRENCY).toUpperCase(),
    effectiveFrom: body.effectiveFrom.toISOString(),
    effectiveTo: body.effectiveTo?.toISOString(),
  }
}

export async function listBorrowTermsForVehicle(ctx: AccessContext, vehicleId: string) {
  assertPermission(ctx, PERMISSIONS.VENDOR_VIEW)
  const vehicle = await findVehicleById(vehicleId)
  if (!vehicle || !canAccessProcurementRecord(ctx, vehicle)) throw notFound('Vehicle was not found.')
  const rows = await listBorrowCostTerms(vehicle.organizationId, vehicle.id)
  return rows.map((row) => ({
    id: String((row as { _id: { toString(): string } })._id),
    vendorId: String((row as { vendorId: unknown }).vendorId),
    vehicleId: String((row as { vehicleId: unknown }).vehicleId),
    rateType: String((row as { rateType: string }).rateType).toLowerCase(),
    rateAmount: String((row as { rateAmount: string }).rateAmount),
    currency: String((row as { currency: string }).currency),
    effectiveFrom: (row as { effectiveFrom: Date }).effectiveFrom?.toISOString?.(),
    effectiveTo: (row as { effectiveTo?: Date }).effectiveTo?.toISOString?.(),
  }))
}

/** Allocate supplier cost for a usage period using the latest effective term. Never mutates historical terms. */
export async function allocateBorrowCost(
  ctx: AccessContext,
  input: { vehicleId: string; usageDays: number; asOf?: Date },
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.VENDOR_VIEW)
  if (!Number.isInteger(input.usageDays) || input.usageDays < 1) {
    throw invalidField('usageDays', 'usageDays must be a positive integer.')
  }
  const vehicle = await findVehicleById(input.vehicleId)
  if (!vehicle || !canAccessProcurementRecord(ctx, vehicle)) throw notFound('Vehicle was not found.')
  const terms = await listBorrowCostTerms(vehicle.organizationId, vehicle.id)
  const asOf = input.asOf ?? new Date()
  const active = terms.find((row) => {
    const from = (row as { effectiveFrom: Date }).effectiveFrom
    const to = (row as { effectiveTo?: Date }).effectiveTo
    return from.getTime() <= asOf.getTime() && (!to || to.getTime() > asOf.getTime())
  })
  if (!active) throw notFound('No effective borrow cost term was found.')
  const rateType = String((active as { rateType: string }).rateType)
  const rateAmount = normalizeMoney(String((active as { rateAmount: string }).rateAmount))
  let supplierCost = rateAmount
  if (rateType === BORROW_RATE_TYPES.DAILY) supplierCost = multiplyMoney(rateAmount, input.usageDays)
  else if (rateType === BORROW_RATE_TYPES.WEEKLY) {
    const weeks = Math.ceil(input.usageDays / 7)
    supplierCost = multiplyMoney(rateAmount, weeks)
  } else if (rateType === BORROW_RATE_TYPES.MONTHLY) {
    const months = Math.ceil(input.usageDays / 30)
    supplierCost = multiplyMoney(rateAmount, months)
  }

  await emitAccountingSourceEvent({
    organizationId: vehicle.organizationId,
    eventType: 'borrow_cost.incurred',
    entityType: 'borrow_cost',
    entityId: String((active as { _id: { toString(): string } })._id),
    idempotencyKey: `borrow_cost.incurred:${vehicle.id}:${asOf.toISOString().slice(0, 10)}:${input.usageDays}`,
    payload: {
      vehicleId: vehicle.id,
      vendorId: String((active as { vendorId: unknown }).vendorId),
      usageDays: input.usageDays,
      rateType,
      rateAmount,
      supplierCost,
      currency: String((active as { currency: string }).currency),
    },
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.BORROW_COST_CREATE,
    entityType: AUDIT_ENTITY_TYPES.BORROW_COST,
    entityId: String((active as { _id: { toString(): string } })._id),
    actorUserId: ctx.userId,
    organizationId: vehicle.organizationId,
    branchId: vehicle.branchId,
    metadata: { supplierCost, usageDays: input.usageDays },
    meta,
  })
  return { vehicleId: vehicle.id, usageDays: input.usageDays, rateType: rateType.toLowerCase(), rateAmount, supplierCost }
}
