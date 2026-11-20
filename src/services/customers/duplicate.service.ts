import type { DuplicateReviewStatus } from '../../constants/customers.js'
import { logger } from '../../lib/logger/index.js'
import {
  findDuplicateReviewFor,
  listDuplicateReviewsFor,
  updateDuplicateReview,
  upsertPotentialDuplicate,
} from '../../repositories/customers/customer-duplicate-review.repository.js'
import {
  findCustomersByIds,
  findDuplicateCandidates,
  type CustomerRecord,
} from '../../repositories/customers/customer.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import { notFound } from '../../utils/httpErrors.js'
import { resolvePagination, toPaginated } from '../../utils/pagination.js'
import type {
  CustomerDuplicateParams,
  ListCustomerDuplicatesQuery,
  ReviewDuplicateBody,
} from '../../validations/customer.validation.js'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, recordAuditEvent } from '../audit/audit.service.js'
import { canAccessCustomer, loadAccessibleCustomer } from './customer-access.js'
import {
  canonicalPair,
  normalizeRegistration,
  sharedSignals,
  type MatchKeys,
} from './customer-rules.js'
import { toDuplicateReviewResource, type DuplicateReviewResource } from './customer.mapper.js'

export function matchKeysOf(customer: CustomerRecord): MatchKeys {
  return {
    normalizedEmail: customer.normalizedEmail,
    normalizedPhone: customer.normalizedPhone,
    registrationNumber: normalizeRegistration(customer.corporate?.registrationNumber),
  }
}

/**
 * Finds other customers of the same organization that share an email, phone or registration
 * number and records one POTENTIAL review per pair. Reviews only: nothing is merged or blocked.
 *
 * The search covers the whole organization, but only candidates the caller may access are
 * returned, so a candidate in another branch is never disclosed.
 * Detection must never fail a create or update, so errors are logged (name only) and swallowed.
 */
export async function detectDuplicates(
  ctx: AccessContext,
  customer: CustomerRecord,
): Promise<DuplicateReviewResource[]> {
  try {
    const keys = matchKeysOf(customer)
    const candidates = await findDuplicateCandidates({
      organizationId: customer.organizationId,
      excludeId: customer.id,
      normalizedEmail: keys.normalizedEmail,
      normalizedPhone: keys.normalizedPhone,
      registrationNumber: keys.registrationNumber,
    })

    const results: DuplicateReviewResource[] = []
    for (const candidate of candidates) {
      const signals = sharedSignals(keys, matchKeysOf(candidate))
      if (signals.length === 0) continue
      const review = await upsertPotentialDuplicate({
        organizationId: customer.organizationId,
        pair: canonicalPair(customer.id, candidate.id),
        signals,
      })
      if (review && canAccessCustomer(ctx, candidate)) {
        results.push(toDuplicateReviewResource(review, customer.id, candidate))
      }
    }
    return results
  } catch (error) {
    logger.error('Duplicate detection failed', {
      module: 'customers',
      operation: 'detect_duplicates',
      name: error instanceof Error ? error.name : 'Error',
    })
    return []
  }
}

export async function listCustomerDuplicates(
  ctx: AccessContext,
  customerId: string,
  query: ListCustomerDuplicatesQuery,
) {
  const customer = await loadAccessibleCustomer(ctx, customerId)
  const pagination = resolvePagination(query)
  const result = await listDuplicateReviewsFor({
    organizationId: customer.organizationId,
    customerId: customer.id,
    status: query.status as DuplicateReviewStatus | undefined,
    skip: pagination.skip,
    take: pagination.take,
  })

  const otherIds = result.items.map((review) =>
    review.customerId === customer.id ? review.candidateId : review.customerId,
  )
  const others = new Map(
    (await findCustomersByIds(customer.organizationId, otherIds)).map((other) => [other.id, other]),
  )

  const items: DuplicateReviewResource[] = []
  for (const review of result.items) {
    const other = others.get(review.customerId === customer.id ? review.candidateId : review.customerId)
    if (!other || !canAccessCustomer(ctx, other)) continue
    items.push(toDuplicateReviewResource(review, customer.id, other))
  }
  return toPaginated(items, pagination.page, pagination.limit, result.total)
}

export async function reviewCustomerDuplicate(
  ctx: AccessContext,
  params: CustomerDuplicateParams,
  input: ReviewDuplicateBody,
  meta: RequestMeta,
): Promise<DuplicateReviewResource> {
  const customer = await loadAccessibleCustomer(ctx, params.id)
  const review = await findDuplicateReviewFor(customer.organizationId, customer.id, params.reviewId)
  if (!review) throw notFound('Duplicate review was not found.')

  const otherId = review.customerId === customer.id ? review.candidateId : review.customerId
  const [other] = await findCustomersByIds(customer.organizationId, [otherId])
  if (!other || !canAccessCustomer(ctx, other)) throw notFound('Duplicate review was not found.')

  const updated = await updateDuplicateReview({
    organizationId: customer.organizationId,
    reviewId: review.id,
    status: input.status,
    note: input.note,
    reviewedBy: ctx.userId,
  })
  if (!updated) throw notFound('Duplicate review was not found.')

  await recordAuditEvent({
    action: AUDIT_ACTIONS.CUSTOMER_DUPLICATE_REVIEWED,
    entityType: AUDIT_ENTITY_TYPES.CUSTOMER,
    entityId: customer.id,
    actorUserId: ctx.userId,
    organizationId: customer.organizationId,
    branchId: customer.branchId,
    metadata: {
      reviewId: updated.id,
      candidateId: other.id,
      from: review.status,
      to: updated.status,
      signals: updated.signals,
    },
    meta,
  })
  return toDuplicateReviewResource(updated, customer.id, other)
}
