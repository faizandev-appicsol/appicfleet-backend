import {
  DEFAULT_RECRUITMENT_TIMEZONE,
  INTERVIEW_STATUSES,
  INTERVIEW_TYPES,
} from '../../constants/recruitment.js'
import {
  findInterviewById,
  findOverlappingInterviews,
  insertInterview,
  insertInterviewFeedback,
  listInterviewFeedback,
  listInterviews,
  updateInterview,
} from '../../repositories/recruitment/recruitment.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import { conflict, invalidField, notFound } from '../../utils/httpErrors.js'
import { toPaginated } from '../../utils/pagination.js'
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  recordAuditEvent,
} from '../audit/audit.service.js'
import { getApplication } from './application.service.js'
import {
  assertBranchScoped,
  branchScopeForList,
  requireRecruitmentOrganization,
} from './recruitment-access.js'
import {
  emitRecruitmentNotificationIntent,
  publishRecruitmentEvent,
} from './recruitment-notifications.js'

function parsePage(query: { page?: number; pageSize?: number; limit?: number }) {
  const page = Math.max(1, Number(query.page ?? 1))
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? query.limit ?? 20)))
  return { page, pageSize, skip: (page - 1) * pageSize }
}

export async function scheduleInterview(
  ctx: AccessContext,
  body: {
    organizationId?: string
    applicationId: string
    interviewType?: string
    interviewerUserIds: string[]
    scheduledStart: string
    scheduledEnd: string
    timezone?: string
    location?: string
    meetingLink?: string
    notes?: string
  },
  meta?: RequestMeta,
) {
  const application = await getApplication(ctx, body.applicationId)
  const start = new Date(body.scheduledStart)
  const end = new Date(body.scheduledEnd)
  if (!(start.getTime() < end.getTime())) {
    throw invalidField('scheduledEnd', 'End time must be after start time.')
  }
  if (!body.interviewerUserIds?.length) {
    throw invalidField('interviewerUserIds', 'At least one interviewer is required.')
  }

  const overlaps = await findOverlappingInterviews({
    organizationId: application.organizationId,
    candidateId: application.candidateId,
    interviewerUserIds: body.interviewerUserIds,
    start,
    end,
  })
  if (overlaps.length) {
    throw conflict('Interview overlaps an existing candidate or interviewer booking.')
  }

  const interview = await insertInterview({
    organizationId: application.organizationId,
    legalEntityId: application.legalEntityId,
    branchId: application.branchId,
    candidateId: application.candidateId,
    applicationId: application.id,
    interviewType: body.interviewType ?? INTERVIEW_TYPES.VIDEO,
    interviewerUserIds: body.interviewerUserIds,
    scheduledStart: start,
    scheduledEnd: end,
    timezone: body.timezone ?? DEFAULT_RECRUITMENT_TIMEZONE,
    location: body.location,
    meetingLink: body.meetingLink,
    status: INTERVIEW_STATUSES.SCHEDULED,
    notes: body.notes,
    createdBy: ctx.userId,
  })

  await recordAuditEvent({
    action: AUDIT_ACTIONS.INTERVIEW_CREATED,
    entityType: AUDIT_ENTITY_TYPES.INTERVIEW,
    entityId: interview.id,
    organizationId: application.organizationId,
    branchId: application.branchId,
    meta,
  })
  await emitRecruitmentNotificationIntent({
    organizationId: application.organizationId,
    candidateId: application.candidateId,
    kind: 'recruitment.interview.scheduled',
    intentKey: `recruitment.interview.scheduled:${interview.id}`,
    entityType: AUDIT_ENTITY_TYPES.INTERVIEW,
    entityId: interview.id,
    payload: { interviewId: interview.id, applicationId: application.id },
    meta,
  })
  await publishRecruitmentEvent({
    organizationId: application.organizationId,
    eventKey: `recruitment.interview.scheduled:${interview.id}`,
    eventType: 'recruitment.interview.scheduled',
    payload: { interviewId: interview.id },
  })
  return interview
}

export async function rescheduleInterview(
  ctx: AccessContext,
  id: string,
  body: {
    scheduledStart: string
    scheduledEnd: string
    timezone?: string
    location?: string
    meetingLink?: string
    notes?: string
  },
  meta?: RequestMeta,
) {
  const existing = await findInterviewById(id)
  if (!existing) throw notFound('Interview was not found.')
  await requireRecruitmentOrganization(ctx, existing.organizationId)
  assertBranchScoped(ctx, existing.branchId, existing.organizationId)

  if (
    existing.status === INTERVIEW_STATUSES.COMPLETED ||
    existing.status === INTERVIEW_STATUSES.CANCELLED
  ) {
    throw conflict('Completed or cancelled interviews cannot be rescheduled.')
  }

  const start = new Date(body.scheduledStart)
  const end = new Date(body.scheduledEnd)
  if (!(start.getTime() < end.getTime())) {
    throw invalidField('scheduledEnd', 'End time must be after start time.')
  }

  const overlaps = await findOverlappingInterviews({
    organizationId: existing.organizationId,
    candidateId: existing.candidateId,
    interviewerUserIds: existing.interviewerUserIds,
    start,
    end,
    excludeId: id,
  })
  if (overlaps.length) {
    throw conflict('Interview overlaps an existing booking.')
  }

  const updated = await updateInterview(id, {
    scheduledStart: start,
    scheduledEnd: end,
    timezone: body.timezone ?? existing.timezone,
    location: body.location ?? existing.location,
    meetingLink: body.meetingLink ?? existing.meetingLink,
    notes: body.notes ?? existing.notes,
    status: INTERVIEW_STATUSES.RESCHEDULED,
    updatedBy: ctx.userId,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.INTERVIEW_RESCHEDULED,
    entityType: AUDIT_ENTITY_TYPES.INTERVIEW,
    entityId: id,
    organizationId: existing.organizationId,
    meta,
  })
  return updated
}

