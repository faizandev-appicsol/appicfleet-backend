import {
  ASSIGNMENT_STATUSES,
  VEHICLE_STATUSES,
  type AssignmentStatus,
  type VehicleStatus,
} from '../../constants/vehicles.js'
import { intervalsOverlap } from './intervals.js'
import { isNonOperationalStatus } from './status-rules.js'

export type AssignmentWindow = {
  startsAt: Date
  endsAt: Date
  status: AssignmentStatus
}

export type CandidateWindow = { startsAt: Date; endsAt: Date }

export type AssignmentDecision<T extends AssignmentWindow> =
  | { accepted: true; conflicts: [] }
  | { accepted: false; conflicts: T[] }

/**
 * Pure race-protection rule: a candidate window is accepted only when no ACTIVE existing
 * window overlaps it. Released windows never block. Called while holding the vehicle lock.
 */
export function decideAssignment<T extends AssignmentWindow>(
  existing: readonly T[],
  candidate: CandidateWindow,
): AssignmentDecision<T> {
  const range = { starts: candidate.startsAt, ends: candidate.endsAt }
  const conflicts = existing.filter(
    (window) =>
      window.status === ASSIGNMENT_STATUSES.ACTIVE &&
      intervalsOverlap({ starts: window.startsAt, ends: window.endsAt }, range),
  )
  return conflicts.length === 0 ? { accepted: true, conflicts: [] } : { accepted: false, conflicts }
}

export const AVAILABILITY_REASONS = {
  INACTIVE: 'vehicle_inactive',
  OUT_OF_SERVICE: 'vehicle_out_of_service',
  MAINTENANCE: 'vehicle_maintenance',
  INSPECTION: 'vehicle_inspection',
  ASSIGNMENT_OVERLAP: 'assignment_overlap',
} as const
export type AvailabilityReason = (typeof AVAILABILITY_REASONS)[keyof typeof AVAILABILITY_REASONS]

const STATUS_REASON: Partial<Record<VehicleStatus, AvailabilityReason>> = {
  [VEHICLE_STATUSES.INACTIVE]: AVAILABILITY_REASONS.INACTIVE,
  [VEHICLE_STATUSES.OUT_OF_SERVICE]: AVAILABILITY_REASONS.OUT_OF_SERVICE,
  [VEHICLE_STATUSES.MAINTENANCE]: AVAILABILITY_REASONS.MAINTENANCE,
  [VEHICLE_STATUSES.INSPECTION]: AVAILABILITY_REASONS.INSPECTION,
}

export type AvailabilityDecision<T extends AssignmentWindow> = {
  available: boolean
  reasons: AvailabilityReason[]
  conflicts: T[]
}

/**
 * Availability for a window:
 * - non-operational statuses (inactive, out of service, maintenance, inspection) always block;
 * - reserved / rented do NOT block by themselves: only overlapping ACTIVE assignment windows do.
 */
export function decideAvailability<T extends AssignmentWindow>(
  status: VehicleStatus,
  existing: readonly T[],
  window: CandidateWindow,
): AvailabilityDecision<T> {
  const reasons: AvailabilityReason[] = []
  if (isNonOperationalStatus(status)) {
    const reason = STATUS_REASON[status]
    if (reason) reasons.push(reason)
  }
  const decision = decideAssignment(existing, window)
  if (!decision.accepted) reasons.push(AVAILABILITY_REASONS.ASSIGNMENT_OVERLAP)
  return { available: reasons.length === 0, reasons, conflicts: decision.conflicts }
}
