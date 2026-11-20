import { Schema, model } from 'mongoose'
import {
  CUSTOMER_DOCUMENT_TYPES,
  CUSTOMER_FILE_STATUSES,
  OCR_STATUSES,
} from '../constants/customers.js'
import type { ICustomerDocument } from '../interfaces/customer.interface.js'

/** Metadata only. File bytes live in the storage service; only an opaque key is kept here. */
const customerDocumentSchema = new Schema<ICustomerDocument>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    documentType: { type: String, required: true, enum: Object.values(CUSTOMER_DOCUMENT_TYPES) },
    storageKey: { type: String, required: true, trim: true, maxlength: 128 },
    originalFilename: { type: String, required: true, trim: true, maxlength: 200 },
    byteSize: { type: Number, required: true, min: 1, validate: Number.isInteger },
    mimeType: { type: String, required: true, trim: true, maxlength: 100 },
    sha256: { type: String, required: true, lowercase: true, match: /^[a-f0-9]{64}$/ },
    duplicateFileFlag: { type: Boolean, required: true, default: false },
    issuedOn: { type: Date },
    expiresOn: { type: Date },
    status: {
      type: String,
      required: true,
      enum: Object.values(CUSTOMER_FILE_STATUSES),
      default: CUSTOMER_FILE_STATUSES.ACTIVE,
    },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    ocrStatus: {
      type: String,
      required: true,
      enum: Object.values(OCR_STATUSES),
      default: OCR_STATUSES.NONE,
    },
  },
  { timestamps: true, collection: 'customer_documents' },
)

// The same file twice for one customer is detectable; the same file for another customer is allowed.
customerDocumentSchema.index({ organizationId: 1, sha256: 1, customerId: 1 }, { unique: true })
customerDocumentSchema.index({ customerId: 1, status: 1, createdAt: -1 })

export const CustomerDocument = model<ICustomerDocument>('CustomerDocument', customerDocumentSchema)
