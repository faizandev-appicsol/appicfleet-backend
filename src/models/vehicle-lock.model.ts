import { Schema, model } from 'mongoose'
import type { IVehicleLock } from '../interfaces/vehicle.interface.js'

/**
 * One document per vehicle, acting as a mutex (see services/vehicles/vehicle-lock.ts).
 * The unique index on vehicleId is what makes concurrent acquisition race-safe.
 */
const vehicleLockSchema = new Schema<IVehicleLock>(
  {
    vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },
    token: { type: String, required: true, maxlength: 64 },
    lockedUntil: { type: Date, required: true },
  },
  { collection: 'vehicle_locks' },
)

vehicleLockSchema.index({ vehicleId: 1 }, { unique: true })

export const VehicleLock = model<IVehicleLock>('VehicleLock', vehicleLockSchema)
