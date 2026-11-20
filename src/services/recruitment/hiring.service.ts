import {
  APPLICATION_STATUSES,
  CANDIDATE_STATUSES,
  OFFER_STATUSES,
  ONBOARDING_STATUSES,
  ONBOARDING_TASK_STATUSES,
} from '../../constants/recruitment.js'
import {
  findOnboardingById,
  findOnboardingTaskById,
  findOnboardingTemplateById,
  findOfferById,
  insertOnboarding,
  insertOnboardingTask,
  insertOnboardingTemplate,
  listOnboardingTasks,
  listOnboardingTemplates,
  listOnboardings,
  updateApplication,
  updateCandidate,
  updateOnboarding,
  updateOnboardingTask,
} from '../../repositories/recruitment/recruitment.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import { conflict, invalidField, notFound } from '../../utils/httpErrors.js'
import { toPaginated } from '../../utils/pagination.js'
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  recordAuditEvent,
} from '../audit/audit.service.js'
import { createEmployee } from '../hr/employee.service.js'
import { assignCompensation } from '../payroll/compensation.service.js'
import { assignEmployeeSchedule } from '../workforce/schedule.service.js'
import { getCandidate } from './candidate.service.js'
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

function computeProgress(tasks: Array<{ required: boolean; status: string }>) {
  const required = tasks.filter((t) => t.required)
  if (!required.length) return 100
  const done = required.filter(
    (t) =>
      t.status === ONBOARDING_TASK_STATUSES.COMPLETED ||
      t.status === ONBOARDING_TASK_STATUSES.SKIPPED,
  ).length
  return Math.round((done / required.length) * 100)
}

export async function createOnboardingTemplate(
  ctx: AccessContext,
  body: {
    organizationId?: string
    code: string
    name: string
    description?: string
    tasks: Array<{
      title: string
      description?: string
      category?: string
      required?: boolean
      sortOrder?: number
      dependsOnSortOrder?: number
    }>
  },
) {
  const organizationId = await requireRecruitmentOrganization(ctx, body.organizationId)
  return insertOnboardingTemplate({
    organizationId,
    code: body.code.toUpperCase(),
    name: body.name,
    description: body.description,
    tasks: body.tasks ?? [],
    status: 'ACTIVE',
    createdBy: ctx.userId,
  })
}

export async function listTemplatesService(ctx: AccessContext, organizationId?: string) {
  const orgId = await requireRecruitmentOrganization(ctx, organizationId)
  return listOnboardingTemplates(orgId)
}

/**
 * Hiring conversion: accepted offer → HR employee → onboarding.
 * Reuses Module 16 createEmployee; does not duplicate employee fields.
 */
