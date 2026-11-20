import { REVIEW_STATUSES } from '../../constants/performance.js'
import {
  findCalibrationById,
  findCycleById,
  findFrameworkById,
  findReviewById,
  insertCalibration,
  insertPeerReview,
  insertReview,
  listCalibrations,
  listGoals,
  listPeerReviews,
  listReviews,
  updateCalibration,
  updatePeerReview,
  updateReview,
} from '../../repositories/performance/performance.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import { conflict, forbiddenError, invalidField, notFound } from '../../utils/httpErrors.js'
import { toPaginated } from '../../utils/pagination.js'
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  recordAuditEvent,
} from '../audit/audit.service.js'
import {
  assertBranchScoped,
  branchScopeForList,
  canViewAllReviews,
  canViewTeamReviews,
  requirePerformanceOrganization,
} from './performance-access.js'
import {
  emitPerformanceNotificationIntent,
  publishPerformanceEvent,
} from './performance-notifications.js'
import { assertReviewTransition } from './transitions.js'
import { weightedAverage } from './weight-math.js'

function parsePage(query: { page?: number; pageSize?: number; limit?: number }) {
  const page = Math.max(1, Number(query.page ?? 1))
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? query.limit ?? 20)))
  return { page, pageSize, skip: (page - 1) * pageSize }
}

export async function createReview(
  ctx: AccessContext,
  body: {
    organizationId?: string
    cycleId: string
    employeeId: string
    managerEmployeeId?: string
    legalEntityId?: string
    branchId?: string
    competencyFrameworkId?: string
  },
  meta?: RequestMeta,
) {
  const organizationId = await requirePerformanceOrganization(ctx, body.organizationId)
  assertBranchScoped(ctx, body.branchId, organizationId)
  const cycle = await findCycleById(body.cycleId)
  if (!cycle || cycle.organizationId !== organizationId) {
    throw invalidField('cycleId', 'Performance cycle was not found.')
  }
  if (['DRAFT', 'CONFIGURING', 'CANCELLED', 'COMPLETED'].includes(cycle.status)) {
    throw conflict('Reviews can only be created for an open cycle.')
  }

  let competencySnapshot: unknown
  if (body.competencyFrameworkId) {
    const framework = await findFrameworkById(body.competencyFrameworkId)
    if (!framework || framework.organizationId !== organizationId) {
      throw invalidField('competencyFrameworkId', 'Competency framework was not found.')
    }
    competencySnapshot = framework
  }

  const review = await insertReview({
    organizationId,
    legalEntityId: body.legalEntityId ?? cycle.legalEntityId,
    branchId: body.branchId,
    cycleId: cycle.id,
    employeeId: body.employeeId,
    managerEmployeeId: body.managerEmployeeId,
    templateId: cycle.templateId,
    templateVersion: cycle.templateVersion,
    templateSnapshot: cycle.templateSnapshot,
    ratingScaleSnapshot: cycle.ratingScaleSnapshot,
    competencySnapshot,
    status: REVIEW_STATUSES.DRAFT,
    createdBy: ctx.userId,
  })
  if (!review) throw conflict('A review already exists for this employee in the cycle.')

  await recordAuditEvent({
    action: AUDIT_ACTIONS.PERFORMANCE_REVIEW_CREATED,
    entityType: AUDIT_ENTITY_TYPES.PERFORMANCE_REVIEW,
    entityId: review.id,
    organizationId,
    meta,
  })
  await publishPerformanceEvent({
    organizationId,
    eventKey: `performance.review.created:${review.id}`,
    eventType: 'performance.review.created',
    payload: { reviewId: review.id, cycleId: cycle.id, employeeId: body.employeeId },
  })
  await emitPerformanceNotificationIntent({
    organizationId,
    kind: 'performance.review.assigned',
    intentKey: `performance.review.assigned:${review.id}`,
    entityType: AUDIT_ENTITY_TYPES.PERFORMANCE_REVIEW,
    entityId: review.id,
    employeeId: body.employeeId,
    payload: { reviewId: review.id },
    meta,
  })
  return review
}

