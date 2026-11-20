import { z } from 'zod'
import {
  REPORT_DATE_PRESETS,
  REVENUE_GROUP_BY,
  UPCOMING_RETURN_WINDOWS,
} from '../constants/reporting.js'
import { objectIdSchema, paginationQuerySchema, timezoneSchema } from './common.validation.js'
import { enumInput, instantSchema } from './vehicle.validation.js'

const presetInput = enumInput(Object.values(REPORT_DATE_PRESETS))
const groupByInput = enumInput(Object.values(REVENUE_GROUP_BY))
const upcomingInput = enumInput(Object.values(UPCOMING_RETURN_WINDOWS))

export const reportScopeQuerySchema = paginationQuerySchema
  .extend({
    organizationId: objectIdSchema.optional(),
    branchId: objectIdSchema.optional(),
    legalEntityId: objectIdSchema.optional(),
    preset: presetInput.optional(),
    from: instantSchema.optional(),
    to: instantSchema.optional(),
    timezone: timezoneSchema.optional(),
    sort: z.string().trim().max(40).optional(),
    order: z.enum(['asc', 'desc']).optional(),
  })
  .superRefine((value, ctx) => {
    if ((value.preset?.toUpperCase() === 'CUSTOM' || (!value.preset && value.from)) && (!value.from || !value.to)) {
      ctx.addIssue({ code: 'custom', message: 'Custom range requires from and to', path: ['from'] })
    }
  })

export const dashboardQuerySchema = reportScopeQuerySchema.extend({
  upcomingWindow: upcomingInput.optional(),
})

export const bookingReportQuerySchema = reportScopeQuerySchema.extend({
  status: z.string().trim().max(32).optional(),
  customerId: objectIdSchema.optional(),
  vehicleId: objectIdSchema.optional(),
})

export const vehicleReportQuerySchema = reportScopeQuerySchema.extend({
  status: z.string().trim().max(32).optional(),
  category: z.string().trim().max(32).optional(),
})

export const utilizationReportQuerySchema = reportScopeQuerySchema.extend({
  vehicleId: objectIdSchema.optional(),
  category: z.string().trim().max(32).optional(),
})

export const customerReportQuerySchema = reportScopeQuerySchema

export const contractReportQuerySchema = reportScopeQuerySchema.extend({
  status: z.string().trim().max(32).optional(),
  customerId: objectIdSchema.optional(),
  vehicleId: objectIdSchema.optional(),
  upcomingWindow: upcomingInput.optional(),
})

export const paymentReportQuerySchema = reportScopeQuerySchema.extend({
  status: z.string().trim().max(32).optional(),
  method: z.string().trim().max(32).optional(),
  customerId: objectIdSchema.optional(),
})

export const expenseReportQuerySchema = reportScopeQuerySchema.extend({
  status: z.string().trim().max(32).optional(),
  vendorId: objectIdSchema.optional(),
  vehicleId: objectIdSchema.optional(),
  category: z.string().trim().max(40).optional(),
})

export const maintenanceReportQuerySchema = reportScopeQuerySchema.extend({
  vehicleId: objectIdSchema.optional(),
  vendorId: objectIdSchema.optional(),
})

export const finesReportQuerySchema = reportScopeQuerySchema.extend({
  kind: z.enum(['fine', 'toll', 'FINE', 'TOLL']).optional(),
})

export const refundsReportQuerySchema = reportScopeQuerySchema.extend({
  status: z.string().trim().max(32).optional(),
})

export const vatReportQuerySchema = z.object({
  organizationId: objectIdSchema.optional(),
  legalEntityId: objectIdSchema,
  taxPeriodId: objectIdSchema.optional(),
})

export const revenueTrendQuerySchema = reportScopeQuerySchema.extend({
  groupBy: groupByInput.optional(),
})

export const profitabilityQuerySchema = reportScopeQuerySchema.extend({
  dimension: z.enum(['branch', 'customer', 'vehicle', 'vehicle_type']).optional(),
})

export const exportQuerySchema = reportScopeQuerySchema.extend({
  kind: z.enum([
    'bookings',
    'vehicles',
    'customers',
    'contracts',
    'payments',
    'expenses',
    'maintenance',
    'fines',
    'refunds',
  ]),
  status: z.string().trim().max(32).optional(),
  method: z.string().trim().max(32).optional(),
  customerId: objectIdSchema.optional(),
  vehicleId: objectIdSchema.optional(),
  vendorId: objectIdSchema.optional(),
  category: z.string().trim().max(40).optional(),
  kindFilter: z.enum(['fine', 'toll']).optional(),
})

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>
export type ReportScopeQuery = z.infer<typeof reportScopeQuerySchema>
export type ExportQuery = z.infer<typeof exportQuerySchema>
