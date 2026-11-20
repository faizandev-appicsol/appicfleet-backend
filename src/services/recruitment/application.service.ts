import { APPLICATION_STATUSES, CANDIDATE_ACTIVITY_TYPES } from '../../constants/recruitment.js'
import {
  findApplicationById,
  findStageByCode,
  insertCandidateActivity,
  insertStageHistory,
  listApplications,
  listStages,
  updateApplication,
} from '../../repositories/recruitment/recruitment.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import { conflict, notFound } from '../../utils/httpErrors.js'
import { toPaginated } from '../../utils/pagination.js'
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  recordAuditEvent,
} from '../audit/audit.service.js'
import {
  assertBranchScoped,
  branchScopeForList,
  requireRecruitmentOrganization,
} from './recruitment-access.js'
import { publishRecruitmentEvent } from './recruitment-notifications.js'
import { ensurePipelineStages } from './requisition.service.js'
import { assertApplicationTransition } from './transitions.js'

function parsePage(query: { page?: number; pageSize?: number; limit?: number }) {
  const page = Math.max(1, Number(query.page ?? 1))
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? query.limit ?? 20)))
  return { page, pageSize, skip: (page - 1) * pageSize }
}

export async function getApplication(ctx: AccessContext, id: string) {
  const application = await findApplicationById(id)
  if (!application) throw notFound('Application was not found.')
  await requireRecruitmentOrganization(ctx, application.organizationId)
  assertBranchScoped(ctx, application.branchId, application.organizationId)
  return application
}

export async function listApplicationsService(
  ctx: AccessContext,
  query: {
    organizationId?: string
    status?: string
    stageCode?: string
    candidateId?: string
    requisitionId?: string
    page?: number
    pageSize?: number
  },
) {
  const organizationId = await requireRecruitmentOrganization(ctx, query.organizationId)
  const { page, skip, pageSize } = parsePage(query)
  const result = await listApplications({
    organizationId,
    status: query.status,
    stageCode: query.stageCode,
    candidateId: query.candidateId,
    requisitionId: query.requisitionId,
    branchIds: branchScopeForList(ctx),
    skip,
    limit: pageSize,
  })
  return toPaginated(result.items, page, pageSize, result.total)
}

export async function listPipelineStagesService(ctx: AccessContext, organizationId?: string) {
  const orgId = await requireRecruitmentOrganization(ctx, organizationId)
  await ensurePipelineStages(ctx, orgId)
  return listStages(orgId)
}

export async function changeApplicationStage(
  ctx: AccessContext,
  id: string,
  body: { stageCode: string; reason?: string; notes?: string },
  meta?: RequestMeta,
) {
  const application = await getApplication(ctx, id)
  const stage = await findStageByCode(application.organizationId, body.stageCode)
  if (!stage) throw notFound('Pipeline stage was not found.')

  const newStatus = stage.mapsToStatus
  if (application.status === newStatus && application.stageCode === stage.code) {
    return application
  }
  assertApplicationTransition(application.status, newStatus)

  const updated = await updateApplication(
    id,
    {
      stageCode: stage.code,
      status: newStatus,
      updatedBy: ctx.userId,
    },
    [application.status],
  )
  if (!updated) throw conflict('Application status changed concurrently.')

  await insertStageHistory({
    organizationId: application.organizationId,
    applicationId: id,
    previousStageCode: application.stageCode,
    newStageCode: stage.code,
    previousStatus: application.status,
    newStatus,
    reason: body.reason,
    notes: body.notes,
    changedBy: ctx.userId,
  })
  await insertCandidateActivity({
    organizationId: application.organizationId,
    candidateId: application.candidateId,
    applicationId: id,
    type: CANDIDATE_ACTIVITY_TYPES.STATUS,
    summary: `Stage changed to ${stage.name}`,
    content: body.notes,
    internalOnly: true,
    createdBy: ctx.userId,
  })

  const action =
    newStatus === APPLICATION_STATUSES.WITHDRAWN
      ? AUDIT_ACTIONS.APPLICATION_WITHDRAWN
      : newStatus === APPLICATION_STATUSES.REJECTED
        ? AUDIT_ACTIONS.APPLICATION_REJECTED
        : AUDIT_ACTIONS.APPLICATION_STAGE_CHANGED

  await recordAuditEvent({
    action,
    entityType: AUDIT_ENTITY_TYPES.APPLICATION,
    entityId: id,
    organizationId: application.organizationId,
    branchId: application.branchId,
    metadata: { from: application.stageCode, to: stage.code },
    meta,
  })
  await publishRecruitmentEvent({
    organizationId: application.organizationId,
    eventKey: `recruitment.application.stage.changed:${id}:${stage.code}`,
    eventType: 'recruitment.application.stage.changed',
    payload: {
      applicationId: id,
      previousStage: application.stageCode,
      newStage: stage.code,
      status: newStatus,
    },
  })
  return updated
}
