import { getRequestMeta } from '../../helpers/requestMeta.js'
import { sendSuccess } from '../../helpers/response.js'
import { requireAccess } from '../../middlewares/auth.middleware.js'
import { getValidated } from '../../middlewares/validation.middleware.js'
import {
  assignCompensation,
  createCompensationStructure,
  createSalaryComponent,
  listAssignmentsService,
  listCompensationStructuresService,
  listSalaryComponentsService,
  updateSalaryComponentService,
} from '../../services/payroll/compensation.service.js'
import {
  approveAdjustment,
  approveAdvance,
  approveBonus,
  approveDeduction,
  approveOvertime,
  createAdjustment,
  createAdvance,
  createBonus,
  createDeduction,
  createOvertime,
  listAdjustmentsService,
  listAdvancesService,
  listBonusesService,
  listDeductionsService,
  listPaymentsService,
} from '../../services/payroll/inputs.service.js'
import {
  downloadPayslipService,
  getPayslipService,
  listPayslipsService,
} from '../../services/payroll/payslip.service.js'
import {
  cancelPayrollPeriodService,
  createPayrollPeriod,
  getPayrollPeriodService,
  listPayrollPeriodsService,
  updatePayrollPeriodService,
} from '../../services/payroll/period.service.js'
import {
  approvePayrollRun,
  calculatePayrollRun,
  cancelPayrollRun,
  createPayrollRun,
  getPayrollRunService,
  listPayrollRunsService,
  listPayslipsForRunService,
  payPayrollRun,
  reviewPayrollRun,
  submitPayrollRun,
} from '../../services/payroll/run.service.js'
import { payrollSummaryService } from '../../services/payroll/summary.service.js'
import type { ValidatedRequest } from '../../types/http.js'
import { asyncHandler } from '../../utils/asyncHandler.js'

export const payrollSummaryHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, Record<string, unknown>>>(req)
  sendSuccess(res, 'Payroll summary loaded.', await payrollSummaryService(requireAccess(req), query))
})

export const listComponentsHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Salary components loaded.',
    await listSalaryComponentsService(requireAccess(req), query),
  )
})

export const createComponentHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Salary component created.',
    await createSalaryComponent(requireAccess(req), body, getRequestMeta(req)),
    201,
  )
})

export const updateComponentHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<
    ValidatedRequest<Record<string, unknown>, unknown, { id: string }>
  >(req)
  sendSuccess(
    res,
    'Salary component updated.',
    await updateSalaryComponentService(requireAccess(req), params.id, body, getRequestMeta(req)),
  )
})

export const listStructuresHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Compensation structures loaded.',
    await listCompensationStructuresService(requireAccess(req), query),
  )
})

export const createStructureHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Compensation structure created.',
    await createCompensationStructure(requireAccess(req), body, getRequestMeta(req)),
    201,
  )
})

export const listAssignmentsHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Compensation assignments loaded.',
    await listAssignmentsService(requireAccess(req), query),
  )
})

export const assignCompensationHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Compensation assigned.',
    await assignCompensation(requireAccess(req), body, getRequestMeta(req)),
    201,
  )
})

export const listPeriodsHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Payroll periods loaded.',
    await listPayrollPeriodsService(requireAccess(req), query),
  )
})

export const createPeriodHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Payroll period created.',
    await createPayrollPeriod(requireAccess(req), body, getRequestMeta(req)),
    201,
  )
})

export const getPeriodHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, { id: string }>>(req)
  sendSuccess(res, 'Payroll period loaded.', await getPayrollPeriodService(requireAccess(req), params.id))
})

export const updatePeriodHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<
    ValidatedRequest<Record<string, unknown>, unknown, { id: string }>
  >(req)
  sendSuccess(
    res,
    'Payroll period updated.',
    await updatePayrollPeriodService(requireAccess(req), params.id, body, getRequestMeta(req)),
  )
})

export const cancelPeriodHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, { id: string }>>(req)
  sendSuccess(
    res,
    'Payroll period cancelled.',
    await cancelPayrollPeriodService(requireAccess(req), params.id, getRequestMeta(req)),
  )
})

export const listRunsHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, Record<string, unknown>>>(req)
  sendSuccess(res, 'Payroll runs loaded.', await listPayrollRunsService(requireAccess(req), query))
})

export const createRunHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Payroll run created.',
    await createPayrollRun(requireAccess(req), body, getRequestMeta(req)),
    201,
  )
})

export const getRunHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, { id: string }>>(req)
  sendSuccess(res, 'Payroll run loaded.', await getPayrollRunService(requireAccess(req), params.id))
})

export const calculateRunHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<
    ValidatedRequest<Record<string, unknown>, unknown, { id: string }>
  >(req)
  sendSuccess(
    res,
    'Payroll calculated.',
    await calculatePayrollRun(requireAccess(req), params.id, body ?? {}, getRequestMeta(req)),
  )
})

