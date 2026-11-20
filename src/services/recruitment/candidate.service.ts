import {
  APPLICATION_STATUSES,
  CANDIDATE_ACTIVITY_TYPES,
  CANDIDATE_DOCUMENT_TYPES,
  CANDIDATE_SOURCES,
  CANDIDATE_STATUSES,
} from '../../constants/recruitment.js'
import {
  findCandidateById,
  findCandidateDuplicates,
  findStageByCode,
  insertApplication,
  insertCandidate,
  insertCandidateActivity,
  insertCandidateDocument,
  insertStageHistory,
  listCandidateActivities,
  listCandidateDocuments,
  listCandidates,
  updateCandidate,
} from '../../repositories/recruitment/recruitment.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import { conflict, invalidField, notFound } from '../../utils/httpErrors.js'
import { toPaginated } from '../../utils/pagination.js'
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  recordAuditEvent,
} from '../audit/audit.service.js'
import { findPostingById } from '../../repositories/recruitment/recruitment.repository.js'
import {
  assertBranchScoped,
  branchScopeForList,
  requireRecruitmentOrganization,
} from './recruitment-access.js'
import {
  emitRecruitmentNotificationIntent,
  publishRecruitmentEvent,
} from './recruitment-notifications.js'
import { ensurePipelineStages } from './requisition.service.js'

function parsePage(query: { page?: number; pageSize?: number; limit?: number }) {
  const page = Math.max(1, Number(query.page ?? 1))
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? query.limit ?? 20)))
  return { page, pageSize, skip: (page - 1) * pageSize }
}

export async function createCandidate(
  ctx: AccessContext,
  body: {
    organizationId?: string
    legalEntityId?: string
    branchId?: string
    firstName: string
    middleName?: string
    lastName: string
    preferredName?: string
    email: string
    phone?: string
    location?: string
    country?: string
    currentEmployer?: string
    currentTitle?: string
    yearsOfExperience?: number
    skills?: string[]
    qualifications?: string
    certifications?: string
    languages?: string[]
    source?: string
    notes?: string
    allowDuplicate?: boolean
  },
  meta?: RequestMeta,
) {
  const organizationId = await requireRecruitmentOrganization(ctx, body.organizationId)
  if (body.branchId) assertBranchScoped(ctx, body.branchId, organizationId)

  const duplicates = await findCandidateDuplicates(
    organizationId,
    body.email,
    body.phone,
  )
  if (duplicates.length && !body.allowDuplicate) {
    return {
      candidate: null as null,
      possibleDuplicates: duplicates.map((d) => ({
        id: d.id,
        firstName: d.firstName,
        lastName: d.lastName,
        email: d.email,
        phone: d.phone,
      })),
      requiresReview: true as const,
    }
  }

  const candidate = await insertCandidate({
    organizationId,
    legalEntityId: body.legalEntityId,
    branchId: body.branchId,
    firstName: body.firstName,
    middleName: body.middleName,
    lastName: body.lastName,
    preferredName: body.preferredName,
    email: body.email.toLowerCase(),
    phone: body.phone,
    location: body.location,
    country: body.country?.toUpperCase(),
    currentEmployer: body.currentEmployer,
    currentTitle: body.currentTitle,
    yearsOfExperience: body.yearsOfExperience,
    skills: body.skills ?? [],
    qualifications: body.qualifications,
    certifications: body.certifications,
    languages: body.languages ?? [],
    source: body.source ?? CANDIDATE_SOURCES.DIRECT,
    recruiterUserId: ctx.userId,
    status: CANDIDATE_STATUSES.ACTIVE,
    notes: body.notes,
    createdBy: ctx.userId,
  })

  await insertCandidateActivity({
    organizationId,
    candidateId: candidate.id,
    type: CANDIDATE_ACTIVITY_TYPES.SYSTEM,
    summary: 'Candidate created',
    internalOnly: true,
    createdBy: ctx.userId,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.CANDIDATE_CREATED,
    entityType: AUDIT_ENTITY_TYPES.CANDIDATE,
    entityId: candidate.id,
    organizationId,
    branchId: body.branchId,
    meta,
  })
  return {
    candidate,
    possibleDuplicates: duplicates.map((d) => ({
      id: d.id,
      firstName: d.firstName,
      lastName: d.lastName,
      email: d.email,
      phone: d.phone,
    })),
    requiresReview: false as const,
  }
}

export async function updateCandidateService(
  ctx: AccessContext,
  id: string,
  body: Record<string, unknown>,
  meta?: RequestMeta,
) {
  const existing = await findCandidateById(id)
  if (!existing) throw notFound('Candidate was not found.')
  await requireRecruitmentOrganization(ctx, existing.organizationId)
  assertBranchScoped(ctx, existing.branchId, existing.organizationId)
  // Never expose or accept employeeId from clients here.
  const { employeeId: _ignore, ...safe } = body
  void _ignore
  const updated = await updateCandidate(id, { ...safe, updatedBy: ctx.userId })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.CANDIDATE_UPDATED,
    entityType: AUDIT_ENTITY_TYPES.CANDIDATE,
    entityId: id,
    organizationId: existing.organizationId,
    meta,
  })
  return updated
}

export async function getCandidate(ctx: AccessContext, id: string) {
  const candidate = await findCandidateById(id)
  if (!candidate) throw notFound('Candidate was not found.')
  await requireRecruitmentOrganization(ctx, candidate.organizationId)
  assertBranchScoped(ctx, candidate.branchId, candidate.organizationId)
  return candidate
}

