import {
  CALCULATION_METHODS,
  PAYROLL_ADJUSTMENT_DIRECTIONS,
  PAYROLL_CALCULATION_VERSION,
  PAYROLL_EXCEPTION_CODES,
  SALARY_COMPONENT_CATEGORIES,
  SALARY_COMPONENT_TYPES,
  type PayrollExceptionCode,
} from '../../constants/payroll.js'
import type { EmployeeRecord } from '../../repositories/hr/hr.repository.js'
import type {
  AssignmentLineRecord,
  CompensationAssignmentRecord,
  EmployeeAdvanceRecord,
  PayrollAdjustmentRecord,
  PayrollBonusRecord,
  PayrollDeductionRecord,
  PayrollOvertimeRecord,
} from '../../repositories/payroll/payroll.repository.js'
import {
  addMoney,
  compareMoney,
  normalizeMoney,
  percentOfMoney,
  subtractMoney,
} from '../../utils/money.js'

export type CalcLine = {
  salaryComponentId?: string
  code: string
  name: string
  componentType: string
  category: string
  amount: string
  source: string
}

export type EmployeeCalcResult = {
  employeeId: string
  employeeNumber: string
  legalEntityId: string
  branchId: string
  compensationAssignmentId?: string
  calculationVersion: number
  currency: string
  earnings: CalcLine[]
  deductions: CalcLine[]
  employerContributions: CalcLine[]
  grossPay: string
  totalDeductions: string
  netPay: string
  employerCost: string
  exceptions: Array<{ code: PayrollExceptionCode; message: string }>
  hasExceptions: boolean
  snapshot: Record<string, unknown>
}

export type EmployeeCalcInput = {
  employee: EmployeeRecord
  assignment: CompensationAssignmentRecord | null
  duplicateAssignment: boolean
  currency: string
  bonuses: PayrollBonusRecord[]
  deductions: PayrollDeductionRecord[]
  adjustments: PayrollAdjustmentRecord[]
  overtime: PayrollOvertimeRecord[]
  advances: EmployeeAdvanceRecord[]
  allowNegativeNet?: boolean
}

function lineAmount(line: AssignmentLineRecord, basicSalary: string): string {
  if (line.calculationMethod === CALCULATION_METHODS.PERCENT_OF_BASIC) {
    if (!line.percentage) return '0.00'
    return percentOfMoney(basicSalary, line.percentage)
  }
  if (line.fixedAmount) return normalizeMoney(line.fixedAmount)
  return '0.00'
}

/**
 * Deterministic payroll calculation for a single employee.
 * Uses decimal-safe money utilities; never JS floating point.
 */