export async function submitSelfAssessment(
  ctx: AccessContext,
  id: string,
  body: {
    achievements?: string
    challenges?: string
    developmentNeeds?: string
    comments?: string
    competencyRatings?: Array<{ competencyCode: string; rating?: number; comments?: string }>
  },
  meta?: RequestMeta,
) {
  const review = await getReviewAuthorized(ctx, id)
  if (review.status === REVIEW_STATUSES.DRAFT) {
    assertReviewTransition(review.status, REVIEW_STATUSES.SELF_REVIEW)
  } else if (review.status !== REVIEW_STATUSES.SELF_REVIEW) {
    throw conflict('Self-assessment can only be submitted during self-review.')
  }

  const updated = await updateReview(
    id,
    {
      status: REVIEW_STATUSES.MANAGER_REVIEW,
      selfAssessment: {
        ...body,
        submittedAt: new Date(),
        submittedBy: ctx.userId,
      },
      updatedBy: ctx.userId,
    },
    [REVIEW_STATUSES.DRAFT, REVIEW_STATUSES.SELF_REVIEW],
  )
  if (!updated) throw conflict('Review could not be updated.')

  await recordAuditEvent({
    action: AUDIT_ACTIONS.PERFORMANCE_REVIEW_SUBMITTED,
    entityType: AUDIT_ENTITY_TYPES.PERFORMANCE_REVIEW,
    entityId: id,
    organizationId: review.organizationId,
    metadata: { stage: 'SELF_REVIEW' },
    meta,
  })
  await publishPerformanceEvent({
    organizationId: review.organizationId,
    eventKey: `performance.self_review.submitted:${id}`,
    eventType: 'performance.self_review.submitted',
    payload: { reviewId: id },
  })
  return updated
}

export async function submitManagerAssessment(
  ctx: AccessContext,
  id: string,
  body: {
    strengths?: string
    improvements?: string
    developmentRecommendations?: string
    comments?: string
    overallRating?: number
    competencyRatings?: Array<{ competencyCode: string; rating?: number; comments?: string }>
    goalRatings?: Array<{ goalId: string; rating?: number; comments?: string }>
    skipPeerReview?: boolean
    skipCalibration?: boolean
  },
  meta?: RequestMeta,
) {
  const review = await getReviewAuthorized(ctx, id)
  if (!canViewTeamReviews(ctx) && !canViewAllReviews(ctx)) {
    throw forbiddenError('You are not authorized to submit manager assessments.')
  }
  if (
    review.status !== REVIEW_STATUSES.MANAGER_REVIEW &&
    review.status !== REVIEW_STATUSES.SELF_REVIEW
  ) {
    throw conflict('Manager assessment is not open for this review.')
  }

  const cycle = await findCycleById(review.cycleId)
  const goals = await listGoals({
    organizationId: review.organizationId,
    employeeId: review.employeeId,
    cycleId: review.cycleId,
    skip: 0,
    limit: 100,
  })

  const goalWeighted = (body.goalRatings ?? [])
    .filter((g) => g.rating != null)
    .map((g) => {
      const goal = goals.items.find((item) => item.id === g.goalId)
      return { rating: Number(g.rating), weight: goal?.weight ?? '0.00' }
    })

  const competencyWeighted = (body.competencyRatings ?? [])
    .filter((c) => c.rating != null)
    .map((c) => ({ rating: Number(c.rating), weight: '1.00' }))

  const components: Array<{ rating: number; weight: string }> = []
  if (goalWeighted.length) {
    components.push({ rating: Number(weightedAverage(goalWeighted)), weight: '40.00' })
  }
  if (competencyWeighted.length) {
    components.push({ rating: Number(weightedAverage(competencyWeighted)), weight: '40.00' })
  }
  if (body.overallRating != null) {
    components.push({ rating: body.overallRating, weight: '20.00' })
  }
  const computedOverall =
    body.overallRating ??
    (components.length ? Number(weightedAverage(components)) : undefined)

  let next = REVIEW_STATUSES.FINAL_REVIEW
  if (cycle?.requirePeerReview && !body.skipPeerReview) next = REVIEW_STATUSES.PEER_REVIEW
  else if (cycle?.requireCalibration && !body.skipCalibration) next = REVIEW_STATUSES.CALIBRATION

  assertReviewTransition(REVIEW_STATUSES.MANAGER_REVIEW, next)

  const updated = await updateReview(
    id,
    {
      status: next,
      managerAssessment: {
        strengths: body.strengths,
        improvements: body.improvements,
        developmentRecommendations: body.developmentRecommendations,
        comments: body.comments,
        overallRating: computedOverall,
        competencyRatings: body.competencyRatings,
        goalRatings: body.goalRatings,
        submittedAt: new Date(),
        submittedBy: ctx.userId,
      },
      originalManagerRating: computedOverall,
      ratingBreakdown: {
        goalAverage: goalWeighted.length ? weightedAverage(goalWeighted) : null,
        competencyAverage: competencyWeighted.length ? weightedAverage(competencyWeighted) : null,
        overallInput: body.overallRating ?? null,
        computedOverall: computedOverall ?? null,
        inputs: { goals: body.goalRatings, competencies: body.competencyRatings },
      },
      updatedBy: ctx.userId,
    },
    [REVIEW_STATUSES.MANAGER_REVIEW, REVIEW_STATUSES.SELF_REVIEW],
  )
  if (!updated) throw conflict('Review could not be updated.')

  await recordAuditEvent({
    action: AUDIT_ACTIONS.PERFORMANCE_REVIEW_SUBMITTED,
    entityType: AUDIT_ENTITY_TYPES.PERFORMANCE_REVIEW,
    entityId: id,
    organizationId: review.organizationId,
    metadata: { stage: 'MANAGER_REVIEW' },
    meta,
  })
  await publishPerformanceEvent({
    organizationId: review.organizationId,
    eventKey: `performance.manager_review.submitted:${id}`,
    eventType: 'performance.manager_review.submitted',
    payload: { reviewId: id },
  })
  return updated
}

