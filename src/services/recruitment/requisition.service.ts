import {
  DEFAULT_PIPELINE_STAGES,
  POSTING_STATUSES,
  POSTING_VISIBILITIES,
  REQUISITION_PRIORITIES,
  REQUISITION_STATUSES,
} from '../../constants/recruitment.js'
import {
  findPostingById,
  findRequisitionById,
  insertPosting,
  insertRequisition,
  listPostings,
  listRequisitions,
  nextRequisitionNumber,
  updatePosting,
  updateRequisition,
  upsertDefaultStages,
} from '../../repositories/recruitment/recruitment.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import { conflict, invalidField, notFound } from '../../utils/httpErrors.js'
import { toPaginated } from '../../utils/pagination.js'
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  recordAuditEvent,
} from '../audit/audit.service.js'
import {
  assertBranchInOrg,
  assertBranchScoped,
  assertLegalEntityInOrg,
  branchScopeForList,
  requireRecruitmentOrganization,
} from './recruitment-access.js'
import { publishRecruitmentEvent } from './recruitment-notifications.js'
import { assertRequisitionTransition } from './transitions.js'

function parsePage(query: { page?: number; pageSize?: number; limit?: number }) {
  const page = Math.max(1, Number(query.page ?? 1))
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? query.limit ?? 20)))
  return { page, pageSize, skip: (page - 1) * pageSize }
}

export async function ensurePipelineStages(ctx: AccessContext, organizationId?: string) {
  const orgId = await requireRecruitmentOrganization(ctx, organizationId)
  return upsertDefaultStages(
    orgId,
    DEFAULT_PIPELINE_STAGES.map((s) => ({
      code: s.code,
      name: s.name,
      sortOrder: s.sortOrder,
      mapsToStatus: s.mapsToStatus,
    })),
  )
}

export async function createRequisition(
  ctx: AccessContext,
  body: {
    organizationId?: string
    legalEntityId: string
    branchId: string
    jobTitle: string
    positionId?: string
    departmentId?: string
    hiringManagerEmployeeId?: string
    recruiterUserId?: string
    openings?: number
    employmentType?: string
    targetStartDate?: string
    salaryMin?: string
    salaryMax?: string
    currency?: string
    jobDescription?: string
    requirements?: string
    responsibilities?: string
    priority?: string
    reasonForHiring?: string
  },
  meta?: RequestMeta,
) {
  const organizationId = await requireRecruitmentOrganization(ctx, body.organizationId)
  await assertLegalEntityInOrg(body.legalEntityId, organizationId)
  await assertBranchInOrg(body.branchId, organizationId)
  assertBranchScoped(ctx, body.branchId, organizationId)
  await ensurePipelineStages(ctx, organizationId)

  const requisition = await insertRequisition({
    organizationId,
    legalEntityId: body.legalEntityId,
    branchId: body.branchId,
    requisitionNumber: await nextRequisitionNumber(organizationId),
    jobTitle: body.jobTitle,
    positionId: body.positionId,
    departmentId: body.departmentId,
    hiringManagerEmployeeId: body.hiringManagerEmployeeId,
    recruiterUserId: body.recruiterUserId ?? ctx.userId,
    openings: body.openings ?? 1,
    employmentType: body.employmentType,
    targetStartDate: body.targetStartDate ? new Date(body.targetStartDate) : undefined,
    salaryMin: body.salaryMin,
    salaryMax: body.salaryMax,
    currency: body.currency?.toUpperCase() ?? 'AED',
    jobDescription: body.jobDescription,
    requirements: body.requirements,
    responsibilities: body.responsibilities,
    status: REQUISITION_STATUSES.DRAFT,
    priority: body.priority ?? REQUISITION_PRIORITIES.MEDIUM,
    reasonForHiring: body.reasonForHiring,
    createdBy: ctx.userId,
  })

  await recordAuditEvent({
    action: AUDIT_ACTIONS.REQUISITION_CREATED,
    entityType: AUDIT_ENTITY_TYPES.JOB_REQUISITION,
    entityId: requisition.id,
    organizationId,
    branchId: body.branchId,
    meta,
  })
  return requisition
}

