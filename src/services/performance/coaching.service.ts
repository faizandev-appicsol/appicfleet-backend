import {
  DEVELOPMENT_STATUSES,
  FEEDBACK_TYPES,
  PIP_STATUSES,
  TRAINING_RECOMMENDATION_STATUSES,
  VISIBILITY_LEVELS,
} from '../../constants/performance.js'
import {
  findPipById,
  insertDevelopmentPlan,
  insertFeedback,
  insertFramework,
  insertKpi,
  insertOneOnOne,
  insertPip,
  insertRecognition,
  insertSuccessionPlan,
  insertTrainingRecommendation,
  listDevelopmentPlans,
  listFeedback,
  listFrameworks,
  listKpis,
  listOneOnOnes,
  listPips,
  listRecognitions,
  listSuccessionPlans,
  updatePip,
} from '../../repositories/performance/performance.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import { notFound } from '../../utils/httpErrors.js'
import { toPaginated } from '../../utils/pagination.js'
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  recordAuditEvent,
} from '../audit/audit.service.js'
import {
  assertBranchScoped,
  branchScopeForList,
  requirePerformanceOrganization,
} from './performance-access.js'
import {
  emitPerformanceNotificationIntent,
  publishPerformanceEvent,
} from './performance-notifications.js'

function parsePage(query: { page?: number; pageSize?: number; limit?: number }) {
  const page = Math.max(1, Number(query.page ?? 1))
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? query.limit ?? 20)))
  return { page, pageSize, skip: (page - 1) * pageSize }
}

export async function createCompetencyFramework(
  ctx: AccessContext,
  body: {
    organizationId?: string
    name: string
    description?: string
    competencies: Array<{
      code: string
      name: string
      category?: string
      description?: string
      expectedBehaviors?: string
      weight?: string
    }>
  },
) {
  const organizationId = await requirePerformanceOrganization(ctx, body.organizationId)
  return insertFramework({
    organizationId,
    name: body.name,
    description: body.description,
    competencies: body.competencies,
    status: 'ACTIVE',
    createdBy: ctx.userId,
  })
}

export async function listFrameworksService(ctx: AccessContext, organizationId?: string) {
  const orgId = await requirePerformanceOrganization(ctx, organizationId)
  return listFrameworks(orgId)
}

export async function createKpiDefinition(
  ctx: AccessContext,
  body: {
    organizationId?: string
    name: string
    description?: string
    category?: string
    unit?: string
    dataSource?: string
    calculationMethod?: string
  },
) {
  const organizationId = await requirePerformanceOrganization(ctx, body.organizationId)
  return insertKpi({
    organizationId,
    name: body.name,
    description: body.description,
    category: body.category,
    unit: body.unit,
    dataSource: body.dataSource ?? 'MANUAL',
    calculationMethod: body.calculationMethod,
    status: 'ACTIVE',
    createdBy: ctx.userId,
  })
}

export async function listKpisService(ctx: AccessContext, organizationId?: string) {
  const orgId = await requirePerformanceOrganization(ctx, organizationId)
  return listKpis(orgId)
}

export async function createPip(
  ctx: AccessContext,
  body: {
    organizationId?: string
    legalEntityId?: string
    branchId?: string
    employeeId: string
    managerEmployeeId?: string
    reviewId?: string
    startDate: string
    endDate: string
    reason: string
    concerns?: string
    expectations?: string
    measurementCriteria?: string
    goals?: Array<{ title: string; description?: string; dueDate?: string }>
  },
  meta?: RequestMeta,
) {
  const organizationId = await requirePerformanceOrganization(ctx, body.organizationId)
  assertBranchScoped(ctx, body.branchId, organizationId)
  const pip = await insertPip({
    organizationId,
    legalEntityId: body.legalEntityId,
    branchId: body.branchId,
    employeeId: body.employeeId,
    managerEmployeeId: body.managerEmployeeId,
    reviewId: body.reviewId,
    startDate: new Date(body.startDate),
    endDate: new Date(body.endDate),
    reason: body.reason,
    concerns: body.concerns,
    expectations: body.expectations,
    measurementCriteria: body.measurementCriteria,
    goals: (body.goals ?? []).map((g) => ({
      ...g,
      dueDate: g.dueDate ? new Date(g.dueDate) : undefined,
      status: 'PENDING',
    })),
    status: PIP_STATUSES.DRAFT,
    createdBy: ctx.userId,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.PERFORMANCE_PIP_CREATED,
    entityType: AUDIT_ENTITY_TYPES.PERFORMANCE_PIP,
    entityId: pip.id,
    organizationId,
    meta,
  })
  await publishPerformanceEvent({
    organizationId,
    eventKey: `performance.pip.created:${pip.id}`,
    eventType: 'performance.pip.created',
    payload: { pipId: pip.id, employeeId: body.employeeId },
  })
  return pip
}

