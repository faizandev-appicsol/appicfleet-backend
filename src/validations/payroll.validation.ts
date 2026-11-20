import { z } from 'zod'
import {
  BONUS_TYPES,
  CALCULATION_METHODS,
  DEDUCTION_TYPES,
  PAYROLL_ADJUSTMENT_DIRECTIONS,
  PAYROLL_FREQUENCIES,
  PAYROLL_PAYMENT_METHODS,
  SALARY_COMPONENT_CATEGORIES,
  SALARY_COMPONENT_TYPES,
} from '../constants/payroll.js'
import { currencySchema, objectIdSchema, paginationQuerySchema } from './common.validation.js'
import { enumInput, instantSchema, moneySchema, optionalText } from './vehicle.validation.js'

const componentTypeInput = enumInput(Object.values(SALARY_COMPONENT_TYPES))
const categoryInput = enumInput(Object.values(SALARY_COMPONENT_CATEGORIES))
const calcMethodInput = enumInput(Object.values(CALCULATION_METHODS))
const frequencyInput = enumInput(Object.values(PAYROLL_FREQUENCIES))
const bonusTypeInput = enumInput(Object.values(BONUS_TYPES))
const deductionTypeInput = enumInput(Object.values(DEDUCTION_TYPES))
const directionInput = enumInput(Object.values(PAYROLL_ADJUSTMENT_DIRECTIONS))
const paymentMethodInput = enumInput(Object.values(PAYROLL_PAYMENT_METHODS))

export const payrollSummaryQuerySchema = z.object({
  organizationId: objectIdSchema.optional(),
  legalEntityId: objectIdSchema.optional(),
})

export const listPayrollQuerySchema = paginationQuerySchema.extend({
  organizationId: objectIdSchema.optional(),
  legalEntityId: objectIdSchema.optional(),
  employeeId: objectIdSchema.optional(),
  payrollPeriodId: objectIdSchema.optional(),
  payrollRunId: objectIdSchema.optional(),
  status: z.string().trim().max(40).optional(),
  componentType: z.string().trim().max(40).optional(),
  q: z.string().trim().max(100).optional(),
})

export const createSalaryComponentBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  legalEntityId: objectIdSchema.optional(),
  code: z.string().trim().min(2).max(32),
  name: z.string().trim().min(2).max(200),
  nameAr: optionalText(200),
  componentType: componentTypeInput,
  category: categoryInput,
  calculationMethod: calcMethodInput.optional(),
  fixedAmount: moneySchema.optional(),
  percentage: moneySchema.optional(),
  taxable: z.boolean().optional(),
  effectiveFrom: instantSchema,
  effectiveTo: instantSchema.optional(),
  description: optionalText(2000),
})

export const updateSalaryComponentBodySchema = z
  .object({
    name: z.string().trim().min(2).max(200).optional(),
    nameAr: optionalText(200),
    fixedAmount: moneySchema.optional(),
    percentage: moneySchema.optional(),
    taxable: z.boolean().optional(),
    status: z.string().trim().max(20).optional(),
    description: optionalText(2000),
  })
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one field to update')

export const createStructureBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  legalEntityId: objectIdSchema.optional(),
  code: z.string().trim().min(2).max(32),
  name: z.string().trim().min(2).max(200),
  currency: currencySchema.optional(),
  lines: z
    .array(
      z.object({
        salaryComponentId: objectIdSchema,
        calculationMethod: calcMethodInput.optional(),
        fixedAmount: moneySchema.optional(),
        percentage: moneySchema.optional(),
      }),
    )
    .optional(),
  description: optionalText(2000),
})

export const assignCompensationBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  employeeId: objectIdSchema,
  compensationStructureId: objectIdSchema.optional(),
  basicSalary: moneySchema,
  currency: currencySchema.optional(),
  effectiveFrom: instantSchema,
  effectiveTo: instantSchema.optional(),
  changeReason: optionalText(500),
  notes: optionalText(2000),
  lines: z
    .array(
      z.object({
        salaryComponentId: objectIdSchema,
        calculationMethod: calcMethodInput.optional(),
        fixedAmount: moneySchema.optional(),
        percentage: moneySchema.optional(),
      }),
    )
    .optional(),
})

export const createPeriodBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  legalEntityId: objectIdSchema,
  branchId: objectIdSchema.optional(),
  name: z.string().trim().min(2).max(120),
  periodNumber: z.string().trim().min(1).max(32),
  frequency: frequencyInput.optional(),
  startDate: instantSchema,
  endDate: instantSchema,
  payDate: instantSchema,
  currency: currencySchema.optional(),
  notes: optionalText(2000),
})

export const updatePeriodBodySchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    startDate: instantSchema.optional(),
    endDate: instantSchema.optional(),
    payDate: instantSchema.optional(),
    notes: optionalText(2000),
  })
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one field to update')

export const createRunBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  payrollPeriodId: objectIdSchema,
  branchId: objectIdSchema.optional(),
  notes: optionalText(2000),
})

export const calculateRunBodySchema = z.object({
  reason: optionalText(500),
})

export const payRunBodySchema = z.object({
  paymentMethod: paymentMethodInput.optional(),
  provider: optionalText(80),
})

export const createBonusBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  employeeId: objectIdSchema,
  payrollPeriodId: objectIdSchema.optional(),
  bonusType: bonusTypeInput.optional(),
  amount: moneySchema,
  currency: currencySchema.optional(),
  reason: optionalText(500),
  notes: optionalText(2000),
  effectiveDate: instantSchema.optional(),
})

export const createDeductionBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  employeeId: objectIdSchema,
  payrollPeriodId: objectIdSchema.optional(),
  deductionType: deductionTypeInput.optional(),
  amount: moneySchema,
  currency: currencySchema.optional(),
  reason: optionalText(500),
  effectiveDate: instantSchema.optional(),
  advanceId: objectIdSchema.optional(),
})

export const createAdjustmentBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  employeeId: objectIdSchema,
  payrollPeriodId: objectIdSchema,
  direction: directionInput,
  amount: moneySchema,
  currency: currencySchema.optional(),
  reason: z.string().trim().min(2).max(500),
})

export const createOvertimeBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  employeeId: objectIdSchema,
  payrollPeriodId: objectIdSchema.optional(),
  workDate: instantSchema,
  hours: z.string().trim().min(1).max(12),
  rate: moneySchema,
  amount: moneySchema,
  currency: currencySchema.optional(),
  reason: optionalText(500),
})

export const createAdvanceBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  employeeId: objectIdSchema,
  principalAmount: moneySchema,
  installmentAmount: moneySchema,
  currency: currencySchema.optional(),
  startDate: instantSchema.optional(),
  notes: optionalText(2000),
})
