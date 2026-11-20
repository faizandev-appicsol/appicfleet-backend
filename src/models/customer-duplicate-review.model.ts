import { Schema, model } from 'mongoose'
import { DUPLICATE_REVIEW_STATUSES } from '../constants/customers.js'
import type { ICustomerDuplicateReview } from '../interfaces/customer.interface.js'

/**
 * One document per customer pair. The pair is canonical (customerId < candidateId), so A-B and
 * B-A can never both exist. Queries must look at both sides.
 */
const customerDuplicateReviewSchema = new Schema<ICustomerDuplicateReview>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    candidateId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    status: {
      type: String,
      required: true,
      enum: Object.values(DUPLICATE_REVIEW_STATUSES),
      default: DUPLICATE_REVIEW_STATUSES.POTENTIAL,
    },
    signals: { type: [String], default: [] },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    note: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true, collection: 'customer_duplicate_reviews' },
)

customerDuplicateReviewSchema.index(
  { organizationId: 1, customerId: 1, candidateId: 1 },
  { unique: true },
)
customerDuplicateReviewSchema.index({ organizationId: 1, candidateId: 1 })

export const CustomerDuplicateReview = model<ICustomerDuplicateReview>(
  'CustomerDuplicateReview',
  customerDuplicateReviewSchema,
)
