import {
  OCR_REVIEW_STATUSES,
  type CustomerDocumentType,
  type OcrReviewStatus,
  type OcrRunStatus,
} from '../../constants/customers.js'
import type {
  IOcrField,
  IOcrReviewedField,
} from '../../interfaces/customer.interface.js'
import { CustomerOcrRun } from '../../models/customer-ocr-run.model.js'
import { omitUndefined, toObjectId } from '../object-id.js'

export type CustomerOcrRunRecord = {
  id: string
  documentId: string
  customerId: string
  organizationId: string
  provider: string
  modelVersion: string
  detectedType: CustomerDocumentType
  typeConfidence: number
  /** RAW values. Mask before returning them from the API. */
  fields: IOcrField[]
  status: OcrRunStatus
  reviewedFields?: IOcrReviewedField[]
  reviewStatus: OcrReviewStatus
  reviewedBy?: string
  reviewedAt?: Date
  errorCode?: string
  createdAt: Date
  updatedAt: Date
}

type PersistableRun = {
  _id: { toString(): string }
  documentId: { toString(): string }
  customerId: { toString(): string }
  organizationId: { toString(): string }
  provider: string
  modelVersion: string
  detectedType: string
  typeConfidence: number
  fields?: ReadonlyArray<{ key: string; value: string; confidence: number }> | null
  status: string
  reviewedFields?: ReadonlyArray<{ key: string; value: string }> | null
  reviewStatus: string
  reviewedBy?: { toString(): string } | null
  reviewedAt?: Date | null
  errorCode?: string | null
  createdAt: Date
  updatedAt: Date
}

function toRecord(doc: PersistableRun): CustomerOcrRunRecord {
  return {
    id: doc._id.toString(),
    documentId: doc.documentId.toString(),
    customerId: doc.customerId.toString(),
    organizationId: doc.organizationId.toString(),
    provider: doc.provider,
    modelVersion: doc.modelVersion,
    detectedType: doc.detectedType as CustomerDocumentType,
    typeConfidence: doc.typeConfidence,
    fields: (doc.fields ?? []).map((f) => ({ key: f.key, value: f.value, confidence: f.confidence })),
    status: doc.status as OcrRunStatus,
    reviewedFields: doc.reviewedFields
      ? doc.reviewedFields.map((f) => ({ key: f.key, value: f.value }))
      : undefined,
    reviewStatus: doc.reviewStatus as OcrReviewStatus,
    reviewedBy: doc.reviewedBy ? doc.reviewedBy.toString() : undefined,
    reviewedAt: doc.reviewedAt ?? undefined,
    errorCode: doc.errorCode ?? undefined,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

export type NewOcrRun = {
  documentId: string
  customerId: string
  organizationId: string
  provider: string
  modelVersion: string
  detectedType: CustomerDocumentType
  typeConfidence: number
  fields: IOcrField[]
  status: OcrRunStatus
  errorCode?: string
}

/** Append-only: every OCR attempt is a new document; earlier runs are never touched. */
export async function insertOcrRun(input: NewOcrRun): Promise<CustomerOcrRunRecord> {
  const doc = await CustomerOcrRun.create({
    ...omitUndefined({ ...input }),
    documentId: toObjectId(input.documentId),
    customerId: toObjectId(input.customerId),
    organizationId: toObjectId(input.organizationId),
    reviewStatus: OCR_REVIEW_STATUSES.NONE,
  })
  return toRecord(doc)
}

export async function listOcrRuns(input: {
  documentId: string
  customerId: string
  organizationId: string
  skip: number
  take: number
}): Promise<{ items: CustomerOcrRunRecord[]; total: number }> {
  const documentId = toObjectId(input.documentId)
  const customerId = toObjectId(input.customerId)
  const organizationId = toObjectId(input.organizationId)
  if (!documentId || !customerId || !organizationId) return { items: [], total: 0 }

  const filter = { documentId, customerId, organizationId }
  const [items, total] = await Promise.all([
    CustomerOcrRun.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(input.skip)
      .limit(input.take)
      .lean(),
    CustomerOcrRun.countDocuments(filter),
  ])
  return { items: items.map(toRecord), total }
}

/** Scoped by document, customer and organization. */
export async function findOcrRun(
  documentId: string,
  customerId: string,
  organizationId: string,
  runId: string,
): Promise<CustomerOcrRunRecord | null> {
  const documentObjectId = toObjectId(documentId)
  const customerObjectId = toObjectId(customerId)
  const orgId = toObjectId(organizationId)
  const id = toObjectId(runId)
  if (!documentObjectId || !customerObjectId || !orgId || !id) return null
  const doc = await CustomerOcrRun.findOne({
    _id: id,
    documentId: documentObjectId,
    customerId: customerObjectId,
    organizationId: orgId,
  }).lean()
  return doc ? toRecord(doc) : null
}

/** Id of the newest run of a document, or null when it has none. */
export async function findLatestOcrRunId(
  documentId: string,
  organizationId: string,
): Promise<string | null> {
  const documentObjectId = toObjectId(documentId)
  const orgId = toObjectId(organizationId)
  if (!documentObjectId || !orgId) return null
  const doc = await CustomerOcrRun.findOne({ documentId: documentObjectId, organizationId: orgId })
    .sort({ createdAt: -1, _id: -1 })
    .select('_id')
    .lean()
  return doc ? doc._id.toString() : null
}

/**
 * Records the single review of a run (compare-and-set on reviewStatus NONE). Returns null when
 * the run is gone or was already reviewed.
 */
export async function reviewOcrRun(input: {
  runId: string
  documentId: string
  customerId: string
  organizationId: string
  reviewStatus: typeof OCR_REVIEW_STATUSES.APPROVED | typeof OCR_REVIEW_STATUSES.REJECTED
  reviewedFields: IOcrReviewedField[]
  reviewedBy: string
}): Promise<CustomerOcrRunRecord | null> {
  const id = toObjectId(input.runId)
  const documentId = toObjectId(input.documentId)
  const customerId = toObjectId(input.customerId)
  const organizationId = toObjectId(input.organizationId)
  const reviewedBy = toObjectId(input.reviewedBy)
  if (!id || !documentId || !customerId || !organizationId || !reviewedBy) return null

  const doc = await CustomerOcrRun.findOneAndUpdate(
    {
      _id: id,
      documentId,
      customerId,
      organizationId,
      reviewStatus: OCR_REVIEW_STATUSES.NONE,
    },
    {
      $set: {
        reviewStatus: input.reviewStatus,
        reviewedFields: input.reviewedFields,
        reviewedBy,
        reviewedAt: new Date(),
      },
    },
    { new: true },
  ).lean()
  return doc ? toRecord(doc) : null
}