export async function updatePipService(
  ctx: AccessContext,
  id: string,
  body: {
    status?: string
    outcome?: string
    managerComments?: string
    employeeComments?: string
    checkIn?: { scheduledAt: string; notes?: string; outcome?: string }
  },
  meta?: RequestMeta,
) {
  const pip = await findPipById(id)
  if (!pip) throw notFound('PIP was not found.')
  await requirePerformanceOrganization(ctx, pip.organizationId)
  assertBranchScoped(ctx, pip.branchId, pip.organizationId)

  const patch: Record<string, unknown> = {
    status: body.status ?? pip.status,
    outcome: body.outcome ?? pip.outcome,
    managerComments: body.managerComments,
    employeeComments: body.employeeComments,
    updatedBy: ctx.userId,
  }
  if (body.checkIn) {
    patch.checkIns = [
      ...((pip.checkIns as unknown[]) ?? []),
      {
        scheduledAt: new Date(body.checkIn.scheduledAt),
        completedAt: new Date(),
        notes: body.checkIn.notes,
        outcome: body.checkIn.outcome,
        createdBy: ctx.userId,
      },
    ]
  }
  const updated = await updatePip(id, patch)
  await recordAuditEvent({
    action: AUDIT_ACTIONS.PERFORMANCE_PIP_UPDATED,
    entityType: AUDIT_ENTITY_TYPES.PERFORMANCE_PIP,
    entityId: id,
    organizationId: pip.organizationId,
    meta,
  })
  await publishPerformanceEvent({
    organizationId: pip.organizationId,
    eventKey: `performance.pip.updated:${id}:${Date.now()}`,
    eventType: 'performance.pip.updated',
    payload: { pipId: id, status: body.status },
  })
  return updated
}

export async function listPipsService(
  ctx: AccessContext,
  query: {
    organizationId?: string
    employeeId?: string
    status?: string
    page?: number
    pageSize?: number
  },
) {
  const organizationId = await requirePerformanceOrganization(ctx, query.organizationId)
  const { page, skip, pageSize } = parsePage(query)
  const result = await listPips({
    organizationId,
    employeeId: query.employeeId,
    status: query.status,
    branchIds: branchScopeForList(ctx),
    skip,
    limit: pageSize,
  })
  return toPaginated(result.items, page, pageSize, result.total)
}

export async function getPip(ctx: AccessContext, id: string) {
  const pip = await findPipById(id)
  if (!pip) throw notFound('PIP was not found.')
  await requirePerformanceOrganization(ctx, pip.organizationId)
  assertBranchScoped(ctx, pip.branchId, pip.organizationId)
  return pip
}

export async function createOneOnOne(
  ctx: AccessContext,
  body: {
    organizationId?: string
    employeeId: string
    managerEmployeeId: string
    scheduledAt: string
    agenda?: string
    actionItems?: Array<{ title: string; dueDate?: string }>
  },
) {
  const organizationId = await requirePerformanceOrganization(ctx, body.organizationId)
  return insertOneOnOne({
    organizationId,
    employeeId: body.employeeId,
    managerEmployeeId: body.managerEmployeeId,
    scheduledAt: new Date(body.scheduledAt),
    agenda: body.agenda,
    actionItems: (body.actionItems ?? []).map((a) => ({
      title: a.title,
      dueDate: a.dueDate ? new Date(a.dueDate) : undefined,
      status: 'OPEN',
    })),
    status: 'SCHEDULED',
    createdBy: ctx.userId,
  })
}

