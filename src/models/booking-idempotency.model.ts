import { Schema, model } from 'mongoose'

/**
 * One row per Idempotency-Key inside an organization. The unique index is the lock:
 * the insert winner creates the booking; a later identical request reads `bookingId`.
 */
const bookingIdempotencySchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    key: { type: String, required: true, trim: true, maxlength: 200 },
    requestHash: { type: String, required: true, maxlength: 64 },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'booking_idempotency_keys' },
)

bookingIdempotencySchema.index({ organizationId: 1, key: 1 }, { unique: true })

export const BookingIdempotency = model('BookingIdempotency', bookingIdempotencySchema)
