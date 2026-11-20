import {
  CALCULATION_METHODS,
  COMPENSATION_ASSIGNMENT_STATUSES,
  ENTITY_ACTIVE_STATUSES,
  SALARY_COMPONENT_CATEGORIES,
  SALARY_COMPONENT_TYPES,
} from '../../constants/payroll.js'
import { PERMISSIONS } from '../../constants/permissions.js'
import {
  findCompensationStructureById,
  findSalaryComponentById,
  insertCompensationAssignment,
  insertCompensationHistory,
  insertCompensationStructure,
  insertSalaryComponent,
  listCompensationAssignments,
  listCompensationStructures,
  listSalaryComponents,
  supersedeAssignment,
  updateSalaryComponent,
} from '../../repositories/payroll/payroll.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import { conflict, invalidField, notFound } from '../../utils/httpErrors.js'
import { isMoneyString, normalizeMoney } from '../../utils/money.js'
import { assertPermission, hasPermission } from '../authorization/authorization.service.js'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, recordAuditEvent } from '../audit/audit.service.js'
import {
  assertBranchInOrg,
  assertLegalEntityInOrg,
  loadAccessiblePayrollEmployee,
  requirePayrollOrganization,
} from './payroll-access.js'
import { mapAssignment, mapSalaryComponent, mapStructure } from './payroll.mapper.js'
import { emitPayrollNotificationIntent } from './payroll-notifications.js'

function parsePage(query: { page?: number; pageSize?: number }) {
  const page = Math.max(1, Number(query.page ?? 1))
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? 20)))
  return { page, pageSize, skip: (page - 1) * pageSize }
}

export async function createSalaryComponent(
  ctx: AccessContext,
  body: Record<string, unknown>,
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.PAYROLL_COMPENSATION_MANAGE)
  const organizationId = await requirePayrollOrganization(ctx, body.organizationId as string | undefined)
  if (body.legalEntityId) await assertLegalEntityInOrg(String(body.legalEntityId), organizationId)

  const componentType = String(body.componentType ?? '').toUpperCase()
  const category = String(body.category ?? '').toUpperCase()
  const calculationMethod = String(body.calculationMethod ?? CALCULATION_METHODS.FIXED).toUpperCase()
  if (!(Object.values(SALARY_COMPONENT_TYPES) as string[]).includes(componentType)) {
    throw invalidField('componentType', 'Unsupported salary component type.')
  }
  if (!(Object.values(SALARY_COMPONENT_CATEGORIES) as string[]).includes(category)) {
    throw invalidField('category', 'Unsupported salary component category.')
  }
  if (!(Object.values(CALCULATION_METHODS) as string[]).includes(calculationMethod)) {
    throw invalidField('calculationMethod', 'Unsupported calculation method.')
  }

  let fixedAmount: string | undefined
  let percentage: string | undefined
  if (calculationMethod === CALCULATION_METHODS.FIXED) {
    if (!body.fixedAmount || !isMoneyString(String(body.fixedAmount))) {
      throw invalidField('fixedAmount', 'A valid fixed amount is required.')
    }
    fixedAmount = normalizeMoney(String(body.fixedAmount))
  }
  if (calculationMethod === CALCULATION_METHODS.PERCENT_OF_BASIC) {
    if (!body.percentage || !isMoneyString(String(body.percentage))) {
      throw invalidField('percentage', 'A valid percentage is required.')
    }
    percentage = normalizeMoney(String(body.percentage))
  }

  const created = await insertSalaryComponent({
    organizationId,
    legalEntityId: body.legalEntityId,
    code: String(body.code).trim().toUpperCase(),
    name: String(body.name).trim(),
    nameAr: body.nameAr ? String(body.nameAr).trim() : undefined,
    componentType,
    category,
    calculationMethod,
    fixedAmount,
    percentage,
    taxable: body.taxable !== false,
    status: ENTITY_ACTIVE_STATUSES.ACTIVE,
    effectiveFrom: new Date(String(body.effectiveFrom)),
    effectiveTo: body.effectiveTo ? new Date(String(body.effectiveTo)) : undefined,
    description: body.description ? String(body.description).trim() : undefined,
    createdBy: ctx.userId,
  })

  await recordAuditEvent({
    action: AUDIT_ACTIONS.PAYROLL_COMPENSATION_CHANGED,
    entityType: AUDIT_ENTITY_TYPES.SALARY_COMPONENT,
    entityId: created.id,
    actorUserId: ctx.userId,
    organizationId,
    metadata: { code: created.code, componentType },
    meta,
  })

  return mapSalaryComponent(created)
}

