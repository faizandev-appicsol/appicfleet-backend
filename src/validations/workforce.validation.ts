import { z } from 'zod'
import {
  ATTENDANCE_SOURCES,
  ATTENDANCE_STATUSES,
  BREAK_TYPES,
  LEAVE_ACCRUAL_METHODS,
  LEAVE_DAY_PARTS,
  WEEKDAY_CODES,
} from '../constants/workforce.js'
import { objectIdSchema, paginationQuerySchema } from './common.validation.js'
import { enumInput, instantSchema, optionalText } from './vehicle.validation.js'

const hmSchema = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm 24-hour time')
const ymdSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
const leaveDaysSchema = z
  .string()
  .trim()
  .regex(/^-?\d{1,5}(\.\d{1,2})?$/, 'Use decimal days e.g. 2.00')

const breakSchema = z.object({
  startTime: hmSchema,
  endTime: hmSchema,
  type: enumInput(Object.values(BREAK_TYPES)).optional(),
})

export const workforceSummaryQuerySchema = z.object({
  organizationId: objectIdSchema.optional(),
})

export const workforceCalendarQuerySchema = z.object({
  organizationId: objectIdSchema.optional(),
  fromDate: ymdSchema,
  toDate: ymdSchema,
  employeeId: objectIdSchema.optional(),
  view: z.enum(['day', 'week', 'month']).optional(),
})

export const listWorkforceQuerySchema = paginationQuerySchema.extend({
  organizationId: objectIdSchema.optional(),
  employeeId: objectIdSchema.optional(),
  leaveTypeId: objectIdSchema.optional(),
  status: z.string().trim().max(40).optional(),
  source: z.string().trim().max(40).optional(),
  fromDate: ymdSchema.optional(),
  toDate: ymdSchema.optional(),
  branchId: objectIdSchema.optional(),
  periodYear: z.coerce.number().int().min(2000).max(2100).optional(),
  resolved: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
})

export const createScheduleBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  legalEntityId: objectIdSchema.optional(),
  code: z.string().trim().min(2).max(32),
  name: z.string().trim().min(2).max(200),
  nameAr: optionalText(200),
  description: optionalText(2000),
  timezone: z.string().trim().max(64).optional(),
  workingDays: z.array(enumInput(Object.values(WEEKDAY_CODES))).min(1),
  startTime: hmSchema,
  endTime: hmSchema,
  breaks: z.array(breakSchema).optional(),
  graceMinutes: z.number().int().min(0).max(240).optional(),
})

export const updateScheduleBodySchema = createScheduleBodySchema
  .omit({ organizationId: true, code: true })
  .partial()
  .extend({
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  })

export const createShiftBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  legalEntityId: objectIdSchema.optional(),
  code: z.string().trim().min(2).max(32),
  name: z.string().trim().min(2).max(200),
  nameAr: optionalText(200),
  description: optionalText(2000),
  timezone: z.string().trim().max(64).optional(),
  startTime: hmSchema,
  endTime: hmSchema,
  breaks: z.array(breakSchema).optional(),
  graceMinutes: z.number().int().min(0).max(240).optional(),
})

export const updateShiftBodySchema = createShiftBodySchema
  .omit({ organizationId: true, code: true })
  .partial()
  .extend({
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  })

export const assignScheduleBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  employeeId: objectIdSchema,
  workScheduleId: objectIdSchema.optional(),
  shiftDefinitionId: objectIdSchema.optional(),
  effectiveFrom: instantSchema,
  effectiveTo: instantSchema.optional(),
  reason: optionalText(500),
})

export const clockBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  employeeId: objectIdSchema.optional(),
  at: instantSchema.optional(),
  source: enumInput(Object.values(ATTENDANCE_SOURCES)).optional(),
  notes: optionalText(2000),
})

export const correctionBodySchema = z.object({
  requestedClockInAt: instantSchema.optional(),
  requestedClockOutAt: instantSchema.optional(),
  requestedStatus: enumInput(Object.values(ATTENDANCE_STATUSES)).optional(),
  reason: z.string().trim().min(3).max(2000),
})

export const reviewCorrectionBodySchema = z.object({
  approve: z.boolean(),
  reviewNotes: optionalText(2000),
})

export const createLeaveTypeBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  legalEntityId: objectIdSchema.optional(),
  code: z.string().trim().min(2).max(32),
  name: z.string().trim().min(2).max(200),
  nameAr: optionalText(200),
  description: optionalText(2000),
  paid: z.boolean().optional(),
  requiresApproval: z.boolean().optional(),
  requiresDocument: z.boolean().optional(),
})

export const updateLeaveTypeBodySchema = createLeaveTypeBodySchema
  .omit({ organizationId: true, code: true })
  .partial()
  .extend({
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  })

export const createLeavePolicyBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  legalEntityId: objectIdSchema.optional(),
  leaveTypeId: objectIdSchema,
  name: z.string().trim().min(2).max(200),
  accrualMethod: enumInput(Object.values(LEAVE_ACCRUAL_METHODS)),
  annualEntitlementDays: leaveDaysSchema,
  carryForwardAllowed: z.boolean().optional(),
  maxCarryForwardDays: leaveDaysSchema.optional(),
  expiryMonths: z.number().int().min(0).max(60).optional(),
  effectiveFrom: instantSchema,
  effectiveTo: instantSchema.optional(),
})

export const leaveRequestBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  employeeId: objectIdSchema.optional(),
  leaveTypeId: objectIdSchema,
  startDate: ymdSchema,
  endDate: ymdSchema,
  dayPart: enumInput(Object.values(LEAVE_DAY_PARTS)).optional(),
  partialHours: leaveDaysSchema.optional(),
  reason: optionalText(2000),
  documentStorageKey: optionalText(128),
  idempotencyKey: optionalText(128),
  submit: z.boolean().optional(),
})

export const leaveReviewBodySchema = z.object({
  notes: optionalText(2000),
})

export const leaveBalanceAdjustBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  employeeId: objectIdSchema,
  leaveTypeId: objectIdSchema,
  periodYear: z.number().int().min(2000).max(2100),
  days: leaveDaysSchema,
  note: optionalText(500),
})

export const createHolidayBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  legalEntityId: objectIdSchema.optional(),
  branchId: objectIdSchema.optional(),
  name: z.string().trim().min(2).max(200),
  nameAr: optionalText(200),
  date: ymdSchema,
  country: z.string().trim().length(2).optional(),
  recurring: z.boolean().optional(),
})

export const updateHolidayBodySchema = createHolidayBodySchema
  .omit({ organizationId: true })
  .partial()
  .extend({
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  })

export const createOvertimeBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  employeeId: objectIdSchema,
  attendanceRecordId: objectIdSchema.optional(),
  workDate: ymdSchema,
  minutes: z.number().int().positive().max(24 * 60),
  reason: optionalText(500),
})

export const approveOvertimeBodySchema = z.object({
  currency: z.string().trim().length(3).optional(),
})

export const importAttendanceBodySchema = z.object({
  organizationId: objectIdSchema.optional(),
  source: enumInput(Object.values(ATTENDANCE_SOURCES)),
  externalBatchId: z.string().trim().min(2).max(128),
  rows: z
    .array(
      z.object({
        employeeNumber: z.string().trim().min(1).max(32),
        businessDate: ymdSchema,
        clockInAt: instantSchema.optional(),
        clockOutAt: instantSchema.optional(),
        externalReference: optionalText(128),
      }),
    )
    .max(5000),
})
