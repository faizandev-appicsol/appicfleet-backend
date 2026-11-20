import { VEHICLE_STATUSES, type VehicleStatus } from '../../constants/vehicles.js'
import { AppError } from '../../exceptions/AppError.js'
import { ERROR_CODES } from '../../exceptions/errorCodes.js'

const S = VEHICLE_STATUSES

/** Allowed status transitions. Anything not listed is rejected with 422. */
export const VEHICLE_STATUS_TRANSITIONS: Readonly<Record<VehicleStatus, readonly VehicleStatus[]>> = {
  [S.AVAILABLE]: [S.RESERVED, S.MAINTENANCE, S.INSPECTION, S.OUT_OF_SERVICE, S.INACTIVE],
  [S.RESERVED]: [S.AVAILABLE, S.RENTED, S.OUT_OF_SERVICE],
  [S.RENTED]: [S.AVAILABLE, S.MAINTENANCE, S.INSPECTION],
  [S.MAINTENANCE]: [S.AVAILABLE, S.INSPECTION, S.OUT_OF_SERVICE, S.INACTIVE],
  [S.INSPECTION]: [S.AVAILABLE, S.MAINTENANCE, S.OUT_OF_SERVICE, S.INACTIVE],
  [S.OUT_OF_SERVICE]: [S.AVAILABLE, S.MAINTENANCE, S.INACTIVE],
  [S.INACTIVE]: [S.AVAILABLE],
}

/** Statuses that always block new assignments, whatever the assignment windows say. */
export const NON_OPERATIONAL_STATUSES: readonly VehicleStatus[] = [
  S.INACTIVE,
  S.OUT_OF_SERVICE,
  S.MAINTENANCE,
  S.INSPECTION,
]

export function canTransition(from: VehicleStatus, to: VehicleStatus): boolean {
  return VEHICLE_STATUS_TRANSITIONS[from].includes(to)
}

export function isNonOperationalStatus(status: VehicleStatus): boolean {
  return NON_OPERATIONAL_STATUSES.includes(status)
}

/** Throws 422 when the transition is not allowed (including same-status "transitions"). */
export function assertTransition(from: VehicleStatus, to: VehicleStatus): void {
  if (canTransition(from, to)) return
  throw new AppError(
    `A vehicle cannot move from ${from.toLowerCase()} to ${to.toLowerCase()}.`,
    422,
    ERROR_CODES.VALIDATION_ERROR,
    { fieldErrors: { status: [`Not allowed from ${from.toLowerCase()}`] } },
  )
}