export function calculateEmployeePayroll(input: EmployeeCalcInput): EmployeeCalcResult {
  const exceptions: Array<{ code: PayrollExceptionCode; message: string }> = []
  const earnings: CalcLine[] = []
  const deductions: CalcLine[] = []
  const employerContributions: CalcLine[] = []

  if (input.employee.status !== 'ACTIVE') {
    exceptions.push({
      code: PAYROLL_EXCEPTION_CODES.EMPLOYEE_INACTIVE,
      message: 'Employee is not active for payroll.',
    })
  }

  if (!input.assignment) {
    exceptions.push({
      code: PAYROLL_EXCEPTION_CODES.MISSING_COMPENSATION,
      message: 'No active primary compensation assignment for the payroll period.',
    })
  }

  if (input.duplicateAssignment) {
    exceptions.push({
      code: PAYROLL_EXCEPTION_CODES.DUPLICATE_COMPENSATION,
      message: 'Multiple active primary compensation assignments overlap the payroll date.',
    })
  }

  if (!input.currency) {
    exceptions.push({
      code: PAYROLL_EXCEPTION_CODES.MISSING_CURRENCY,
      message: 'Payroll currency is missing.',
    })
  }

  const currency = (input.assignment?.currency ?? input.currency).toUpperCase()
  if (input.assignment && input.assignment.currency.toUpperCase() !== input.currency.toUpperCase()) {
    exceptions.push({
      code: PAYROLL_EXCEPTION_CODES.CURRENCY_MISMATCH,
      message: 'Compensation currency does not match payroll run currency.',
    })
  }

  let basicSalary = '0.00'
  if (input.assignment) {
    basicSalary = normalizeMoney(input.assignment.basicSalary)
    for (const line of input.assignment.lines) {
      try {
        const amount = lineAmount(line, basicSalary)
        const base = {
          salaryComponentId: line.salaryComponentId,
          code: line.code,
          name: line.name,
          componentType: line.componentType,
          category: line.category,
          amount,
          source: 'compensation',
        }
        if (
          line.componentType === SALARY_COMPONENT_TYPES.EARNING ||
          line.componentType === SALARY_COMPONENT_TYPES.REIMBURSEMENT
        ) {
          earnings.push(base)
        } else if (line.componentType === SALARY_COMPONENT_TYPES.DEDUCTION) {
          deductions.push(base)
        } else if (line.componentType === SALARY_COMPONENT_TYPES.EMPLOYER_CONTRIBUTION) {
          employerContributions.push(base)
        } else {
          exceptions.push({
            code: PAYROLL_EXCEPTION_CODES.INVALID_COMPONENT,
            message: `Unsupported component type for ${line.code}.`,
          })
        }
      } catch {
        exceptions.push({
          code: PAYROLL_EXCEPTION_CODES.INVALID_COMPONENT,
          message: `Invalid amount configuration for component ${line.code}.`,
        })
      }
    }
  }

  for (const bonus of input.bonuses) {
    if (bonus.currency.toUpperCase() !== currency) {
      exceptions.push({
        code: PAYROLL_EXCEPTION_CODES.CURRENCY_MISMATCH,
        message: `Bonus currency mismatch for employee ${input.employee.employeeNumber}.`,
      })
      continue
    }
    earnings.push({
      code: `BONUS_${bonus.bonusType}`,
      name: `Bonus (${bonus.bonusType})`,
      componentType: SALARY_COMPONENT_TYPES.EARNING,
      category: SALARY_COMPONENT_CATEGORIES.BONUS,
      amount: normalizeMoney(bonus.amount),
      source: 'bonus',
    })
  }

  for (const ot of input.overtime) {
    if (ot.currency.toUpperCase() !== currency) {
      exceptions.push({
        code: PAYROLL_EXCEPTION_CODES.CURRENCY_MISMATCH,
        message: `Overtime currency mismatch for employee ${input.employee.employeeNumber}.`,
      })
      continue
    }
    earnings.push({
      code: 'OVERTIME',
      name: 'Overtime',
      componentType: SALARY_COMPONENT_TYPES.EARNING,
      category: SALARY_COMPONENT_CATEGORIES.OVERTIME,
      amount: normalizeMoney(ot.amount),
      source: 'overtime',
    })
  }

  for (const adj of input.adjustments) {
    if (adj.currency.toUpperCase() !== currency) {
      exceptions.push({
        code: PAYROLL_EXCEPTION_CODES.CURRENCY_MISMATCH,
        message: `Adjustment currency mismatch for employee ${input.employee.employeeNumber}.`,
      })
      continue
    }
    if (adj.direction === PAYROLL_ADJUSTMENT_DIRECTIONS.POSITIVE) {
      earnings.push({
        code: 'ADJ_POS',
        name: 'Positive adjustment',
        componentType: SALARY_COMPONENT_TYPES.EARNING,
        category: SALARY_COMPONENT_CATEGORIES.OTHER_EARNING,
        amount: normalizeMoney(adj.amount),
        source: 'adjustment',
      })
    } else {
      deductions.push({
        code: 'ADJ_NEG',
        name: 'Negative adjustment',
        componentType: SALARY_COMPONENT_TYPES.DEDUCTION,
        category: SALARY_COMPONENT_CATEGORIES.OTHER_DEDUCTION,
        amount: normalizeMoney(adj.amount),
        source: 'adjustment',
      })
    }
  }

  for (const ded of input.deductions) {
    if (ded.currency.toUpperCase() !== currency) {
      exceptions.push({
        code: PAYROLL_EXCEPTION_CODES.CURRENCY_MISMATCH,
        message: `Deduction currency mismatch for employee ${input.employee.employeeNumber}.`,
      })
      continue
    }
    deductions.push({
      code: `DED_${ded.deductionType}`,
      name: `Deduction (${ded.deductionType})`,
      componentType: SALARY_COMPONENT_TYPES.DEDUCTION,
      category: SALARY_COMPONENT_CATEGORIES.OTHER_DEDUCTION,
      amount: normalizeMoney(ded.amount),
      source: 'deduction',
    })
  }

  for (const advance of input.advances) {
    if (advance.currency.toUpperCase() !== currency) {
      exceptions.push({
        code: PAYROLL_EXCEPTION_CODES.CURRENCY_MISMATCH,
        message: `Advance currency mismatch for employee ${input.employee.employeeNumber}.`,
      })
      continue
    }
    const installment = normalizeMoney(advance.installmentAmount)
    const remaining = normalizeMoney(advance.remainingBalance)
    const amount = compareMoney(installment, remaining) > 0 ? remaining : installment
    if (compareMoney(amount, '0.00') > 0) {
      deductions.push({
        code: 'ADVANCE_REPAY',
        name: 'Advance repayment',
        componentType: SALARY_COMPONENT_TYPES.DEDUCTION,
        category: SALARY_COMPONENT_CATEGORIES.ADVANCE,
        amount,
        source: 'advance',
      })
    }
  }

  const grossPay = earnings.length ? addMoney(...earnings.map((e) => e.amount)) : '0.00'
  const totalDeductions = deductions.length
    ? addMoney(...deductions.map((d) => d.amount))
    : '0.00'
  const employerCost = employerContributions.length
    ? addMoney(...employerContributions.map((e) => e.amount))
    : '0.00'
  const netPay = subtractMoney(grossPay, totalDeductions, true)

  if (!input.allowNegativeNet && compareMoney(netPay, '0.00') < 0) {
    exceptions.push({
      code: PAYROLL_EXCEPTION_CODES.NEGATIVE_NET_PAY,
      message: 'Net pay is negative.',
    })
  }

  return {
    employeeId: input.employee.id,
    employeeNumber: input.employee.employeeNumber,
    legalEntityId: input.employee.legalEntityId,
    branchId: input.employee.branchId,
    compensationAssignmentId: input.assignment?.id,
    calculationVersion: PAYROLL_CALCULATION_VERSION,
    currency,
    earnings,
    deductions,
    employerContributions,
    grossPay,
    totalDeductions,
    netPay,
    employerCost,
    exceptions,
    hasExceptions: exceptions.length > 0,
    snapshot: {
      calculationVersion: PAYROLL_CALCULATION_VERSION,
      basicSalary,
      assignmentId: input.assignment?.id,
      earningCount: earnings.length,
      deductionCount: deductions.length,
      employerContributionCount: employerContributions.length,
      calculatedAt: new Date().toISOString(),
    },
  }
}
