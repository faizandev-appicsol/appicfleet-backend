import {
  CYCLE_STATUSES,
  DEFAULT_RATING_SCALE_LEVELS,
  REVIEW_TYPES,
} from '../../constants/performance.js'
import {
  findCycleById,
  findRatingScaleById,
  findTemplateById,
  insertCycle,
  insertRatingScale,
  insertTemplate,
  listCycles,
  listRatingScales,
  listTemplates,
  updateCycle,
} from '../../repositories/performance/performance.repository.js'
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
  assertLegalEntityInOrg,
  requirePerformanceOrganization,
} from './performance-access.js'
import {
  emitPerformanceNotificationIntent,
  publishPerformanceEvent,
} from './performance-notifications.js'
import { assertCycleTransition } from './transitions.js'

function parsePage(query: { page?: number; pageSize?: number; limit?: number }) {
  const page = Math.max(1, Number(query.page ?? 1))
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? query.limit ?? 20)))
  return { page, pageSize, skip: (page - 1) * pageSize }
}

export async function createRatingScale(
  ctx: AccessContext,
  body: {
    organizationId?: string
    name: string
    description?: string
    minValue?: number
    maxValue?: number
    levels?: Array<{ value: number; label: string; description?: string }>
  },
) {
  const organizationId = await requirePerformanceOrganization(ctx, body.organizationId)
  return insertRatingScale({
    organizationId,
    name: body.name,
    description: body.description,
    minValue: body.minValue ?? 1,
    maxValue: body.maxValue ?? 5,
    levels: body.levels?.length
      ? body.levels
      : DEFAULT_RATING_SCALE_LEVELS.map((l) => ({ ...l })),
    status: 'ACTIVE',
    createdBy: ctx.userId,
  })
}

export async function listRatingScalesService(ctx: AccessContext, organizationId?: string) {
  const orgId = await requirePerformanceOrganization(ctx, organizationId)
  return listRatingScales(orgId)
}

export async function createTemplate(
  ctx: AccessContext,
  body: {
    organizationId?: string
    name: string
    description?: string
    reviewType?: string
    includePeerReview?: boolean
    requireGoalWeightTotal100?: boolean
    sections?: Array<{
      code: string
      title: string
      required?: boolean
      sortOrder?: number
      weight?: string
    }>
  },
) {
  const organizationId = await requirePerformanceOrganization(ctx, body.organizationId)
  return insertTemplate({
    organizationId,
    name: body.name,
    description: body.description,
    reviewType: body.reviewType ?? REVIEW_TYPES.ANNUAL,
    version: 1,
    includePeerReview: body.includePeerReview ?? false,
    requireGoalWeightTotal100: body.requireGoalWeightTotal100 ?? true,
    sections: body.sections ?? [
      { code: 'GOALS', title: 'Goals', required: true, sortOrder: 10, weight: '40.00' },
      { code: 'COMPETENCIES', title: 'Competencies', required: true, sortOrder: 20, weight: '40.00' },
      { code: 'OVERALL', title: 'Overall', required: true, sortOrder: 30, weight: '20.00' },
    ],
    status: 'ACTIVE',
    createdBy: ctx.userId,
  })
}

export async function listTemplatesService(ctx: AccessContext, organizationId?: string) {
  const orgId = await requirePerformanceOrganization(ctx, organizationId)
  return listTemplates(orgId)
}