export async function requestPeerReview(
  ctx: AccessContext,
  id: string,
  body: { reviewerEmployeeId: string; confidentiality?: string },
) {
  const review = await getReviewAuthorized(ctx, id)
  if (![REVIEW_STATUSES.PEER_REVIEW, REVIEW_STATUSES.MANAGER_REVIEW].includes(review.status as never)) {
    throw conflict('Peer review can only be requested in the peer-review stage.')
  }
  const created = await insertPeerReview({
    organizationId: review.organizationId,
    reviewId: id,
    employeeId: review.employeeId,
    reviewerEmployeeId: body.reviewerEmployeeId,
    confidentiality: body.confidentiality ?? 'CONFIDENTIAL',
    status: 'REQUESTED',
    createdBy: ctx.userId,
  })
  if (!created) throw conflict('Peer review already requested for this reviewer.')
  await emitPerformanceNotificationIntent({
    organizationId: review.organizationId,
    kind: 'performance.peer_review.request',
    intentKey: `performance.peer_review.request:${id}:${body.reviewerEmployeeId}`,
    entityType: AUDIT_ENTITY_TYPES.PERFORMANCE_REVIEW,
    entityId: id,
    employeeId: body.reviewerEmployeeId,
    payload: { reviewId: id },
  })
  return created
}

export async function submitPeerReview(
  ctx: AccessContext,
  peerReviewId: string,
  body: {
    ratings?: Array<{ competencyCode: string; rating?: number; comments?: string }>
    comments?: string
  },
  meta?: RequestMeta,
) {
  const updated = await updatePeerReview(peerReviewId, {
    ratings: body.ratings,
    comments: body.comments,
    status: 'SUBMITTED',
    submittedAt: new Date(),
  })
  if (!updated) throw notFound('Peer review was not found.')
  await publishPerformanceEvent({
    organizationId: (await findReviewById(updated.reviewId))!.organizationId,
    eventKey: `performance.peer_review.submitted:${peerReviewId}`,
    eventType: 'performance.peer_review.submitted',
    payload: { peerReviewId, reviewId: updated.reviewId },
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.PERFORMANCE_REVIEW_SUBMITTED,
    entityType: AUDIT_ENTITY_TYPES.PERFORMANCE_REVIEW,
    entityId: updated.reviewId,
    organizationId: (await findReviewById(updated.reviewId))!.organizationId,
    metadata: { stage: 'PEER_REVIEW', peerReviewId },
    meta,
  })
  return sanitizePeerReview(updated, ctx)
}

