import { Schema, model } from 'mongoose'
import { BOOKING_STATUSES } from '../constants/bookings.js'

/** Append-only status history. Rows are never updated. */
const bookingStatusEventSchema = new Schema(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    fromStatus: { type: String, enum: Object.values(BOOKING_STATUSES) },
    toStatus: { type: String, required: true, enum: Object.values(BOOKING_STATUSES) },
    reason: { type: String, trim: true, maxlength: 500 },
    actorUserId: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'booking_status_events' },
)

bookingStatusEventSchema.index({ bookingId: 1, createdAt: 1 })
bookingStatusEventSchema.index({ organizationId: 1, createdAt: -1 })

export const BookingStatusEvent = model('BookingStatusEvent', bookingStatusEventSchema)