export async function convertOfferToEmployee(
  ctx: AccessContext,
  body: {
    offerId: string
    templateId?: string
    workEmail?: string
    workScheduleId?: string
    shiftDefinitionId?: string
    compensationStructureId?: string
    basicSalary?: string
    assignedHrUserId?: string
    idempotencyKey?: string
  },
  meta?: RequestMeta,
) {
  const offer = await findOfferById(body.offerId)
  if (!offer) throw notFound('Offer was not found.')
  await requireRecruitmentOrganization(ctx, offer.organizationId)
  assertBranchScoped(ctx, offer.branchId, offer.organizationId)

  if (offer.status !== OFFER_STATUSES.ACCEPTED) {
    throw conflict('Only accepted offers can be converted to employees.')
  }

  const candidate = await getCandidate(ctx, offer.candidateId)
  if (candidate.employeeId) {
    const existingOnboarding = await listOnboardings({
      organizationId: offer.organizationId,
      skip: 0,
      limit: 1,
    })
    const match = existingOnboarding.items.find((o) => o.employeeId === candidate.employeeId)
    if (match) return { employeeId: candidate.employeeId, onboarding: match, alreadyConverted: true }
  }

  const employee = await createEmployee(
    ctx,
    {
      organizationId: offer.organizationId,
      legalEntityId: offer.legalEntityId,
      branchId: offer.branchId,
      firstName: candidate.firstName,
      middleName: candidate.middleName,
      lastName: candidate.lastName,
      preferredName: candidate.preferredName,
      personalEmail: candidate.email,
      personalPhone: candidate.phone,
      workEmail: body.workEmail,
      employmentType: offer.employmentType,
      jobTitle: undefined,
      departmentId: offer.departmentId,
      positionId: offer.positionId,
      hireDate: offer.proposedStartDate,
      employmentStartsAt: offer.proposedStartDate,
      notes: `Hired from recruitment offer ${offer.id}`,
    },
    meta ?? ({} as RequestMeta),
  )

  await updateCandidate(candidate.id, {
    employeeId: employee.id,
    status: CANDIDATE_STATUSES.HIRED,
    hiredAt: new Date(),
    updatedBy: ctx.userId,
  })
  await updateApplication(offer.applicationId, {
    status: APPLICATION_STATUSES.HIRED,
    stageCode: 'HIRED',
    updatedBy: ctx.userId,
  })

  let template = body.templateId ? await findOnboardingTemplateById(body.templateId) : null
  if (template && template.organizationId !== offer.organizationId) {
    throw invalidField('templateId', 'Onboarding template was not found.')
  }

  const onboarding = await insertOnboarding({
    organizationId: offer.organizationId,
    legalEntityId: offer.legalEntityId,
    branchId: offer.branchId,
    employeeId: employee.id,
    candidateId: candidate.id,
    offerId: offer.id,
    applicationId: offer.applicationId,
    templateId: template?.id,
    startDate: offer.proposedStartDate,
    status: ONBOARDING_STATUSES.IN_PROGRESS,
    assignedHrUserId: body.assignedHrUserId ?? ctx.userId,
    progressPercent: 0,
    workScheduleId: body.workScheduleId,
    shiftDefinitionId: body.shiftDefinitionId,
    compensationStructureId: body.compensationStructureId ?? offer.compensationStructureId,
    idempotencyKey: body.idempotencyKey ?? `hire:${offer.id}`,
    createdBy: ctx.userId,
  })
  if (!onboarding) throw conflict('Onboarding already exists for this employee.')

  const templateTasks = (template?.tasks ?? []) as Array<{
    _id?: { toString(): string }
    title: string
    description?: string
    category?: string
    required?: boolean
    sortOrder?: number
    dependsOnSortOrder?: number
  }>

  const createdTasks = []
  for (const task of templateTasks) {
    createdTasks.push(
      await insertOnboardingTask({
        organizationId: offer.organizationId,
        onboardingId: onboarding.id,
        employeeId: employee.id,
        title: task.title,
        description: task.description,
        category: task.category,
        required: task.required ?? true,
        sortOrder: task.sortOrder ?? 0,
        assignedHrUserId: body.assignedHrUserId ?? ctx.userId,
        status: ONBOARDING_TASK_STATUSES.PENDING,
      }),
    )
  }

  // Wire simple dependencies by sort order after insert.
  for (let i = 0; i < templateTasks.length; i += 1) {
    const depSort = templateTasks[i]?.dependsOnSortOrder
    if (depSort == null) continue
    const dep = createdTasks.find((t) => t.sortOrder === depSort)
    if (dep) {
      await updateOnboardingTask(createdTasks[i]!.id, { dependsOnTaskId: dep.id })
    }
  }

  // Optional payroll init — Module 17 owns money; recruitment only requests assignment.
  if (body.compensationStructureId || offer.compensationStructureId) {
    try {
      await assignCompensation(
        ctx,
        {
          organizationId: offer.organizationId,
          employeeId: employee.id,
          compensationStructureId:
            body.compensationStructureId ?? offer.compensationStructureId,
          effectiveFrom: offer.proposedStartDate.toISOString(),
          basicSalary: body.basicSalary ?? offer.baseSalary,
          currency: offer.currency,
          changeReason: `Onboarding from offer ${offer.id}`,
        } as never,
        meta,
      )
    } catch {
      // Compensation setup remains optional; HR/payroll can complete later.
    }
  }

  // Optional workforce schedule — Module 18 owns scheduling.
  if (body.workScheduleId || body.shiftDefinitionId) {
    try {
      await assignEmployeeSchedule(
        ctx,
        {
          organizationId: offer.organizationId,
          employeeId: employee.id,
          workScheduleId: body.workScheduleId,
          shiftDefinitionId: body.shiftDefinitionId,
          effectiveFrom: offer.proposedStartDate.toISOString(),
          reason: `Onboarding from offer ${offer.id}`,
        },
        meta,
      )
    } catch {
      // Schedule assignment optional at hire time.
    }
  }

  await emitRecruitmentNotificationIntent({
    organizationId: offer.organizationId,
    candidateId: candidate.id,
    kind: 'recruitment.candidate.hired',
    intentKey: `recruitment.candidate.hired:${offer.id}:${employee.id}`,
    entityType: AUDIT_ENTITY_TYPES.CANDIDATE,
    entityId: candidate.id,
    payload: { employeeId: employee.id, offerId: offer.id, onboardingId: onboarding.id },
    meta,
  })
  await emitRecruitmentNotificationIntent({
    organizationId: offer.organizationId,
    candidateId: candidate.id,
    kind: 'recruitment.onboarding.started',
    intentKey: `recruitment.onboarding.started:${onboarding.id}`,
    entityType: AUDIT_ENTITY_TYPES.ONBOARDING,
    entityId: onboarding.id,
    payload: { onboardingId: onboarding.id, employeeId: employee.id },
    meta,
  })
  await publishRecruitmentEvent({
    organizationId: offer.organizationId,
    eventKey: `recruitment.candidate.hired:${offer.id}`,
    eventType: 'recruitment.candidate.hired',
    payload: { offerId: offer.id, employeeId: employee.id, candidateId: candidate.id },
  })
  await publishRecruitmentEvent({
    organizationId: offer.organizationId,
    eventKey: `recruitment.onboarding.started:${onboarding.id}`,
    eventType: 'recruitment.onboarding.started',
    payload: { onboardingId: onboarding.id },
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.CANDIDATE_CONVERTED_TO_EMPLOYEE,
    entityType: AUDIT_ENTITY_TYPES.CANDIDATE,
    entityId: candidate.id,
    organizationId: offer.organizationId,
    branchId: offer.branchId,
    metadata: { employeeId: employee.id, offerId: offer.id },
    meta,
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.ONBOARDING_CREATED,
    entityType: AUDIT_ENTITY_TYPES.ONBOARDING,
    entityId: onboarding.id,
    organizationId: offer.organizationId,
    meta,
  })

  return { employeeId: employee.id, onboarding, alreadyConverted: false }
}

