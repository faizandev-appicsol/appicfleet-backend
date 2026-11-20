import {
  PAYROLL_CALCULATION_VERSION,
  PAYROLL_PAYMENT_METHODS,
  PAYROLL_PAYMENT_STATUSES,
  PAYROLL_PERIOD_STATUSES,
  PAYROLL_RUN_STATUSES,
  PAYSLIP_STATUSES,
} from '../../constants/payroll.js'
import { PERMISSIONS } from '../../constants/permissions.js'
import { EMPLOYMENT_STATUSES } from '../../constants/hr.js'
import { listEmployees } from '../../repositories/hr/hr.repository.js'
import {
  deleteCalculationsForRun,
  findActivePrimaryAssignment,
  findPayrollPeriodById,
  findPayrollRunById,
  insertPayrollApproval,
  insertPayrollPayment,
  insertPayrollRun,
  insertPayslip,
  listActiveAdvancesForEmployees,
  listApprovedAdjustmentsForPeriod,
  listApprovedBonusesForPeriod,
  listApprovedDeductionsForPeriod,
  listApprovedOvertimeForPeriod,
  listCalculationsForRun,
  listPaymentsForRun,
  listPayrollRuns,
  lockPayslipsForRun,
  nextPayrollSequence,
  findPaymentByIdempotency,
  findPayslipByRunEmployee,
  transitionPayment,
  transitionPayrollRun,
  updatePayrollPeriod,
  updatePayrollRun,
  upsertPayrollCalculation,
} from '../../repositories/payroll/payroll.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import { conflict, forbiddenError, invalidField, notFound } from '../../utils/httpErrors.js'
import { addMoney } from '../../utils/money.js'
import { assertPermission, hasPermission } from '../authorization/authorization.service.js'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, recordAuditEvent } from '../audit/audit.service.js'
import { postPayrollAccrual, postPayrollPaymentClearing } from './accounting-bridge.service.js'
import { calculateEmployeePayroll } from './calculation.engine.js'
import {
  assertBranchInOrg,
  branchScopeForList,
  requirePayrollOrganization,
} from './payroll-access.js'
import { mapCalculation, mapPayment, mapPayslip, mapRun } from './payroll.mapper.js'
import { emitPayrollNotificationIntent } from './payroll-notifications.js'

function parsePage(query: { page?: number; pageSize?: number }) {
  const page = Math.max(1, Number(query.page ?? 1))
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? 20)))
  return { page, pageSize, skip: (page - 1) * pageSize }
}

async function loadAccessibleRun(ctx: AccessContext, id: string) {
  const run = await findPayrollRunById(id)
  if (!run) throw notFound('Payroll run was not found.')
  await requirePayrollOrganization(ctx, run.organizationId)
  if (run.branchId) {
    const { hasBranchAccess } = await import('../authorization/authorization.service.js')
    if (!hasBranchAccess(ctx, run.branchId, run.organizationId)) {
      throw notFound('Payroll run was not found.')
    }
  }
  return run
}

export async function createPayrollRun(
  ctx: AccessContext,
  body: Record<string, unknown>,
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.PAYROLL_CREATE)
  const period = await findPayrollPeriodById(String(body.payrollPeriodId))
  if (!period) throw notFound('Payroll period was not found.')
  await requirePayrollOrganization(ctx, period.organizationId)
  if (period.status === PAYROLL_PERIOD_STATUSES.CANCELLED) {
    throw conflict('Cannot create a run for a cancelled period.')
  }
  if (period.status === PAYROLL_PERIOD_STATUSES.PAID) {
    throw conflict('Cannot create a run for a paid period.')
  }
  if (body.branchId) await assertBranchInOrg(String(body.branchId), period.organizationId)

  const seq = await nextPayrollSequence(period.organizationId, 'payroll_run')
  const runNumber = `PR-${String(seq).padStart(6, '0')}`

  const created = await insertPayrollRun({
    organizationId: period.organizationId,
    legalEntityId: period.legalEntityId,
    branchId: body.branchId ?? period.branchId,
    payrollPeriodId: period.id,
    runNumber,
    status: PAYROLL_RUN_STATUSES.OPEN,
    currency: period.currency,
    calculationVersion: PAYROLL_CALCULATION_VERSION,
    notes: body.notes ? String(body.notes).trim() : undefined,
    createdBy: ctx.userId,
  })

  await updatePayrollPeriod(period.id, {
    status: PAYROLL_PERIOD_STATUSES.PROCESSING,
    updatedBy: ctx.userId,
  })

  await recordAuditEvent({
    action: AUDIT_ACTIONS.PAYROLL_RUN_CREATED,
    entityType: AUDIT_ENTITY_TYPES.PAYROLL_RUN,
    entityId: created.id,
    actorUserId: ctx.userId,
    organizationId: period.organizationId,
    metadata: { runNumber, payrollPeriodId: period.id },
    meta,
  })

  await emitPayrollNotificationIntent({
    organizationId: period.organizationId,
    payrollRunId: created.id,
    kind: 'payroll.run.created',
    intentKey: `payroll.run.created:${created.id}`,
    payload: { runNumber },
    meta,
  })

  return mapRun(created, hasPermission(ctx, PERMISSIONS.PAYROLL_SENSITIVE_VIEW))
}

