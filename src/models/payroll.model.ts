import { Schema, model } from 'mongoose'
import {
  ADVANCE_STATUSES,
  BONUS_TYPES,
  CALCULATION_METHODS,
  COMPENSATION_ASSIGNMENT_STATUSES,
  DEDUCTION_TYPES,
  ENTITY_ACTIVE_STATUSES,
  PAYROLL_ADJUSTMENT_DIRECTIONS,
  PAYROLL_FREQUENCIES,
  PAYROLL_INPUT_STATUSES,
  PAYROLL_PAYMENT_METHODS,
  PAYROLL_PAYMENT_STATUSES,
  PAYROLL_PERIOD_STATUSES,
  PAYROLL_RUN_STATUSES,
  PAYSLIP_STATUSES,
  SALARY_COMPONENT_CATEGORIES,
  SALARY_COMPONENT_TYPES,
} from '../constants/payroll.js'

const moneyString = { type: String, required: true, trim: true, maxlength: 20 }

const salaryComponentSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity' },
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 32 },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    nameAr: { type: String, trim: true, maxlength: 200 },
    componentType: { type: String, required: true, enum: Object.values(SALARY_COMPONENT_TYPES) },
    category: { type: String, required: true, enum: Object.values(SALARY_COMPONENT_CATEGORIES) },
    calculationMethod: {
      type: String,
      required: true,
      enum: Object.values(CALCULATION_METHODS),
      default: CALCULATION_METHODS.FIXED,
    },
    fixedAmount: { type: String, trim: true, maxlength: 20 },
    percentage: { type: String, trim: true, maxlength: 20 },
    taxable: { type: Boolean, default: true },
    status: {
      type: String,
      required: true,
      enum: Object.values(ENTITY_ACTIVE_STATUSES),
      default: ENTITY_ACTIVE_STATUSES.ACTIVE,
    },
    effectiveFrom: { type: Date, required: true },
    effectiveTo: { type: Date },
    description: { type: String, trim: true, maxlength: 2000 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'salary_components' },
)
salaryComponentSchema.index({ organizationId: 1, code: 1 }, { unique: true })
salaryComponentSchema.index({ organizationId: 1, status: 1, componentType: 1 })

const structureLineSchema = new Schema(
  {
    salaryComponentId: { type: Schema.Types.ObjectId, ref: 'SalaryComponent', required: true },
    calculationMethod: { type: String, enum: Object.values(CALCULATION_METHODS) },
    fixedAmount: { type: String, trim: true, maxlength: 20 },
    percentage: { type: String, trim: true, maxlength: 20 },
  },
  { _id: false },
)

const compensationStructureSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity' },
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 32 },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    currency: { type: String, required: true, uppercase: true, maxlength: 3, default: 'AED' },
    status: {
      type: String,
      required: true,
      enum: Object.values(ENTITY_ACTIVE_STATUSES),
      default: ENTITY_ACTIVE_STATUSES.ACTIVE,
    },
    lines: { type: [structureLineSchema], default: [] },
    description: { type: String, trim: true, maxlength: 2000 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'compensation_structures' },
)
compensationStructureSchema.index({ organizationId: 1, code: 1 }, { unique: true })

const assignmentLineSchema = new Schema(
  {
    salaryComponentId: { type: Schema.Types.ObjectId, ref: 'SalaryComponent', required: true },
    componentType: { type: String, required: true, enum: Object.values(SALARY_COMPONENT_TYPES) },
    category: { type: String, required: true, enum: Object.values(SALARY_COMPONENT_CATEGORIES) },
    code: { type: String, required: true, trim: true, maxlength: 32 },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    calculationMethod: { type: String, required: true, enum: Object.values(CALCULATION_METHODS) },
    fixedAmount: { type: String, trim: true, maxlength: 20 },
    percentage: { type: String, trim: true, maxlength: 20 },
    taxable: { type: Boolean, default: true },
  },
  { _id: false },
)

const compensationAssignmentSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    compensationStructureId: { type: Schema.Types.ObjectId, ref: 'CompensationStructure' },
    currency: { type: String, required: true, uppercase: true, maxlength: 3 },
    effectiveFrom: { type: Date, required: true },
    effectiveTo: { type: Date },
    status: {
      type: String,
      required: true,
      enum: Object.values(COMPENSATION_ASSIGNMENT_STATUSES),
      default: COMPENSATION_ASSIGNMENT_STATUSES.ACTIVE,
    },
    isPrimary: { type: Boolean, default: true },
    lines: { type: [assignmentLineSchema], default: [] },
    basicSalary: moneyString,
    notes: { type: String, trim: true, maxlength: 2000 },
    changeReason: { type: String, trim: true, maxlength: 500 },
    previousAssignmentId: { type: Schema.Types.ObjectId, ref: 'EmployeeCompensationAssignment' },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'employee_compensation_assignments' },
)
compensationAssignmentSchema.index({ organizationId: 1, employeeId: 1, effectiveFrom: -1 })
compensationAssignmentSchema.index({ organizationId: 1, employeeId: 1, status: 1, isPrimary: 1 })

const compensationHistorySchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    previousAssignmentId: { type: Schema.Types.ObjectId, ref: 'EmployeeCompensationAssignment' },
    newAssignmentId: { type: Schema.Types.ObjectId, ref: 'EmployeeCompensationAssignment', required: true },
    previousBasicSalary: { type: String, trim: true, maxlength: 20 },
    newBasicSalary: moneyString,
    currency: { type: String, required: true, uppercase: true, maxlength: 3 },
    effectiveFrom: { type: Date, required: true },
    reason: { type: String, trim: true, maxlength: 500 },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'compensation_history' },
)
compensationHistorySchema.index({ organizationId: 1, employeeId: 1, createdAt: -1 })

const payrollPeriodSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    periodNumber: { type: String, required: true, trim: true, maxlength: 32 },
    frequency: {
      type: String,
      required: true,
      enum: Object.values(PAYROLL_FREQUENCIES),
      default: PAYROLL_FREQUENCIES.MONTHLY,
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    payDate: { type: Date, required: true },
    status: {
      type: String,
      required: true,
      enum: Object.values(PAYROLL_PERIOD_STATUSES),
      default: PAYROLL_PERIOD_STATUSES.OPEN,
    },
    currency: { type: String, required: true, uppercase: true, maxlength: 3, default: 'AED' },
    notes: { type: String, trim: true, maxlength: 2000 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'payroll_periods' },
)
payrollPeriodSchema.index(
  { organizationId: 1, legalEntityId: 1, frequency: 1, periodNumber: 1 },
  { unique: true },
)
payrollPeriodSchema.index({ organizationId: 1, legalEntityId: 1, startDate: 1, endDate: 1 })
payrollPeriodSchema.index({ organizationId: 1, status: 1 })

const payrollRunSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
    payrollPeriodId: { type: Schema.Types.ObjectId, ref: 'PayrollPeriod', required: true },
    runNumber: { type: String, required: true, trim: true, maxlength: 32 },
    status: {
      type: String,
      required: true,
      enum: Object.values(PAYROLL_RUN_STATUSES),
      default: PAYROLL_RUN_STATUSES.OPEN,
    },
    currency: { type: String, required: true, uppercase: true, maxlength: 3 },
    calculationVersion: { type: Number, required: true, default: 1 },
    employeeCount: { type: Number, default: 0 },
    exceptionCount: { type: Number, default: 0 },
    grossTotal: { type: String, trim: true, maxlength: 20, default: '0.00' },
    deductionTotal: { type: String, trim: true, maxlength: 20, default: '0.00' },
    netTotal: { type: String, trim: true, maxlength: 20, default: '0.00' },
    employerCostTotal: { type: String, trim: true, maxlength: 20, default: '0.00' },
    calculatedAt: { type: Date },
    calculatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    submittedAt: { type: Date },
    submittedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    paidAt: { type: Date },
    paidBy: { type: Schema.Types.ObjectId, ref: 'User' },
    accountingJournalId: { type: Schema.Types.ObjectId, ref: 'Journal' },
    paymentJournalId: { type: Schema.Types.ObjectId, ref: 'Journal' },
    recalculationCount: { type: Number, default: 0 },
    lastRecalculationReason: { type: String, trim: true, maxlength: 500 },
    notes: { type: String, trim: true, maxlength: 2000 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'payroll_runs' },
)
payrollRunSchema.index({ organizationId: 1, runNumber: 1 }, { unique: true })
payrollRunSchema.index({ organizationId: 1, payrollPeriodId: 1, createdAt: -1 })
payrollRunSchema.index({ organizationId: 1, status: 1 })

