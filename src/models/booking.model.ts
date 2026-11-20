import { Schema, model } from 'mongoose'
import { BOOKING_SOURCES, BOOKING_STATUSES } from '../constants/bookings.js'

const pricingSchema = new Schema(
  {
    currency: { type: String, required: true, trim: true, uppercase: true, minlength: 3, maxlength: 3 },
    /** Daily rate copied from the vehicle rate card. Decimal string. */
    unitAmount: { type: String, required: true },
    /** Whole billable days. A count, not money. */
    quantityDays: { type: Number, required: true, min: 1 },
    totalAmount: { type: String, required: true },
    rateType: { type: String, required: true, default: 'DAILY' },
  },
  { _id: false },
)

/**
 * A reservation. It is not a contract. `assignmentId` points at the vehicle window that
 * blocks availability while the booking is a hold or confirmed.
 */
const bookingSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    returnBranchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    bookingNumber: { type: String, required: true, trim: true, maxlength: 32 },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle' },
    vehicleCategory: { type: String, trim: true, maxlength: 40 },
    customerDisplayName: { type: String, required: true, trim: true, maxlength: 200 },
    vehiclePlate: { type: String, trim: true, maxlength: 20 },
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
    status: {
      type: String,
      required: true,
      enum: Object.values(BOOKING_STATUSES),
      default: BOOKING_STATUSES.DRAFT,
    },
    source: { type: String, required: true, enum: Object.values(BOOKING_SOURCES) },
    sourceChannel: { type: String, trim: true, maxlength: 80 },
    campaignReference: { type: String, trim: true, maxlength: 80 },
    externalReference: { type: String, trim: true, maxlength: 120 },
    notes: { type: String, trim: true, maxlength: 2000 },
    pricing: { type: pricingSchema },
    holdExpiresAt: { type: Date },
    assignmentId: { type: Schema.Types.ObjectId, ref: 'VehicleAssignment' },
    /** Set once when the booking is marked converted. The future contract module owns the contract. */
    conversionKey: { type: String, trim: true, maxlength: 80 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, collection: 'bookings' },
)

bookingSchema.index({ organizationId: 1, bookingNumber: 1 }, { unique: true })
bookingSchema.index({ organizationId: 1, branchId: 1, status: 1, startsAt: 1 })
bookingSchema.index({ organizationId: 1, vehicleId: 1, startsAt: 1, endsAt: 1 })
bookingSchema.index({ organizationId: 1, customerId: 1, startsAt: 1 })
bookingSchema.index({ organizationId: 1, startsAt: 1, endsAt: 1 })
bookingSchema.index({ status: 1, holdExpiresAt: 1 })
bookingSchema.index(
  { organizationId: 1, source: 1, externalReference: 1 },
  {
    unique: true,
    partialFilterExpression: { externalReference: { $type: 'string' } },
  },
)

export const Booking = model('Booking', bookingSchema)
