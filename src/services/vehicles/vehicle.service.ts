import { PERMISSIONS } from '../../constants/permissions.js'
import { ENTITY_STATUSES } from '../../constants/roles.js'
import { VEHICLE_STATUSES, type VehicleStatus } from '../../constants/vehicles.js'
import type { IVehicleCompliance, IVehicleOwnership } from '../../interfaces/vehicle.interface.js'
import { findBranchById } from '../../repositories/branches/branch.repository.js'
import { findLegalEntityById } from '../../repositories/legal-entities/legal-entity.repository.js'
import { findOrganizationById } from '../../repositories/organizations/organization.repository.js'
import {
  countVehiclesByStatus,
  createVehicle,
  listVehicles,
  softDeleteVehicle,
  transitionVehicleStatus,
  updateVehicle,
  type VehicleUpdate,
} from '../../repositories/vehicles/vehicle.repository.js'
import {
  DEFAULT_VEHICLE_MAKES,
  DEFAULT_VEHICLE_TYPES,
  mergeCatalogWithDefaults,
} from '../../constants/vehicle-catalog.js'
import {
  listVehicleMakesForUser,
  upsertVehicleMakeForUser,
} from '../../repositories/vehicles/vehicle-make.repository.js'
import {
  listVehicleTypesForUser,
  upsertVehicleTypeForUser,
} from '../../repositories/vehicles/vehicle-type.repository.js'
import {
  insertVehicleStatusEvent,
  listVehicleStatusEvents,
} from '../../repositories/vehicles/vehicle-status-event.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import { conflict, invalidField, notFound } from '../../utils/httpErrors.js'
import { resolvePagination, toPaginated } from '../../utils/pagination.js'
import type {
  ChangeVehicleStatusBody,
  CreateVehicleBody,
  ListVehiclesQuery,
  UpdateVehicleBody,
  VehicleStatsQuery,
  VehicleStatusHistoryQuery,
} from '../../validations/vehicle.validation.js'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, recordAuditEvent } from '../audit/audit.service.js'
import { assertBranchAccess, assertPermission } from '../authorization/authorization.service.js'
import { evaluateCompliance } from './compliance.js'
import { assertOwnership, pickOwnership } from './ownership-rules.js'
import { assertTransition } from './status-rules.js'
import {
  assertVehicleLegalEntityScope,
  isOrganizationWide,
  loadAccessibleVehicle,
  resolveVehicleOrganization,
} from './vehicle-access.js'
import {
  toStatusEventResource,
  toVehicleListResource,
  toVehicleResource,
  type VehicleResource,
} from './vehicle.mapper.js'

export type { VehicleResource } from './vehicle.mapper.js'

/** The branch must exist in the organization, be active, and be inside the caller's scope. */
async function resolveBranch(ctx: AccessContext, branchId: string, organizationId: string) {
  const branch = await findBranchById(branchId)
  if (!branch || branch.organizationId !== organizationId) {
    throw invalidField('branchId', 'Branch was not found in this organization')
  }
  if (branch.status !== ENTITY_STATUSES.ACTIVE) throw invalidField('branchId', 'Branch is not active')
  assertBranchAccess(ctx, branch.id, organizationId)
  return branch
}

/** The legal entity must exist in the same organization, be active, and be inside the caller's scope. */
async function resolveLegalEntity(ctx: AccessContext, legalEntityId: string, organizationId: string) {
  const legalEntity = await findLegalEntityById(legalEntityId)
  if (!legalEntity || legalEntity.organizationId !== organizationId) {
    throw invalidField('legalEntityId', 'Legal entity was not found in this organization')
  }
  if (legalEntity.status !== ENTITY_STATUSES.ACTIVE) {
    throw invalidField('legalEntityId', 'Legal entity is not active')
  }
  assertVehicleLegalEntityScope(ctx, legalEntity.id, organizationId)
  return legalEntity
}

export async function listVehicleDirectory(ctx: AccessContext, query: ListVehiclesQuery) {
  const organizationId = resolveVehicleOrganization(ctx, query.organizationId)
  const pagination = resolvePagination(query)
  const orgWide = isOrganizationWide(ctx)

  // Branch isolation: branch-limited accounts only see their branches ($in) AND the requested filter.
  let branchIds: string[] | undefined = orgWide ? undefined : [...ctx.branchIds]
  if (query.branchId) {
    branchIds = branchIds ? branchIds.filter((id) => id === query.branchId) : [query.branchId]
  }
  // Legal-entity isolation, only for accounts that have assignments and are not organization-wide.
  const legalEntityIds = !orgWide && ctx.legalEntityIds.length > 0 ? [...ctx.legalEntityIds] : undefined

  const result = await listVehicles({
    organizationId,
    skip: pagination.skip,
    take: pagination.take,
    search: query.search?.trim() ? query.search.trim() : undefined,
    status: query.status,
    ownershipType: query.ownershipType,
    complianceState: query.compliance,
    category: query.category?.trim() ? query.category.trim() : undefined,
    branchIds,
    legalEntityIds,
    sort: query.sort ?? 'plateNumber',
    order: query.order ?? 'asc',
  })

  const now = new Date()
  return toPaginated(
    result.items.map((vehicle) => toVehicleListResource(vehicle, now)),
    pagination.page,
    pagination.limit,
    result.total,
  )
}

