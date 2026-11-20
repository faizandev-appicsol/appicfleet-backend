import { VehicleLock } from '../../models/vehicle-lock.model.js'
import type { VehicleLockStore } from '../../services/vehicles/vehicle-lock.js'
import { toObjectId } from '../object-id.js'

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 11000
  )
}

/**
 * Mongo-backed mutex. `acquire` is a single atomic upsert:
 * - no lock document        -> inserted with our token (we own it);
 * - document with lockedUntil < now (expired) -> matched and re-tokened (we own it);
 * - live document           -> filter does not match, the upsert tries to insert, and the unique
 *                              index on vehicleId rejects it (E11000) -> someone else owns it.
 */
export const mongoVehicleLockStore: VehicleLockStore = {
  async acquire(vehicleId, token, now, lockedUntil) {
    const id = toObjectId(vehicleId)
    if (!id) return false
    try {
      const doc = await VehicleLock.findOneAndUpdate(
        { vehicleId: id, lockedUntil: { $lt: now } },
        { $set: { token, lockedUntil } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      ).lean()
      return doc?.token === token
    } catch (error) {
      if (isDuplicateKeyError(error)) return false
      throw error
    }
  },

  async release(vehicleId, token, now) {
    const id = toObjectId(vehicleId)
    if (!id) return
    // Only the owner can release; a stale holder whose lock was taken over matches nothing.
    await VehicleLock.updateOne(
      { vehicleId: id, token },
      { $set: { lockedUntil: new Date(now.getTime() - 1000) } },
    )
  },
}