export async function listPeerReviewsForReview(ctx: AccessContext, reviewId: string) {
  const review = await getReviewAuthorized(ctx, reviewId)
  const items = await listPeerReviews(review.organizationId, reviewId)
  return items.map((item) => sanitizePeerReview(item, ctx))
}

function sanitizePeerReview(
  item: {
    id: string
    reviewId: string
    status: string
    confidentiality: string
    comments?: string
    ratings?: unknown
    reviewerEmployeeId?: string
    submittedAt?: Date
  },
  ctx: AccessContext,
) {
  if (item.confidentiality === 'CONFIDENTIAL' && !canViewAllReviews(ctx)) {
    return {
      id: item.id,
      reviewId: item.reviewId,
      status: item.status,
      confidentiality: item.confidentiality,
      comments: item.comments,
      ratings: item.ratings,
      submittedAt: item.submittedAt,
      reviewerEmployeeId: undefined,
    }
  }
  return item
}

export async function createCalibrationSession(
  ctx: AccessContext,
  body: {
    organizationId?: string
    cycleId: string
    name: string
    participants: Array<{
      reviewId: string
      employeeId: string
      originalRating?: number
      proposedRating?: number
    }>
  },
) {
  const organizationId = await requirePerformanceOrganization(ctx, body.organizationId)
  const cycle = await findCycleById(body.cycleId)
  if (!cycle || cycle.organizationId !== organizationId) {
    throw invalidField('cycleId', 'Performance cycle was not found.')
  }
  return insertCalibration({
    organizationId,
    cycleId: body.cycleId,
    name: body.name,
    status: 'IN_PROGRESS',
    participants: body.participants,
    createdBy: ctx.userId,
  })
}

export async function finalizeCalibration(
  ctx: AccessContext,
  id: string,
  body: {
    participants: Array<{
      reviewId: string
      employeeId: string
      originalRating?: number
      proposedRating?: number
      finalRating: number
      comments?: string
    }>
    comments?: string
  },
  meta?: RequestMeta,
) {
  const session = await findCalibrationById(id)
  if (!session) throw notFound('Calibration session was not found.')
  await requirePerformanceOrganization(ctx, session.organizationId)

  for (const participant of body.participants) {
    const review = await findReviewById(participant.reviewId)
    if (!review || review.organizationId !== session.organizationId) continue
    await updateReview(participant.reviewId, {
      calibratedRating: participant.finalRating,
      status: REVIEW_STATUSES.FINAL_REVIEW,
      updatedBy: ctx.userId,
    })
  }

  const updated = await updateCalibration(id, {
    status: 'COMPLETED',
    participants: body.participants,
    comments: body.comments,
    finalizedAt: new Date(),
    finalizedBy: ctx.userId,
  })

  await recordAuditEvent({
    action: AUDIT_ACTIONS.PERFORMANCE_CALIBRATION_CHANGED,
    entityType: AUDIT_ENTITY_TYPES.CALIBRATION_SESSION,
    entityId: id,
    organizationId: session.organizationId,
    meta,
  })
  await publishPerformanceEvent({
    organizationId: session.organizationId,
    eventKey: `performance.rating.calibrated:${id}`,
    eventType: 'performance.rating.calibrated',
    payload: { calibrationId: id },
  })
  return updated
}