/** Register KPI counts (available / rented / maintenance / total) for the current filter scope. */
export async function getVehicleRegisterStats(ctx: AccessContext, query: VehicleStatsQuery) {
  assertPermission(ctx, PERMISSIONS.VEHICLE_VIEW)
  const organizationId = resolveVehicleOrganization(ctx, query.organizationId)
  const orgWide = isOrganizationWide(ctx)

  let branchIds: string[] | undefined = orgWide ? undefined : [...ctx.branchIds]
  if (query.branchId) {
    branchIds = branchIds ? branchIds.filter((id) => id === query.branchId) : [query.branchId]
  }
  const legalEntityIds = !orgWide && ctx.legalEntityIds.length > 0 ? [...ctx.legalEntityIds] : undefined

  const { total, byStatus } = await countVehiclesByStatus({
    organizationId,
    search: query.search?.trim() ? query.search.trim() : undefined,
    ownershipType: query.ownershipType,
    complianceState: query.compliance,
    category: query.category?.trim() ? query.category.trim() : undefined,
    branchIds,
    legalEntityIds,
  })

  const available = byStatus.AVAILABLE ?? 0
  const rented = byStatus.RENTED ?? 0
  const maintenance = byStatus.MAINTENANCE ?? 0

  return {
    total,
    available,
    rented,
    maintenance,
    byStatus: Object.fromEntries(
      Object.entries(byStatus).map(([key, value]) => [key.toLowerCase(), value]),
    ),
  }
}

export async function getVehicle(ctx: AccessContext, id: string): Promise<VehicleResource> {
  return toVehicleResource(await loadAccessibleVehicle(ctx, id), new Date())
}

export async function addVehicle(
  ctx: AccessContext,
  input: CreateVehicleBody,
  meta: RequestMeta,
): Promise<VehicleResource> {
  const organizationId = resolveVehicleOrganization(ctx, input.organizationId)
  if (ctx.accessAllOrganizations) {
    const organization = await findOrganizationById(organizationId)
    if (!organization) throw invalidField('organizationId', 'Organization was not found')
    if (organization.status !== ENTITY_STATUSES.ACTIVE) {
      throw invalidField('organizationId', 'Organization is not active')
    }
  }

  const branch = await resolveBranch(ctx, input.branchId, organizationId)
  const legalEntity = await resolveLegalEntity(
    ctx,
    input.legalEntityId ?? branch.legalEntityId,
    organizationId,
  )

  const ownership = pickOwnership(input.ownershipType, input.ownership)
  const compliance: IVehicleCompliance = {
    registrationExpiresOn: input.compliance?.registrationExpiresOn,
    insuranceExpiresOn: input.compliance?.insuranceExpiresOn,
    inspectionExpiresOn: input.compliance?.inspectionExpiresOn,
  }

  const vehicle = await createVehicle({
    organizationId,
    legalEntityId: legalEntity.id,
    branchId: branch.id,
    plateNumber: input.plateNumber,
    vin: input.vin,
    make: input.make,
    model: input.model,
    year: input.year,
    color: input.color,
    category: input.category,
    transmission: input.transmission,
    fuelType: input.fuelType,
    seatingCapacity: input.seatingCapacity,
    engineNumber: input.engineNumber,
    mileageKm: input.mileageKm,
    purchasedOn: input.purchasedOn,
    salikTagNumber: input.salikTagNumber,
    mulkiyaNumber: input.mulkiyaNumber,
    latitude: input.latitude,
    longitude: input.longitude,
    featureOnWebsite: input.featureOnWebsite ?? false,
    notes: input.notes,
    ownershipType: input.ownershipType,
    ownership,
    status: VEHICLE_STATUSES.AVAILABLE,
    compliance,
    complianceState: evaluateCompliance(compliance, new Date()).overall,
    createdBy: ctx.userId,
  })

  await upsertVehicleMakeForUser({
    organizationId,
    userId: ctx.userId,
    name: vehicle.make,
  })
  await upsertVehicleTypeForUser({
    organizationId,
    userId: ctx.userId,
    name: vehicle.category,
  })

  await recordAuditEvent({
    action: AUDIT_ACTIONS.VEHICLE_CREATE,
    entityType: AUDIT_ENTITY_TYPES.VEHICLE,
    entityId: vehicle.id,
    actorUserId: ctx.userId,
    organizationId,
    branchId: vehicle.branchId,
    metadata: {
      plateNumber: vehicle.plateNumber,
      legalEntityId: vehicle.legalEntityId,
      ownershipType: vehicle.ownershipType,
    },
    meta,
  })
  return toVehicleResource(vehicle, new Date())
}