export async function listSalaryComponentsService(ctx: AccessContext, query: Record<string, unknown>) {
  assertPermission(ctx, PERMISSIONS.PAYROLL_COMPENSATION_VIEW)
  const organizationId = await requirePayrollOrganization(ctx, query.organizationId as string | undefined)
  const { page, pageSize, skip } = parsePage(query as { page?: number; pageSize?: number })
  const result = await listSalaryComponents({
    organizationId,
    status: query.status ? String(query.status).toUpperCase() : undefined,
    componentType: query.componentType ? String(query.componentType).toUpperCase() : undefined,
    q: query.q ? String(query.q) : undefined,
    limit: pageSize,
    skip,
  })
  return {
    items: result.items.map(mapSalaryComponent),
    page,
    pageSize,
    total: result.total,
  }
}

export async function updateSalaryComponentService(
  ctx: AccessContext,
  id: string,
  body: Record<string, unknown>,
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.PAYROLL_COMPENSATION_MANAGE)
  const existing = await findSalaryComponentById(id)
  if (!existing) throw notFound('Salary component was not found.')
  await requirePayrollOrganization(ctx, existing.organizationId)

  const patch: Record<string, unknown> = { updatedBy: ctx.userId }
  if (body.name !== undefined) patch.name = String(body.name).trim()
  if (body.nameAr !== undefined) patch.nameAr = String(body.nameAr).trim()
  if (body.description !== undefined) patch.description = String(body.description).trim()
  if (body.status !== undefined) patch.status = String(body.status).toUpperCase()
  if (body.taxable !== undefined) patch.taxable = Boolean(body.taxable)
  if (body.fixedAmount !== undefined) {
    if (!isMoneyString(String(body.fixedAmount))) throw invalidField('fixedAmount', 'Invalid amount.')
    patch.fixedAmount = normalizeMoney(String(body.fixedAmount))
  }
  if (body.percentage !== undefined) {
    if (!isMoneyString(String(body.percentage))) throw invalidField('percentage', 'Invalid percentage.')
    patch.percentage = normalizeMoney(String(body.percentage))
  }

  const updated = await updateSalaryComponent(id, patch)
  if (!updated) throw notFound('Salary component was not found.')
  await recordAuditEvent({
    action: AUDIT_ACTIONS.PAYROLL_COMPENSATION_CHANGED,
    entityType: AUDIT_ENTITY_TYPES.SALARY_COMPONENT,
    entityId: id,
    actorUserId: ctx.userId,
    organizationId: existing.organizationId,
    metadata: { updated: Object.keys(patch) },
    meta,
  })
  return mapSalaryComponent(updated)
}

export async function createCompensationStructure(
  ctx: AccessContext,
  body: Record<string, unknown>,
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.PAYROLL_COMPENSATION_MANAGE)
  const organizationId = await requirePayrollOrganization(ctx, body.organizationId as string | undefined)
  if (body.legalEntityId) await assertLegalEntityInOrg(String(body.legalEntityId), organizationId)

  const lines = Array.isArray(body.lines) ? body.lines : []
  for (const line of lines as Array<Record<string, unknown>>) {
    const component = await findSalaryComponentById(String(line.salaryComponentId))
    if (!component || component.organizationId !== organizationId) {
      throw invalidField('lines', 'Salary component was not found in this organization.')
    }
  }

  const created = await insertCompensationStructure({
    organizationId,
    legalEntityId: body.legalEntityId,
    code: String(body.code).trim().toUpperCase(),
    name: String(body.name).trim(),
    currency: String(body.currency ?? 'AED').toUpperCase(),
    status: ENTITY_ACTIVE_STATUSES.ACTIVE,
    lines,
    description: body.description ? String(body.description).trim() : undefined,
    createdBy: ctx.userId,
  })

  await recordAuditEvent({
    action: AUDIT_ACTIONS.PAYROLL_COMPENSATION_CHANGED,
    entityType: AUDIT_ENTITY_TYPES.PAYROLL_COMPENSATION,
    entityId: created.id,
    actorUserId: ctx.userId,
    organizationId,
    metadata: { kind: 'structure', code: created.code },
    meta,
  })

  return mapStructure(created)
}