export async function completeOnboardingTask(
  ctx: AccessContext,
  taskId: string,
  body: { evidenceStorageKey?: string },
  meta?: RequestMeta,
) {
  const task = await findOnboardingTaskById(taskId)
  if (!task) throw notFound('Onboarding task was not found.')
  await requireRecruitmentOrganization(ctx, task.organizationId)

  if (task.dependsOnTaskId) {
    const dep = await findOnboardingTaskById(task.dependsOnTaskId)
    if (
      dep &&
      dep.status !== ONBOARDING_TASK_STATUSES.COMPLETED &&
      dep.status !== ONBOARDING_TASK_STATUSES.SKIPPED
    ) {
      throw conflict('Prerequisite onboarding task is not complete.')
    }
  }

  if (task.status === ONBOARDING_TASK_STATUSES.COMPLETED) return task

  const updated = await updateOnboardingTask(taskId, {
    status: ONBOARDING_TASK_STATUSES.COMPLETED,
    completedAt: new Date(),
    completedBy: ctx.userId,
    evidenceStorageKey: body.evidenceStorageKey,
  })

  const tasks = await listOnboardingTasks(task.organizationId, task.onboardingId)
  const progressPercent = computeProgress(tasks)
  await updateOnboarding(task.onboardingId, {
    progressPercent,
    status: ONBOARDING_STATUSES.IN_PROGRESS,
    updatedBy: ctx.userId,
  })

  await recordAuditEvent({
    action: AUDIT_ACTIONS.ONBOARDING_TASK_COMPLETED,
    entityType: AUDIT_ENTITY_TYPES.ONBOARDING_TASK,
    entityId: taskId,
    organizationId: task.organizationId,
    meta,
  })
  return updated
}