/** Makes previously saved by this user for the active organization (dropdown source). */
export async function listVehicleMakes(ctx: AccessContext, organizationIdInput?: string) {
  assertPermission(ctx, PERMISSIONS.VEHICLE_VIEW)
  const organizationId = resolveVehicleOrganization(ctx, organizationIdInput)
  const items = await listVehicleMakesForUser(organizationId, ctx.userId)
  return {
    items: mergeCatalogWithDefaults(
      items.map((item) => ({ id: item.id, name: item.name })),
      DEFAULT_VEHICLE_MAKES,
    ),
  }
}

/** Types previously saved by this user for the active organization (dropdown source). */
export async function listVehicleTypes(ctx: AccessContext, organizationIdInput?: string) {
  assertPermission(ctx, PERMISSIONS.VEHICLE_VIEW)
  const organizationId = resolveVehicleOrganization(ctx, organizationIdInput)
  const items = await listVehicleTypesForUser(organizationId, ctx.userId)
  return {
    items: mergeCatalogWithDefaults(
      items.map((item) => ({ id: item.id, name: item.name })),
      DEFAULT_VEHICLE_TYPES,
    ),
  }
}

export async function changeVehicle(
  ctx: AccessContext,
  id: string,
  input: UpdateVehicleBody,
  meta: RequestMeta,
): Promise<VehicleResource> {
  const existing = await loadAccessibleVehicle(ctx, id)

  if (input.branchId && input.branchId !== existing.branchId) {
    await resolveBranch(ctx, input.branchId, existing.organizationId)
  }
  if (input.legalEntityId && input.legalEntityId !== existing.legalEntityId) {
    await resolveLegalEntity(ctx, input.legalEntityId, existing.organizationId)
  }

  // Ownership is replaced as a whole whenever it (or its type) is part of the request.
  const ownershipType = input.ownershipType ?? existing.ownershipType
  let ownership: IVehicleOwnership | null | undefined
  if (input.ownership !== undefined || ownershipType !== existing.ownershipType) {
    assertOwnership(ownershipType, input.ownership)
    ownership = pickOwnership(ownershipType, input.ownership) ?? null
  }

  // Recompute the denormalized compliance state from the merged dates (also refreshes a stale value).
  const mergedDates: IVehicleCompliance = { ...existing.compliance }
  for (const key of ['registrationExpiresOn', 'insuranceExpiresOn', 'inspectionExpiresOn'] as const) {
    const value = input.compliance?.[key]
    if (value !== undefined) mergedDates[key] = value ?? undefined
  }
  const complianceState = evaluateCompliance(mergedDates, new Date()).overall

  const update: VehicleUpdate = {
    plateNumber: input.plateNumber,
    vin: input.vin,
    make: input.make,
    model: input.model,
    year: input.year,
    color: input.color,
    category: input.category,
    transmission: input.transmission,
    fuelType: input.fuelType,
    seatingCapacity: input.seatingCapacity,
    engineNumber: input.engineNumber,
    mileageKm: input.mileageKm,
    purchasedOn: input.purchasedOn,
    salikTagNumber: input.salikTagNumber,
    mulkiyaNumber: input.mulkiyaNumber,
    latitude: input.latitude,
    longitude: input.longitude,
    featureOnWebsite: input.featureOnWebsite,
    notes: input.notes,
    branchId: input.branchId,
    legalEntityId: input.legalEntityId,
    ownershipType: input.ownershipType,
    ownership,
    compliance: input.compliance,
    complianceState,
  }

  const updated = await updateVehicle(existing.id, existing.organizationId, update)
  if (!updated) throw notFound('Vehicle was not found.')

  if (updated.make) {
    await upsertVehicleMakeForUser({
      organizationId: updated.organizationId,
      userId: ctx.userId,
      name: updated.make,
    })
  }
  if (updated.category) {
    await upsertVehicleTypeForUser({
      organizationId: updated.organizationId,
      userId: ctx.userId,
      name: updated.category,
    })
  }

  await recordAuditEvent({
    action: AUDIT_ACTIONS.VEHICLE_UPDATE,
    entityType: AUDIT_ENTITY_TYPES.VEHICLE,
    entityId: updated.id,
    actorUserId: ctx.userId,
    organizationId: updated.organizationId,
    branchId: updated.branchId,
    metadata: {
      changedFields: Object.entries(input)
        .filter(([, value]) => value !== undefined)
        .map(([key]) => key),
      plateNumber: updated.plateNumber,
    },
    meta,
  })
  return toVehicleResource(updated, new Date())
}

