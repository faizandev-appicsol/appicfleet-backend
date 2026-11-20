import type { FilterQuery } from 'mongoose'
import {
  CUSTOMER_FILE_STATUSES,
  OCR_STATUSES,
  type CustomerDocumentType,
  type CustomerFileStatus,
  type OcrStatus,
} from '../../constants/customers.js'
import { rethrowDatabaseError } from '../../exceptions/mongooseError.js'
import type { ICustomerDocument } from '../../interfaces/customer.interface.js'
import { CustomerDocument } from '../../models/customer-document.model.js'
import { omitUndefined, toObjectId } from '../object-id.js'

export type CustomerDocumentRecord = {
  id: string
  customerId: string
  organizationId: string
  branchId: string
  documentType: CustomerDocumentType
  /** Opaque storage key. Never returned from the API. */
  storageKey: string
  originalFilename: string
  byteSize: number
  mimeType: string
  sha256: string
  duplicateFileFlag: boolean
  issuedOn?: Date
  expiresOn?: Date
  status: CustomerFileStatus
  uploadedBy: string
  ocrStatus: OcrStatus
  createdAt: Date
  updatedAt: Date
}

type PersistableDocument = {
  _id: { toString(): string }
  customerId: { toString(): string }
  organizationId: { toString(): string }
  branchId: { toString(): string }
  documentType: string
  storageKey: string
  originalFilename: string
  byteSize: number
  mimeType: string
  sha256: string
  duplicateFileFlag?: boolean | null
  issuedOn?: Date | null
  expiresOn?: Date | null
  status: string
  uploadedBy: { toString(): string }
  ocrStatus: string
  createdAt: Date
  updatedAt: Date
}

