import { ASSIGNMENT_RESOLUTIONS, type AssignmentResolution } from '../../constants/charges.js'
import { findContractById } from '../../repositories/contracts/contract.repository.js'
import { findAssignmentsCoveringInstant } from '../../repositories/vehicles/vehicle-assignment.repository.js'
import {
  findVehicleById,
  findVehicleByPlateInOrganization,
  type VehicleRecord,
} from '../../repositories/vehicles/vehicle.repository.js'
import { findCustomerById } from '../../repositories/customers/customer.repository.js'

export type EventResponsibility = {
  resolution: AssignmentResolution
  reviewReason?: string
  vehicle?: VehicleRecord
  assignmentId?: string
  assignmentStartsAt?: Date
  assignmentEndsAt?: Date
  contractId?: string
  customerId?: string
  customerName?: string
  legalEntityId?: string
  branchId?: string
  overlappingAssignmentIds?: string[]
}

/**
 * Resolve who was responsible at event time.
 * Never uses the vehicle's current customer. Half-open: startsAt <= eventAt < endsAt.
 */
export async function resolveEventResponsibility(input: {
  organizationId: string
  vehicleId?: string
  vehiclePlate?: string
  eventAt: Date
}): Promise<EventResponsibility> {
  let vehicle: VehicleRecord | null = null
  if (input.vehicleId) {
    vehicle = await findVehicleById(input.vehicleId)
    if (vehicle && vehicle.organizationId !== input.organizationId) {
      return { resolution: ASSIGNMENT_RESOLUTIONS.VEHICLE_NOT_FOUND, reviewReason: 'Vehicle belongs to another tenant.' }
    }
  } else if (input.vehiclePlate) {
    vehicle = await findVehicleByPlateInOrganization(input.organizationId, input.vehiclePlate)
  }

  if (!vehicle) {
    return {
      resolution: ASSIGNMENT_RESOLUTIONS.VEHICLE_NOT_FOUND,
      reviewReason: 'Vehicle was not found in this organization.',
    }
  }

  const covering = await findAssignmentsCoveringInstant(vehicle.id, vehicle.organizationId, input.eventAt)
  const contractAssignments = covering.filter((row) => row.contractId && row.assignmentType !== 'SERVICE')

  if (contractAssignments.length === 0) {
    return {
      resolution: ASSIGNMENT_RESOLUTIONS.UNASSIGNED,
      reviewReason: 'No contract assignment covered the event timestamp.',
      vehicle,
      legalEntityId: vehicle.legalEntityId,
      branchId: vehicle.branchId,
    }
  }

  if (contractAssignments.length > 1) {
    return {
      resolution: ASSIGNMENT_RESOLUTIONS.OVERLAP_CONFLICT,
      reviewReason: 'Multiple overlapping contract assignments cover the event timestamp.',
      vehicle,
      legalEntityId: vehicle.legalEntityId,
      branchId: vehicle.branchId,
      overlappingAssignmentIds: contractAssignments.map((row) => row.id),
    }
  }

  const assignment = contractAssignments[0]!
  const contract = assignment.contractId ? await findContractById(assignment.contractId) : null
  if (!contract || contract.organizationId !== vehicle.organizationId) {
    return {
      resolution: ASSIGNMENT_RESOLUTIONS.REVIEW_REQUIRED,
      reviewReason: 'Assignment contract was missing or out of scope.',
      vehicle,
      assignmentId: assignment.id,
      assignmentStartsAt: assignment.startsAt,
      assignmentEndsAt: assignment.endsAt,
      legalEntityId: vehicle.legalEntityId,
      branchId: vehicle.branchId,
    }
  }

  const customer = await findCustomerById(contract.customerId)
  return {
    resolution: ASSIGNMENT_RESOLUTIONS.ASSIGNED,
    vehicle,
    assignmentId: assignment.id,
    assignmentStartsAt: assignment.startsAt,
    assignmentEndsAt: assignment.endsAt,
    contractId: contract.id,
    customerId: contract.customerId,
    customerName: customer?.displayName,
    legalEntityId: contract.legalEntityId ?? vehicle.legalEntityId,
    branchId: contract.branchId ?? vehicle.branchId,
  }
}
