import type { FilterQuery } from 'mongoose'
import {
  DOCUMENT_STATUSES,
  type DocumentStatus,
  type DocumentType,
} from '../../constants/vehicles.js'
import { rethrowDatabaseError } from '../../exceptions/mongooseError.js'
import type { IVehicleDocument } from '../../interfaces/vehicle.interface.js'
import { VehicleDocument } from '../../models/vehicle-document.model.js'
import { omitUndefined, toObjectId } from '../object-id.js'

export type VehicleDocumentRecord = {
  id: string
  vehicleId: string
  organizationId: string
  documentType: DocumentType
  documentNumber?: string
  issuedOn?: Date
  expiresOn?: Date
  storageKey: string
  status: DocumentStatus
  uploadedBy: string
  createdAt: Date
  updatedAt: Date
}

type PersistableDocument = {
  _id: { toString(): string }
  vehicleId: { toString(): string }
  organizationId: { toString(): string }
  documentType: string
  documentNumber?: string | null
  issuedOn?: Date | null
  expiresOn?: Date | null
  storageKey: string
  status: string
  uploadedBy: { toString(): string }
  createdAt: Date
  updatedAt: Date
}

function toRecord(doc: PersistableDocument): VehicleDocumentRecord {
  return {
    id: doc._id.toString(),
    vehicleId: doc.vehicleId.toString(),
    organizationId: doc.organizationId.toString(),
    documentType: doc.documentType as DocumentType,
    documentNumber: doc.documentNumber ?? undefined,
    issuedOn: doc.issuedOn ?? undefined,
    expiresOn: doc.expiresOn ?? undefined,
    storageKey: doc.storageKey,
    status: doc.status as DocumentStatus,
    uploadedBy: doc.uploadedBy.toString(),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

export async function listVehicleDocuments(input: {
  vehicleId: string
  organizationId: string
  skip: number
  take: number
  status?: DocumentStatus
  documentType?: DocumentType
}): Promise<{ items: VehicleDocumentRecord[]; total: number }> {
  const vehicleId = toObjectId(input.vehicleId)
  const organizationId = toObjectId(input.organizationId)
  if (!vehicleId || !organizationId) return { items: [], total: 0 }

  const filter: FilterQuery<IVehicleDocument> = { vehicleId, organizationId }
  if (input.status) filter.status = input.status
  if (input.documentType) filter.documentType = input.documentType

  const [items, total] = await Promise.all([
    VehicleDocument.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(input.skip)
      .limit(input.take)
      .lean(),
    VehicleDocument.countDocuments(filter),
  ])
  return { items: items.map(toRecord), total }
}

export async function insertVehicleDocument(input: {
  vehicleId: string
  organizationId: string
  documentType: DocumentType
  documentNumber?: string
  issuedOn?: Date
  expiresOn?: Date
  storageKey: string
  uploadedBy: string
}): Promise<VehicleDocumentRecord> {
  try {
    const doc = await VehicleDocument.create({
      ...omitUndefined({ ...input }),
      vehicleId: toObjectId(input.vehicleId),
      organizationId: toObjectId(input.organizationId),
      uploadedBy: toObjectId(input.uploadedBy),
      status: DOCUMENT_STATUSES.ACTIVE,
    })
    return toRecord(doc)
  } catch (error) {
    rethrowDatabaseError(error, 'The document could not be saved.')
  }
}

/** Scoped by vehicle and organization; a document id from another vehicle never matches. */
export async function findVehicleDocument(
  vehicleId: string,
  organizationId: string,
  documentId: string,
): Promise<VehicleDocumentRecord | null> {
  const vehicleObjectId = toObjectId(vehicleId)
  const orgId = toObjectId(organizationId)
  const id = toObjectId(documentId)
  if (!vehicleObjectId || !orgId || !id) return null
  const doc = await VehicleDocument.findOne({
    _id: id,
    vehicleId: vehicleObjectId,
    organizationId: orgId,
  }).lean()
  return doc ? toRecord(doc) : null
}

/** Compare-and-set: returns null when the document is missing or already archived. */
export async function archiveVehicleDocument(
  vehicleId: string,
  organizationId: string,
  documentId: string,
): Promise<VehicleDocumentRecord | null> {
  const vehicleObjectId = toObjectId(vehicleId)
  const orgId = toObjectId(organizationId)
  const id = toObjectId(documentId)
  if (!vehicleObjectId || !orgId || !id) return null
  const doc = await VehicleDocument.findOneAndUpdate(
    {
      _id: id,
      vehicleId: vehicleObjectId,
      organizationId: orgId,
      status: DOCUMENT_STATUSES.ACTIVE,
    },
    { $set: { status: DOCUMENT_STATUSES.ARCHIVED } },
    { new: true },
  ).lean()
  return doc ? toRecord(doc) : null
}