export async function listPayrollRunsService(ctx: AccessContext, query: Record<string, unknown>) {
  assertPermission(ctx, PERMISSIONS.PAYROLL_VIEW)
  const organizationId = await requirePayrollOrganization(ctx, query.organizationId as string | undefined)
  const { page, pageSize, skip } = parsePage(query as { page?: number; pageSize?: number })
  const result = await listPayrollRuns({
    organizationId,
    payrollPeriodId: query.payrollPeriodId ? String(query.payrollPeriodId) : undefined,
    status: query.status ? String(query.status).toUpperCase() : undefined,
    limit: pageSize,
    skip,
  })
  const sensitive = hasPermission(ctx, PERMISSIONS.PAYROLL_SENSITIVE_VIEW)
  return {
    items: result.items.map((row) => mapRun(row, sensitive)),
    page,
    pageSize,
    total: result.total,
  }
}

export async function getPayrollRunService(ctx: AccessContext, id: string) {
  assertPermission(ctx, PERMISSIONS.PAYROLL_VIEW)
  const run = await loadAccessibleRun(ctx, id)
  return mapRun(run, hasPermission(ctx, PERMISSIONS.PAYROLL_SENSITIVE_VIEW))
}

export async function calculatePayrollRun(
  ctx: AccessContext,
  id: string,
  body: Record<string, unknown>,
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.PAYROLL_CALCULATE)
  const run = await loadAccessibleRun(ctx, id)
  const editable = [
    PAYROLL_RUN_STATUSES.OPEN,
    PAYROLL_RUN_STATUSES.PROCESSING,
    PAYROLL_RUN_STATUSES.CALCULATED,
  ]
  if (!editable.includes(run.status as (typeof editable)[number])) {
    throw conflict('Payroll run cannot be recalculated in its current status.')
  }

  const period = await findPayrollPeriodById(run.payrollPeriodId)
  if (!period) throw notFound('Payroll period was not found.')

  const locked = await transitionPayrollRun(run.id, editable, {
    status: PAYROLL_RUN_STATUSES.PROCESSING,
    updatedBy: ctx.userId,
  })
  if (!locked) throw conflict('Payroll run is being processed by another user.')

  const isRecalc = run.status === PAYROLL_RUN_STATUSES.CALCULATED
  if (isRecalc) {
    await deleteCalculationsForRun(run.id)
  }

  const branchIds = run.branchId ? [run.branchId] : branchScopeForList(ctx)
  const employees = await listEmployees({
    organizationId: run.organizationId,
    legalEntityId: run.legalEntityId,
    branchIds,
    status: EMPLOYMENT_STATUSES.ACTIVE,
    skip: 0,
    take: 5000,
  })

  const employeeIds = employees.items.map((e) => e.id)
  const [bonuses, deductions, adjustments, overtime, advances] = await Promise.all([
    listApprovedBonusesForPeriod(run.organizationId, period.id, employeeIds),
    listApprovedDeductionsForPeriod(run.organizationId, period.id, employeeIds),
    listApprovedAdjustmentsForPeriod(run.organizationId, period.id, employeeIds),
    listApprovedOvertimeForPeriod(run.organizationId, period.id, employeeIds),
    listActiveAdvancesForEmployees(run.organizationId, employeeIds),
  ])

  const asOf = period.endDate
  let grossTotal = '0.00'
  let deductionTotal = '0.00'
  let netTotal = '0.00'
  let employerCostTotal = '0.00'
  let exceptionCount = 0

  for (const employee of employees.items) {
    const assignments = await findActivePrimaryAssignment(
      run.organizationId,
      employee.id,
      asOf,
    )
    const assignment = assignments[0] ?? null
    const result = calculateEmployeePayroll({
      employee,
      assignment,
      duplicateAssignment: assignments.length > 1,
      currency: run.currency,
      bonuses: bonuses.filter((b) => b.employeeId === employee.id),
      deductions: deductions.filter((d) => d.employeeId === employee.id),
      adjustments: adjustments.filter((a) => a.employeeId === employee.id),
      overtime: overtime.filter((o) => o.employeeId === employee.id),
      advances: advances.filter((a) => a.employeeId === employee.id),
    })

    await upsertPayrollCalculation({
      organizationId: run.organizationId,
      legalEntityId: result.legalEntityId,
      branchId: result.branchId,
      payrollPeriodId: period.id,
      payrollRunId: run.id,
      employeeId: result.employeeId,
      employeeNumber: result.employeeNumber,
      compensationAssignmentId: result.compensationAssignmentId,
      calculationVersion: result.calculationVersion,
      currency: result.currency,
      earnings: result.earnings,
      deductions: result.deductions,
      employerContributions: result.employerContributions,
      grossPay: result.grossPay,
      totalDeductions: result.totalDeductions,
      netPay: result.netPay,
      employerCost: result.employerCost,
      exceptions: result.exceptions,
      hasExceptions: result.hasExceptions,
      snapshot: result.snapshot,
      calculatedAt: new Date(),
      calculatedBy: ctx.userId,
    })

    if (!result.hasExceptions) {
      grossTotal = addMoney(grossTotal, result.grossPay)
      deductionTotal = addMoney(deductionTotal, result.totalDeductions)
      netTotal = addMoney(netTotal, result.netPay)
      employerCostTotal = addMoney(employerCostTotal, result.employerCost)
    } else {
      exceptionCount += 1
    }
  }

  const updated = await transitionPayrollRun(run.id, PAYROLL_RUN_STATUSES.PROCESSING, {
    status: PAYROLL_RUN_STATUSES.CALCULATED,
    employeeCount: employees.items.length,
    exceptionCount,
    grossTotal,
    deductionTotal,
    netTotal,
    employerCostTotal,
    calculatedAt: new Date(),
    calculatedBy: ctx.userId,
    calculationVersion: PAYROLL_CALCULATION_VERSION,
    recalculationCount: isRecalc ? run.recalculationCount + 1 : run.recalculationCount,
    lastRecalculationReason: isRecalc
      ? String(body.reason ?? 'Recalculation after input correction')
      : undefined,
    updatedBy: ctx.userId,
  })
  if (!updated) throw conflict('Failed to finalize payroll calculation.')

  await updatePayrollPeriod(period.id, {
    status: PAYROLL_PERIOD_STATUSES.CALCULATED,
    updatedBy: ctx.userId,
  })

  await recordAuditEvent({
    action: isRecalc ? AUDIT_ACTIONS.PAYROLL_RUN_RECALCULATED : AUDIT_ACTIONS.PAYROLL_RUN_CALCULATED,
    entityType: AUDIT_ENTITY_TYPES.PAYROLL_RUN,
    entityId: run.id,
    actorUserId: ctx.userId,
    organizationId: run.organizationId,
    metadata: {
      employeeCount: employees.items.length,
      exceptionCount,
      recalculation: isRecalc,
    },
    meta,
  })

  await emitPayrollNotificationIntent({
    organizationId: run.organizationId,
    payrollRunId: run.id,
    kind: 'payroll.run.calculated',
    intentKey: `payroll.run.calculated:${run.id}:${updated.recalculationCount}`,
    payload: { runNumber: run.runNumber, exceptionCount },
    meta,
  })

  return mapRun(updated, hasPermission(ctx, PERMISSIONS.PAYROLL_SENSITIVE_VIEW))
}

