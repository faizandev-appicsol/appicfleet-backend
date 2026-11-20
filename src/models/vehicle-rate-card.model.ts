import { Schema, model } from 'mongoose'
import { RATE_STATUSES, RATE_TYPES } from '../constants/vehicles.js'
import type { IVehicleRateCard } from '../interfaces/vehicle.interface.js'
import { MONEY_REGEX } from '../utils/money.js'

/** History is preserved: cards are inserted, never overwritten. `amount` is a decimal string. */
const vehicleRateCardSchema = new Schema<IVehicleRateCard>(
  {
    vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    rateType: { type: String, required: true, enum: Object.values(RATE_TYPES) },
    amount: { type: String, required: true, trim: true, match: MONEY_REGEX },
    currency: { type: String, required: true, uppercase: true, trim: true, match: /^[A-Z]{3}$/ },
    effectiveFrom: { type: Date, required: true },
    effectiveTo: { type: Date, default: null },
    status: {
      type: String,
      required: true,
      enum: Object.values(RATE_STATUSES),
      default: RATE_STATUSES.ACTIVE,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, collection: 'vehicle_rate_cards' },
)

vehicleRateCardSchema.index({ vehicleId: 1, rateType: 1, status: 1, effectiveFrom: -1 })

export const VehicleRateCard = model<IVehicleRateCard>('VehicleRateCard', vehicleRateCardSchema)
