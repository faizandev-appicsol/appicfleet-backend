import { Schema, model } from 'mongoose'
import { VEHICLE_STATUSES } from '../constants/vehicles.js'
import type { IVehicleStatusEvent } from '../interfaces/vehicle.interface.js'

/** Append-only: rows are inserted and never updated or deleted. */
const vehicleStatusEventSchema = new Schema<IVehicleStatusEvent>(
  {
    vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    fromStatus: { type: String, required: true, enum: Object.values(VEHICLE_STATUSES) },
    toStatus: { type: String, required: true, enum: Object.values(VEHICLE_STATUSES) },
    reason: { type: String, required: true, trim: true, maxlength: 500 },
    actorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'vehicle_status_events',
    strict: true,
  },
)

vehicleStatusEventSchema.index({ vehicleId: 1, createdAt: -1 })
vehicleStatusEventSchema.index({ organizationId: 1, createdAt: -1 })

export const VehicleStatusEvent = model<IVehicleStatusEvent>(
  'VehicleStatusEvent',
  vehicleStatusEventSchema,
)
