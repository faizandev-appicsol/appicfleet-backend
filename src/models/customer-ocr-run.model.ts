import { Schema, model } from 'mongoose'
import {
  CUSTOMER_DOCUMENT_TYPES,
  OCR_REVIEW_STATUSES,
  OCR_RUN_STATUSES,
} from '../constants/customers.js'
import type { ICustomerOcrRun } from '../interfaces/customer.interface.js'

const ocrFieldSchema = new Schema(
  {
    key: { type: String, required: true, trim: true, maxlength: 60 },
    value: { type: String, required: true, maxlength: 500 },
    confidence: { type: Number, required: true, min: 0, max: 1 },
  },
  { _id: false },
)

const reviewedFieldSchema = new Schema(
  {
    key: { type: String, required: true, trim: true, maxlength: 60 },
    value: { type: String, required: true, maxlength: 500 },
  },
  { _id: false },
)

/**
 * Append-only: every OCR attempt is a new document. Only the review fields are ever written
 * afterwards (once, by the review endpoint).
 */
const customerOcrRunSchema = new Schema<ICustomerOcrRun>(
  {
    documentId: { type: Schema.Types.ObjectId, ref: 'CustomerDocument', required: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    provider: { type: String, required: true, trim: true, maxlength: 40 },
    modelVersion: { type: String, required: true, trim: true, maxlength: 40 },
    detectedType: { type: String, required: true, enum: Object.values(CUSTOMER_DOCUMENT_TYPES) },
    typeConfidence: { type: Number, required: true, min: 0, max: 1 },
    fields: { type: [ocrFieldSchema], default: [] },
    status: { type: String, required: true, enum: Object.values(OCR_RUN_STATUSES) },
    reviewedFields: { type: [reviewedFieldSchema], default: undefined },
    reviewStatus: {
      type: String,
      required: true,
      enum: Object.values(OCR_REVIEW_STATUSES),
      default: OCR_REVIEW_STATUSES.NONE,
    },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    errorCode: { type: String, trim: true, maxlength: 60 },
  },
  { timestamps: true, collection: 'customer_ocr_runs' },
)

customerOcrRunSchema.index({ documentId: 1, createdAt: -1 })
customerOcrRunSchema.index({ organizationId: 1, customerId: 1 })
customerOcrRunSchema.index({ organizationId: 1, 'fields.value': 1 })

export const CustomerOcrRun = model<ICustomerOcrRun>('CustomerOcrRun', customerOcrRunSchema)