export async function createCycle(
  ctx: AccessContext,
  body: {
    organizationId?: string
    legalEntityId?: string
    branchIds?: string[]
    departmentIds?: string[]
    name: string
    description?: string
    reviewType?: string
    startDate: string
    endDate: string
    reviewDeadline?: string
    ratingScaleId: string
    templateId: string
    requirePeerReview?: boolean
    requireCalibration?: boolean
  },
  meta?: RequestMeta,
) {
  const organizationId = await requirePerformanceOrganization(ctx, body.organizationId)
  if (body.legalEntityId) await assertLegalEntityInOrg(body.legalEntityId, organizationId)
  for (const branchId of body.branchIds ?? []) {
    await assertBranchInOrg(branchId, organizationId)
  }
  const scale = await findRatingScaleById(body.ratingScaleId)
  if (!scale || scale.organizationId !== organizationId) {
    throw invalidField('ratingScaleId', 'Rating scale was not found.')
  }
  const template = await findTemplateById(body.templateId)
  if (!template || template.organizationId !== organizationId) {
    throw invalidField('templateId', 'Performance template was not found.')
  }
  const start = new Date(body.startDate)
  const end = new Date(body.endDate)
  if (!(start < end)) throw invalidField('endDate', 'End date must be after start date.')

  const cycle = await insertCycle({
    organizationId,
    legalEntityId: body.legalEntityId,
    branchIds: body.branchIds ?? [],
    departmentIds: body.departmentIds ?? [],
    name: body.name,
    description: body.description,
    reviewType: body.reviewType ?? REVIEW_TYPES.ANNUAL,
    startDate: start,
    endDate: end,
    reviewDeadline: body.reviewDeadline ? new Date(body.reviewDeadline) : undefined,
    status: CYCLE_STATUSES.DRAFT,
    ratingScaleId: scale.id,
    templateId: template.id,
    templateVersion: template.version,
    templateSnapshot: { ...template },
    ratingScaleSnapshot: { ...scale },
    requirePeerReview: body.requirePeerReview ?? template.includePeerReview,
    requireCalibration: body.requireCalibration ?? false,
    createdBy: ctx.userId,
  })

  await recordAuditEvent({
    action: AUDIT_ACTIONS.PERFORMANCE_CYCLE_CREATED,
    entityType: AUDIT_ENTITY_TYPES.PERFORMANCE_CYCLE,
    entityId: cycle.id,
    organizationId,
    meta,
  })
  await publishPerformanceEvent({
    organizationId,
    eventKey: `performance.cycle.created:${cycle.id}`,
    eventType: 'performance.cycle.created',
    payload: { cycleId: cycle.id },
  })
  return cycle
}

export async function transitionCycle(
  ctx: AccessContext,
  id: string,
  status: string,
  meta?: RequestMeta,
) {
  const cycle = await findCycleById(id)
  if (!cycle) throw notFound('Performance cycle was not found.')
  await requirePerformanceOrganization(ctx, cycle.organizationId)
  assertCycleTransition(cycle.status, status)

  const patch: Record<string, unknown> = { status }
  if (status === CYCLE_STATUSES.OPEN) {
    patch.openedAt = new Date()
    patch.approvedBy = ctx.userId
  }
  if (status === CYCLE_STATUSES.COMPLETED) patch.completedAt = new Date()

  const updated = await updateCycle(id, patch, [cycle.status])
  if (!updated) throw conflict('Cycle status was already changed.')

  await recordAuditEvent({
    action:
      status === CYCLE_STATUSES.OPEN
        ? AUDIT_ACTIONS.PERFORMANCE_CYCLE_OPENED
        : AUDIT_ACTIONS.PERFORMANCE_CYCLE_STATUS_CHANGED,
    entityType: AUDIT_ENTITY_TYPES.PERFORMANCE_CYCLE,
    entityId: id,
    organizationId: cycle.organizationId,
    metadata: { from: cycle.status, to: status },
    meta,
  })
  if (status === CYCLE_STATUSES.OPEN) {
    await emitPerformanceNotificationIntent({
      organizationId: cycle.organizationId,
      kind: 'performance.cycle.opened',
      intentKey: `performance.cycle.opened:${id}`,
      entityType: AUDIT_ENTITY_TYPES.PERFORMANCE_CYCLE,
      entityId: id,
      payload: { cycleId: id, name: cycle.name },
      meta,
    })
    await publishPerformanceEvent({
      organizationId: cycle.organizationId,
      eventKey: `performance.cycle.opened:${id}`,
      eventType: 'performance.cycle.opened',
      payload: { cycleId: id },
    })
  }
  return updated
}

export async function getCycle(ctx: AccessContext, id: string) {
  const cycle = await findCycleById(id)
  if (!cycle) throw notFound('Performance cycle was not found.')
  await requirePerformanceOrganization(ctx, cycle.organizationId)
  return cycle
}

export async function listCyclesService(
  ctx: AccessContext,
  query: { organizationId?: string; status?: string; page?: number; pageSize?: number },
) {
  const organizationId = await requirePerformanceOrganization(ctx, query.organizationId)
  const { page, skip, pageSize } = parsePage(query)
  const result = await listCycles({
    organizationId,
    status: query.status,
    skip,
    limit: pageSize,
  })
  return toPaginated(result.items, page, pageSize, result.total)
}
