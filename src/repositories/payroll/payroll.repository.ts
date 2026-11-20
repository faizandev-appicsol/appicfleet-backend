import type { FilterQuery } from 'mongoose'
import {
  ADVANCE_STATUSES,
  COMPENSATION_ASSIGNMENT_STATUSES,
  PAYROLL_INPUT_STATUSES,
  PAYROLL_PAYMENT_STATUSES,
  PAYROLL_PERIOD_STATUSES,
  PAYROLL_RUN_STATUSES,
  PAYSLIP_STATUSES,
  type AdvanceStatus,
  type BonusType,
  type CalculationMethod,
  type CompensationAssignmentStatus,
  type DeductionType,
  type PayrollAdjustmentDirection,
  type PayrollFrequency,
  type PayrollInputStatus,
  type PayrollPaymentMethod,
  type PayrollPaymentStatus,
  type PayrollPeriodStatus,
  type PayrollRunStatus,
  type PayslipStatus,
  type SalaryComponentCategory,
  type SalaryComponentType,
} from '../../constants/payroll.js'
import {
  CompensationHistoryModel,
  CompensationStructureModel,
  EmployeeAdvanceModel,
  EmployeeCompensationAssignmentModel,
  PayrollAdjustmentModel,
  PayrollApprovalModel,
  PayrollBonusModel,
  PayrollCalculationModel,
  PayrollCounterModel,
  PayrollDeductionModel,
  PayrollNotificationIntentModel,
  PayrollOvertimeModel,
  PayrollPaymentModel,
  PayrollPeriodModel,
  PayrollRunModel,
  PayslipModel,
  SalaryComponentModel,
} from '../../models/payroll.model.js'
import { toObjectId } from '../object-id.js'

type LeanDoc = Record<string, unknown> & { _id: { toString(): string } }

function sid(value: unknown): string {
  return String(value)
}

function oid(value?: string | null) {
  return value ? toObjectId(value) : undefined
}

function mapBase(doc: LeanDoc) {
  return {
    id: sid(doc._id),
    organizationId: sid(doc.organizationId),
    createdAt: doc.createdAt as Date,
    updatedAt: doc.updatedAt as Date,
  }
}

