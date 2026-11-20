import { Schema, model } from 'mongoose'
import { ASSIGNMENT_STATUSES } from '../constants/vehicles.js'
import type { IVehicleAssignment } from '../interfaces/vehicle.interface.js'

/** Blocking windows used by availability. This is NOT a booking record. */
const vehicleAssignmentSchema = new Schema<IVehicleAssignment>(
  {
    vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    startsAt: { type: Date, required: true },
    endsAt: {
      type: Date,
      required: true,
      validate: {
        validator(this: { startsAt?: Date }, value: Date) {
          return !this.startsAt || value.getTime() > this.startsAt.getTime()
        },
        message: 'endsAt must be after startsAt',
      },
    },
    plannedEndsAt: { type: Date },
    closedAt: { type: Date },
    reason: { type: String, required: true, trim: true, maxlength: 200 },
    contractId: { type: Schema.Types.ObjectId, ref: 'Contract' },
    assignmentType: { type: String, trim: true, maxlength: 40 },
    sourceAssignmentId: { type: Schema.Types.ObjectId, ref: 'VehicleAssignment' },
    vehiclePlate: { type: String, trim: true, maxlength: 20 },
    status: {
      type: String,
      required: true,
      enum: Object.values(ASSIGNMENT_STATUSES),
      default: ASSIGNMENT_STATUSES.ACTIVE,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, collection: 'vehicle_assignments' },
)

vehicleAssignmentSchema.index({ vehicleId: 1, status: 1, startsAt: 1, endsAt: 1 })
vehicleAssignmentSchema.index({ organizationId: 1, branchId: 1, startsAt: 1 })
vehicleAssignmentSchema.index({ contractId: 1, startsAt: 1 })

export const VehicleAssignment = model<IVehicleAssignment>(
  'VehicleAssignment',
  vehicleAssignmentSchema,
)