export async function submitRequisitionForApproval(
  ctx: AccessContext,
  id: string,
  meta?: RequestMeta,
) {
  const existing = await findRequisitionById(id)
  if (!existing) throw notFound('Requisition was not found.')
  await requireRecruitmentOrganization(ctx, existing.organizationId)
  assertBranchScoped(ctx, existing.branchId, existing.organizationId)
  assertRequisitionTransition(existing.status, REQUISITION_STATUSES.PENDING_APPROVAL)
  const updated = await updateRequisition(
    id,
    { status: REQUISITION_STATUSES.PENDING_APPROVAL, updatedBy: ctx.userId },
    [REQUISITION_STATUSES.DRAFT],
  )
  if (!updated) throw conflict('Requisition is not in draft.')
  void meta
  return updated
}

export async function approveRequisition(
  ctx: AccessContext,
  id: string,
  body: { notes?: string; approve: boolean },
  meta?: RequestMeta,
) {
  const existing = await findRequisitionById(id)
  if (!existing) throw notFound('Requisition was not found.')
  await requireRecruitmentOrganization(ctx, existing.organizationId)
  assertBranchScoped(ctx, existing.branchId, existing.organizationId)

  if (body.approve) {
    assertRequisitionTransition(existing.status, REQUISITION_STATUSES.APPROVED)
    const updated = await updateRequisition(
      id,
      {
        status: REQUISITION_STATUSES.APPROVED,
        approvedBy: ctx.userId,
        approvedAt: new Date(),
        approvalNotes: body.notes,
        updatedBy: ctx.userId,
      },
      [REQUISITION_STATUSES.PENDING_APPROVAL],
    )
    if (!updated) throw conflict('Requisition is not pending approval.')
    await recordAuditEvent({
      action: AUDIT_ACTIONS.REQUISITION_APPROVED,
      entityType: AUDIT_ENTITY_TYPES.JOB_REQUISITION,
      entityId: id,
      organizationId: existing.organizationId,
      branchId: existing.branchId,
      meta,
    })
    await publishRecruitmentEvent({
      organizationId: existing.organizationId,
      eventKey: `recruitment.requisition.approved:${id}`,
      eventType: 'recruitment.requisition.approved',
      payload: { requisitionId: id },
    })
    return updated
  }

  assertRequisitionTransition(existing.status, REQUISITION_STATUSES.DRAFT)
  const updated = await updateRequisition(
    id,
    {
      status: REQUISITION_STATUSES.DRAFT,
      approvalNotes: body.notes,
      updatedBy: ctx.userId,
    },
    [REQUISITION_STATUSES.PENDING_APPROVAL],
  )
  if (!updated) throw conflict('Requisition is not pending approval.')
  return updated
}

export async function transitionRequisition(
  ctx: AccessContext,
  id: string,
  toStatus: string,
  meta?: RequestMeta,
) {
  const existing = await findRequisitionById(id)
  if (!existing) throw notFound('Requisition was not found.')
  await requireRecruitmentOrganization(ctx, existing.organizationId)
  assertBranchScoped(ctx, existing.branchId, existing.organizationId)
  assertRequisitionTransition(existing.status, toStatus)
  const updated = await updateRequisition(
    id,
    { status: toStatus, updatedBy: ctx.userId },
    [existing.status],
  )
  if (!updated) throw conflict('Requisition status changed concurrently.')
  if (toStatus === REQUISITION_STATUSES.OPEN) {
    await recordAuditEvent({
      action: AUDIT_ACTIONS.REQUISITION_OPENED,
      entityType: AUDIT_ENTITY_TYPES.JOB_REQUISITION,
      entityId: id,
      organizationId: existing.organizationId,
      meta,
    })
  }
  if (toStatus === REQUISITION_STATUSES.CLOSED || toStatus === REQUISITION_STATUSES.FILLED) {
    await recordAuditEvent({
      action: AUDIT_ACTIONS.REQUISITION_CLOSED,
      entityType: AUDIT_ENTITY_TYPES.JOB_REQUISITION,
      entityId: id,
      organizationId: existing.organizationId,
      metadata: { status: toStatus },
      meta,
    })
  }
  return updated
}

export async function listRequisitionsService(
  ctx: AccessContext,
  query: { organizationId?: string; status?: string; page?: number; pageSize?: number },
) {
  const organizationId = await requireRecruitmentOrganization(ctx, query.organizationId)
  const { page, skip, pageSize } = parsePage(query)
  const result = await listRequisitions({
    organizationId,
    status: query.status,
    branchIds: branchScopeForList(ctx),
    skip,
    limit: pageSize,
  })
  return toPaginated(result.items, page, pageSize, result.total)
}

