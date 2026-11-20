import { GOAL_PRIORITIES, GOAL_STATUSES } from '../../constants/performance.js'
import {
  findGoalById,
  insertGoal,
  insertGoalProgress,
  listGoals,
  updateGoal,
} from '../../repositories/performance/performance.repository.js'
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
  requirePerformanceOrganization,
} from './performance-access.js'
import { publishPerformanceEvent } from './performance-notifications.js'
import { assertGoalWeightsTotal100, computeNumericProgress } from './weight-math.js'
import { getCycle } from './cycle.service.js'

function parsePage(query: { page?: number; pageSize?: number; limit?: number }) {
  const page = Math.max(1, Number(query.page ?? 1))
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? query.limit ?? 20)))
  return { page, pageSize, skip: (page - 1) * pageSize }
}

export async function createGoal(
  ctx: AccessContext,
  body: {
    organizationId?: string
    legalEntityId?: string
    branchId?: string
    employeeId: string
    managerEmployeeId?: string
    cycleId?: string
    title: string
    description?: string
    category?: string
    startDate?: string
    dueDate?: string
    weight?: string
    targetValue?: string
    currentValue?: string
    unit?: string
    progressPercent?: string
    measurementMethod?: 'NUMERIC' | 'MANUAL_PERCENT'
    priority?: string
    employeeComments?: string
  },
  meta?: RequestMeta,
) {
  const organizationId = await requirePerformanceOrganization(ctx, body.organizationId)
  assertBranchScoped(ctx, body.branchId, organizationId)
  if (body.cycleId) await getCycle(ctx, body.cycleId)

  let progress = body.progressPercent ?? '0.00'
  if (body.measurementMethod === 'NUMERIC') {
    const computed = computeNumericProgress(body.targetValue, body.currentValue)
    if (computed) progress = computed
  }

  const goal = await insertGoal({
    organizationId,
    legalEntityId: body.legalEntityId,
    branchId: body.branchId,
    employeeId: body.employeeId,
    managerEmployeeId: body.managerEmployeeId,
    cycleId: body.cycleId,
    title: body.title,
    description: body.description,
    category: body.category,
    startDate: body.startDate ? new Date(body.startDate) : undefined,
    dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
    weight: body.weight ?? '0.00',
    targetValue: body.targetValue,
    currentValue: body.currentValue,
    unit: body.unit,
    progressPercent: progress,
    measurementMethod: body.measurementMethod ?? 'MANUAL_PERCENT',
    priority: body.priority ?? GOAL_PRIORITIES.MEDIUM,
    status: GOAL_STATUSES.DRAFT,
    employeeComments: body.employeeComments,
    createdBy: ctx.userId,
  })

  await recordAuditEvent({
    action: AUDIT_ACTIONS.PERFORMANCE_GOAL_CREATED,
    entityType: AUDIT_ENTITY_TYPES.EMPLOYEE_GOAL,
    entityId: goal.id,
    organizationId,
    meta,
  })
  await publishPerformanceEvent({
    organizationId,
    eventKey: `performance.goal.created:${goal.id}`,
    eventType: 'performance.goal.created',
    payload: { goalId: goal.id, employeeId: body.employeeId },
  })
  return goal
}

export async function updateGoalProgress(
  ctx: AccessContext,
  id: string,
  body: {
    currentValue?: string
    progressPercent?: string
    status?: string
    employeeComments?: string
    managerComments?: string
    notes?: string
  },
  meta?: RequestMeta,
) {
  const goal = await findGoalById(id)
  if (!goal) throw notFound('Goal was not found.')
  await requirePerformanceOrganization(ctx, goal.organizationId)
  assertBranchScoped(ctx, goal.branchId, goal.organizationId)

  let progress = body.progressPercent ?? goal.progressPercent
  const currentValue = body.currentValue ?? goal.currentValue
  if (goal.measurementMethod === 'NUMERIC') {
    const computed = computeNumericProgress(goal.targetValue, currentValue)
    if (computed) progress = computed
  }

  const nextStatus = body.status ?? goal.status
  const updated = await updateGoal(id, {
    currentValue,
    progressPercent: progress,
    status: nextStatus,
    employeeComments: body.employeeComments ?? goal.employeeComments,
    managerComments: body.managerComments ?? goal.managerComments,
    updatedBy: ctx.userId,
  })
  if (!updated) throw conflict('Goal could not be updated.')

  await insertGoalProgress({
    organizationId: goal.organizationId,
    goalId: id,
    previousProgressPercent: goal.progressPercent,
    newProgressPercent: progress,
    previousCurrentValue: goal.currentValue,
    newCurrentValue: currentValue,
    previousStatus: goal.status,
    newStatus: nextStatus,
    notes: body.notes,
    changedBy: ctx.userId,
  })

  await recordAuditEvent({
    action:
      nextStatus === GOAL_STATUSES.COMPLETED
        ? AUDIT_ACTIONS.PERFORMANCE_GOAL_COMPLETED
        : AUDIT_ACTIONS.PERFORMANCE_GOAL_UPDATED,
    entityType: AUDIT_ENTITY_TYPES.EMPLOYEE_GOAL,
    entityId: id,
    organizationId: goal.organizationId,
    meta,
  })
  if (nextStatus === GOAL_STATUSES.COMPLETED) {
    await publishPerformanceEvent({
      organizationId: goal.organizationId,
      eventKey: `performance.goal.completed:${id}`,
      eventType: 'performance.goal.completed',
      payload: { goalId: id },
    })
  }
  return updated
}

export async function validateCycleGoalWeights(
  ctx: AccessContext,
  cycleId: string,
  employeeId: string,
) {
  const cycle = await getCycle(ctx, cycleId)
  const { items } = await listGoals({
    organizationId: cycle.organizationId,
    cycleId,
    employeeId,
    skip: 0,
    limit: 200,
  })
  const active = items.filter((g) => !['CANCELLED'].includes(g.status))
  const require100 = Boolean(
    (cycle.templateSnapshot as { requireGoalWeightTotal100?: boolean } | undefined)
      ?.requireGoalWeightTotal100 ?? true,
  )
  assertGoalWeightsTotal100(
    active.map((g) => g.weight),
    require100,
  )
  return { valid: true, total: active.reduce((n, g) => n + Number(g.weight), 0), count: active.length }
}

export async function getGoal(ctx: AccessContext, id: string) {
  const goal = await findGoalById(id)
  if (!goal) throw notFound('Goal was not found.')
  await requirePerformanceOrganization(ctx, goal.organizationId)
  assertBranchScoped(ctx, goal.branchId, goal.organizationId)
  return goal
}

export async function listGoalsService(
  ctx: AccessContext,
  query: {
    organizationId?: string
    employeeId?: string
    cycleId?: string
    status?: string
    page?: number
    pageSize?: number
  },
) {
  const organizationId = await requirePerformanceOrganization(ctx, query.organizationId)
  const { page, skip, pageSize } = parsePage(query)
  const result = await listGoals({
    organizationId,
    employeeId: query.employeeId,
    cycleId: query.cycleId,
    status: query.status,
    branchIds: branchScopeForList(ctx),
    skip,
    limit: pageSize,
  })
  return toPaginated(result.items, page, pageSize, result.total)
}
