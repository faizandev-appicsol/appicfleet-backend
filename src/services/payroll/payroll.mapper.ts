import { toPublicEnum } from '../../constants/vehicles.js'
import type {
  CompensationAssignmentRecord,
  CompensationStructureRecord,
  EmployeeAdvanceRecord,
  PayrollAdjustmentRecord,
  PayrollBonusRecord,
  PayrollCalculationRecord,
  PayrollDeductionRecord,
  PayrollOvertimeRecord,
  PayrollPaymentRecord,
  PayrollPeriodRecord,
  PayrollRunRecord,
  PayslipRecord,
  SalaryComponentRecord,
} from '../../repositories/payroll/payroll.repository.js'

export function mapSalaryComponent(row: SalaryComponentRecord) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    legalEntityId: row.legalEntityId,
    code: row.code,
    name: row.name,
    nameAr: row.nameAr,
    componentType: toPublicEnum(row.componentType as never),
    category: toPublicEnum(row.category as never),
    calculationMethod: toPublicEnum(row.calculationMethod as never),
    fixedAmount: row.fixedAmount,
    percentage: row.percentage,
    taxable: row.taxable,
    status: toPublicEnum(row.status as never),
    effectiveFrom: row.effectiveFrom.toISOString(),
    effectiveTo: row.effectiveTo?.toISOString(),
    description: row.description,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function mapStructure(row: CompensationStructureRecord) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    legalEntityId: row.legalEntityId,
    code: row.code,
    name: row.name,
    currency: row.currency,
    status: toPublicEnum(row.status as never),
    lines: row.lines,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function mapAssignment(row: CompensationAssignmentRecord, includeSensitive = true) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    legalEntityId: row.legalEntityId,
    branchId: row.branchId,
    employeeId: row.employeeId,
    compensationStructureId: row.compensationStructureId,
    currency: row.currency,
    effectiveFrom: row.effectiveFrom.toISOString(),
    effectiveTo: row.effectiveTo?.toISOString(),
    status: toPublicEnum(row.status as never),
    isPrimary: row.isPrimary,
    basicSalary: includeSensitive ? row.basicSalary : undefined,
    lines: includeSensitive ? row.lines : undefined,
    notes: row.notes,
    changeReason: row.changeReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function mapPeriod(row: PayrollPeriodRecord) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    legalEntityId: row.legalEntityId,
    branchId: row.branchId,
    name: row.name,
    periodNumber: row.periodNumber,
    frequency: toPublicEnum(row.frequency as never),
    startDate: row.startDate.toISOString(),
    endDate: row.endDate.toISOString(),
    payDate: row.payDate.toISOString(),
    status: toPublicEnum(row.status as never),
    currency: row.currency,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function mapRun(row: PayrollRunRecord, includeTotals = true) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    legalEntityId: row.legalEntityId,
    branchId: row.branchId,
    payrollPeriodId: row.payrollPeriodId,
    runNumber: row.runNumber,
    status: toPublicEnum(row.status as never),
    currency: row.currency,
    calculationVersion: row.calculationVersion,
    employeeCount: row.employeeCount,
    exceptionCount: row.exceptionCount,
    grossTotal: includeTotals ? row.grossTotal : undefined,
    deductionTotal: includeTotals ? row.deductionTotal : undefined,
    netTotal: includeTotals ? row.netTotal : undefined,
    employerCostTotal: includeTotals ? row.employerCostTotal : undefined,
    calculatedAt: row.calculatedAt?.toISOString(),
    approvedAt: row.approvedAt?.toISOString(),
    paidAt: row.paidAt?.toISOString(),
    accountingJournalId: row.accountingJournalId,
    paymentJournalId: row.paymentJournalId,
    recalculationCount: row.recalculationCount,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function mapCalculation(row: PayrollCalculationRecord, includeSensitive = true) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    legalEntityId: row.legalEntityId,
    branchId: row.branchId,
    payrollPeriodId: row.payrollPeriodId,
    payrollRunId: row.payrollRunId,
    employeeId: row.employeeId,
    employeeNumber: row.employeeNumber,
    calculationVersion: row.calculationVersion,
    currency: row.currency,
    earnings: includeSensitive ? row.earnings : undefined,
    deductions: includeSensitive ? row.deductions : undefined,
    employerContributions: includeSensitive ? row.employerContributions : undefined,
    grossPay: includeSensitive ? row.grossPay : undefined,
    totalDeductions: includeSensitive ? row.totalDeductions : undefined,
    netPay: includeSensitive ? row.netPay : undefined,
    employerCost: includeSensitive ? row.employerCost : undefined,
    exceptions: row.exceptions,
    hasExceptions: row.hasExceptions,
    calculatedAt: row.calculatedAt.toISOString(),
  }
}