export type SalaryComponentRecord = {
  id: string
  organizationId: string
  legalEntityId?: string
  code: string
  name: string
  nameAr?: string
  componentType: SalaryComponentType
  category: SalaryComponentCategory
  calculationMethod: CalculationMethod
  fixedAmount?: string
  percentage?: string
  taxable: boolean
  status: string
  effectiveFrom: Date
  effectiveTo?: Date
  description?: string
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export type CompensationStructureRecord = {
  id: string
  organizationId: string
  legalEntityId?: string
  code: string
  name: string
  currency: string
  status: string
  lines: Array<{
    salaryComponentId: string
    calculationMethod?: CalculationMethod
    fixedAmount?: string
    percentage?: string
  }>
  description?: string
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export type AssignmentLineRecord = {
  salaryComponentId: string
  componentType: SalaryComponentType
  category: SalaryComponentCategory
  code: string
  name: string
  calculationMethod: CalculationMethod
  fixedAmount?: string
  percentage?: string
  taxable: boolean
}

export type CompensationAssignmentRecord = {
  id: string
  organizationId: string
  legalEntityId: string
  branchId: string
  employeeId: string
  compensationStructureId?: string
  currency: string
  effectiveFrom: Date
  effectiveTo?: Date
  status: CompensationAssignmentStatus
  isPrimary: boolean
  lines: AssignmentLineRecord[]
  basicSalary: string
  notes?: string
  changeReason?: string
  previousAssignmentId?: string
  approvedBy?: string
  approvedAt?: Date
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export type PayrollPeriodRecord = {
  id: string
  organizationId: string
  legalEntityId: string
  branchId?: string
  name: string
  periodNumber: string
  frequency: PayrollFrequency
  startDate: Date
  endDate: Date
  payDate: Date
  status: PayrollPeriodStatus
  currency: string
  notes?: string
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export type PayrollRunRecord = {
  id: string
  organizationId: string
  legalEntityId: string
  branchId?: string
  payrollPeriodId: string
  runNumber: string
  status: PayrollRunStatus
  currency: string
  calculationVersion: number
  employeeCount: number
  exceptionCount: number
  grossTotal: string
  deductionTotal: string
  netTotal: string
  employerCostTotal: string
  calculatedAt?: Date
  calculatedBy?: string
  submittedAt?: Date
  submittedBy?: string
  approvedAt?: Date
  approvedBy?: string
  paidAt?: Date
  paidBy?: string
  accountingJournalId?: string
  paymentJournalId?: string
  recalculationCount: number
  lastRecalculationReason?: string
  notes?: string
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export type CalculationLineRecord = {
  salaryComponentId?: string
  code: string
  name: string
  componentType: string
  category: string
  amount: string
  source: string
}

export type PayrollCalculationRecord = {
  id: string
  organizationId: string
  legalEntityId: string
  branchId: string
  payrollPeriodId: string
  payrollRunId: string
  employeeId: string
  employeeNumber: string
  compensationAssignmentId?: string
  calculationVersion: number
  currency: string
  earnings: CalculationLineRecord[]
  deductions: CalculationLineRecord[]
  employerContributions: CalculationLineRecord[]
  grossPay: string
  totalDeductions: string
  netPay: string
  employerCost: string
  exceptions: Array<{ code: string; message: string }>
  hasExceptions: boolean
  snapshot?: Record<string, unknown>
  calculatedAt: Date
  calculatedBy: string
  createdAt: Date
  updatedAt: Date
}

export type PayslipRecord = {
  id: string
  organizationId: string
  legalEntityId: string
  branchId: string
  payrollPeriodId: string
  payrollRunId: string
  payrollCalculationId: string
  employeeId: string
  employeeNumber: string
  payslipNumber: string
  currency: string
  payDate: Date
  earnings: CalculationLineRecord[]
  deductions: CalculationLineRecord[]
  employerContributions: CalculationLineRecord[]
  grossSalary: string
  totalDeductions: string
  netSalary: string
  employerCost: string
  status: PayslipStatus
  documentPayload?: Record<string, unknown>
  generatedAt: Date
  generatedBy: string
  createdAt: Date
  updatedAt: Date
}

export type PayrollPaymentRecord = {
  id: string
  organizationId: string
  legalEntityId: string
  branchId: string
  payrollRunId: string
  payrollPeriodId: string
  employeeId: string
  payslipId?: string
  amount: string
  currency: string
  paymentDate?: Date
  paymentMethod: PayrollPaymentMethod
  status: PayrollPaymentStatus
  externalReference?: string
  reconciliationReference?: string
  failureReason?: string
  idempotencyKey: string
  provider?: string
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export type PayrollBonusRecord = {
  id: string
  organizationId: string
  legalEntityId: string
  branchId: string
  employeeId: string
  payrollPeriodId?: string
  bonusType: BonusType
  amount: string
  currency: string
  reason?: string
  notes?: string
  effectiveDate: Date
  status: PayrollInputStatus
  approvedBy?: string
  approvedAt?: Date
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export type PayrollDeductionRecord = {
  id: string
  organizationId: string
  legalEntityId: string
  branchId: string
  employeeId: string
  payrollPeriodId?: string
  deductionType: DeductionType
  amount: string
  currency: string
  reason?: string
  effectiveDate: Date
  advanceId?: string
  status: PayrollInputStatus
  approvedBy?: string
  approvedAt?: Date
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export type PayrollAdjustmentRecord = {
  id: string
  organizationId: string
  legalEntityId: string
  branchId: string
  employeeId: string
  payrollPeriodId: string
  direction: PayrollAdjustmentDirection
  amount: string
  currency: string
  reason: string
  status: PayrollInputStatus
  approvedBy?: string
  approvedAt?: Date
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export type PayrollOvertimeRecord = {
  id: string
  organizationId: string
  legalEntityId: string
  branchId: string
  employeeId: string
  payrollPeriodId?: string
  workDate: Date
  hours: string
  rate: string
  amount: string
  currency: string
  reason?: string
  status: PayrollInputStatus
  approvedBy?: string
  approvedAt?: Date
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export type EmployeeAdvanceRecord = {
  id: string
  organizationId: string
  legalEntityId: string
  branchId: string
  employeeId: string
  principalAmount: string
  installmentAmount: string
  remainingBalance: string
  currency: string
  startDate: Date
  status: AdvanceStatus
  notes?: string
  approvedBy?: string
  approvedAt?: Date
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

function mapComponent(doc: LeanDoc): SalaryComponentRecord {
  return {
    ...mapBase(doc),
    legalEntityId: doc.legalEntityId ? sid(doc.legalEntityId) : undefined,
    code: String(doc.code),
    name: String(doc.name),
    nameAr: doc.nameAr ? String(doc.nameAr) : undefined,
    componentType: doc.componentType as SalaryComponentType,
    category: doc.category as SalaryComponentCategory,
    calculationMethod: doc.calculationMethod as CalculationMethod,
    fixedAmount: doc.fixedAmount ? String(doc.fixedAmount) : undefined,
    percentage: doc.percentage ? String(doc.percentage) : undefined,
    taxable: Boolean(doc.taxable),
    status: String(doc.status),
    effectiveFrom: doc.effectiveFrom as Date,
    effectiveTo: doc.effectiveTo as Date | undefined,
    description: doc.description ? String(doc.description) : undefined,
    createdBy: sid(doc.createdBy),
  }
}

function mapStructure(doc: LeanDoc): CompensationStructureRecord {
  const lines = Array.isArray(doc.lines) ? doc.lines : []
  return {
    ...mapBase(doc),
    legalEntityId: doc.legalEntityId ? sid(doc.legalEntityId) : undefined,
    code: String(doc.code),
    name: String(doc.name),
    currency: String(doc.currency),
    status: String(doc.status),
    lines: lines.map((line: Record<string, unknown>) => ({
      salaryComponentId: sid(line.salaryComponentId),
      calculationMethod: line.calculationMethod as CalculationMethod | undefined,
      fixedAmount: line.fixedAmount ? String(line.fixedAmount) : undefined,
      percentage: line.percentage ? String(line.percentage) : undefined,
    })),
    description: doc.description ? String(doc.description) : undefined,
    createdBy: sid(doc.createdBy),
  }
}

function mapAssignment(doc: LeanDoc): CompensationAssignmentRecord {
  const lines = Array.isArray(doc.lines) ? doc.lines : []
  return {
    ...mapBase(doc),
    legalEntityId: sid(doc.legalEntityId),
    branchId: sid(doc.branchId),
    employeeId: sid(doc.employeeId),
    compensationStructureId: doc.compensationStructureId
      ? sid(doc.compensationStructureId)
      : undefined,
    currency: String(doc.currency),
    effectiveFrom: doc.effectiveFrom as Date,
    effectiveTo: doc.effectiveTo as Date | undefined,
    status: doc.status as CompensationAssignmentStatus,
    isPrimary: Boolean(doc.isPrimary),
    lines: lines.map((line: Record<string, unknown>) => ({
      salaryComponentId: sid(line.salaryComponentId),
      componentType: line.componentType as SalaryComponentType,
      category: line.category as SalaryComponentCategory,
      code: String(line.code),
      name: String(line.name),
      calculationMethod: line.calculationMethod as CalculationMethod,
      fixedAmount: line.fixedAmount ? String(line.fixedAmount) : undefined,
      percentage: line.percentage ? String(line.percentage) : undefined,
      taxable: Boolean(line.taxable ?? true),
    })),
    basicSalary: String(doc.basicSalary),
    notes: doc.notes ? String(doc.notes) : undefined,
    changeReason: doc.changeReason ? String(doc.changeReason) : undefined,
    previousAssignmentId: doc.previousAssignmentId ? sid(doc.previousAssignmentId) : undefined,
    approvedBy: doc.approvedBy ? sid(doc.approvedBy) : undefined,
    approvedAt: doc.approvedAt as Date | undefined,
    createdBy: sid(doc.createdBy),
  }
}

function mapPeriod(doc: LeanDoc): PayrollPeriodRecord {
  return {
    ...mapBase(doc),
    legalEntityId: sid(doc.legalEntityId),
    branchId: doc.branchId ? sid(doc.branchId) : undefined,
    name: String(doc.name),
    periodNumber: String(doc.periodNumber),
    frequency: doc.frequency as PayrollFrequency,
    startDate: doc.startDate as Date,
    endDate: doc.endDate as Date,
    payDate: doc.payDate as Date,
    status: doc.status as PayrollPeriodStatus,
    currency: String(doc.currency),
    notes: doc.notes ? String(doc.notes) : undefined,
    createdBy: sid(doc.createdBy),
  }
}

function mapRun(doc: LeanDoc): PayrollRunRecord {
  return {
    ...mapBase(doc),
    legalEntityId: sid(doc.legalEntityId),
    branchId: doc.branchId ? sid(doc.branchId) : undefined,
    payrollPeriodId: sid(doc.payrollPeriodId),
    runNumber: String(doc.runNumber),
    status: doc.status as PayrollRunStatus,
    currency: String(doc.currency),
    calculationVersion: Number(doc.calculationVersion ?? 1),
    employeeCount: Number(doc.employeeCount ?? 0),
    exceptionCount: Number(doc.exceptionCount ?? 0),
    grossTotal: String(doc.grossTotal ?? '0.00'),
    deductionTotal: String(doc.deductionTotal ?? '0.00'),
    netTotal: String(doc.netTotal ?? '0.00'),
    employerCostTotal: String(doc.employerCostTotal ?? '0.00'),
    calculatedAt: doc.calculatedAt as Date | undefined,
    calculatedBy: doc.calculatedBy ? sid(doc.calculatedBy) : undefined,
    submittedAt: doc.submittedAt as Date | undefined,
    submittedBy: doc.submittedBy ? sid(doc.submittedBy) : undefined,
    approvedAt: doc.approvedAt as Date | undefined,
    approvedBy: doc.approvedBy ? sid(doc.approvedBy) : undefined,
    paidAt: doc.paidAt as Date | undefined,
    paidBy: doc.paidBy ? sid(doc.paidBy) : undefined,
    accountingJournalId: doc.accountingJournalId ? sid(doc.accountingJournalId) : undefined,
    paymentJournalId: doc.paymentJournalId ? sid(doc.paymentJournalId) : undefined,
    recalculationCount: Number(doc.recalculationCount ?? 0),
    lastRecalculationReason: doc.lastRecalculationReason
      ? String(doc.lastRecalculationReason)
      : undefined,
    notes: doc.notes ? String(doc.notes) : undefined,
    createdBy: sid(doc.createdBy),
  }
}

function mapCalcLines(value: unknown): CalculationLineRecord[] {
  if (!Array.isArray(value)) return []
  return value.map((line: Record<string, unknown>) => ({
    salaryComponentId: line.salaryComponentId ? sid(line.salaryComponentId) : undefined,
    code: String(line.code),
    name: String(line.name),
    componentType: String(line.componentType),
    category: String(line.category),
    amount: String(line.amount),
    source: String(line.source),
  }))
}

function mapCalculation(doc: LeanDoc): PayrollCalculationRecord {
  return {
    ...mapBase(doc),
    legalEntityId: sid(doc.legalEntityId),
    branchId: sid(doc.branchId),
    payrollPeriodId: sid(doc.payrollPeriodId),
    payrollRunId: sid(doc.payrollRunId),
    employeeId: sid(doc.employeeId),
    employeeNumber: String(doc.employeeNumber),
    compensationAssignmentId: doc.compensationAssignmentId
      ? sid(doc.compensationAssignmentId)
      : undefined,
    calculationVersion: Number(doc.calculationVersion),
    currency: String(doc.currency),
    earnings: mapCalcLines(doc.earnings),
    deductions: mapCalcLines(doc.deductions),
    employerContributions: mapCalcLines(doc.employerContributions),
    grossPay: String(doc.grossPay),
    totalDeductions: String(doc.totalDeductions),
    netPay: String(doc.netPay),
    employerCost: String(doc.employerCost),
    exceptions: Array.isArray(doc.exceptions)
      ? doc.exceptions.map((e: Record<string, unknown>) => ({
          code: String(e.code),
          message: String(e.message),
        }))
      : [],
    hasExceptions: Boolean(doc.hasExceptions),
    snapshot: doc.snapshot as Record<string, unknown> | undefined,
    calculatedAt: doc.calculatedAt as Date,
    calculatedBy: sid(doc.calculatedBy),
  }
}

function mapPayslip(doc: LeanDoc): PayslipRecord {
  return {
    ...mapBase(doc),
    legalEntityId: sid(doc.legalEntityId),
    branchId: sid(doc.branchId),
    payrollPeriodId: sid(doc.payrollPeriodId),
    payrollRunId: sid(doc.payrollRunId),
    payrollCalculationId: sid(doc.payrollCalculationId),
    employeeId: sid(doc.employeeId),
    employeeNumber: String(doc.employeeNumber),
    payslipNumber: String(doc.payslipNumber),
    currency: String(doc.currency),
    payDate: doc.payDate as Date,
    earnings: mapCalcLines(doc.earnings),
    deductions: mapCalcLines(doc.deductions),
    employerContributions: mapCalcLines(doc.employerContributions),
    grossSalary: String(doc.grossSalary),
    totalDeductions: String(doc.totalDeductions),
    netSalary: String(doc.netSalary),
    employerCost: String(doc.employerCost),
    status: doc.status as PayslipStatus,
    documentPayload: doc.documentPayload as Record<string, unknown> | undefined,
    generatedAt: doc.generatedAt as Date,
    generatedBy: sid(doc.generatedBy),
  }
}

function mapPayment(doc: LeanDoc): PayrollPaymentRecord {
  return {
    ...mapBase(doc),
    legalEntityId: sid(doc.legalEntityId),
    branchId: sid(doc.branchId),
    payrollRunId: sid(doc.payrollRunId),
    payrollPeriodId: sid(doc.payrollPeriodId),
    employeeId: sid(doc.employeeId),
    payslipId: doc.payslipId ? sid(doc.payslipId) : undefined,
    amount: String(doc.amount),
    currency: String(doc.currency),
    paymentDate: doc.paymentDate as Date | undefined,
    paymentMethod: doc.paymentMethod as PayrollPaymentMethod,
    status: doc.status as PayrollPaymentStatus,
    externalReference: doc.externalReference ? String(doc.externalReference) : undefined,
    reconciliationReference: doc.reconciliationReference
      ? String(doc.reconciliationReference)
      : undefined,
    failureReason: doc.failureReason ? String(doc.failureReason) : undefined,
    idempotencyKey: String(doc.idempotencyKey),
    provider: doc.provider ? String(doc.provider) : undefined,
    createdBy: sid(doc.createdBy),
  }
}

function mapBonus(doc: LeanDoc): PayrollBonusRecord {
  return {
    ...mapBase(doc),
    legalEntityId: sid(doc.legalEntityId),
    branchId: sid(doc.branchId),
    employeeId: sid(doc.employeeId),
    payrollPeriodId: doc.payrollPeriodId ? sid(doc.payrollPeriodId) : undefined,
    bonusType: doc.bonusType as BonusType,
    amount: String(doc.amount),
    currency: String(doc.currency),
    reason: doc.reason ? String(doc.reason) : undefined,
    notes: doc.notes ? String(doc.notes) : undefined,
    effectiveDate: doc.effectiveDate as Date,
    status: doc.status as PayrollInputStatus,
    approvedBy: doc.approvedBy ? sid(doc.approvedBy) : undefined,
    approvedAt: doc.approvedAt as Date | undefined,
    createdBy: sid(doc.createdBy),
  }
}

function mapDeduction(doc: LeanDoc): PayrollDeductionRecord {
  return {
    ...mapBase(doc),
    legalEntityId: sid(doc.legalEntityId),
    branchId: sid(doc.branchId),
    employeeId: sid(doc.employeeId),
    payrollPeriodId: doc.payrollPeriodId ? sid(doc.payrollPeriodId) : undefined,
    deductionType: doc.deductionType as DeductionType,
    amount: String(doc.amount),
    currency: String(doc.currency),
    reason: doc.reason ? String(doc.reason) : undefined,
    effectiveDate: doc.effectiveDate as Date,
    advanceId: doc.advanceId ? sid(doc.advanceId) : undefined,
    status: doc.status as PayrollInputStatus,
    approvedBy: doc.approvedBy ? sid(doc.approvedBy) : undefined,
    approvedAt: doc.approvedAt as Date | undefined,
    createdBy: sid(doc.createdBy),
  }
}

function mapAdjustment(doc: LeanDoc): PayrollAdjustmentRecord {
  return {
    ...mapBase(doc),
    legalEntityId: sid(doc.legalEntityId),
    branchId: sid(doc.branchId),
    employeeId: sid(doc.employeeId),
    payrollPeriodId: sid(doc.payrollPeriodId),
    direction: doc.direction as PayrollAdjustmentDirection,
    amount: String(doc.amount),
    currency: String(doc.currency),
    reason: String(doc.reason),
    status: doc.status as PayrollInputStatus,
    approvedBy: doc.approvedBy ? sid(doc.approvedBy) : undefined,
    approvedAt: doc.approvedAt as Date | undefined,
    createdBy: sid(doc.createdBy),
  }
}

function mapOvertime(doc: LeanDoc): PayrollOvertimeRecord {
  return {
    ...mapBase(doc),
    legalEntityId: sid(doc.legalEntityId),
    branchId: sid(doc.branchId),
    employeeId: sid(doc.employeeId),
    payrollPeriodId: doc.payrollPeriodId ? sid(doc.payrollPeriodId) : undefined,
    workDate: doc.workDate as Date,
    hours: String(doc.hours),
    rate: String(doc.rate),
    amount: String(doc.amount),
    currency: String(doc.currency),
    reason: doc.reason ? String(doc.reason) : undefined,
    status: doc.status as PayrollInputStatus,
    approvedBy: doc.approvedBy ? sid(doc.approvedBy) : undefined,
    approvedAt: doc.approvedAt as Date | undefined,
    createdBy: sid(doc.createdBy),
  }
}

function mapAdvance(doc: LeanDoc): EmployeeAdvanceRecord {
  return {
    ...mapBase(doc),
    legalEntityId: sid(doc.legalEntityId),
    branchId: sid(doc.branchId),
    employeeId: sid(doc.employeeId),
    principalAmount: String(doc.principalAmount),
    installmentAmount: String(doc.installmentAmount),
    remainingBalance: String(doc.remainingBalance),
    currency: String(doc.currency),
    startDate: doc.startDate as Date,
    status: doc.status as AdvanceStatus,
    notes: doc.notes ? String(doc.notes) : undefined,
    approvedBy: doc.approvedBy ? sid(doc.approvedBy) : undefined,
    approvedAt: doc.approvedAt as Date | undefined,
    createdBy: sid(doc.createdBy),
  }
}

export async function nextPayrollSequence(organizationId: string, name: string): Promise<number> {
  const updated = await PayrollCounterModel.findOneAndUpdate(
    { organizationId: oid(organizationId), name },
    { $inc: { seq: 1 } },
    { upsert: true, new: true },
  ).lean()
  return Number((updated as LeanDoc).seq)
}

export async function insertSalaryComponent(data: Record<string, unknown>) {
  const doc = await SalaryComponentModel.create({
    ...data,
    organizationId: oid(String(data.organizationId)),
    legalEntityId: oid(data.legalEntityId as string | undefined),
    createdBy: oid(String(data.createdBy)),
  })
  return mapComponent(doc.toObject() as LeanDoc)
}

export async function findSalaryComponentById(id: string) {
  const doc = await SalaryComponentModel.findById(oid(id)).lean()
  return doc ? mapComponent(doc as LeanDoc) : null
}

export async function listSalaryComponents(filter: {
  organizationId: string
  status?: string
  componentType?: string
  q?: string
  limit: number
  skip: number
}) {
  const query: FilterQuery<typeof SalaryComponentModel> = {
    organizationId: oid(filter.organizationId),
  }
  if (filter.status) query.status = filter.status
  if (filter.componentType) query.componentType = filter.componentType
  if (filter.q) {
    query.$or = [
      { code: new RegExp(filter.q, 'i') },
      { name: new RegExp(filter.q, 'i') },
    ]
  }
  const [items, total] = await Promise.all([
    SalaryComponentModel.find(query).sort({ code: 1 }).skip(filter.skip).limit(filter.limit).lean(),
    SalaryComponentModel.countDocuments(query),
  ])
  return { items: (items as LeanDoc[]).map(mapComponent), total }
}

export async function updateSalaryComponent(id: string, patch: Record<string, unknown>) {
  const doc = await SalaryComponentModel.findByIdAndUpdate(oid(id), { $set: patch }, { new: true }).lean()
  return doc ? mapComponent(doc as LeanDoc) : null
}

export async function insertCompensationStructure(data: Record<string, unknown>) {
  const doc = await CompensationStructureModel.create({
    ...data,
    organizationId: oid(String(data.organizationId)),
    legalEntityId: oid(data.legalEntityId as string | undefined),
    createdBy: oid(String(data.createdBy)),
    lines: Array.isArray(data.lines)
      ? data.lines.map((line: Record<string, unknown>) => ({
          ...line,
          salaryComponentId: oid(String(line.salaryComponentId)),
        }))
      : [],
  })
  return mapStructure(doc.toObject() as LeanDoc)
}

export async function findCompensationStructureById(id: string) {
  const doc = await CompensationStructureModel.findById(oid(id)).lean()
  return doc ? mapStructure(doc as LeanDoc) : null
}

export async function listCompensationStructures(filter: {
  organizationId: string
  status?: string
  q?: string
  limit: number
  skip: number
}) {
  const query: FilterQuery<typeof CompensationStructureModel> = {
    organizationId: oid(filter.organizationId),
  }
  if (filter.status) query.status = filter.status
  if (filter.q) {
    query.$or = [{ code: new RegExp(filter.q, 'i') }, { name: new RegExp(filter.q, 'i') }]
  }
  const [items, total] = await Promise.all([
    CompensationStructureModel.find(query)
      .sort({ code: 1 })
      .skip(filter.skip)
      .limit(filter.limit)
      .lean(),
    CompensationStructureModel.countDocuments(query),
  ])
  return { items: (items as LeanDoc[]).map(mapStructure), total }
}

export async function insertCompensationAssignment(data: Record<string, unknown>) {
  const doc = await EmployeeCompensationAssignmentModel.create({
    ...data,
    organizationId: oid(String(data.organizationId)),
    legalEntityId: oid(String(data.legalEntityId)),
    branchId: oid(String(data.branchId)),
    employeeId: oid(String(data.employeeId)),
    compensationStructureId: oid(data.compensationStructureId as string | undefined),
    previousAssignmentId: oid(data.previousAssignmentId as string | undefined),
    createdBy: oid(String(data.createdBy)),
    approvedBy: oid(data.approvedBy as string | undefined),
    lines: Array.isArray(data.lines)
      ? data.lines.map((line: Record<string, unknown>) => ({
          ...line,
          salaryComponentId: oid(String(line.salaryComponentId)),
        }))
      : [],
  })
  return mapAssignment(doc.toObject() as LeanDoc)
}

export async function findCompensationAssignmentById(id: string) {
  const doc = await EmployeeCompensationAssignmentModel.findById(oid(id)).lean()
  return doc ? mapAssignment(doc as LeanDoc) : null
}

export async function listCompensationAssignments(filter: {
  organizationId: string
  employeeId?: string
  status?: string
  limit: number
  skip: number
}) {
  const query: FilterQuery<typeof EmployeeCompensationAssignmentModel> = {
    organizationId: oid(filter.organizationId),
  }
  if (filter.employeeId) query.employeeId = oid(filter.employeeId)
  if (filter.status) query.status = filter.status
  const [items, total] = await Promise.all([
    EmployeeCompensationAssignmentModel.find(query)
      .sort({ effectiveFrom: -1 })
      .skip(filter.skip)
      .limit(filter.limit)
      .lean(),
    EmployeeCompensationAssignmentModel.countDocuments(query),
  ])
  return { items: (items as LeanDoc[]).map(mapAssignment), total }
}

export async function findActivePrimaryAssignment(
  organizationId: string,
  employeeId: string,
  asOf: Date,
) {
  const docs = await EmployeeCompensationAssignmentModel.find({
    organizationId: oid(organizationId),
    employeeId: oid(employeeId),
    status: COMPENSATION_ASSIGNMENT_STATUSES.ACTIVE,
    isPrimary: true,
    effectiveFrom: { $lte: asOf },
    $or: [{ effectiveTo: null }, { effectiveTo: { $gte: asOf } }],
  })
    .sort({ effectiveFrom: -1 })
    .limit(2)
    .lean()
  return (docs as LeanDoc[]).map(mapAssignment)
}

export async function supersedeAssignment(id: string, effectiveTo: Date, updatedBy: string) {
  const doc = await EmployeeCompensationAssignmentModel.findByIdAndUpdate(
    oid(id),
    {
      $set: {
        status: COMPENSATION_ASSIGNMENT_STATUSES.SUPERSEDED,
        effectiveTo,
        updatedBy: oid(updatedBy),
      },
    },
    { new: true },
  ).lean()
  return doc ? mapAssignment(doc as LeanDoc) : null
}

export async function insertCompensationHistory(data: Record<string, unknown>) {
  await CompensationHistoryModel.create({
    ...data,
    organizationId: oid(String(data.organizationId)),
    employeeId: oid(String(data.employeeId)),
    previousAssignmentId: oid(data.previousAssignmentId as string | undefined),
    newAssignmentId: oid(String(data.newAssignmentId)),
    changedBy: oid(String(data.changedBy)),
    approvedBy: oid(data.approvedBy as string | undefined),
  })
}

export async function insertPayrollPeriod(data: Record<string, unknown>) {
  const doc = await PayrollPeriodModel.create({
    ...data,
    organizationId: oid(String(data.organizationId)),
    legalEntityId: oid(String(data.legalEntityId)),
    branchId: oid(data.branchId as string | undefined),
    createdBy: oid(String(data.createdBy)),
  })
  return mapPeriod(doc.toObject() as LeanDoc)
}

export async function findPayrollPeriodById(id: string) {
  const doc = await PayrollPeriodModel.findById(oid(id)).lean()
  return doc ? mapPeriod(doc as LeanDoc) : null
}

export async function listPayrollPeriods(filter: {
  organizationId: string
  legalEntityId?: string
  status?: string
  limit: number
  skip: number
}) {
  const query: FilterQuery<typeof PayrollPeriodModel> = {
    organizationId: oid(filter.organizationId),
  }
  if (filter.legalEntityId) query.legalEntityId = oid(filter.legalEntityId)
  if (filter.status) query.status = filter.status
  const [items, total] = await Promise.all([
    PayrollPeriodModel.find(query).sort({ startDate: -1 }).skip(filter.skip).limit(filter.limit).lean(),
    PayrollPeriodModel.countDocuments(query),
  ])
  return { items: (items as LeanDoc[]).map(mapPeriod), total }
}

export async function updatePayrollPeriod(id: string, patch: Record<string, unknown>) {
  const doc = await PayrollPeriodModel.findByIdAndUpdate(oid(id), { $set: patch }, { new: true }).lean()
  return doc ? mapPeriod(doc as LeanDoc) : null
}

export async function findOverlappingPeriods(params: {
  organizationId: string
  legalEntityId: string
  frequency: string
  startDate: Date
  endDate: Date
  excludeId?: string
}) {
  const query: FilterQuery<typeof PayrollPeriodModel> = {
    organizationId: oid(params.organizationId),
    legalEntityId: oid(params.legalEntityId),
    frequency: params.frequency,
    status: { $ne: PAYROLL_PERIOD_STATUSES.CANCELLED },
    startDate: { $lte: params.endDate },
    endDate: { $gte: params.startDate },
  }
  if (params.excludeId) query._id = { $ne: oid(params.excludeId) }
  const docs = await PayrollPeriodModel.find(query).lean()
  return (docs as LeanDoc[]).map(mapPeriod)
}

export async function insertPayrollRun(data: Record<string, unknown>) {
  const doc = await PayrollRunModel.create({
    ...data,
    organizationId: oid(String(data.organizationId)),
    legalEntityId: oid(String(data.legalEntityId)),
    branchId: oid(data.branchId as string | undefined),
    payrollPeriodId: oid(String(data.payrollPeriodId)),
    createdBy: oid(String(data.createdBy)),
  })
  return mapRun(doc.toObject() as LeanDoc)
}

export async function findPayrollRunById(id: string) {
  const doc = await PayrollRunModel.findById(oid(id)).lean()
  return doc ? mapRun(doc as LeanDoc) : null
}

export async function listPayrollRuns(filter: {
  organizationId: string
  payrollPeriodId?: string
  status?: string
  limit: number
  skip: number
}) {
  const query: FilterQuery<typeof PayrollRunModel> = {
    organizationId: oid(filter.organizationId),
  }
  if (filter.payrollPeriodId) query.payrollPeriodId = oid(filter.payrollPeriodId)
  if (filter.status) query.status = filter.status
  const [items, total] = await Promise.all([
    PayrollRunModel.find(query).sort({ createdAt: -1 }).skip(filter.skip).limit(filter.limit).lean(),
    PayrollRunModel.countDocuments(query),
  ])
  return { items: (items as LeanDoc[]).map(mapRun), total }
}

export async function updatePayrollRun(id: string, patch: Record<string, unknown>) {
  const prepared = { ...patch }
  if (prepared.calculatedBy) prepared.calculatedBy = oid(String(prepared.calculatedBy))
  if (prepared.submittedBy) prepared.submittedBy = oid(String(prepared.submittedBy))
  if (prepared.approvedBy) prepared.approvedBy = oid(String(prepared.approvedBy))
  if (prepared.paidBy) prepared.paidBy = oid(String(prepared.paidBy))
  if (prepared.updatedBy) prepared.updatedBy = oid(String(prepared.updatedBy))
  if (prepared.accountingJournalId)
    prepared.accountingJournalId = oid(String(prepared.accountingJournalId))
  if (prepared.paymentJournalId) prepared.paymentJournalId = oid(String(prepared.paymentJournalId))
  const doc = await PayrollRunModel.findByIdAndUpdate(oid(id), { $set: prepared }, { new: true }).lean()
  return doc ? mapRun(doc as LeanDoc) : null
}

/** Optimistic lock: update only when current status matches expected. */
export async function transitionPayrollRun(
  id: string,
  fromStatus: PayrollRunStatus | PayrollRunStatus[],
  patch: Record<string, unknown>,
) {
  const from = Array.isArray(fromStatus) ? fromStatus : [fromStatus]
  const prepared = { ...patch }
  for (const key of [
    'calculatedBy',
    'submittedBy',
    'approvedBy',
    'paidBy',
    'updatedBy',
    'accountingJournalId',
    'paymentJournalId',
  ]) {
    if (prepared[key]) prepared[key] = oid(String(prepared[key]))
  }
  const doc = await PayrollRunModel.findOneAndUpdate(
    { _id: oid(id), status: { $in: from } },
    { $set: prepared },
    { new: true },
  ).lean()
  return doc ? mapRun(doc as LeanDoc) : null
}

export async function deleteCalculationsForRun(payrollRunId: string) {
  await PayrollCalculationModel.deleteMany({ payrollRunId: oid(payrollRunId) })
}

export async function upsertPayrollCalculation(data: Record<string, unknown>) {
  const doc = await PayrollCalculationModel.findOneAndUpdate(
    {
      organizationId: oid(String(data.organizationId)),
      payrollRunId: oid(String(data.payrollRunId)),
      employeeId: oid(String(data.employeeId)),
    },
    {
      $set: {
        ...data,
        organizationId: oid(String(data.organizationId)),
        legalEntityId: oid(String(data.legalEntityId)),
        branchId: oid(String(data.branchId)),
        payrollPeriodId: oid(String(data.payrollPeriodId)),
        payrollRunId: oid(String(data.payrollRunId)),
        employeeId: oid(String(data.employeeId)),
        compensationAssignmentId: oid(data.compensationAssignmentId as string | undefined),
        calculatedBy: oid(String(data.calculatedBy)),
      },
    },
    { upsert: true, new: true },
  ).lean()
  return mapCalculation(doc as LeanDoc)
}

export async function listCalculationsForRun(payrollRunId: string) {
  const docs = await PayrollCalculationModel.find({ payrollRunId: oid(payrollRunId) })
    .sort({ employeeNumber: 1 })
    .lean()
  return (docs as LeanDoc[]).map(mapCalculation)
}

export async function findCalculationById(id: string) {
  const doc = await PayrollCalculationModel.findById(oid(id)).lean()
  return doc ? mapCalculation(doc as LeanDoc) : null
}

export async function insertBonus(data: Record<string, unknown>) {
  const doc = await PayrollBonusModel.create({
    ...data,
    organizationId: oid(String(data.organizationId)),
    legalEntityId: oid(String(data.legalEntityId)),
    branchId: oid(String(data.branchId)),
    employeeId: oid(String(data.employeeId)),
    payrollPeriodId: oid(data.payrollPeriodId as string | undefined),
    createdBy: oid(String(data.createdBy)),
  })
  return mapBonus(doc.toObject() as LeanDoc)
}

export async function findBonusById(id: string) {
  const doc = await PayrollBonusModel.findById(oid(id)).lean()
  return doc ? mapBonus(doc as LeanDoc) : null
}

export async function updateBonus(id: string, patch: Record<string, unknown>) {
  if (patch.approvedBy) patch.approvedBy = oid(String(patch.approvedBy))
  const doc = await PayrollBonusModel.findByIdAndUpdate(oid(id), { $set: patch }, { new: true }).lean()
  return doc ? mapBonus(doc as LeanDoc) : null
}

export async function listApprovedBonusesForPeriod(
  organizationId: string,
  payrollPeriodId: string,
  employeeIds?: string[],
) {
  const query: FilterQuery<typeof PayrollBonusModel> = {
    organizationId: oid(organizationId),
    payrollPeriodId: oid(payrollPeriodId),
    status: PAYROLL_INPUT_STATUSES.APPROVED,
  }
  if (employeeIds?.length) query.employeeId = { $in: employeeIds.map((id) => oid(id)) }
  const docs = await PayrollBonusModel.find(query).lean()
  return (docs as LeanDoc[]).map(mapBonus)
}

export async function listBonuses(filter: {
  organizationId: string
  employeeId?: string
  payrollPeriodId?: string
  status?: string
  limit: number
  skip: number
}) {
  const query: FilterQuery<typeof PayrollBonusModel> = {
    organizationId: oid(filter.organizationId),
  }
  if (filter.employeeId) query.employeeId = oid(filter.employeeId)
  if (filter.payrollPeriodId) query.payrollPeriodId = oid(filter.payrollPeriodId)
  if (filter.status) query.status = filter.status
  const [items, total] = await Promise.all([
    PayrollBonusModel.find(query).sort({ createdAt: -1 }).skip(filter.skip).limit(filter.limit).lean(),
    PayrollBonusModel.countDocuments(query),
  ])
  return { items: (items as LeanDoc[]).map(mapBonus), total }
}

export async function insertDeduction(data: Record<string, unknown>) {
  const doc = await PayrollDeductionModel.create({
    ...data,
    organizationId: oid(String(data.organizationId)),
    legalEntityId: oid(String(data.legalEntityId)),
    branchId: oid(String(data.branchId)),
    employeeId: oid(String(data.employeeId)),
    payrollPeriodId: oid(data.payrollPeriodId as string | undefined),
    advanceId: oid(data.advanceId as string | undefined),
    createdBy: oid(String(data.createdBy)),
  })
  return mapDeduction(doc.toObject() as LeanDoc)
}

export async function findDeductionById(id: string) {
  const doc = await PayrollDeductionModel.findById(oid(id)).lean()
  return doc ? mapDeduction(doc as LeanDoc) : null
}

export async function updateDeduction(id: string, patch: Record<string, unknown>) {
  if (patch.approvedBy) patch.approvedBy = oid(String(patch.approvedBy))
  const doc = await PayrollDeductionModel.findByIdAndUpdate(oid(id), { $set: patch }, { new: true }).lean()
  return doc ? mapDeduction(doc as LeanDoc) : null
}

export async function listApprovedDeductionsForPeriod(
  organizationId: string,
  payrollPeriodId: string,
  employeeIds?: string[],
) {
  const query: FilterQuery<typeof PayrollDeductionModel> = {
    organizationId: oid(organizationId),
    payrollPeriodId: oid(payrollPeriodId),
    status: PAYROLL_INPUT_STATUSES.APPROVED,
  }
  if (employeeIds?.length) query.employeeId = { $in: employeeIds.map((id) => oid(id)) }
  const docs = await PayrollDeductionModel.find(query).lean()
  return (docs as LeanDoc[]).map(mapDeduction)
}

export async function listDeductions(filter: {
  organizationId: string
  employeeId?: string
  payrollPeriodId?: string
  status?: string
  limit: number
  skip: number
}) {
  const query: FilterQuery<typeof PayrollDeductionModel> = {
    organizationId: oid(filter.organizationId),
  }
  if (filter.employeeId) query.employeeId = oid(filter.employeeId)
  if (filter.payrollPeriodId) query.payrollPeriodId = oid(filter.payrollPeriodId)
  if (filter.status) query.status = filter.status
  const [items, total] = await Promise.all([
    PayrollDeductionModel.find(query)
      .sort({ createdAt: -1 })
      .skip(filter.skip)
      .limit(filter.limit)
      .lean(),
    PayrollDeductionModel.countDocuments(query),
  ])
  return { items: (items as LeanDoc[]).map(mapDeduction), total }
}

export async function insertAdjustment(data: Record<string, unknown>) {
  const doc = await PayrollAdjustmentModel.create({
    ...data,
    organizationId: oid(String(data.organizationId)),
    legalEntityId: oid(String(data.legalEntityId)),
    branchId: oid(String(data.branchId)),
    employeeId: oid(String(data.employeeId)),
    payrollPeriodId: oid(String(data.payrollPeriodId)),
    createdBy: oid(String(data.createdBy)),
  })
  return mapAdjustment(doc.toObject() as LeanDoc)
}

export async function findAdjustmentById(id: string) {
  const doc = await PayrollAdjustmentModel.findById(oid(id)).lean()
  return doc ? mapAdjustment(doc as LeanDoc) : null
}

export async function updateAdjustment(id: string, patch: Record<string, unknown>) {
  if (patch.approvedBy) patch.approvedBy = oid(String(patch.approvedBy))
  const doc = await PayrollAdjustmentModel.findByIdAndUpdate(
    oid(id),
    { $set: patch },
    { new: true },
  ).lean()
  return doc ? mapAdjustment(doc as LeanDoc) : null
}

export async function listApprovedAdjustmentsForPeriod(
  organizationId: string,
  payrollPeriodId: string,
  employeeIds?: string[],
) {
  const query: FilterQuery<typeof PayrollAdjustmentModel> = {
    organizationId: oid(organizationId),
    payrollPeriodId: oid(payrollPeriodId),
    status: PAYROLL_INPUT_STATUSES.APPROVED,
  }
  if (employeeIds?.length) query.employeeId = { $in: employeeIds.map((id) => oid(id)) }
  const docs = await PayrollAdjustmentModel.find(query).lean()
  return (docs as LeanDoc[]).map(mapAdjustment)
}

export async function listAdjustments(filter: {
  organizationId: string
  employeeId?: string
  payrollPeriodId?: string
  status?: string
  limit: number
  skip: number
}) {
  const query: FilterQuery<typeof PayrollAdjustmentModel> = {
    organizationId: oid(filter.organizationId),
  }
  if (filter.employeeId) query.employeeId = oid(filter.employeeId)
  if (filter.payrollPeriodId) query.payrollPeriodId = oid(filter.payrollPeriodId)
  if (filter.status) query.status = filter.status
  const [items, total] = await Promise.all([
    PayrollAdjustmentModel.find(query)
      .sort({ createdAt: -1 })
      .skip(filter.skip)
      .limit(filter.limit)
      .lean(),
    PayrollAdjustmentModel.countDocuments(query),
  ])
  return { items: (items as LeanDoc[]).map(mapAdjustment), total }
}

export async function insertOvertime(data: Record<string, unknown>) {
  const doc = await PayrollOvertimeModel.create({
    ...data,
    organizationId: oid(String(data.organizationId)),
    legalEntityId: oid(String(data.legalEntityId)),
    branchId: oid(String(data.branchId)),
    employeeId: oid(String(data.employeeId)),
    payrollPeriodId: oid(data.payrollPeriodId as string | undefined),
    createdBy: oid(String(data.createdBy)),
  })
  return mapOvertime(doc.toObject() as LeanDoc)
}

export async function findOvertimeById(id: string) {
  const doc = await PayrollOvertimeModel.findById(oid(id)).lean()
  return doc ? mapOvertime(doc as LeanDoc) : null
}

export async function updateOvertime(id: string, patch: Record<string, unknown>) {
  if (patch.approvedBy) patch.approvedBy = oid(String(patch.approvedBy))
  const doc = await PayrollOvertimeModel.findByIdAndUpdate(oid(id), { $set: patch }, { new: true }).lean()
  return doc ? mapOvertime(doc as LeanDoc) : null
}

export async function listApprovedOvertimeForPeriod(
  organizationId: string,
  payrollPeriodId: string,
  employeeIds?: string[],
) {
  const query: FilterQuery<typeof PayrollOvertimeModel> = {
    organizationId: oid(organizationId),
    payrollPeriodId: oid(payrollPeriodId),
    status: PAYROLL_INPUT_STATUSES.APPROVED,
  }
  if (employeeIds?.length) query.employeeId = { $in: employeeIds.map((id) => oid(id)) }
  const docs = await PayrollOvertimeModel.find(query).lean()
  return (docs as LeanDoc[]).map(mapOvertime)
}

export async function insertAdvance(data: Record<string, unknown>) {
  const doc = await EmployeeAdvanceModel.create({
    ...data,
    organizationId: oid(String(data.organizationId)),
    legalEntityId: oid(String(data.legalEntityId)),
    branchId: oid(String(data.branchId)),
    employeeId: oid(String(data.employeeId)),
    createdBy: oid(String(data.createdBy)),
  })
  return mapAdvance(doc.toObject() as LeanDoc)
}

export async function findAdvanceById(id: string) {
  const doc = await EmployeeAdvanceModel.findById(oid(id)).lean()
  return doc ? mapAdvance(doc as LeanDoc) : null
}

export async function updateAdvance(id: string, patch: Record<string, unknown>) {
  if (patch.approvedBy) patch.approvedBy = oid(String(patch.approvedBy))
  const doc = await EmployeeAdvanceModel.findByIdAndUpdate(oid(id), { $set: patch }, { new: true }).lean()
  return doc ? mapAdvance(doc as LeanDoc) : null
}

export async function listActiveAdvancesForEmployees(
  organizationId: string,
  employeeIds: string[],
) {
  if (!employeeIds.length) return []
  const docs = await EmployeeAdvanceModel.find({
    organizationId: oid(organizationId),
    employeeId: { $in: employeeIds.map((id) => oid(id)) },
    status: { $in: [ADVANCE_STATUSES.APPROVED, ADVANCE_STATUSES.ACTIVE] },
  }).lean()
  return (docs as LeanDoc[]).map(mapAdvance)
}

export async function listAdvances(filter: {
  organizationId: string
  employeeId?: string
  status?: string
  limit: number
  skip: number
}) {
  const query: FilterQuery<typeof EmployeeAdvanceModel> = {
    organizationId: oid(filter.organizationId),
  }
  if (filter.employeeId) query.employeeId = oid(filter.employeeId)
  if (filter.status) query.status = filter.status
  const [items, total] = await Promise.all([
    EmployeeAdvanceModel.find(query)
      .sort({ createdAt: -1 })
      .skip(filter.skip)
      .limit(filter.limit)
      .lean(),
    EmployeeAdvanceModel.countDocuments(query),
  ])
  return { items: (items as LeanDoc[]).map(mapAdvance), total }
}

export async function insertPayslip(data: Record<string, unknown>) {
  const doc = await PayslipModel.create({
    ...data,
    organizationId: oid(String(data.organizationId)),
    legalEntityId: oid(String(data.legalEntityId)),
    branchId: oid(String(data.branchId)),
    payrollPeriodId: oid(String(data.payrollPeriodId)),
    payrollRunId: oid(String(data.payrollRunId)),
    payrollCalculationId: oid(String(data.payrollCalculationId)),
    employeeId: oid(String(data.employeeId)),
    generatedBy: oid(String(data.generatedBy)),
  })
  return mapPayslip(doc.toObject() as LeanDoc)
}

export async function findPayslipById(id: string) {
  const doc = await PayslipModel.findById(oid(id)).lean()
  return doc ? mapPayslip(doc as LeanDoc) : null
}

export async function findPayslipByRunEmployee(payrollRunId: string, employeeId: string) {
  const doc = await PayslipModel.findOne({
    payrollRunId: oid(payrollRunId),
    employeeId: oid(employeeId),
  }).lean()
  return doc ? mapPayslip(doc as LeanDoc) : null
}

export async function listPayslips(filter: {
  organizationId: string
  employeeId?: string
  payrollRunId?: string
  payrollPeriodId?: string
  limit: number
  skip: number
}) {
  const query: FilterQuery<typeof PayslipModel> = {
    organizationId: oid(filter.organizationId),
  }
  if (filter.employeeId) query.employeeId = oid(filter.employeeId)
  if (filter.payrollRunId) query.payrollRunId = oid(filter.payrollRunId)
  if (filter.payrollPeriodId) query.payrollPeriodId = oid(filter.payrollPeriodId)
  const [items, total] = await Promise.all([
    PayslipModel.find(query).sort({ payDate: -1 }).skip(filter.skip).limit(filter.limit).lean(),
    PayslipModel.countDocuments(query),
  ])
  return { items: (items as LeanDoc[]).map(mapPayslip), total }
}

export async function lockPayslipsForRun(payrollRunId: string) {
  await PayslipModel.updateMany(
    { payrollRunId: oid(payrollRunId), status: { $ne: PAYSLIP_STATUSES.CANCELLED } },
    { $set: { status: PAYSLIP_STATUSES.LOCKED } },
  )
}

export async function insertPayrollPayment(data: Record<string, unknown>) {
  const doc = await PayrollPaymentModel.create({
    ...data,
    organizationId: oid(String(data.organizationId)),
    legalEntityId: oid(String(data.legalEntityId)),
    branchId: oid(String(data.branchId)),
    payrollRunId: oid(String(data.payrollRunId)),
    payrollPeriodId: oid(String(data.payrollPeriodId)),
    employeeId: oid(String(data.employeeId)),
    payslipId: oid(data.payslipId as string | undefined),
    createdBy: oid(String(data.createdBy)),
  })
  return mapPayment(doc.toObject() as LeanDoc)
}

export async function findPaymentByIdempotency(organizationId: string, idempotencyKey: string) {
  const doc = await PayrollPaymentModel.findOne({
    organizationId: oid(organizationId),
    idempotencyKey,
  }).lean()
  return doc ? mapPayment(doc as LeanDoc) : null
}

export async function findPaymentById(id: string) {
  const doc = await PayrollPaymentModel.findById(oid(id)).lean()
  return doc ? mapPayment(doc as LeanDoc) : null
}

export async function updatePayment(id: string, patch: Record<string, unknown>) {
  if (patch.updatedBy) patch.updatedBy = oid(String(patch.updatedBy))
  const doc = await PayrollPaymentModel.findByIdAndUpdate(oid(id), { $set: patch }, { new: true }).lean()
  return doc ? mapPayment(doc as LeanDoc) : null
}

export async function transitionPayment(
  id: string,
  fromStatus: PayrollPaymentStatus | PayrollPaymentStatus[],
  patch: Record<string, unknown>,
) {
  const from = Array.isArray(fromStatus) ? fromStatus : [fromStatus]
  if (patch.updatedBy) patch.updatedBy = oid(String(patch.updatedBy))
  const doc = await PayrollPaymentModel.findOneAndUpdate(
    { _id: oid(id), status: { $in: from } },
    { $set: patch },
    { new: true },
  ).lean()
  return doc ? mapPayment(doc as LeanDoc) : null
}

export async function listPayments(filter: {
  organizationId: string
  payrollRunId?: string
  employeeId?: string
  status?: string
  limit: number
  skip: number
}) {
  const query: FilterQuery<typeof PayrollPaymentModel> = {
    organizationId: oid(filter.organizationId),
  }
  if (filter.payrollRunId) query.payrollRunId = oid(filter.payrollRunId)
  if (filter.employeeId) query.employeeId = oid(filter.employeeId)
  if (filter.status) query.status = filter.status
  const [items, total] = await Promise.all([
    PayrollPaymentModel.find(query)
      .sort({ createdAt: -1 })
      .skip(filter.skip)
      .limit(filter.limit)
      .lean(),
    PayrollPaymentModel.countDocuments(query),
  ])
  return { items: (items as LeanDoc[]).map(mapPayment), total }
}

export async function listPaymentsForRun(payrollRunId: string) {
  const docs = await PayrollPaymentModel.find({ payrollRunId: oid(payrollRunId) }).lean()
  return (docs as LeanDoc[]).map(mapPayment)
}

export async function insertPayrollApproval(data: Record<string, unknown>) {
  await PayrollApprovalModel.create({
    ...data,
    organizationId: oid(String(data.organizationId)),
    payrollRunId: oid(String(data.payrollRunId)),
    actorUserId: oid(String(data.actorUserId)),
  })
}

export async function tryInsertPayrollNotificationIntent(data: {
  organizationId: string
  employeeId?: string
  payrollRunId?: string
  payslipId?: string
  intentKey: string
  kind: string
  payload?: Record<string, unknown>
}) {
  try {
    await PayrollNotificationIntentModel.create({
      organizationId: oid(data.organizationId),
      employeeId: oid(data.employeeId),
      payrollRunId: oid(data.payrollRunId),
      payslipId: oid(data.payslipId),
      intentKey: data.intentKey,
      kind: data.kind,
      payload: data.payload,
    })
    return true
  } catch (error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: number }).code === 11000
    ) {
      return false
    }
    throw error
  }
}

export async function countRunsByStatus(organizationId: string) {
  const rows = await PayrollRunModel.aggregate([
    { $match: { organizationId: oid(organizationId) } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ])
  return rows as Array<{ _id: string; count: number }>
}

export async function sumPaidPayments(organizationId: string) {
  const rows = await PayrollPaymentModel.aggregate([
    {
      $match: {
        organizationId: oid(organizationId),
        status: PAYROLL_PAYMENT_STATUSES.PAID,
      },
    },
    { $group: { _id: '$currency', count: { $sum: 1 } } },
  ])
  return rows as Array<{ _id: string; count: number }>
}

export async function findCurrentOpenPeriod(organizationId: string, legalEntityId?: string) {
  const query: FilterQuery<typeof PayrollPeriodModel> = {
    organizationId: oid(organizationId),
    status: PAYROLL_PERIOD_STATUSES.OPEN,
  }
  if (legalEntityId) query.legalEntityId = oid(legalEntityId)
  const doc = await PayrollPeriodModel.findOne(query).sort({ startDate: -1 }).lean()
  return doc ? mapPeriod(doc as LeanDoc) : null
}

export { PAYROLL_RUN_STATUSES, PAYROLL_PERIOD_STATUSES }