function toRecord(doc: PersistableDocument): CustomerDocumentRecord {
  return {
    id: doc._id.toString(),
    customerId: doc.customerId.toString(),
    organizationId: doc.organizationId.toString(),
    branchId: doc.branchId.toString(),
    documentType: doc.documentType as CustomerDocumentType,
    storageKey: doc.storageKey,
    originalFilename: doc.originalFilename,
    byteSize: doc.byteSize,
    mimeType: doc.mimeType,
    sha256: doc.sha256,
    duplicateFileFlag: doc.duplicateFileFlag ?? false,
    issuedOn: doc.issuedOn ?? undefined,
    expiresOn: doc.expiresOn ?? undefined,
    status: doc.status as CustomerFileStatus,
    uploadedBy: doc.uploadedBy.toString(),
    ocrStatus: doc.ocrStatus as OcrStatus,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

export async function listCustomerDocuments(input: {
  customerId: string
  organizationId: string
  skip: number
  take: number
  status?: CustomerFileStatus
  documentType?: CustomerDocumentType
}): Promise<{ items: CustomerDocumentRecord[]; total: number }> {
  const customerId = toObjectId(input.customerId)
  const organizationId = toObjectId(input.organizationId)
  if (!customerId || !organizationId) return { items: [], total: 0 }

  const filter: FilterQuery<ICustomerDocument> = { customerId, organizationId }
  if (input.status) filter.status = input.status
  if (input.documentType) filter.documentType = input.documentType

  const [items, total] = await Promise.all([
    CustomerDocument.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(input.skip)
      .limit(input.take)
      .lean(),
    CustomerDocument.countDocuments(filter),
  ])
  return { items: items.map(toRecord), total }
}

/** Scoped by customer and organization; a document id from another customer never matches. */
export async function findCustomerDocument(
  customerId: string,
  organizationId: string,
  documentId: string,
): Promise<CustomerDocumentRecord | null> {
  const customerObjectId = toObjectId(customerId)
  const orgId = toObjectId(organizationId)
  const id = toObjectId(documentId)
  if (!customerObjectId || !orgId || !id) return null
  const doc = await CustomerDocument.findOne({
    _id: id,
    customerId: customerObjectId,
    organizationId: orgId,
  }).lean()
  return doc ? toRecord(doc) : null
}

/** The same file (by hash) already stored for this customer, in any status. */
export async function findCustomerDocumentByHash(
  customerId: string,
  organizationId: string,
  sha256: string,
): Promise<CustomerDocumentRecord | null> {
  const customerObjectId = toObjectId(customerId)
  const orgId = toObjectId(organizationId)
  if (!customerObjectId || !orgId) return null
  const doc = await CustomerDocument.findOne({
    customerId: customerObjectId,
    organizationId: orgId,
    sha256,
  }).lean()
  return doc ? toRecord(doc) : null
}

/** True when another customer of the organization already holds a file with this hash. */
export async function existsHashForOtherCustomer(
  customerId: string,
  organizationId: string,
  sha256: string,
): Promise<boolean> {
  const customerObjectId = toObjectId(customerId)
  const orgId = toObjectId(organizationId)
  if (!customerObjectId || !orgId) return false
  const found = await CustomerDocument.exists({
    organizationId: orgId,
    sha256,
    customerId: { $ne: customerObjectId },
  })
  return found !== null
}

export type NewCustomerDocument = {
  customerId: string
  organizationId: string
  branchId: string
  documentType: CustomerDocumentType
  storageKey: string
  originalFilename: string
  byteSize: number
  mimeType: string
  sha256: string
  duplicateFileFlag: boolean
  issuedOn?: Date
  expiresOn?: Date
  uploadedBy: string
}

export async function insertCustomerDocument(
  input: NewCustomerDocument,
): Promise<CustomerDocumentRecord> {
  try {
    const doc = await CustomerDocument.create({
      ...omitUndefined({ ...input }),
      customerId: toObjectId(input.customerId),
      organizationId: toObjectId(input.organizationId),
      branchId: toObjectId(input.branchId),
      uploadedBy: toObjectId(input.uploadedBy),
      status: CUSTOMER_FILE_STATUSES.ACTIVE,
      ocrStatus: OCR_STATUSES.NONE,
    })
    return toRecord(doc)
  } catch (error) {
    rethrowDatabaseError(error, 'This file has already been uploaded for this customer.')
  }
}

/** Compare-and-set: returns null when the document is missing or already archived. */
export async function archiveCustomerDocument(
  customerId: string,
  organizationId: string,
  documentId: string,
): Promise<CustomerDocumentRecord | null> {
  const customerObjectId = toObjectId(customerId)
  const orgId = toObjectId(organizationId)
  const id = toObjectId(documentId)
  if (!customerObjectId || !orgId || !id) return null
  const doc = await CustomerDocument.findOneAndUpdate(
    {
      _id: id,
      customerId: customerObjectId,
      organizationId: orgId,
      status: CUSTOMER_FILE_STATUSES.ACTIVE,
    },
    { $set: { status: CUSTOMER_FILE_STATUSES.ARCHIVED } },
    { new: true },
  ).lean()
  return doc ? toRecord(doc) : null
}

/**
 * Moves the document into OCR PROCESSING unless a run is already in flight.
 * Returns null when the document is missing, not active, or already processing.
 */
export async function beginDocumentOcr(
  customerId: string,
  organizationId: string,
  documentId: string,
): Promise<CustomerDocumentRecord | null> {
  const customerObjectId = toObjectId(customerId)
  const orgId = toObjectId(organizationId)
  const id = toObjectId(documentId)
  if (!customerObjectId || !orgId || !id) return null
  const doc = await CustomerDocument.findOneAndUpdate(
    {
      _id: id,
      customerId: customerObjectId,
      organizationId: orgId,
      status: CUSTOMER_FILE_STATUSES.ACTIVE,
      ocrStatus: { $ne: OCR_STATUSES.PROCESSING },
    },
    { $set: { ocrStatus: OCR_STATUSES.PROCESSING } },
    { new: true },
  ).lean()
  return doc ? toRecord(doc) : null
}

export async function setDocumentOcrStatus(
  customerId: string,
  organizationId: string,
  documentId: string,
  ocrStatus: OcrStatus,
): Promise<CustomerDocumentRecord | null> {
  const customerObjectId = toObjectId(customerId)
  const orgId = toObjectId(organizationId)
  const id = toObjectId(documentId)
  if (!customerObjectId || !orgId || !id) return null
  const doc = await CustomerDocument.findOneAndUpdate(
    { _id: id, customerId: customerObjectId, organizationId: orgId },
    { $set: { ocrStatus } },
    { new: true },
  ).lean()
  return doc ? toRecord(doc) : null
}

/** OCR statuses of the customer's ACTIVE documents, used to derive the customer document status. */
export async function listActiveDocumentOcrStatuses(
  customerId: string,
  organizationId: string,
): Promise<OcrStatus[]> {
  const customerObjectId = toObjectId(customerId)
  const orgId = toObjectId(organizationId)
  if (!customerObjectId || !orgId) return []
  const statuses = await CustomerDocument.distinct('ocrStatus', {
    customerId: customerObjectId,
    organizationId: orgId,
    status: CUSTOMER_FILE_STATUSES.ACTIVE,
  })
  return statuses as OcrStatus[]
}