export async function reviewPayrollRun(ctx: AccessContext, id: string) {
  assertPermission(ctx, PERMISSIONS.PAYROLL_VIEW)
  const run = await loadAccessibleRun(ctx, id)
  const calculations = await listCalculationsForRun(run.id)
  const sensitive = hasPermission(ctx, PERMISSIONS.PAYROLL_SENSITIVE_VIEW)
  return {
    run: mapRun(run, sensitive),
    calculations: calculations.map((c) => mapCalculation(c, sensitive)),
    exceptions: calculations.filter((c) => c.hasExceptions).map((c) => mapCalculation(c, false)),
  }
}

export async function submitPayrollRun(ctx: AccessContext, id: string, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.PAYROLL_CALCULATE)
  const run = await loadAccessibleRun(ctx, id)
  if (run.exceptionCount > 0) {
    throw conflict('Resolve calculation exceptions before submitting for approval.')
  }
  const updated = await transitionPayrollRun(run.id, PAYROLL_RUN_STATUSES.CALCULATED, {
    status: PAYROLL_RUN_STATUSES.PENDING_APPROVAL,
    submittedAt: new Date(),
    submittedBy: ctx.userId,
    updatedBy: ctx.userId,
  })
  if (!updated) throw conflict('Payroll run cannot be submitted in its current status.')

  await updatePayrollPeriod(run.payrollPeriodId, {
    status: PAYROLL_PERIOD_STATUSES.PENDING_APPROVAL,
    updatedBy: ctx.userId,
  })

  await insertPayrollApproval({
    organizationId: run.organizationId,
    payrollRunId: run.id,
    action: 'SUBMIT',
    actorUserId: ctx.userId,
  })

  await recordAuditEvent({
    action: AUDIT_ACTIONS.PAYROLL_RUN_SUBMITTED,
    entityType: AUDIT_ENTITY_TYPES.PAYROLL_RUN,
    entityId: run.id,
    actorUserId: ctx.userId,
    organizationId: run.organizationId,
    meta,
  })

  await emitPayrollNotificationIntent({
    organizationId: run.organizationId,
    payrollRunId: run.id,
    kind: 'payroll.run.pending_approval',
    intentKey: `payroll.run.pending_approval:${run.id}`,
    payload: { runNumber: run.runNumber },
    meta,
  })

  return mapRun(updated, hasPermission(ctx, PERMISSIONS.PAYROLL_SENSITIVE_VIEW))
}