export async function listCandidatesService(
  ctx: AccessContext,
  query: {
    organizationId?: string
    status?: string
    q?: string
    page?: number
    pageSize?: number
  },
) {
  const organizationId = await requireRecruitmentOrganization(ctx, query.organizationId)
  const { page, skip, pageSize } = parsePage(query)
  const result = await listCandidates({
    organizationId,
    status: query.status,
    q: query.q,
    branchIds: branchScopeForList(ctx),
    skip,
    limit: pageSize,
  })
  return toPaginated(result.items, page, pageSize, result.total)
}

export async function addCandidateNote(
  ctx: AccessContext,
  candidateId: string,
  body: { content: string; applicationId?: string },
) {
  const candidate = await getCandidate(ctx, candidateId)
  await insertCandidateActivity({
    organizationId: candidate.organizationId,
    candidateId,
    applicationId: body.applicationId,
    type: CANDIDATE_ACTIVITY_TYPES.NOTE,
    summary: 'Internal note',
    content: body.content,
    internalOnly: true,
    createdBy: ctx.userId,
  })
  return { ok: true }
}

export async function listCandidateActivityService(ctx: AccessContext, candidateId: string) {
  const candidate = await getCandidate(ctx, candidateId)
  return listCandidateActivities(candidate.organizationId, candidateId)
}

export async function registerCandidateDocument(
  ctx: AccessContext,
  candidateId: string,
  body: {
    documentType: string
    fileName: string
    storageKey: string
    mimeType?: string
  },
  meta?: RequestMeta,
) {
  const candidate = await getCandidate(ctx, candidateId)
  if (!Object.values(CANDIDATE_DOCUMENT_TYPES).includes(body.documentType as never)) {
    throw invalidField('documentType', 'Invalid document type.')
  }
  const doc = await insertCandidateDocument({
    organizationId: candidate.organizationId,
    candidateId,
    documentType: body.documentType,
    fileName: body.fileName,
    storageKey: body.storageKey,
    mimeType: body.mimeType,
    uploadedBy: ctx.userId,
  })
  if (body.documentType === CANDIDATE_DOCUMENT_TYPES.RESUME) {
    await updateCandidate(candidateId, {
      resumeStorageKey: body.storageKey,
      updatedBy: ctx.userId,
    })
  }
  await recordAuditEvent({
    action: AUDIT_ACTIONS.CANDIDATE_DOCUMENT_UPLOADED,
    entityType: AUDIT_ENTITY_TYPES.CANDIDATE_DOCUMENT,
    entityId: doc.id,
    organizationId: candidate.organizationId,
    metadata: { candidateId, documentType: body.documentType },
    meta,
  })
  return doc
}

export async function listCandidateDocumentsService(ctx: AccessContext, candidateId: string) {
  const candidate = await getCandidate(ctx, candidateId)
  // Return metadata only — never raw storage URLs.
  const docs = await listCandidateDocuments(candidate.organizationId, candidateId)
  return docs.map(({ storageKey: _s, ...rest }) => {
    void _s
    return { ...rest, hasFile: true }
  })
}

export async function createApplication(
  ctx: AccessContext,
  body: {
    organizationId?: string
    candidateId: string
    postingId: string
    source?: string
    notes?: string
    idempotencyKey?: string
  },
  meta?: RequestMeta,
) {
  const candidate = await getCandidate(ctx, body.candidateId)
  const posting = await findPostingById(body.postingId)
  if (!posting || posting.organizationId !== candidate.organizationId) {
    throw notFound('Job posting was not found.')
  }
  if (posting.status !== 'PUBLISHED') {
    throw conflict('Applications are only accepted for published postings.')
  }
  await ensurePipelineStages(ctx, candidate.organizationId)
  const stage = await findStageByCode(candidate.organizationId, 'NEW')

  const application = await insertApplication({
    organizationId: candidate.organizationId,
    legalEntityId: posting.legalEntityId,
    branchId: posting.branchId,
    candidateId: candidate.id,
    postingId: posting.id,
    requisitionId: posting.requisitionId,
    appliedAt: new Date(),
    stageCode: stage?.code ?? 'NEW',
    status: APPLICATION_STATUSES.NEW,
    source: body.source ?? candidate.source,
    recruiterUserId: ctx.userId,
    notes: body.notes,
    idempotencyKey: body.idempotencyKey,
    createdBy: ctx.userId,
  })
  if (!application) throw conflict('Application already exists for this posting.')

  await insertStageHistory({
    organizationId: candidate.organizationId,
    applicationId: application.id,
    previousStageCode: null,
    newStageCode: application.stageCode,
    previousStatus: null,
    newStatus: application.status,
    reason: 'Application created',
    changedBy: ctx.userId,
  })
  await insertCandidateActivity({
    organizationId: candidate.organizationId,
    candidateId: candidate.id,
    applicationId: application.id,
    type: CANDIDATE_ACTIVITY_TYPES.STATUS,
    summary: 'Application submitted',
    internalOnly: false,
    createdBy: ctx.userId,
  })
  await emitRecruitmentNotificationIntent({
    organizationId: candidate.organizationId,
    candidateId: candidate.id,
    kind: 'recruitment.application.created',
    intentKey: `recruitment.application.created:${application.id}`,
    entityType: AUDIT_ENTITY_TYPES.APPLICATION,
    entityId: application.id,
    payload: { applicationId: application.id, postingId: posting.id },
    meta,
  })
  await publishRecruitmentEvent({
    organizationId: candidate.organizationId,
    eventKey: `recruitment.application.created:${application.id}`,
    eventType: 'recruitment.application.created',
    payload: { applicationId: application.id, candidateId: candidate.id },
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.APPLICATION_CREATED,
    entityType: AUDIT_ENTITY_TYPES.APPLICATION,
    entityId: application.id,
    organizationId: candidate.organizationId,
    branchId: posting.branchId,
    meta,
  })
  return application
}
