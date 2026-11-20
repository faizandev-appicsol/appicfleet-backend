import { Router } from 'express'
import { PERMISSIONS } from '../constants/permissions.js'
import {
  approveAdjustmentHandler,
  approveAdvanceHandler,
  approveBonusHandler,
  approveDeductionHandler,
  approveOvertimeHandler,
  approveRunHandler,
  assignCompensationHandler,
  calculateRunHandler,
  cancelPeriodHandler,
  cancelRunHandler,
  createAdjustmentHandler,
  createAdvanceHandler,
  createBonusHandler,
  createComponentHandler,
  createDeductionHandler,
  createOvertimeHandler,
  createPeriodHandler,
  createRunHandler,
  createStructureHandler,
  downloadPayslipHandler,
  getPayslipHandler,
  getPeriodHandler,
  getRunHandler,
  listAdjustmentsHandler,
  listAdvancesHandler,
  listAssignmentsHandler,
  listBonusesHandler,
  listComponentsHandler,
  listDeductionsHandler,
  listPaymentsHandler,
  listPayslipsHandler,
  listPeriodsHandler,
  listRunPayslipsHandler,
  listRunsHandler,
  listStructuresHandler,
  payRunHandler,
  payrollSummaryHandler,
  reviewRunHandler,
  submitRunHandler,
  updateComponentHandler,
  updatePeriodHandler,
} from '../controllers/payroll/payroll.controller.js'
import { authenticate, requirePermission } from '../middlewares/auth.middleware.js'
import { validate } from '../middlewares/validation.middleware.js'
import { idParamsSchema } from '../validations/common.validation.js'
import {
  assignCompensationBodySchema,
  calculateRunBodySchema,
  createAdjustmentBodySchema,
  createAdvanceBodySchema,
  createBonusBodySchema,
  createDeductionBodySchema,
  createOvertimeBodySchema,
  createPeriodBodySchema,
  createRunBodySchema,
  createSalaryComponentBodySchema,
  createStructureBodySchema,
  listPayrollQuerySchema,
  payRunBodySchema,
  payrollSummaryQuerySchema,
  updatePeriodBodySchema,
  updateSalaryComponentBodySchema,
} from '../validations/payroll.validation.js'

export const payrollRouter = Router()
payrollRouter.use(authenticate)

payrollRouter.get(
  '/summary',
  requirePermission(PERMISSIONS.PAYROLL_VIEW),
  validate({ query: payrollSummaryQuerySchema }),
  payrollSummaryHandler,
)

payrollRouter.get(
  '/components',
  requirePermission(PERMISSIONS.PAYROLL_COMPENSATION_VIEW),
  validate({ query: listPayrollQuerySchema }),
  listComponentsHandler,
)
payrollRouter.post(
  '/components',
  requirePermission(PERMISSIONS.PAYROLL_COMPENSATION_MANAGE),
  validate({ body: createSalaryComponentBodySchema }),
  createComponentHandler,
)
payrollRouter.patch(
  '/components/:id',
  requirePermission(PERMISSIONS.PAYROLL_COMPENSATION_MANAGE),
  validate({ params: idParamsSchema, body: updateSalaryComponentBodySchema }),
  updateComponentHandler,
)

payrollRouter.get(
  '/structures',
  requirePermission(PERMISSIONS.PAYROLL_COMPENSATION_VIEW),
  validate({ query: listPayrollQuerySchema }),
  listStructuresHandler,
)
payrollRouter.post(
  '/structures',
  requirePermission(PERMISSIONS.PAYROLL_COMPENSATION_MANAGE),
  validate({ body: createStructureBodySchema }),
  createStructureHandler,
)

payrollRouter.get(
  '/assignments',
  requirePermission(PERMISSIONS.PAYROLL_COMPENSATION_VIEW),
  validate({ query: listPayrollQuerySchema }),
  listAssignmentsHandler,
)
payrollRouter.post(
  '/assignments',
  requirePermission(PERMISSIONS.PAYROLL_COMPENSATION_MANAGE),
  validate({ body: assignCompensationBodySchema }),
  assignCompensationHandler,
)

payrollRouter.get(
  '/periods',
  requirePermission(PERMISSIONS.PAYROLL_VIEW),
  validate({ query: listPayrollQuerySchema }),
  listPeriodsHandler,
)
payrollRouter.post(
  '/periods',
  requirePermission(PERMISSIONS.PAYROLL_CREATE),
  validate({ body: createPeriodBodySchema }),
  createPeriodHandler,
)
payrollRouter.get(
  '/periods/:id',
  requirePermission(PERMISSIONS.PAYROLL_VIEW),
  validate({ params: idParamsSchema }),
  getPeriodHandler,
)
payrollRouter.patch(
  '/periods/:id',
  requirePermission(PERMISSIONS.PAYROLL_CREATE),
  validate({ params: idParamsSchema, body: updatePeriodBodySchema }),
  updatePeriodHandler,
)
payrollRouter.post(
  '/periods/:id/cancel',
  requirePermission(PERMISSIONS.PAYROLL_CANCEL),
  validate({ params: idParamsSchema }),
  cancelPeriodHandler,
)

