import { Schema, model } from 'mongoose'
import { BOOKING_SOURCES } from '../constants/bookings.js'

/**
 * One row per external event id and source. A repeated webhook finds this row and
 * returns the original booking instead of creating another.
 */
const bookingIntakeEventSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    source: { type: String, required: true, enum: Object.values(BOOKING_SOURCES) },
    externalEventId: { type: String, required: true, trim: true, maxlength: 200 },
    requestHash: { type: String, required: true, maxlength: 64 },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'booking_intake_events' },
)

bookingIntakeEventSchema.index(
  { organizationId: 1, source: 1, externalEventId: 1 },
  { unique: true },
)

export const BookingIntakeEvent = model('BookingIntakeEvent', bookingIntakeEventSchema)