export function mapPayslip(row: PayslipRecord, includeSensitive = true) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    legalEntityId: row.legalEntityId,
    branchId: row.branchId,
    payrollPeriodId: row.payrollPeriodId,
    payrollRunId: row.payrollRunId,
    employeeId: row.employeeId,
    employeeNumber: row.employeeNumber,
    payslipNumber: row.payslipNumber,
    currency: row.currency,
    payDate: row.payDate.toISOString(),
    earnings: includeSensitive ? row.earnings : undefined,
    deductions: includeSensitive ? row.deductions : undefined,
    employerContributions: includeSensitive ? row.employerContributions : undefined,
    grossSalary: includeSensitive ? row.grossSalary : undefined,
    totalDeductions: includeSensitive ? row.totalDeductions : undefined,
    netSalary: includeSensitive ? row.netSalary : undefined,
    employerCost: includeSensitive ? row.employerCost : undefined,
    status: toPublicEnum(row.status as never),
    generatedAt: row.generatedAt.toISOString(),
  }
}

export function mapPayment(row: PayrollPaymentRecord) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    legalEntityId: row.legalEntityId,
    branchId: row.branchId,
    payrollRunId: row.payrollRunId,
    payrollPeriodId: row.payrollPeriodId,
    employeeId: row.employeeId,
    payslipId: row.payslipId,
    amount: row.amount,
    currency: row.currency,
    paymentDate: row.paymentDate?.toISOString(),
    paymentMethod: toPublicEnum(row.paymentMethod as never),
    status: toPublicEnum(row.status as never),
    externalReference: row.externalReference,
    failureReason: row.failureReason,
    createdAt: row.createdAt.toISOString(),
  }
}

export function mapBonus(row: PayrollBonusRecord) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    employeeId: row.employeeId,
    payrollPeriodId: row.payrollPeriodId,
    bonusType: toPublicEnum(row.bonusType as never),
    amount: row.amount,
    currency: row.currency,
    reason: row.reason,
    effectiveDate: row.effectiveDate.toISOString(),
    status: toPublicEnum(row.status as never),
    createdAt: row.createdAt.toISOString(),
  }
}

export function mapDeduction(row: PayrollDeductionRecord) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    employeeId: row.employeeId,
    payrollPeriodId: row.payrollPeriodId,
    deductionType: toPublicEnum(row.deductionType as never),
    amount: row.amount,
    currency: row.currency,
    reason: row.reason,
    effectiveDate: row.effectiveDate.toISOString(),
    status: toPublicEnum(row.status as never),
    createdAt: row.createdAt.toISOString(),
  }
}

export function mapAdjustment(row: PayrollAdjustmentRecord) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    employeeId: row.employeeId,
    payrollPeriodId: row.payrollPeriodId,
    direction: toPublicEnum(row.direction as never),
    amount: row.amount,
    currency: row.currency,
    reason: row.reason,
    status: toPublicEnum(row.status as never),
    createdAt: row.createdAt.toISOString(),
  }
}

export function mapOvertime(row: PayrollOvertimeRecord) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    employeeId: row.employeeId,
    payrollPeriodId: row.payrollPeriodId,
    workDate: row.workDate.toISOString(),
    hours: row.hours,
    rate: row.rate,
    amount: row.amount,
    currency: row.currency,
    reason: row.reason,
    status: toPublicEnum(row.status as never),
    createdAt: row.createdAt.toISOString(),
  }
}

export function mapAdvance(row: EmployeeAdvanceRecord) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    employeeId: row.employeeId,
    principalAmount: row.principalAmount,
    installmentAmount: row.installmentAmount,
    remainingBalance: row.remainingBalance,
    currency: row.currency,
    startDate: row.startDate.toISOString(),
    status: toPublicEnum(row.status as never),
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  }
}