export async function approvePayrollRun(ctx: AccessContext, id: string, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.PAYROLL_APPROVE)
  const run = await loadAccessibleRun(ctx, id)

  // Separation of duties: calculator/submitter cannot approve their own run
  if (run.submittedBy && run.submittedBy === ctx.userId && !ctx.accessAllOrganizations) {
    throw forbiddenError('You cannot approve a payroll run you submitted.')
  }
  if (run.calculatedBy && run.calculatedBy === ctx.userId && !ctx.accessAllOrganizations) {
    throw forbiddenError('You cannot approve a payroll run you calculated.')
  }

  const period = await findPayrollPeriodById(run.payrollPeriodId)
  if (!period) throw notFound('Payroll period was not found.')

  const updated = await transitionPayrollRun(run.id, PAYROLL_RUN_STATUSES.PENDING_APPROVAL, {
    status: PAYROLL_RUN_STATUSES.APPROVED,
    approvedAt: new Date(),
    approvedBy: ctx.userId,
    updatedBy: ctx.userId,
  })
  if (!updated) throw conflict('Payroll run cannot be approved in its current status.')

  const calculations = await listCalculationsForRun(run.id)
  for (const calc of calculations) {
    if (calc.hasExceptions) continue
    const existingPayslip = await findPayslipByRunEmployee(run.id, calc.employeeId)
    if (!existingPayslip) {
      const seq = await nextPayrollSequence(run.organizationId, 'payslip')
      const payslipNumber = `PS-${period.periodNumber}-${String(seq).padStart(5, '0')}`
      await insertPayslip({
        organizationId: run.organizationId,
        legalEntityId: calc.legalEntityId,
        branchId: calc.branchId,
        payrollPeriodId: period.id,
        payrollRunId: run.id,
        payrollCalculationId: calc.id,
        employeeId: calc.employeeId,
        employeeNumber: calc.employeeNumber,
        payslipNumber,
        currency: calc.currency,
        payDate: period.payDate,
        earnings: calc.earnings,
        deductions: calc.deductions,
        employerContributions: calc.employerContributions,
        grossSalary: calc.grossPay,
        totalDeductions: calc.totalDeductions,
        netSalary: calc.netPay,
        employerCost: calc.employerCost,
        status: PAYSLIP_STATUSES.AVAILABLE,
        documentPayload: {
          payslipNumber,
          employeeNumber: calc.employeeNumber,
          currency: calc.currency,
          payDate: period.payDate.toISOString(),
          periodName: period.name,
          earnings: calc.earnings,
          deductions: calc.deductions,
          grossSalary: calc.grossPay,
          netSalary: calc.netPay,
          locale: { en: true, ar: true },
        },
        generatedAt: new Date(),
        generatedBy: ctx.userId,
      })
    }

    await emitPayrollNotificationIntent({
      organizationId: run.organizationId,
      employeeId: calc.employeeId,
      payrollRunId: run.id,
      kind: 'payroll.payslip.available',
      intentKey: `payroll.payslip.available:${run.id}:${calc.employeeId}`,
      payload: { message: 'Your payslip is available.' },
      meta,
    })
  }

  // Post accrual journal through accounting module (idempotent)
  let journalId: string | undefined
  try {
    const branchId = run.branchId ?? calculations[0]?.branchId
    if (!branchId) throw invalidField('branchId', 'Branch is required for accounting posting.')
    const journal = await postPayrollAccrual(
      ctx,
      {
        organizationId: run.organizationId,
        legalEntityId: run.legalEntityId,
        branchId,
        payrollRunId: run.id,
        accountingDate: period.payDate,
        grossTotal: run.grossTotal,
        employerCostTotal: run.employerCostTotal,
        currency: run.currency,
        description: `Payroll accrual ${run.runNumber}`,
      },
      meta,
    )
    journalId = journal.id
    await updatePayrollRun(run.id, { accountingJournalId: journalId, updatedBy: ctx.userId })
  } catch (error) {
    // Keep approval; accounting mapping may be pending — surface in response
    await recordAuditEvent({
      action: AUDIT_ACTIONS.PAYROLL_RUN_APPROVED,
      entityType: AUDIT_ENTITY_TYPES.PAYROLL_RUN,
      entityId: run.id,
      actorUserId: ctx.userId,
      organizationId: run.organizationId,
      metadata: {
        accountingPostFailed: true,
        error: error instanceof Error ? error.message : 'accounting_error',
      },
      meta,
    })
  }

  await updatePayrollPeriod(period.id, {
    status: PAYROLL_PERIOD_STATUSES.APPROVED,
    updatedBy: ctx.userId,
  })

  await insertPayrollApproval({
    organizationId: run.organizationId,
    payrollRunId: run.id,
    action: 'APPROVE',
    actorUserId: ctx.userId,
  })

  await recordAuditEvent({
    action: AUDIT_ACTIONS.PAYROLL_RUN_APPROVED,
    entityType: AUDIT_ENTITY_TYPES.PAYROLL_RUN,
    entityId: run.id,
    actorUserId: ctx.userId,
    organizationId: run.organizationId,
    metadata: { accountingJournalId: journalId },
    meta,
  })

  await recordAuditEvent({
    action: AUDIT_ACTIONS.PAYROLL_PAYSLIP_GENERATED,
    entityType: AUDIT_ENTITY_TYPES.PAYROLL_RUN,
    entityId: run.id,
    actorUserId: ctx.userId,
    organizationId: run.organizationId,
    metadata: { count: calculations.filter((c) => !c.hasExceptions).length },
    meta,
  })

  await emitPayrollNotificationIntent({
    organizationId: run.organizationId,
    payrollRunId: run.id,
    kind: 'payroll.run.approved',
    intentKey: `payroll.run.approved:${run.id}`,
    payload: { runNumber: run.runNumber },
    meta,
  })

  const refreshed = await findPayrollRunById(run.id)
  return mapRun(refreshed!, hasPermission(ctx, PERMISSIONS.PAYROLL_SENSITIVE_VIEW))
}