export async function listOneOnOnesService(
  ctx: AccessContext,
  query: {
    organizationId?: string
    employeeId?: string
    managerEmployeeId?: string
    page?: number
    pageSize?: number
    includePrivateNotes?: boolean
  },
) {
  const organizationId = await requirePerformanceOrganization(ctx, query.organizationId)
  const { page, skip, pageSize } = parsePage(query)
  const result = await listOneOnOnes({
    organizationId,
    employeeId: query.employeeId,
    managerEmployeeId: query.managerEmployeeId,
    skip,
    limit: pageSize,
  })
  const items = result.items.map((row) => {
    if (query.includePrivateNotes) return row
    const { privateManagerNotes: _private, ...rest } = row
    return rest
  })
  return toPaginated(items, page, pageSize, result.total)
}

export async function createFeedback(
  ctx: AccessContext,
  body: {
    organizationId?: string
    recipientEmployeeId: string
    feedbackType: string
    category?: string
    message: string
    visibility?: string
    relatedGoalId?: string
    relatedCompetencyCode?: string
    relatedReviewId?: string
  },
  meta?: RequestMeta,
) {
  const organizationId = await requirePerformanceOrganization(ctx, body.organizationId)
  const feedback = await insertFeedback({
    organizationId,
    senderUserId: ctx.userId,
    recipientEmployeeId: body.recipientEmployeeId,
    feedbackType: body.feedbackType ?? FEEDBACK_TYPES.COACHING,
    category: body.category,
    message: body.message,
    visibility: body.visibility ?? VISIBILITY_LEVELS.MANAGER_ONLY,
    relatedGoalId: body.relatedGoalId,
    relatedCompetencyCode: body.relatedCompetencyCode,
    relatedReviewId: body.relatedReviewId,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.PERFORMANCE_FEEDBACK_CREATED,
    entityType: AUDIT_ENTITY_TYPES.PERFORMANCE_FEEDBACK,
    entityId: feedback.id,
    organizationId,
    meta,
  })
  return feedback
}

export async function listFeedbackService(
  ctx: AccessContext,
  query: {
    organizationId?: string
    recipientEmployeeId?: string
    page?: number
    pageSize?: number
  },
) {
  const organizationId = await requirePerformanceOrganization(ctx, query.organizationId)
  const { page, skip, pageSize } = parsePage(query)
  const result = await listFeedback({
    organizationId,
    recipientEmployeeId: query.recipientEmployeeId,
    skip,
    limit: pageSize,
  })
  return toPaginated(result.items, page, pageSize, result.total)
}

export async function createRecognition(
  ctx: AccessContext,
  body: {
    organizationId?: string
    employeeId: string
    category?: string
    message: string
    visibility?: string
    relatedCompetencyCode?: string
    relatedGoalId?: string
  },
  meta?: RequestMeta,
) {
  const organizationId = await requirePerformanceOrganization(ctx, body.organizationId)
  const recognition = await insertRecognition({
    organizationId,
    employeeId: body.employeeId,
    recognizerUserId: ctx.userId,
    category: body.category,
    message: body.message,
    visibility: body.visibility ?? VISIBILITY_LEVELS.TEAM,
    relatedCompetencyCode: body.relatedCompetencyCode,
    relatedGoalId: body.relatedGoalId,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.PERFORMANCE_RECOGNITION_CREATED,
    entityType: AUDIT_ENTITY_TYPES.PERFORMANCE_RECOGNITION,
    entityId: recognition.id,
    organizationId,
    meta,
  })
  await publishPerformanceEvent({
    organizationId,
    eventKey: `performance.recognition.created:${recognition.id}`,
    eventType: 'performance.recognition.created',
    payload: { recognitionId: recognition.id, employeeId: body.employeeId },
  })
  await emitPerformanceNotificationIntent({
    organizationId,
    kind: 'performance.recognition.received',
    intentKey: `performance.recognition.received:${recognition.id}`,
    entityType: AUDIT_ENTITY_TYPES.PERFORMANCE_RECOGNITION,
    entityId: recognition.id,
    employeeId: body.employeeId,
    payload: { recognitionId: recognition.id },
    meta,
  })
  return recognition
}

export async function listRecognitionsService(
  ctx: AccessContext,
  query: { organizationId?: string; employeeId?: string; page?: number; pageSize?: number },
) {
  const organizationId = await requirePerformanceOrganization(ctx, query.organizationId)
  const { page, skip, pageSize } = parsePage(query)
  const result = await listRecognitions({
    organizationId,
    employeeId: query.employeeId,
    skip,
    limit: pageSize,
  })
  return toPaginated(result.items, page, pageSize, result.total)
}

