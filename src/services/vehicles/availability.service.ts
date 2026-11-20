import { toPublicEnum } from '../../constants/vehicles.js'
import {
  findActiveAssignmentsOverlapping,
  findVehicleAssignment,
  insertVehicleAssignment,
  listVehicleAssignments,
  releaseVehicleAssignment,
  type VehicleAssignmentRecord,
} from '../../repositories/vehicles/vehicle-assignment.repository.js'
import { findVehicleById } from '../../repositories/vehicles/vehicle.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import { conflict, notFound } from '../../utils/httpErrors.js'
import { resolvePagination, toPaginated } from '../../utils/pagination.js'
import type {
  CheckAvailabilityBody,
  CreateVehicleAssignmentBody,
  ListVehicleAssignmentsQuery,
} from '../../validations/vehicle.validation.js'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, recordAuditEvent } from '../audit/audit.service.js'
import { decideAssignment, decideAvailability } from './availability-rules.js'
import { isNonOperationalStatus } from './status-rules.js'
import { loadAccessibleVehicle } from './vehicle-access.js'
import { withVehicleLock } from './vehicle-lock.service.js'

export type VehicleAssignmentResource = {
  id: string
  vehicleId: string
  branchId: string
  startsAt: string
  endsAt: string
  reason: string
  status: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

function toResource(assignment: VehicleAssignmentRecord): VehicleAssignmentResource {
  return {
    id: assignment.id,
    vehicleId: assignment.vehicleId,
    branchId: assignment.branchId,
    startsAt: assignment.startsAt.toISOString(),
    endsAt: assignment.endsAt.toISOString(),
    reason: assignment.reason,
    status: toPublicEnum(assignment.status),
    createdBy: assignment.createdBy,
    createdAt: assignment.createdAt.toISOString(),
    updatedAt: assignment.updatedAt.toISOString(),
  }
}

export type AvailabilityResource = {
  available: boolean
  reasons: string[]
  /** Overlapping ACTIVE windows (ids and times only). */
  conflicts: { id: string; startsAt: string; endsAt: string }[]
}

/** Read-only check. The answer can change before a caller acts on it; createAssignment re-checks under the lock. */
export async function checkAvailability(
  ctx: AccessContext,
  vehicleId: string,
  window: CheckAvailabilityBody,
): Promise<AvailabilityResource> {
  const vehicle = await loadAccessibleVehicle(ctx, vehicleId)
  const overlapping = await findActiveAssignmentsOverlapping(
    vehicle.id,
    vehicle.organizationId,
    window.startsAt,
    window.endsAt,
  )
  const decision = decideAvailability(vehicle.status, overlapping, window)
  return {
    available: decision.available,
    reasons: decision.reasons,
    conflicts: decision.conflicts.map((entry) => ({
      id: entry.id,
      startsAt: entry.startsAt.toISOString(),
      endsAt: entry.endsAt.toISOString(),
    })),
  }
}

export async function listAssignments(
  ctx: AccessContext,
  vehicleId: string,
  query: ListVehicleAssignmentsQuery,
) {
  const vehicle = await loadAccessibleVehicle(ctx, vehicleId)
  const pagination = resolvePagination(query)
  const result = await listVehicleAssignments({
    vehicleId: vehicle.id,
    organizationId: vehicle.organizationId,
    skip: pagination.skip,
    take: pagination.take,
    status: query.status,
  })
  return toPaginated(result.items.map(toResource), pagination.page, pagination.limit, result.total)
}

/**
 * Creates a blocking window. Race protection: the vehicle status check, the overlap query and
 * the insert all run while holding the vehicle lock, so two concurrent overlapping requests
 * cannot both succeed (the loser gets 409).
 */
export async function createAssignment(
  ctx: AccessContext,
  vehicleId: string,
  input: CreateVehicleAssignmentBody,
  meta: RequestMeta,
): Promise<VehicleAssignmentResource> {
  const vehicle = await loadAccessibleVehicle(ctx, vehicleId)

  const assignment = await withVehicleLock(vehicle.id, async () => {
    // Re-read inside the lock: the status may have changed since the access check.
    const current = await findVehicleById(vehicle.id)
    if (!current || current.organizationId !== vehicle.organizationId) {
      throw notFound('Vehicle was not found.')
    }
    if (isNonOperationalStatus(current.status)) {
      throw conflict(`Vehicle is ${toPublicEnum(current.status)} and cannot be assigned.`)
    }

    const overlapping = await findActiveAssignmentsOverlapping(
      current.id,
      current.organizationId,
      input.startsAt,
      input.endsAt,
    )
    const decision = decideAssignment(overlapping, input)
    if (!decision.accepted) {
      throw conflict('The vehicle already has an active assignment in this period.')
    }

    return insertVehicleAssignment({
      vehicleId: current.id,
      organizationId: current.organizationId,
      branchId: current.branchId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      reason: input.reason,
      createdBy: ctx.userId,
    })
  })

  await recordAuditEvent({
    action: AUDIT_ACTIONS.VEHICLE_ASSIGNMENT_CREATE,
    entityType: AUDIT_ENTITY_TYPES.VEHICLE,
    entityId: vehicle.id,
    actorUserId: ctx.userId,
    organizationId: vehicle.organizationId,
    branchId: vehicle.branchId,
    metadata: {
      assignmentId: assignment.id,
      startsAt: assignment.startsAt,
      endsAt: assignment.endsAt,
    },
    meta,
  })
  return toResource(assignment)
}

export async function releaseAssignment(
  ctx: AccessContext,
  vehicleId: string,
  assignmentId: string,
  meta: RequestMeta,
): Promise<VehicleAssignmentResource> {
  const vehicle = await loadAccessibleVehicle(ctx, vehicleId)
  const existing = await findVehicleAssignment(vehicle.id, vehicle.organizationId, assignmentId)
  if (!existing) throw notFound('Assignment was not found.')

  const released = await releaseVehicleAssignment(vehicle.id, vehicle.organizationId, existing.id)
  if (!released) throw conflict('Assignment is already released.')

  await recordAuditEvent({
    action: AUDIT_ACTIONS.VEHICLE_ASSIGNMENT_RELEASE,
    entityType: AUDIT_ENTITY_TYPES.VEHICLE,
    entityId: vehicle.id,
    actorUserId: ctx.userId,
    organizationId: vehicle.organizationId,
    branchId: vehicle.branchId,
    metadata: { assignmentId: released.id },
    meta,
  })
  return toResource(released)
}
