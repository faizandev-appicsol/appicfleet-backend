import { Schema, model, type InferSchemaType, type Types } from 'mongoose'

/**
 * User-scoped vehicle type catalog.
 * When a user types a new type on create/update, it is upserted here and reused in the dropdown.
 */
const vehicleTypeSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    /** Lowercase trimmed name for uniqueness within the user+organization scope. */
    normalizedName: { type: String, required: true, trim: true, lowercase: true, maxlength: 60 },
  },
  { timestamps: { createdAt: true, updatedAt: true } },
)

vehicleTypeSchema.index(
  { organizationId: 1, userId: 1, normalizedName: 1 },
  { unique: true },
)

export type VehicleTypeDocument = InferSchemaType<typeof vehicleTypeSchema> & {
  _id: Types.ObjectId
}

export const VehicleTypeModel = model('VehicleType', vehicleTypeSchema, 'vehicle_types')
