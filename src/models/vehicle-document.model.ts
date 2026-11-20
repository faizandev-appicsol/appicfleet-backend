import { Schema, model } from 'mongoose'
import { DOCUMENT_STATUSES, DOCUMENT_TYPES } from '../constants/vehicles.js'
import type { IVehicleDocument } from '../interfaces/vehicle.interface.js'

/** Metadata only. File bytes live in object storage; only an opaque key is kept here. */
const vehicleDocumentSchema = new Schema<IVehicleDocument>(
  {
    vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    documentType: { type: String, required: true, enum: Object.values(DOCUMENT_TYPES) },
    documentNumber: { type: String, trim: true, maxlength: 80 },
    issuedOn: { type: Date },
    expiresOn: { type: Date },
    storageKey: { type: String, required: true, trim: true, maxlength: 300 },
    status: {
      type: String,
      required: true,
      enum: Object.values(DOCUMENT_STATUSES),
      default: DOCUMENT_STATUSES.ACTIVE,
    },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, collection: 'vehicle_documents' },
)

vehicleDocumentSchema.index({ vehicleId: 1, status: 1, createdAt: -1 })
vehicleDocumentSchema.index({ organizationId: 1, expiresOn: 1 })

export const VehicleDocument = model<IVehicleDocument>('VehicleDocument', vehicleDocumentSchema)