const lineSnapshotSchema = new Schema(
  {
    salaryComponentId: { type: Schema.Types.ObjectId },
    code: { type: String, required: true },
    name: { type: String, required: true },
    componentType: { type: String, required: true },
    category: { type: String, required: true },
    amount: moneyString,
    source: { type: String, required: true, maxlength: 40 },
  },
  { _id: false },
)

const payrollCalculationSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    payrollPeriodId: { type: Schema.Types.ObjectId, ref: 'PayrollPeriod', required: true },
    payrollRunId: { type: Schema.Types.ObjectId, ref: 'PayrollRun', required: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    employeeNumber: { type: String, required: true, trim: true, maxlength: 32 },
    compensationAssignmentId: { type: Schema.Types.ObjectId, ref: 'EmployeeCompensationAssignment' },
    calculationVersion: { type: Number, required: true },
    currency: { type: String, required: true, uppercase: true, maxlength: 3 },
    earnings: { type: [lineSnapshotSchema], default: [] },
    deductions: { type: [lineSnapshotSchema], default: [] },
    employerContributions: { type: [lineSnapshotSchema], default: [] },
    grossPay: moneyString,
    totalDeductions: moneyString,
    netPay: moneyString,
    employerCost: moneyString,
    exceptions: {
      type: [
        {
          code: { type: String, required: true },
          message: { type: String, required: true },
        },
      ],
      default: [],
    },
    hasExceptions: { type: Boolean, default: false },
    snapshot: { type: Schema.Types.Mixed },
    calculatedAt: { type: Date, required: true },
    calculatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, collection: 'payroll_calculations' },
)
payrollCalculationSchema.index(
  { organizationId: 1, payrollRunId: 1, employeeId: 1 },
  { unique: true },
)
payrollCalculationSchema.index({ organizationId: 1, payrollPeriodId: 1, employeeId: 1 })

const payrollBonusSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    payrollPeriodId: { type: Schema.Types.ObjectId, ref: 'PayrollPeriod' },
    bonusType: { type: String, required: true, enum: Object.values(BONUS_TYPES) },
    amount: moneyString,
    currency: { type: String, required: true, uppercase: true, maxlength: 3 },
    reason: { type: String, trim: true, maxlength: 500 },
    notes: { type: String, trim: true, maxlength: 2000 },
    effectiveDate: { type: Date, required: true },
    status: {
      type: String,
      required: true,
      enum: Object.values(PAYROLL_INPUT_STATUSES),
      default: PAYROLL_INPUT_STATUSES.DRAFT,
    },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, collection: 'payroll_bonuses' },
)
payrollBonusSchema.index({ organizationId: 1, employeeId: 1, status: 1, effectiveDate: 1 })
payrollBonusSchema.index({ organizationId: 1, payrollPeriodId: 1, status: 1 })

const payrollDeductionSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    payrollPeriodId: { type: Schema.Types.ObjectId, ref: 'PayrollPeriod' },
    deductionType: { type: String, required: true, enum: Object.values(DEDUCTION_TYPES) },
    amount: moneyString,
    currency: { type: String, required: true, uppercase: true, maxlength: 3 },
    reason: { type: String, trim: true, maxlength: 500 },
    effectiveDate: { type: Date, required: true },
    advanceId: { type: Schema.Types.ObjectId, ref: 'EmployeeAdvance' },
    status: {
      type: String,
      required: true,
      enum: Object.values(PAYROLL_INPUT_STATUSES),
      default: PAYROLL_INPUT_STATUSES.DRAFT,
    },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, collection: 'payroll_deductions' },
)
payrollDeductionSchema.index({ organizationId: 1, employeeId: 1, status: 1, effectiveDate: 1 })
payrollDeductionSchema.index({ organizationId: 1, payrollPeriodId: 1, status: 1 })

const payrollAdjustmentSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    payrollPeriodId: { type: Schema.Types.ObjectId, ref: 'PayrollPeriod', required: true },
    direction: {
      type: String,
      required: true,
      enum: Object.values(PAYROLL_ADJUSTMENT_DIRECTIONS),
    },
    amount: moneyString,
    currency: { type: String, required: true, uppercase: true, maxlength: 3 },
    reason: { type: String, required: true, trim: true, maxlength: 500 },
    status: {
      type: String,
      required: true,
      enum: Object.values(PAYROLL_INPUT_STATUSES),
      default: PAYROLL_INPUT_STATUSES.DRAFT,
    },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, collection: 'payroll_adjustments' },
)
payrollAdjustmentSchema.index({ organizationId: 1, payrollPeriodId: 1, status: 1 })
payrollAdjustmentSchema.index({ organizationId: 1, employeeId: 1, status: 1 })

const payrollOvertimeSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    payrollPeriodId: { type: Schema.Types.ObjectId, ref: 'PayrollPeriod' },
    workDate: { type: Date, required: true },
    hours: { type: String, required: true, trim: true, maxlength: 12 },
    rate: moneyString,
    amount: moneyString,
    currency: { type: String, required: true, uppercase: true, maxlength: 3 },
    reason: { type: String, trim: true, maxlength: 500 },
    status: {
      type: String,
      required: true,
      enum: Object.values(PAYROLL_INPUT_STATUSES),
      default: PAYROLL_INPUT_STATUSES.DRAFT,
    },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, collection: 'payroll_overtime' },
)
payrollOvertimeSchema.index({ organizationId: 1, employeeId: 1, workDate: 1 })
payrollOvertimeSchema.index({ organizationId: 1, payrollPeriodId: 1, status: 1 })

const employeeAdvanceSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    principalAmount: moneyString,
    installmentAmount: moneyString,
    remainingBalance: moneyString,
    currency: { type: String, required: true, uppercase: true, maxlength: 3 },
    startDate: { type: Date, required: true },
    status: {
      type: String,
      required: true,
      enum: Object.values(ADVANCE_STATUSES),
      default: ADVANCE_STATUSES.DRAFT,
    },
    notes: { type: String, trim: true, maxlength: 2000 },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, collection: 'employee_advances' },
)
employeeAdvanceSchema.index({ organizationId: 1, employeeId: 1, status: 1 })

const payslipSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    payrollPeriodId: { type: Schema.Types.ObjectId, ref: 'PayrollPeriod', required: true },
    payrollRunId: { type: Schema.Types.ObjectId, ref: 'PayrollRun', required: true },
    payrollCalculationId: {
      type: Schema.Types.ObjectId,
      ref: 'PayrollCalculation',
      required: true,
    },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    employeeNumber: { type: String, required: true, trim: true, maxlength: 32 },
    payslipNumber: { type: String, required: true, trim: true, maxlength: 40 },
    currency: { type: String, required: true, uppercase: true, maxlength: 3 },
    payDate: { type: Date, required: true },
    earnings: { type: [lineSnapshotSchema], default: [] },
    deductions: { type: [lineSnapshotSchema], default: [] },
    employerContributions: { type: [lineSnapshotSchema], default: [] },
    grossSalary: moneyString,
    totalDeductions: moneyString,
    netSalary: moneyString,
    employerCost: moneyString,
    status: {
      type: String,
      required: true,
      enum: Object.values(PAYSLIP_STATUSES),
      default: PAYSLIP_STATUSES.GENERATED,
    },
    documentPayload: { type: Schema.Types.Mixed },
    generatedAt: { type: Date, required: true },
    generatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, collection: 'payslips' },
)
payslipSchema.index({ organizationId: 1, payslipNumber: 1 }, { unique: true })
payslipSchema.index({ organizationId: 1, payrollRunId: 1, employeeId: 1 }, { unique: true })
payslipSchema.index({ organizationId: 1, employeeId: 1, payDate: -1 })

const payrollPaymentSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    payrollRunId: { type: Schema.Types.ObjectId, ref: 'PayrollRun', required: true },
    payrollPeriodId: { type: Schema.Types.ObjectId, ref: 'PayrollPeriod', required: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    payslipId: { type: Schema.Types.ObjectId, ref: 'Payslip' },
    amount: moneyString,
    currency: { type: String, required: true, uppercase: true, maxlength: 3 },
    paymentDate: { type: Date },
    paymentMethod: {
      type: String,
      required: true,
      enum: Object.values(PAYROLL_PAYMENT_METHODS),
      default: PAYROLL_PAYMENT_METHODS.BANK_TRANSFER,
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(PAYROLL_PAYMENT_STATUSES),
      default: PAYROLL_PAYMENT_STATUSES.PENDING,
    },
    externalReference: { type: String, trim: true, maxlength: 120 },
    reconciliationReference: { type: String, trim: true, maxlength: 120 },
    failureReason: { type: String, trim: true, maxlength: 500 },
    idempotencyKey: { type: String, required: true, trim: true, maxlength: 120 },
    provider: { type: String, trim: true, maxlength: 80 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'payroll_payments' },
)
payrollPaymentSchema.index({ organizationId: 1, idempotencyKey: 1 }, { unique: true })
payrollPaymentSchema.index({ organizationId: 1, payrollRunId: 1, employeeId: 1 }, { unique: true })
payrollPaymentSchema.index({ organizationId: 1, status: 1, paymentDate: -1 })

const payrollApprovalSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    payrollRunId: { type: Schema.Types.ObjectId, ref: 'PayrollRun', required: true },
    action: { type: String, required: true, maxlength: 40 },
    actorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    notes: { type: String, trim: true, maxlength: 1000 },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true, collection: 'payroll_approvals' },
)
payrollApprovalSchema.index({ organizationId: 1, payrollRunId: 1, createdAt: -1 })

const payrollNotificationIntentSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee' },
    payrollRunId: { type: Schema.Types.ObjectId, ref: 'PayrollRun' },
    payslipId: { type: Schema.Types.ObjectId, ref: 'Payslip' },
    intentKey: { type: String, required: true, trim: true, maxlength: 200 },
    kind: { type: String, required: true, trim: true, maxlength: 80 },
    payload: { type: Schema.Types.Mixed },
  },
  { timestamps: true, collection: 'payroll_notification_intents' },
)
payrollNotificationIntentSchema.index({ intentKey: 1 }, { unique: true })

const payrollCounterSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    name: { type: String, required: true, trim: true, maxlength: 64 },
    seq: { type: Number, required: true, default: 0 },
  },
  { timestamps: true, collection: 'payroll_counters' },
)
payrollCounterSchema.index({ organizationId: 1, name: 1 }, { unique: true })

export const SalaryComponentModel = model('SalaryComponent', salaryComponentSchema)
export const CompensationStructureModel = model('CompensationStructure', compensationStructureSchema)
export const EmployeeCompensationAssignmentModel = model(
  'EmployeeCompensationAssignment',
  compensationAssignmentSchema,
)
export const CompensationHistoryModel = model('CompensationHistory', compensationHistorySchema)
export const PayrollPeriodModel = model('PayrollPeriod', payrollPeriodSchema)
export const PayrollRunModel = model('PayrollRun', payrollRunSchema)
export const PayrollCalculationModel = model('PayrollCalculation', payrollCalculationSchema)
export const PayrollBonusModel = model('PayrollBonus', payrollBonusSchema)
export const PayrollDeductionModel = model('PayrollDeduction', payrollDeductionSchema)
export const PayrollAdjustmentModel = model('PayrollAdjustment', payrollAdjustmentSchema)
export const PayrollOvertimeModel = model('PayrollOvertime', payrollOvertimeSchema)
export const EmployeeAdvanceModel = model('EmployeeAdvance', employeeAdvanceSchema)
export const PayslipModel = model('Payslip', payslipSchema)
export const PayrollPaymentModel = model('PayrollPayment', payrollPaymentSchema)
export const PayrollApprovalModel = model('PayrollApproval', payrollApprovalSchema)
export const PayrollNotificationIntentModel = model(
  'PayrollNotificationIntent',
  payrollNotificationIntentSchema,
)
export const PayrollCounterModel = model('PayrollCounter', payrollCounterSchema)