/**
 * Applies a status transition. Rules are enforced here, not by clients:
 * - moving to or from INACTIVE additionally needs `vehicle.deactivate`;
 * - the transition must be in the allowed table (else 422);
 * - the write is compare-and-set on the current status, so two racing changes cannot both win.
 */
export async function changeVehicleStatus(
  ctx: AccessContext,
  id: string,
  input: ChangeVehicleStatusBody,
  meta: RequestMeta,
): Promise<VehicleResource> {
  const vehicle = await loadAccessibleVehicle(ctx, id)
  const from: VehicleStatus = vehicle.status
  const to: VehicleStatus = input.status

  if (to === VEHICLE_STATUSES.INACTIVE || from === VEHICLE_STATUSES.INACTIVE) {
    assertPermission(ctx, PERMISSIONS.VEHICLE_DEACTIVATE)
  }
  assertTransition(from, to)

  const updated = await transitionVehicleStatus(vehicle.id, vehicle.organizationId, from, to)
  if (!updated) throw conflict('Vehicle status changed in the meantime. Reload and retry.')

  await insertVehicleStatusEvent({
    vehicleId: updated.id,
    organizationId: updated.organizationId,
    branchId: updated.branchId,
    fromStatus: from,
    toStatus: to,
    reason: input.reason,
    actorUserId: ctx.userId,
  })

  await recordAuditEvent({
    action: AUDIT_ACTIONS.VEHICLE_STATUS_CHANGE,
    entityType: AUDIT_ENTITY_TYPES.VEHICLE,
    entityId: updated.id,
    actorUserId: ctx.userId,
    organizationId: updated.organizationId,
    branchId: updated.branchId,
    metadata: { from, to, reason: input.reason },
    meta,
  })
  return toVehicleResource(updated, new Date())
}

/** Deactivation is a status transition to INACTIVE (same rules, history and audit). */
export async function deactivateVehicle(
  ctx: AccessContext,
  id: string,
  reason: string,
  meta: RequestMeta,
): Promise<VehicleResource> {
  return changeVehicleStatus(ctx, id, { status: VEHICLE_STATUSES.INACTIVE, reason }, meta)
}

/**
 * Soft-deletes a vehicle (sets deletedAt). Never hard-removes the document.
 * Blocked while the vehicle is rented or reserved.
 */
export async function deleteVehicle(
  ctx: AccessContext,
  id: string,
  meta: RequestMeta,
): Promise<void> {
  assertPermission(ctx, PERMISSIONS.VEHICLE_DEACTIVATE)
  const vehicle = await loadAccessibleVehicle(ctx, id)

  if (vehicle.status === VEHICLE_STATUSES.RENTED || vehicle.status === VEHICLE_STATUSES.RESERVED) {
    throw conflict('Cannot delete a vehicle that is rented or reserved. Release it first.')
  }

  const deleted = await softDeleteVehicle(vehicle.id, vehicle.organizationId, ctx.userId)
  if (!deleted) throw notFound('Vehicle was not found.')

  await recordAuditEvent({
    action: AUDIT_ACTIONS.VEHICLE_DELETE,
    entityType: AUDIT_ENTITY_TYPES.VEHICLE,
    entityId: deleted.id,
    actorUserId: ctx.userId,
    organizationId: deleted.organizationId,
    branchId: deleted.branchId,
    metadata: {
      plateNumber: deleted.plateNumber,
      softDelete: true,
      previousStatus: vehicle.status,
    },
    meta,
  })
}

export async function listVehicleStatusHistory(
  ctx: AccessContext,
  id: string,
  query: VehicleStatusHistoryQuery,
) {
  const vehicle = await loadAccessibleVehicle(ctx, id)
  const pagination = resolvePagination(query)
  const result = await listVehicleStatusEvents({
    vehicleId: vehicle.id,
    organizationId: vehicle.organizationId,
    skip: pagination.skip,
    take: pagination.take,
  })
  return toPaginated(
    result.items.map(toStatusEventResource),
    pagination.page,
    pagination.limit,
    result.total,
  )
}
