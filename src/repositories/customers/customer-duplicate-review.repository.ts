import type { FilterQuery } from 'mongoose'
import {
  DUPLICATE_REVIEW_STATUSES,
  type DuplicateReviewStatus,
} from '../../constants/customers.js'
import type { ICustomerDuplicateReview } from '../../interfaces/customer.interface.js'
import { CustomerDuplicateReview } from '../../models/customer-duplicate-review.model.js'
import { toObjectId } from '../object-id.js'

/** `customerId` is always the smaller id of the pair, `candidateId` the larger. */
export type DuplicateReviewRecord = {
  id: string
  organizationId: string
  customerId: string
  candidateId: string
  status: DuplicateReviewStatus
  signals: string[]
  reviewedBy?: string
  reviewedAt?: Date
  note?: string
  createdAt: Date
  updatedAt: Date
}

type PersistableReview = {
  _id: { toString(): string }
  organizationId: { toString(): string }
  customerId: { toString(): string }
  candidateId: { toString(): string }
  status: string
  signals?: ReadonlyArray<string> | null
  reviewedBy?: { toString(): string } | null
  reviewedAt?: Date | null
  note?: string | null
  createdAt: Date
  updatedAt: Date
}

function toRecord(doc: PersistableReview): DuplicateReviewRecord {
  return {
    id: doc._id.toString(),
    organizationId: doc.organizationId.toString(),
    customerId: doc.customerId.toString(),
    candidateId: doc.candidateId.toString(),
    status: doc.status as DuplicateReviewStatus,
    signals: [...(doc.signals ?? [])],
    reviewedBy: doc.reviewedBy ? doc.reviewedBy.toString() : undefined,
    reviewedAt: doc.reviewedAt ?? undefined,
    note: doc.note ?? undefined,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 11000
  )
}

/**
 * Creates a POTENTIAL review for a canonical pair, or adds new signals to the existing one.
 * An existing review keeps its status, so a pair already marked NOT_DUPLICATE or CONFIRMED is
 * never reopened. `pair.customerId` must be smaller than `pair.candidateId`.
 */
export async function upsertPotentialDuplicate(input: {
  organizationId: string
  pair: { customerId: string; candidateId: string }
  signals: readonly string[]
}): Promise<DuplicateReviewRecord | null> {
  const organizationId = toObjectId(input.organizationId)
  const customerId = toObjectId(input.pair.customerId)
  const candidateId = toObjectId(input.pair.candidateId)
  if (!organizationId || !customerId || !candidateId) return null

  const run = () =>
    CustomerDuplicateReview.findOneAndUpdate(
      { organizationId, customerId, candidateId },
      {
        $setOnInsert: { status: DUPLICATE_REVIEW_STATUSES.POTENTIAL },
        $addToSet: { signals: { $each: [...input.signals] } },
      },
      { upsert: true, new: true },
    ).lean()

  try {
    const doc = await run()
    return doc ? toRecord(doc) : null
  } catch (error) {
    // Two requests upserting the same pair at once: the loser retries against the winner's row.
    if (!isDuplicateKeyError(error)) throw error
    const doc = await run()
    return doc ? toRecord(doc) : null
  }
}

/** Reviews that involve the customer on either side of the pair. */
export async function listDuplicateReviewsFor(input: {
  organizationId: string
  customerId: string
  status?: DuplicateReviewStatus
  skip: number
  take: number
}): Promise<{ items: DuplicateReviewRecord[]; total: number }> {
  const organizationId = toObjectId(input.organizationId)
  const customerId = toObjectId(input.customerId)
  if (!organizationId || !customerId) return { items: [], total: 0 }

  const filter: FilterQuery<ICustomerDuplicateReview> = {
    organizationId,
    $or: [{ customerId }, { candidateId: customerId }],
  }
  if (input.status) filter.status = input.status

  const [items, total] = await Promise.all([
    CustomerDuplicateReview.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(input.skip)
      .limit(input.take)
      .lean(),
    CustomerDuplicateReview.countDocuments(filter),
  ])
  return { items: items.map(toRecord), total }
}

/** A review that involves the customer on either side. */
export async function findDuplicateReviewFor(
  organizationId: string,
  customerId: string,
  reviewId: string,
): Promise<DuplicateReviewRecord | null> {
  const orgId = toObjectId(organizationId)
  const customerObjectId = toObjectId(customerId)
  const id = toObjectId(reviewId)
  if (!orgId || !customerObjectId || !id) return null
  const doc = await CustomerDuplicateReview.findOne({
    _id: id,
    organizationId: orgId,
    $or: [{ customerId: customerObjectId }, { candidateId: customerObjectId }],
  }).lean()
  return doc ? toRecord(doc) : null
}

export async function updateDuplicateReview(input: {
  organizationId: string
  reviewId: string
  status: DuplicateReviewStatus
  note?: string
  reviewedBy: string
}): Promise<DuplicateReviewRecord | null> {
  const organizationId = toObjectId(input.organizationId)
  const id = toObjectId(input.reviewId)
  const reviewedBy = toObjectId(input.reviewedBy)
  if (!organizationId || !id || !reviewedBy) return null

  const $set: Record<string, unknown> = {
    status: input.status,
    reviewedBy,
    reviewedAt: new Date(),
  }
  if (input.note !== undefined) $set.note = input.note

  const doc = await CustomerDuplicateReview.findOneAndUpdate(
    { _id: id, organizationId },
    { $set },
    { new: true },
  ).lean()
  return doc ? toRecord(doc) : null
}