export async function cancelPayrollRun(ctx: AccessContext, id: string, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.PAYROLL_CANCEL)
  const run = await loadAccessibleRun(ctx, id)
  if (
    run.status === PAYROLL_RUN_STATUSES.PAID ||
    run.status === PAYROLL_RUN_STATUSES.APPROVED
  ) {
    throw conflict('Approved or paid payroll runs cannot be cancelled. Use controlled corrections.')
  }
  const updated = await transitionPayrollRun(
    run.id,
    [
      PAYROLL_RUN_STATUSES.OPEN,
      PAYROLL_RUN_STATUSES.PROCESSING,
      PAYROLL_RUN_STATUSES.CALCULATED,
      PAYROLL_RUN_STATUSES.PENDING_APPROVAL,
    ],
    {
      status: PAYROLL_RUN_STATUSES.CANCELLED,
      updatedBy: ctx.userId,
    },
  )
  if (!updated) throw conflict('Payroll run cannot be cancelled in its current status.')

  await insertPayrollApproval({
    organizationId: run.organizationId,
    payrollRunId: run.id,
    action: 'CANCEL',
    actorUserId: ctx.userId,
  })

  await recordAuditEvent({
    action: AUDIT_ACTIONS.PAYROLL_RUN_CANCELLED,
    entityType: AUDIT_ENTITY_TYPES.PAYROLL_RUN,
    entityId: run.id,
    actorUserId: ctx.userId,
    organizationId: run.organizationId,
    meta,
  })

  return mapRun(updated, hasPermission(ctx, PERMISSIONS.PAYROLL_SENSITIVE_VIEW))
}