export async function getRequisition(ctx: AccessContext, id: string) {
  const requisition = await findRequisitionById(id)
  if (!requisition) throw notFound('Requisition was not found.')
  await requireRecruitmentOrganization(ctx, requisition.organizationId)
  assertBranchScoped(ctx, requisition.branchId, requisition.organizationId)
  return requisition
}

export async function createPostingFromRequisition(
  ctx: AccessContext,
  body: {
    organizationId?: string
    requisitionId: string
    title?: string
    description?: string
    requirements?: string
    responsibilities?: string
    location?: string
    visibility?: string
    applicationDeadline?: string
    publish?: boolean
  },
  meta?: RequestMeta,
) {
  const requisition = await getRequisition(ctx, body.requisitionId)
  if (
    requisition.status !== REQUISITION_STATUSES.APPROVED &&
    requisition.status !== REQUISITION_STATUSES.OPEN
  ) {
    throw conflict('Only approved or open requisitions can be posted.')
  }
  const posting = await insertPosting({
    organizationId: requisition.organizationId,
    legalEntityId: requisition.legalEntityId,
    branchId: requisition.branchId,
    requisitionId: requisition.id,
    title: body.title ?? requisition.jobTitle,
    description: body.description ?? requisition.jobDescription,
    requirements: body.requirements ?? requisition.requirements,
    responsibilities: body.responsibilities ?? requisition.responsibilities,
    location: body.location,
    employmentType: requisition.employmentType,
    departmentId: requisition.departmentId,
    positionId: requisition.positionId,
    salaryMin:
      body.visibility === POSTING_VISIBILITIES.EXTERNAL || body.visibility === POSTING_VISIBILITIES.BOTH
        ? undefined
        : requisition.salaryMin,
    salaryMax:
      body.visibility === POSTING_VISIBILITIES.EXTERNAL || body.visibility === POSTING_VISIBILITIES.BOTH
        ? undefined
        : requisition.salaryMax,
    currency: requisition.currency,
    applicationDeadline: body.applicationDeadline
      ? new Date(body.applicationDeadline)
      : undefined,
    status: body.publish ? POSTING_STATUSES.PUBLISHED : POSTING_STATUSES.DRAFT,
    visibility: body.visibility ?? POSTING_VISIBILITIES.INTERNAL,
    publishedAt: body.publish ? new Date() : undefined,
    createdBy: ctx.userId,
  })
  if (requisition.status === REQUISITION_STATUSES.APPROVED) {
    await transitionRequisition(ctx, requisition.id, REQUISITION_STATUSES.OPEN, meta)
  }
  return posting
}

export async function publishPosting(ctx: AccessContext, id: string) {
  const posting = await findPostingById(id)
  if (!posting) throw notFound('Job posting was not found.')
  await requireRecruitmentOrganization(ctx, posting.organizationId)
  assertBranchScoped(ctx, posting.branchId, posting.organizationId)
  if (posting.status === POSTING_STATUSES.PUBLISHED) return posting
  if (posting.status !== POSTING_STATUSES.DRAFT && posting.status !== POSTING_STATUSES.PAUSED) {
    throw conflict('Posting cannot be published from the current status.')
  }
  return updatePosting(id, {
    status: POSTING_STATUSES.PUBLISHED,
    publishedAt: posting.publishedAt ?? new Date(),
    updatedBy: ctx.userId,
  })
}

export async function listPostingsService(
  ctx: AccessContext,
  query: { organizationId?: string; status?: string; page?: number; pageSize?: number },
) {
  const organizationId = await requireRecruitmentOrganization(ctx, query.organizationId)
  const { page, skip, pageSize } = parsePage(query)
  const result = await listPostings({
    organizationId,
    status: query.status,
    branchIds: branchScopeForList(ctx),
    skip,
    limit: pageSize,
  })
  return toPaginated(result.items, page, pageSize, result.total)
}

export async function updateRequisitionDraft(
  ctx: AccessContext,
  id: string,
  body: Record<string, unknown>,
) {
  const existing = await getRequisition(ctx, id)
  if (existing.status !== REQUISITION_STATUSES.DRAFT) {
    throw conflict('Only draft requisitions can be edited.')
  }
  if (body.salaryMin && typeof body.salaryMin !== 'string') {
    throw invalidField('salaryMin', 'Invalid salary.')
  }
  return updateRequisition(id, { ...body, updatedBy: ctx.userId }, [REQUISITION_STATUSES.DRAFT])
}
