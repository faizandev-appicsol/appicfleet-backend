import { toPublicEnum } from '../../constants/vehicles.js'
import {
  findActiveRates,
  insertVehicleRate,
  listVehicleRates,
  supersedeActiveRates,
  type VehicleRateRecord,
} from '../../repositories/vehicles/vehicle-rate.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import { resolvePagination, toPaginated } from '../../utils/pagination.js'
import type {
  CreateVehicleRateBody,
  ListVehicleRatesQuery,
} from '../../validations/vehicle.validation.js'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, recordAuditEvent } from '../audit/audit.service.js'
import { findOverlappingRate } from './intervals.js'
import { loadAccessibleVehicle } from './vehicle-access.js'
import { withVehicleLock } from './vehicle-lock.service.js'

export type VehicleRateResource = {
  id: string
  vehicleId: string
  rateType: string
  /** Decimal string, e.g. "150.00". */
  amount: string
  currency: string
  effectiveFrom: string
  effectiveTo: string | null
  status: string
  createdBy: string
  createdAt: string
}

function toResource(rate: VehicleRateRecord): VehicleRateResource {
  return {
    id: rate.id,
    vehicleId: rate.vehicleId,
    rateType: toPublicEnum(rate.rateType),
    amount: rate.amount,
    currency: rate.currency,
    effectiveFrom: rate.effectiveFrom.toISOString(),
    effectiveTo: rate.effectiveTo ? rate.effectiveTo.toISOString() : null,
    status: toPublicEnum(rate.status),
    createdBy: rate.createdBy,
    createdAt: rate.createdAt.toISOString(),
  }
}

export async function listRates(ctx: AccessContext, vehicleId: string, query: ListVehicleRatesQuery) {
  const vehicle = await loadAccessibleVehicle(ctx, vehicleId)
  const pagination = resolvePagination(query)
  const result = await listVehicleRates({
    vehicleId: vehicle.id,
    organizationId: vehicle.organizationId,
    skip: pagination.skip,
    take: pagination.take,
    rateType: query.rateType,
    status: query.status,
  })
  return toPaginated(result.items.map(toResource), pagination.page, pagination.limit, result.total)
}

/**
 * Adds a rate card. When an ACTIVE card of the same type overlaps the new window, that card is
 * superseded (history kept) and the new card becomes ACTIVE — so edit/replace from the form works.
 */
export async function createRate(
  ctx: AccessContext,
  vehicleId: string,
  input: CreateVehicleRateBody,
  meta: RequestMeta,
): Promise<VehicleRateResource> {
  const vehicle = await loadAccessibleVehicle(ctx, vehicleId)
  const candidate = { effectiveFrom: input.effectiveFrom, effectiveTo: input.effectiveTo ?? null }

  const rate = await withVehicleLock(vehicle.id, async () => {
    const active = await findActiveRates(vehicle.id, vehicle.organizationId, input.rateType)
    const sameAmount = active.find(
      (card) =>
        card.amount === input.amount &&
        card.currency === input.currency &&
        card.effectiveTo === null,
    )
    if (sameAmount) return sameAmount

    const overlapping = active.filter((card) => findOverlappingRate([card], candidate))
    if (overlapping.length > 0) {
      await supersedeActiveRates({
        vehicleId: vehicle.id,
        organizationId: vehicle.organizationId,
        rateType: input.rateType,
        effectiveTo: candidate.effectiveFrom,
        rateIds: overlapping.map((card) => card.id),
      })
    }

    return insertVehicleRate({
      vehicleId: vehicle.id,
      organizationId: vehicle.organizationId,
      rateType: input.rateType,
      amount: input.amount,
      currency: input.currency,
      effectiveFrom: candidate.effectiveFrom,
      effectiveTo: candidate.effectiveTo,
      createdBy: ctx.userId,
    })
  })

  await recordAuditEvent({
    action: AUDIT_ACTIONS.VEHICLE_RATE_CREATE,
    entityType: AUDIT_ENTITY_TYPES.VEHICLE,
    entityId: vehicle.id,
    actorUserId: ctx.userId,
    organizationId: vehicle.organizationId,
    branchId: vehicle.branchId,
    metadata: {
      rateId: rate.id,
      rateType: rate.rateType,
      amount: rate.amount,
      currency: rate.currency,
      effectiveFrom: rate.effectiveFrom,
      effectiveTo: rate.effectiveTo,
    },
    meta,
  })
  return toResource(rate)
}