export async function payPayrollRun(
  ctx: AccessContext,
  id: string,
  body: Record<string, unknown>,
  meta: RequestMeta,
) {
  assertPermission(ctx, PERMISSIONS.PAYROLL_PAY)
  const run = await loadAccessibleRun(ctx, id)
  if (run.status !== PAYROLL_RUN_STATUSES.APPROVED && run.status !== PAYROLL_RUN_STATUSES.PAID) {
    throw conflict('Only approved payroll runs can be paid.')
  }

  const period = await findPayrollPeriodById(run.payrollPeriodId)
  if (!period) throw notFound('Payroll period was not found.')

  const calculations = (await listCalculationsForRun(run.id)).filter((c) => !c.hasExceptions)
  const paymentMethod = String(
    body.paymentMethod ?? PAYROLL_PAYMENT_METHODS.BANK_TRANSFER,
  ).toUpperCase()
  const createdPayments = []

  for (const calc of calculations) {
    const idempotencyKey = `payroll-pay:${run.id}:${calc.employeeId}`
    const existing = await findPaymentByIdempotency(run.organizationId, idempotencyKey)
    if (existing) {
      createdPayments.push(existing)
      continue
    }
    const payment = await insertPayrollPayment({
      organizationId: run.organizationId,
      legalEntityId: calc.legalEntityId,
      branchId: calc.branchId,
      payrollRunId: run.id,
      payrollPeriodId: period.id,
      employeeId: calc.employeeId,
      amount: calc.netPay,
      currency: calc.currency,
      paymentMethod,
      status: PAYROLL_PAYMENT_STATUSES.PENDING,
      idempotencyKey,
      provider: body.provider ? String(body.provider) : 'internal',
      createdBy: ctx.userId,
    })
    createdPayments.push(payment)

    await recordAuditEvent({
      action: AUDIT_ACTIONS.PAYROLL_PAYMENT_CREATED,
      entityType: AUDIT_ENTITY_TYPES.PAYROLL_PAYMENT,
      entityId: payment.id,
      actorUserId: ctx.userId,
      organizationId: run.organizationId,
      metadata: { payrollRunId: run.id, employeeId: calc.employeeId },
      meta,
    })
  }

  // Mark payments as paid (internal provider). External providers would process asynchronously.
  for (const payment of createdPayments) {
    if (payment.status === PAYROLL_PAYMENT_STATUSES.PAID) continue
    await transitionPayment(payment.id, PAYROLL_PAYMENT_STATUSES.PENDING, {
      status: PAYROLL_PAYMENT_STATUSES.PAID,
      paymentDate: new Date(),
      updatedBy: ctx.userId,
    })
    await recordAuditEvent({
      action: AUDIT_ACTIONS.PAYROLL_PAYMENT_COMPLETED,
      entityType: AUDIT_ENTITY_TYPES.PAYROLL_PAYMENT,
      entityId: payment.id,
      actorUserId: ctx.userId,
      organizationId: run.organizationId,
      metadata: { payrollRunId: run.id },
      meta,
    })
    await emitPayrollNotificationIntent({
      organizationId: run.organizationId,
      employeeId: payment.employeeId,
      payrollRunId: run.id,
      kind: 'payroll.payment.completed',
      intentKey: `payroll.payment.completed:${payment.id}`,
      payload: { message: 'Payroll payment completed.' },
      meta,
    })
  }

  const payments = await listPaymentsForRun(run.id)
  const allPaid = payments.every((p) => p.status === PAYROLL_PAYMENT_STATUSES.PAID)

  if (allPaid && run.status === PAYROLL_RUN_STATUSES.APPROVED) {
    const branchId = run.branchId ?? payments[0]?.branchId
    if (branchId) {
      try {
        const journal = await postPayrollPaymentClearing(
          ctx,
          {
            organizationId: run.organizationId,
            legalEntityId: run.legalEntityId,
            branchId,
            payrollRunId: run.id,
            accountingDate: new Date(),
            netTotal: run.netTotal,
            currency: run.currency,
            description: `Payroll payment ${run.runNumber}`,
            useBank: paymentMethod !== PAYROLL_PAYMENT_METHODS.CASH,
          },
          meta,
        )
        await updatePayrollRun(run.id, {
          paymentJournalId: journal.id,
          updatedBy: ctx.userId,
        })
      } catch (error) {
        await recordAuditEvent({
          action: AUDIT_ACTIONS.PAYROLL_PAYMENT_FAILED,
          entityType: AUDIT_ENTITY_TYPES.PAYROLL_RUN,
          entityId: run.id,
          actorUserId: ctx.userId,
          organizationId: run.organizationId,
          metadata: {
            accountingPostFailed: true,
            error: error instanceof Error ? error.message : 'accounting_error',
          },
          meta,
        })
      }
    }

    await lockPayslipsForRun(run.id)
    await transitionPayrollRun(run.id, PAYROLL_RUN_STATUSES.APPROVED, {
      status: PAYROLL_RUN_STATUSES.PAID,
      paidAt: new Date(),
      paidBy: ctx.userId,
      updatedBy: ctx.userId,
    })
    await updatePayrollPeriod(period.id, {
      status: PAYROLL_PERIOD_STATUSES.PAID,
      updatedBy: ctx.userId,
    })
  }

  const refreshed = await findPayrollRunById(run.id)
  return {
    run: mapRun(refreshed!, hasPermission(ctx, PERMISSIONS.PAYROLL_SENSITIVE_VIEW)),
    payments: payments.map(mapPayment),
  }
}

export async function listPayslipsForRunService(ctx: AccessContext, runId: string) {
  assertPermission(ctx, PERMISSIONS.PAYROLL_PAYSLIP_VIEW)
  const run = await loadAccessibleRun(ctx, runId)
  const { listPayslips } = await import('../../repositories/payroll/payroll.repository.js')
  const result = await listPayslips({
    organizationId: run.organizationId,
    payrollRunId: run.id,
    limit: 500,
    skip: 0,
  })
  const sensitive = hasPermission(ctx, PERMISSIONS.PAYROLL_SENSITIVE_VIEW)
  return { items: result.items.map((p) => mapPayslip(p, sensitive)), total: result.total }
}