export async function createDevelopmentPlan(
  ctx: AccessContext,
  body: {
    organizationId?: string
    employeeId: string
    reviewId?: string
    objective: string
    competencyCode?: string
    currentProficiency?: number
    targetProficiency?: number
    targetDate?: string
    actions?: Array<{ title: string; actionType?: string; dueDate?: string }>
  },
  meta?: RequestMeta,
) {
  const organizationId = await requirePerformanceOrganization(ctx, body.organizationId)
  const plan = await insertDevelopmentPlan({
    organizationId,
    employeeId: body.employeeId,
    reviewId: body.reviewId,
    objective: body.objective,
    competencyCode: body.competencyCode,
    currentProficiency: body.currentProficiency,
    targetProficiency: body.targetProficiency,
    targetDate: body.targetDate ? new Date(body.targetDate) : undefined,
    status: DEVELOPMENT_STATUSES.PLANNED,
    actions: (body.actions ?? []).map((a) => ({
      title: a.title,
      actionType: a.actionType ?? 'OTHER',
      dueDate: a.dueDate ? new Date(a.dueDate) : undefined,
      status: DEVELOPMENT_STATUSES.PLANNED,
    })),
    createdBy: ctx.userId,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.PERFORMANCE_DEVELOPMENT_PLAN_CREATED,
    entityType: AUDIT_ENTITY_TYPES.DEVELOPMENT_PLAN,
    entityId: plan.id,
    organizationId,
    meta,
  })
  await publishPerformanceEvent({
    organizationId,
    eventKey: `performance.development_plan.created:${plan.id}`,
    eventType: 'performance.development_plan.created',
    payload: { planId: plan.id },
  })
  return plan
}

export async function listDevelopmentPlansService(
  ctx: AccessContext,
  query: { organizationId?: string; employeeId?: string; page?: number; pageSize?: number },
) {
  const organizationId = await requirePerformanceOrganization(ctx, query.organizationId)
  const { page, skip, pageSize } = parsePage(query)
  const result = await listDevelopmentPlans({
    organizationId,
    employeeId: query.employeeId,
    skip,
    limit: pageSize,
  })
  return toPaginated(result.items, page, pageSize, result.total)
}

export async function createTrainingRecommendation(
  ctx: AccessContext,
  body: {
    organizationId?: string
    employeeId: string
    reviewId?: string
    competencyCode?: string
    topic: string
    reason?: string
    priority?: string
  },
) {
  const organizationId = await requirePerformanceOrganization(ctx, body.organizationId)
  return insertTrainingRecommendation({
    organizationId,
    employeeId: body.employeeId,
    reviewId: body.reviewId,
    competencyCode: body.competencyCode,
    topic: body.topic,
    reason: body.reason,
    priority: body.priority,
    status: TRAINING_RECOMMENDATION_STATUSES.RECOMMENDED,
    recommendedBy: ctx.userId,
  })
}

export async function createSuccessionPlan(
  ctx: AccessContext,
  body: {
    organizationId?: string
    legalEntityId?: string
    branchId?: string
    criticalPositionId?: string
    criticalPositionTitle: string
    candidates: Array<{
      employeeId: string
      readiness?: string
      developmentGaps?: string
      riskNotes?: string
    }>
  },
  meta?: RequestMeta,
) {
  const organizationId = await requirePerformanceOrganization(ctx, body.organizationId)
  assertBranchScoped(ctx, body.branchId, organizationId)
  const plan = await insertSuccessionPlan({
    organizationId,
    legalEntityId: body.legalEntityId,
    branchId: body.branchId,
    criticalPositionId: body.criticalPositionId,
    criticalPositionTitle: body.criticalPositionTitle,
    candidates: body.candidates,
    status: 'ACTIVE',
    createdBy: ctx.userId,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.PERFORMANCE_SUCCESSION_CHANGED,
    entityType: AUDIT_ENTITY_TYPES.SUCCESSION_PLAN,
    entityId: plan.id,
    organizationId,
    meta,
  })
  return plan
}

export async function listSuccessionPlansService(ctx: AccessContext, organizationId?: string) {
  const orgId = await requirePerformanceOrganization(ctx, organizationId)
  return listSuccessionPlans(orgId)
}
