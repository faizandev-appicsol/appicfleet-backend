import { mongoVehicleLockStore } from '../../repositories/vehicles/vehicle-lock.repository.js'
import { runWithVehicleLock } from './vehicle-lock.js'

/**
 * withVehicleLock(vehicleId, fn): runs fn while holding the vehicle's Mongo-backed mutex.
 * Throws 409 "Vehicle is being updated. Retry." when another request holds it.
 */
export function withVehicleLock<T>(vehicleId: string, fn: () => Promise<T>): Promise<T> {
  return runWithVehicleLock(mongoVehicleLockStore, vehicleId, fn)
}
