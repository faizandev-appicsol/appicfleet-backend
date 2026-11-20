import { Schema, model } from 'mongoose'

/** Per-organization sequence. `$inc` is atomic, so two creates cannot take the same number. */
const bookingCounterSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    name: { type: String, required: true, default: 'booking' },
    seq: { type: Number, required: true, default: 0 },
  },
  { collection: 'booking_counters' },
)

bookingCounterSchema.index({ organizationId: 1, name: 1 }, { unique: true })

export const BookingCounter = model('BookingCounter', bookingCounterSchema)