export async function completeOnboarding(
  ctx: AccessContext,
  onboardingId: string,
  body: { overrideReason?: string },
  meta?: RequestMeta,
) {
  const onboarding = await findOnboardingById(onboardingId)
  if (!onboarding) throw notFound('Onboarding was not found.')
  await requireRecruitmentOrganization(ctx, onboarding.organizationId)
  assertBranchScoped(ctx, onboarding.branchId, onboarding.organizationId)

  if (onboarding.status === ONBOARDING_STATUSES.COMPLETED) return onboarding

  const tasks = await listOnboardingTasks(onboarding.organizationId, onboardingId)
  const incompleteRequired = tasks.filter(
    (t) =>
      t.required &&
      t.status !== ONBOARDING_TASK_STATUSES.COMPLETED &&
      t.status !== ONBOARDING_TASK_STATUSES.SKIPPED,
  )
  if (incompleteRequired.length && !body.overrideReason?.trim()) {
    throw conflict('Required onboarding tasks are incomplete. Provide an override reason.')
  }

  const updated = await updateOnboarding(onboardingId, {
    status: ONBOARDING_STATUSES.COMPLETED,
    completedAt: new Date(),
    progressPercent: 100,
    completionOverrideReason: incompleteRequired.length ? body.overrideReason : undefined,
    updatedBy: ctx.userId,
  })

  await emitRecruitmentNotificationIntent({
    organizationId: onboarding.organizationId,
    candidateId: onboarding.candidateId,
    kind: 'recruitment.onboarding.completed',
    intentKey: `recruitment.onboarding.completed:${onboardingId}`,
    entityType: AUDIT_ENTITY_TYPES.ONBOARDING,
    entityId: onboardingId,
    payload: { onboardingId, employeeId: onboarding.employeeId },
    meta,
  })
  await publishRecruitmentEvent({
    organizationId: onboarding.organizationId,
    eventKey: `recruitment.onboarding.completed:${onboardingId}`,
    eventType: 'recruitment.onboarding.completed',
    payload: { onboardingId, employeeId: onboarding.employeeId },
  })
  await recordAuditEvent({
    action: AUDIT_ACTIONS.ONBOARDING_COMPLETED,
    entityType: AUDIT_ENTITY_TYPES.ONBOARDING,
    entityId: onboardingId,
    organizationId: onboarding.organizationId,
    metadata: { override: Boolean(incompleteRequired.length) },
    meta,
  })
  return updated
}

export async function listOnboardingsService(
  ctx: AccessContext,
  query: { organizationId?: string; status?: string; page?: number; pageSize?: number },
) {
  const organizationId = await requireRecruitmentOrganization(ctx, query.organizationId)
  const { page, skip, pageSize } = parsePage(query)
  const result = await listOnboardings({
    organizationId,
    status: query.status,
    branchIds: branchScopeForList(ctx),
    skip,
    limit: pageSize,
  })
  return toPaginated(result.items, page, pageSize, result.total)
}

export async function getOnboarding(ctx: AccessContext, id: string) {
  const onboarding = await findOnboardingById(id)
  if (!onboarding) throw notFound('Onboarding was not found.')
  await requireRecruitmentOrganization(ctx, onboarding.organizationId)
  assertBranchScoped(ctx, onboarding.branchId, onboarding.organizationId)
  const tasks = await listOnboardingTasks(onboarding.organizationId, id)
  return { ...onboarding, tasks }
}