export async function finalizeReview(
  ctx: AccessContext,
  id: string,
  body: { finalRating?: number; finalComments?: string; meetingNotes?: string },
  meta?: RequestMeta,
) {
  const review = await getReviewAuthorized(ctx, id)
  if (!canViewAllReviews(ctx) && !canViewTeamReviews(ctx)) {
    throw forbiddenError('You are not authorized to finalize reviews.')
  }
  if (![REVIEW_STATUSES.FINAL_REVIEW, REVIEW_STATUSES.APPROVED].includes(review.status as never)) {
    assertReviewTransition(review.status, REVIEW_STATUSES.FINAL_REVIEW)
  }

  const finalRating =
    body.finalRating ?? review.calibratedRating ?? review.originalManagerRating ?? undefined
  if (finalRating == null) throw invalidField('finalRating', 'Final rating is required.')

  const updated = await updateReview(
    id,
    {
      status: REVIEW_STATUSES.COMPLETED,
      finalRating,
      finalComments: body.finalComments,
      meetingNotes: body.meetingNotes,
      meetingCompletedAt: new Date(),
      finalizedAt: new Date(),
      finalizedBy: ctx.userId,
      updatedBy: ctx.userId,
    },
    [REVIEW_STATUSES.FINAL_REVIEW, REVIEW_STATUSES.APPROVED, REVIEW_STATUSES.CALIBRATION],
  )
  if (!updated) throw conflict('Review could not be finalized.')

  await recordAuditEvent({
    action: AUDIT_ACTIONS.PERFORMANCE_REVIEW_FINALIZED,
    entityType: AUDIT_ENTITY_TYPES.PERFORMANCE_REVIEW,
    entityId: id,
    organizationId: review.organizationId,
    meta,
  })
  await publishPerformanceEvent({
    organizationId: review.organizationId,
    eventKey: `performance.review.finalized:${id}`,
    eventType: 'performance.review.finalized',
    payload: { reviewId: id, finalRating },
  })
  await emitPerformanceNotificationIntent({
    organizationId: review.organizationId,
    kind: 'performance.review.finalized',
    intentKey: `performance.review.finalized:${id}`,
    entityType: AUDIT_ENTITY_TYPES.PERFORMANCE_REVIEW,
    entityId: id,
    employeeId: review.employeeId,
    payload: { reviewId: id },
    meta,
  })
  return updated
}

export async function getReviewAuthorized(ctx: AccessContext, id: string) {
  const review = await findReviewById(id)
  if (!review) throw notFound('Performance review was not found.')
  await requirePerformanceOrganization(ctx, review.organizationId)
  assertBranchScoped(ctx, review.branchId, review.organizationId)
  return review
}

export async function listReviewsService(
  ctx: AccessContext,
  query: {
    organizationId?: string
    cycleId?: string
    employeeId?: string
    managerEmployeeId?: string
    status?: string
    page?: number
    pageSize?: number
  },
) {
  const organizationId = await requirePerformanceOrganization(ctx, query.organizationId)
  const { page, skip, pageSize } = parsePage(query)
  const result = await listReviews({
    organizationId,
    cycleId: query.cycleId,
    employeeId: query.employeeId,
    managerEmployeeId: query.managerEmployeeId,
    status: query.status,
    branchIds: branchScopeForList(ctx),
    skip,
    limit: pageSize,
  })
  return toPaginated(result.items, page, pageSize, result.total)
}

export async function listCalibrationsService(
  ctx: AccessContext,
  query: { organizationId?: string; cycleId?: string },
) {
  const organizationId = await requirePerformanceOrganization(ctx, query.organizationId)
  return listCalibrations(organizationId, query.cycleId)
}

export async function transitionReviewStatus(
  ctx: AccessContext,
  id: string,
  status: string,
  meta?: RequestMeta,
) {
  const review = await getReviewAuthorized(ctx, id)
  assertReviewTransition(review.status, status)
  const updated = await updateReview(id, { status, updatedBy: ctx.userId }, [review.status])
  if (!updated) throw conflict('Review status was already changed.')
  await recordAuditEvent({
    action: AUDIT_ACTIONS.PERFORMANCE_REVIEW_SUBMITTED,
    entityType: AUDIT_ENTITY_TYPES.PERFORMANCE_REVIEW,
    entityId: id,
    organizationId: review.organizationId,
    metadata: { from: review.status, to: status },
    meta,
  })
  return updated
}