export const reviewRunHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, { id: string }>>(req)
  sendSuccess(res, 'Payroll review loaded.', await reviewPayrollRun(requireAccess(req), params.id))
})

export const submitRunHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, { id: string }>>(req)
  sendSuccess(
    res,
    'Payroll submitted for approval.',
    await submitPayrollRun(requireAccess(req), params.id, getRequestMeta(req)),
  )
})

export const approveRunHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, { id: string }>>(req)
  sendSuccess(
    res,
    'Payroll approved.',
    await approvePayrollRun(requireAccess(req), params.id, getRequestMeta(req)),
  )
})

export const cancelRunHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, { id: string }>>(req)
  sendSuccess(
    res,
    'Payroll cancelled.',
    await cancelPayrollRun(requireAccess(req), params.id, getRequestMeta(req)),
  )
})

export const payRunHandler = asyncHandler(async (req, res) => {
  const { params, body } = getValidated<
    ValidatedRequest<Record<string, unknown>, unknown, { id: string }>
  >(req)
  sendSuccess(
    res,
    'Payroll payments processed.',
    await payPayrollRun(requireAccess(req), params.id, body ?? {}, getRequestMeta(req)),
  )
})

export const listRunPayslipsHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, { id: string }>>(req)
  sendSuccess(
    res,
    'Payslips loaded.',
    await listPayslipsForRunService(requireAccess(req), params.id),
  )
})

export const listPayslipsHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, Record<string, unknown>>>(req)
  sendSuccess(res, 'Payslips loaded.', await listPayslipsService(requireAccess(req), query))
})

export const getPayslipHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, { id: string }>>(req)
  sendSuccess(res, 'Payslip loaded.', await getPayslipService(requireAccess(req), params.id))
})

export const downloadPayslipHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, { id: string }>>(req)
  sendSuccess(
    res,
    'Payslip document ready.',
    await downloadPayslipService(requireAccess(req), params.id, getRequestMeta(req)),
  )
})

export const listBonusesHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, Record<string, unknown>>>(req)
  sendSuccess(res, 'Bonuses loaded.', await listBonusesService(requireAccess(req), query))
})

export const createBonusHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Bonus created.',
    await createBonus(requireAccess(req), body, getRequestMeta(req)),
    201,
  )
})

export const approveBonusHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, { id: string }>>(req)
  sendSuccess(
    res,
    'Bonus approved.',
    await approveBonus(requireAccess(req), params.id, getRequestMeta(req)),
  )
})

export const listDeductionsHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, Record<string, unknown>>>(req)
  sendSuccess(res, 'Deductions loaded.', await listDeductionsService(requireAccess(req), query))
})

export const createDeductionHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Deduction created.',
    await createDeduction(requireAccess(req), body, getRequestMeta(req)),
    201,
  )
})

export const approveDeductionHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, { id: string }>>(req)
  sendSuccess(
    res,
    'Deduction approved.',
    await approveDeduction(requireAccess(req), params.id, getRequestMeta(req)),
  )
})

export const listAdjustmentsHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, Record<string, unknown>>>(req)
  sendSuccess(res, 'Adjustments loaded.', await listAdjustmentsService(requireAccess(req), query))
})

export const createAdjustmentHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Adjustment created.',
    await createAdjustment(requireAccess(req), body, getRequestMeta(req)),
    201,
  )
})

export const approveAdjustmentHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, { id: string }>>(req)
  sendSuccess(
    res,
    'Adjustment approved.',
    await approveAdjustment(requireAccess(req), params.id, getRequestMeta(req)),
  )
})

export const createOvertimeHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Overtime created.',
    await createOvertime(requireAccess(req), body, getRequestMeta(req)),
    201,
  )
})

export const approveOvertimeHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, { id: string }>>(req)
  sendSuccess(
    res,
    'Overtime approved.',
    await approveOvertime(requireAccess(req), params.id, getRequestMeta(req)),
  )
})

export const listAdvancesHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, Record<string, unknown>>>(req)
  sendSuccess(res, 'Advances loaded.', await listAdvancesService(requireAccess(req), query))
})

export const createAdvanceHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<Record<string, unknown>>>(req)
  sendSuccess(
    res,
    'Advance created.',
    await createAdvance(requireAccess(req), body, getRequestMeta(req)),
    201,
  )
})

export const approveAdvanceHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, { id: string }>>(req)
  sendSuccess(
    res,
    'Advance approved.',
    await approveAdvance(requireAccess(req), params.id, getRequestMeta(req)),
  )
})

export const listPaymentsHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, Record<string, unknown>>>(req)
  sendSuccess(res, 'Payroll payments loaded.', await listPaymentsService(requireAccess(req), query))
})