export async function listCompensationStructuresService(
  ctx: AccessContext,
  query: Record<string, unknown>,
) {
  assertPermission(ctx, PERMISSIONS.PAYROLL_COMPENSATION_VIEW)
  const organizationId = await requirePayrollOrganization(ctx, query.organizationId as string | undefined)
  const { page, pageSize, skip } = parsePage(query as { page?: number; pageSize?: number })
  const result = await listCompensationStructures({
    organizationId,
    status: query.status ? String(query.status).toUpperCase() : undefined,
    q: query.q ? String(query.q) : undefined,
    limit: pageSize,
    skip,
  })
  return {
    items: result.items.map(mapStructure),
    page,
    pageSize,
    total: result.total,
  }
}

export async function assignCompensation(
  ctx: AccessContext,
  body: Record<string, unknown>,
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.PAYROLL_COMPENSATION_MANAGE)
  const employee = await loadAccessiblePayrollEmployee(
    ctx,
    String(body.employeeId),
    body.organizationId as string | undefined,
  )
  await assertLegalEntityInOrg(employee.legalEntityId, employee.organizationId)
  await assertBranchInOrg(employee.branchId, employee.organizationId)

  if (!body.basicSalary || !isMoneyString(String(body.basicSalary))) {
    throw invalidField('basicSalary', 'A valid basic salary is required.')
  }
  const basicSalary = normalizeMoney(String(body.basicSalary))
  const effectiveFrom = new Date(String(body.effectiveFrom))
  if (Number.isNaN(effectiveFrom.getTime())) {
    throw invalidField('effectiveFrom', 'Invalid effective date.')
  }

  let lines: Array<Record<string, unknown>> = []
  let structureId: string | undefined
  if (body.compensationStructureId) {
    const structure = await findCompensationStructureById(String(body.compensationStructureId))
    if (!structure || structure.organizationId !== employee.organizationId) {
      throw notFound('Compensation structure was not found.')
    }
    structureId = structure.id
    for (const line of structure.lines) {
      const component = await findSalaryComponentById(line.salaryComponentId)
      if (!component) continue
      lines.push({
        salaryComponentId: component.id,
        componentType: component.componentType,
        category: component.category,
        code: component.code,
        name: component.name,
        calculationMethod: line.calculationMethod ?? component.calculationMethod,
        fixedAmount:
          line.fixedAmount ??
          (component.category === SALARY_COMPONENT_CATEGORIES.BASIC
            ? basicSalary
            : component.fixedAmount),
        percentage: line.percentage ?? component.percentage,
        taxable: component.taxable,
      })
    }
  } else if (Array.isArray(body.lines)) {
    for (const line of body.lines as Array<Record<string, unknown>>) {
      const component = await findSalaryComponentById(String(line.salaryComponentId))
      if (!component || component.organizationId !== employee.organizationId) {
        throw invalidField('lines', 'Salary component was not found.')
      }
      lines.push({
        salaryComponentId: component.id,
        componentType: component.componentType,
        category: component.category,
        code: component.code,
        name: component.name,
        calculationMethod: String(line.calculationMethod ?? component.calculationMethod).toUpperCase(),
        fixedAmount: line.fixedAmount
          ? normalizeMoney(String(line.fixedAmount))
          : component.category === SALARY_COMPONENT_CATEGORIES.BASIC
            ? basicSalary
            : component.fixedAmount,
        percentage: line.percentage
          ? normalizeMoney(String(line.percentage))
          : component.percentage,
        taxable: component.taxable,
      })
    }
  }

  if (!lines.some((l) => l.category === SALARY_COMPONENT_CATEGORIES.BASIC)) {
    // Ensure basic is present as a line for snapshot reproducibility
    lines = [
      {
        salaryComponentId: lines[0]?.salaryComponentId ?? employee.id,
        componentType: SALARY_COMPONENT_TYPES.EARNING,
        category: SALARY_COMPONENT_CATEGORIES.BASIC,
        code: 'BASIC',
        name: 'Basic salary',
        calculationMethod: CALCULATION_METHODS.FIXED,
        fixedAmount: basicSalary,
        taxable: true,
      },
      ...lines,
    ]
  } else {
    lines = lines.map((l) =>
      l.category === SALARY_COMPONENT_CATEGORIES.BASIC ? { ...l, fixedAmount: basicSalary } : l,
    )
  }

  const existingActive = await listCompensationAssignments({
    organizationId: employee.organizationId,
    employeeId: employee.id,
    status: COMPENSATION_ASSIGNMENT_STATUSES.ACTIVE,
    limit: 50,
    skip: 0,
  })
  const previousPrimary = existingActive.items.find((a) => a.isPrimary)
  if (previousPrimary) {
    const endDate = new Date(effectiveFrom.getTime() - 24 * 60 * 60 * 1000)
    await supersedeAssignment(previousPrimary.id, endDate, ctx.userId)
  }

  const created = await insertCompensationAssignment({
    organizationId: employee.organizationId,
    legalEntityId: employee.legalEntityId,
    branchId: employee.branchId,
    employeeId: employee.id,
    compensationStructureId: structureId,
    currency: String(body.currency ?? 'AED').toUpperCase(),
    effectiveFrom,
    effectiveTo: body.effectiveTo ? new Date(String(body.effectiveTo)) : undefined,
    status: COMPENSATION_ASSIGNMENT_STATUSES.ACTIVE,
    isPrimary: true,
    lines,
    basicSalary,
    notes: body.notes ? String(body.notes).trim() : undefined,
    changeReason: body.changeReason ? String(body.changeReason).trim() : undefined,
    previousAssignmentId: previousPrimary?.id,
    approvedBy: ctx.userId,
    approvedAt: new Date(),
    createdBy: ctx.userId,
  })

  await insertCompensationHistory({
    organizationId: employee.organizationId,
    employeeId: employee.id,
    previousAssignmentId: previousPrimary?.id,
    newAssignmentId: created.id,
    previousBasicSalary: previousPrimary?.basicSalary,
    newBasicSalary: basicSalary,
    currency: created.currency,
    effectiveFrom,
    reason: body.changeReason ? String(body.changeReason).trim() : undefined,
    changedBy: ctx.userId,
    approvedBy: ctx.userId,
  })

  await recordAuditEvent({
    action: AUDIT_ACTIONS.PAYROLL_COMPENSATION_CHANGED,
    entityType: AUDIT_ENTITY_TYPES.PAYROLL_COMPENSATION,
    entityId: created.id,
    actorUserId: ctx.userId,
    organizationId: employee.organizationId,
    metadata: {
      employeeId: employee.id,
      previousAssignmentId: previousPrimary?.id,
      effectiveFrom: effectiveFrom.toISOString(),
    },
    meta,
  })

  await emitPayrollNotificationIntent({
    organizationId: employee.organizationId,
    employeeId: employee.id,
    kind: 'payroll.compensation.changed',
    intentKey: `payroll.compensation.changed:${created.id}`,
    payload: { employeeNumber: employee.employeeNumber },
  })

  const sensitive = hasPermission(ctx, PERMISSIONS.PAYROLL_SENSITIVE_VIEW)
  return mapAssignment(created, sensitive)
}

export async function listAssignmentsService(ctx: AccessContext, query: Record<string, unknown>) {
  assertPermission(ctx, PERMISSIONS.PAYROLL_COMPENSATION_VIEW)
  const organizationId = await requirePayrollOrganization(ctx, query.organizationId as string | undefined)
  if (query.employeeId) {
    await loadAccessiblePayrollEmployee(ctx, String(query.employeeId), organizationId)
  }
  const { page, pageSize, skip } = parsePage(query as { page?: number; pageSize?: number })
  const result = await listCompensationAssignments({
    organizationId,
    employeeId: query.employeeId ? String(query.employeeId) : undefined,
    status: query.status ? String(query.status).toUpperCase() : undefined,
    limit: pageSize,
    skip,
  })
  const sensitive = hasPermission(ctx, PERMISSIONS.PAYROLL_SENSITIVE_VIEW)
  return {
    items: result.items.map((row) => mapAssignment(row, sensitive)),
    page,
    pageSize,
    total: result.total,
  }
}