payrollRouter.get(
  '/runs',
  requirePermission(PERMISSIONS.PAYROLL_VIEW),
  validate({ query: listPayrollQuerySchema }),
  listRunsHandler,
)
payrollRouter.post(
  '/runs',
  requirePermission(PERMISSIONS.PAYROLL_CREATE),
  validate({ body: createRunBodySchema }),
  createRunHandler,
)
payrollRouter.get(
  '/runs/:id',
  requirePermission(PERMISSIONS.PAYROLL_VIEW),
  validate({ params: idParamsSchema }),
  getRunHandler,
)
payrollRouter.get(
  '/runs/:id/review',
  requirePermission(PERMISSIONS.PAYROLL_VIEW),
  validate({ params: idParamsSchema }),
  reviewRunHandler,
)
payrollRouter.get(
  '/runs/:id/payslips',
  requirePermission(PERMISSIONS.PAYROLL_PAYSLIP_VIEW),
  validate({ params: idParamsSchema }),
  listRunPayslipsHandler,
)
payrollRouter.post(
  '/runs/:id/calculate',
  requirePermission(PERMISSIONS.PAYROLL_CALCULATE),
  validate({ params: idParamsSchema, body: calculateRunBodySchema }),
  calculateRunHandler,
)
payrollRouter.post(
  '/runs/:id/submit',
  requirePermission(PERMISSIONS.PAYROLL_CALCULATE),
  validate({ params: idParamsSchema }),
  submitRunHandler,
)
payrollRouter.post(
  '/runs/:id/approve',
  requirePermission(PERMISSIONS.PAYROLL_APPROVE),
  validate({ params: idParamsSchema }),
  approveRunHandler,
)
payrollRouter.post(
  '/runs/:id/cancel',
  requirePermission(PERMISSIONS.PAYROLL_CANCEL),
  validate({ params: idParamsSchema }),
  cancelRunHandler,
)
payrollRouter.post(
  '/runs/:id/pay',
  requirePermission(PERMISSIONS.PAYROLL_PAY),
  validate({ params: idParamsSchema, body: payRunBodySchema }),
  payRunHandler,
)

payrollRouter.get(
  '/payslips',
  requirePermission(PERMISSIONS.PAYROLL_PAYSLIP_VIEW),
  validate({ query: listPayrollQuerySchema }),
  listPayslipsHandler,
)
payrollRouter.get(
  '/payslips/:id',
  requirePermission(PERMISSIONS.PAYROLL_PAYSLIP_VIEW),
  validate({ params: idParamsSchema }),
  getPayslipHandler,
)
payrollRouter.get(
  '/payslips/:id/download',
  requirePermission(PERMISSIONS.PAYROLL_PAYSLIP_DOWNLOAD),
  validate({ params: idParamsSchema }),
  downloadPayslipHandler,
)

payrollRouter.get(
  '/bonuses',
  requirePermission(PERMISSIONS.PAYROLL_VIEW),
  validate({ query: listPayrollQuerySchema }),
  listBonusesHandler,
)
payrollRouter.post(
  '/bonuses',
  requirePermission(PERMISSIONS.PAYROLL_ADJUST),
  validate({ body: createBonusBodySchema }),
  createBonusHandler,
)
payrollRouter.post(
  '/bonuses/:id/approve',
  requirePermission(PERMISSIONS.PAYROLL_APPROVE),
  validate({ params: idParamsSchema }),
  approveBonusHandler,
)

payrollRouter.get(
  '/deductions',
  requirePermission(PERMISSIONS.PAYROLL_VIEW),
  validate({ query: listPayrollQuerySchema }),
  listDeductionsHandler,
)
payrollRouter.post(
  '/deductions',
  requirePermission(PERMISSIONS.PAYROLL_ADJUST),
  validate({ body: createDeductionBodySchema }),
  createDeductionHandler,
)
payrollRouter.post(
  '/deductions/:id/approve',
  requirePermission(PERMISSIONS.PAYROLL_APPROVE),
  validate({ params: idParamsSchema }),
  approveDeductionHandler,
)

payrollRouter.get(
  '/adjustments',
  requirePermission(PERMISSIONS.PAYROLL_VIEW),
  validate({ query: listPayrollQuerySchema }),
  listAdjustmentsHandler,
)
payrollRouter.post(
  '/adjustments',
  requirePermission(PERMISSIONS.PAYROLL_ADJUST),
  validate({ body: createAdjustmentBodySchema }),
  createAdjustmentHandler,
)
payrollRouter.post(
  '/adjustments/:id/approve',
  requirePermission(PERMISSIONS.PAYROLL_APPROVE),
  validate({ params: idParamsSchema }),
  approveAdjustmentHandler,
)

payrollRouter.post(
  '/overtime',
  requirePermission(PERMISSIONS.PAYROLL_ADJUST),
  validate({ body: createOvertimeBodySchema }),
  createOvertimeHandler,
)
payrollRouter.post(
  '/overtime/:id/approve',
  requirePermission(PERMISSIONS.PAYROLL_APPROVE),
  validate({ params: idParamsSchema }),
  approveOvertimeHandler,
)

payrollRouter.get(
  '/advances',
  requirePermission(PERMISSIONS.PAYROLL_VIEW),
  validate({ query: listPayrollQuerySchema }),
  listAdvancesHandler,
)
payrollRouter.post(
  '/advances',
  requirePermission(PERMISSIONS.PAYROLL_ADJUST),
  validate({ body: createAdvanceBodySchema }),
  createAdvanceHandler,
)
payrollRouter.post(
  '/advances/:id/approve',
  requirePermission(PERMISSIONS.PAYROLL_APPROVE),
  validate({ params: idParamsSchema }),
  approveAdvanceHandler,
)

payrollRouter.get(
  '/payments',
  requirePermission(PERMISSIONS.PAYROLL_PAYMENT_VIEW),
  validate({ query: listPayrollQuerySchema }),
  listPaymentsHandler,
)
