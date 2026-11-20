import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import {
  CALCULATION_METHODS,
  PAYROLL_ADJUSTMENT_DIRECTIONS,
  PAYROLL_CALCULATION_VERSION,
  PAYROLL_EXCEPTION_CODES,
  SALARY_COMPONENT_CATEGORIES,
  SALARY_COMPONENT_TYPES,
} from '../../src/constants/payroll.js'
import { calculateEmployeePayroll } from '../../src/services/payroll/calculation.engine.js'
import type { EmployeeRecord } from '../../src/repositories/hr/hr.repository.js'
import type { CompensationAssignmentRecord } from '../../src/repositories/payroll/payroll.repository.js'
import { addMoney, subtractMoney } from '../../src/utils/money.js'

function employee(overrides: Partial<EmployeeRecord> = {}): EmployeeRecord {
  return {
    id: '64a000000000000000000001',
    organizationId: '64a000000000000000000010',
    legalEntityId: '64a000000000000000000011',
    branchId: '64a000000000000000000012',
    employeeNumber: 'EMP-000001',
    firstName: 'Ada',
    lastName: 'Lovelace',
    status: 'ACTIVE',
    employmentType: 'FULL_TIME',
    addresses: [],
    emergencyContacts: [],
    createdBy: '64a000000000000000000099',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as EmployeeRecord
}

function assignment(overrides: Partial<CompensationAssignmentRecord> = {}): CompensationAssignmentRecord {
  return {
    id: '64a000000000000000000021',
    organizationId: '64a000000000000000000010',
    legalEntityId: '64a000000000000000000011',
    branchId: '64a000000000000000000012',
    employeeId: '64a000000000000000000001',
    currency: 'AED',
    effectiveFrom: new Date('2026-01-01'),
    status: 'ACTIVE',
    isPrimary: true,
    basicSalary: '8000.00',
    lines: [
      {
        salaryComponentId: '64a000000000000000000031',
        componentType: SALARY_COMPONENT_TYPES.EARNING,
        category: SALARY_COMPONENT_CATEGORIES.BASIC,
        code: 'BASIC',
        name: 'Basic',
        calculationMethod: CALCULATION_METHODS.FIXED,
        fixedAmount: '8000.00',
        taxable: true,
      },
      {
        salaryComponentId: '64a000000000000000000032',
        componentType: SALARY_COMPONENT_TYPES.EARNING,
        category: SALARY_COMPONENT_CATEGORIES.HOUSING,
        code: 'HOUSING',
        name: 'Housing',
        calculationMethod: CALCULATION_METHODS.PERCENT_OF_BASIC,
        percentage: '25.00',
        taxable: true,
      },
    ],
    createdBy: '64a000000000000000000099',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('payroll calculation engine', () => {
  it('computes gross-to-net with decimal-safe money', () => {
    const result = calculateEmployeePayroll({
      employee: employee(),
      assignment: assignment(),
      duplicateAssignment: false,
      currency: 'AED',
      bonuses: [
        {
          id: 'b1',
          organizationId: '64a000000000000000000010',
          legalEntityId: '64a000000000000000000011',
          branchId: '64a000000000000000000012',
          employeeId: '64a000000000000000000001',
          bonusType: 'PERFORMANCE',
          amount: '500.00',
          currency: 'AED',
          effectiveDate: new Date(),
          status: 'APPROVED',
          createdBy: 'u',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      deductions: [
        {
          id: 'd1',
          organizationId: '64a000000000000000000010',
          legalEntityId: '64a000000000000000000011',
          branchId: '64a000000000000000000012',
          employeeId: '64a000000000000000000001',
          deductionType: 'OTHER',
          amount: '100.00',
          currency: 'AED',
          effectiveDate: new Date(),
          status: 'APPROVED',
          createdBy: 'u',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      adjustments: [
        {
          id: 'a1',
          organizationId: '64a000000000000000000010',
          legalEntityId: '64a000000000000000000011',
          branchId: '64a000000000000000000012',
          employeeId: '64a000000000000000000001',
          payrollPeriodId: 'p1',
          direction: PAYROLL_ADJUSTMENT_DIRECTIONS.NEGATIVE,
          amount: '50.00',
          currency: 'AED',
          reason: 'Correction',
          status: 'APPROVED',
          createdBy: 'u',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      overtime: [],
      advances: [],
    })

    // 8000 + 2000 housing + 500 bonus = 10500; deductions 100 + 50 = 150; net 10350
    assert.equal(result.grossPay, '10500.00')
    assert.equal(result.totalDeductions, '150.00')
    assert.equal(result.netPay, '10350.00')
    assert.equal(result.calculationVersion, PAYROLL_CALCULATION_VERSION)
    assert.equal(result.hasExceptions, false)
  })

  it('flags missing compensation instead of skipping silently', () => {
    const result = calculateEmployeePayroll({
      employee: employee(),
      assignment: null,
      duplicateAssignment: false,
      currency: 'AED',
      bonuses: [],
      deductions: [],
      adjustments: [],
      overtime: [],
      advances: [],
    })
    assert.equal(result.hasExceptions, true)
    assert.ok(
      result.exceptions.some((e) => e.code === PAYROLL_EXCEPTION_CODES.MISSING_COMPENSATION),
    )
  })

  it('flags currency mismatch', () => {
    const result = calculateEmployeePayroll({
      employee: employee(),
      assignment: assignment({ currency: 'USD' }),
      duplicateAssignment: false,
      currency: 'AED',
      bonuses: [],
      deductions: [],
      adjustments: [],
      overtime: [],
      advances: [],
    })
    assert.ok(result.exceptions.some((e) => e.code === PAYROLL_EXCEPTION_CODES.CURRENCY_MISMATCH))
  })

  it('never uses floating point for money aggregation', () => {
    assert.equal(addMoney('100.10', '0.20'), '100.30')
    assert.equal(subtractMoney('100.10', '0.20'), '99.90')
  })
})