export async function completeInterview(ctx: AccessContext, id: string, meta?: RequestMeta) {
  const existing = await findInterviewById(id)
  if (!existing) throw notFound('Interview was not found.')
  await requireRecruitmentOrganization(ctx, existing.organizationId)
  if (existing.status === INTERVIEW_STATUSES.COMPLETED) return existing
  if (existing.status === INTERVIEW_STATUSES.CANCELLED) {
    throw conflict('Cancelled interviews cannot be completed.')
  }
  const updated = await updateInterview(id, {
    status: INTERVIEW_STATUSES.COMPLETED,
    updatedBy: ctx.userId,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.INTERVIEW_COMPLETED,
    entityType: AUDIT_ENTITY_TYPES.INTERVIEW,
    entityId: id,
    organizationId: existing.organizationId,
    meta,
  })
  await publishRecruitmentEvent({
    organizationId: existing.organizationId,
    eventKey: `recruitment.interview.completed:${id}`,
    eventType: 'recruitment.interview.completed',
    payload: { interviewId: id },
  })
  return updated
}

export async function cancelInterview(ctx: AccessContext, id: string) {
  const existing = await findInterviewById(id)
  if (!existing) throw notFound('Interview was not found.')
  await requireRecruitmentOrganization(ctx, existing.organizationId)
  if (existing.status === INTERVIEW_STATUSES.COMPLETED) {
    throw conflict('Completed interviews cannot be cancelled.')
  }
  if (existing.status === INTERVIEW_STATUSES.CANCELLED) return existing
  return updateInterview(id, {
    status: INTERVIEW_STATUSES.CANCELLED,
    updatedBy: ctx.userId,
  })
}

export async function submitFeedback(
  ctx: AccessContext,
  interviewId: string,
  body: {
    rating?: number
    recommendation: string
    strengths?: string
    concerns?: string
    notes?: string
  },
  meta?: RequestMeta,
) {
  const interview = await findInterviewById(interviewId)
  if (!interview) throw notFound('Interview was not found.')
  await requireRecruitmentOrganization(ctx, interview.organizationId)
  assertBranchScoped(ctx, interview.branchId, interview.organizationId)

  const feedback = await insertInterviewFeedback({
    organizationId: interview.organizationId,
    interviewId,
    applicationId: interview.applicationId,
    candidateId: interview.candidateId,
    interviewerUserId: ctx.userId,
    rating: body.rating,
    recommendation: body.recommendation,
    strengths: body.strengths,
    concerns: body.concerns,
    notes: body.notes,
    submittedAt: new Date(),
  })
  if (!feedback) throw conflict('Feedback already submitted for this interview.')

  await recordAuditEvent({
    action: AUDIT_ACTIONS.INTERVIEW_FEEDBACK_SUBMITTED,
    entityType: AUDIT_ENTITY_TYPES.INTERVIEW,
    entityId: interviewId,
    organizationId: interview.organizationId,
    metadata: { recommendation: body.recommendation },
    meta,
  })
  return feedback
}

export async function listFeedbackService(ctx: AccessContext, interviewId: string) {
  const interview = await findInterviewById(interviewId)
  if (!interview) throw notFound('Interview was not found.')
  await requireRecruitmentOrganization(ctx, interview.organizationId)
  assertBranchScoped(ctx, interview.branchId, interview.organizationId)
  return listInterviewFeedback(interview.organizationId, interviewId)
}

export async function listInterviewsService(
  ctx: AccessContext,
  query: {
    organizationId?: string
    status?: string
    from?: string
    to?: string
    page?: number
    pageSize?: number
  },
) {
  const organizationId = await requireRecruitmentOrganization(ctx, query.organizationId)
  const { page, skip, pageSize } = parsePage(query)
  const result = await listInterviews({
    organizationId,
    status: query.status,
    from: query.from ? new Date(query.from) : undefined,
    to: query.to ? new Date(query.to) : undefined,
    branchIds: branchScopeForList(ctx),
    skip,
    limit: pageSize,
  })
  return toPaginated(result.items, page, pageSize, result.total)
}

export async function getInterview(ctx: AccessContext, id: string) {
  const interview = await findInterviewById(id)
  if (!interview) throw notFound('Interview was not found.')
  await requireRecruitmentOrganization(ctx, interview.organizationId)
  assertBranchScoped(ctx, interview.branchId, interview.organizationId)
  return interview
}
