import { z } from 'zod'
import {
  BOOKING_SORT_FIELDS,
  BOOKING_SOURCES,
  BOOKING_STATUSES,
  HOLD_MAX_MINUTES,
  HOLD_MIN_MINUTES,
} from '../constants/bookings.js'
import { VEHICLE_CATEGORIES, OWNERSHIP_TYPES } from '../constants/vehicles.js'
import {
  AT_LEAST_ONE_FIELD_MESSAGE,
  atLeastOneField,
  idParamsSchema,
  objectIdSchema,
  paginationQuerySchema,
} from './common.validation.js'
import { enumInput, instantSchema, optionalText } from './vehicle.validation.js'

const statusInput = enumInput(Object.values(BOOKING_STATUSES))
const sourceInput = enumInput(Object.values(BOOKING_SOURCES))
const categoryInput = enumInput(Object.values(VEHICLE_CATEGORIES))
const ownershipInput = enumInput(Object.values(OWNERSHIP_TYPES))

const holdMinutesSchema = z.coerce
  .number()
  .int()
  .min(HOLD_MIN_MINUTES, `Use at least ${HOLD_MIN_MINUTES} minutes`)
  .max(HOLD_MAX_MINUTES, `Use at most ${HOLD_MAX_MINUTES} minutes`)
  .optional()

const windowFields = {
  startsAt: instantSchema,
  endsAt: instantSchema,
}

function windowRefine(value: { startsAt: Date; endsAt: Date }, ctx: z.RefinementCtx) {
  if (value.endsAt.getTime() <= value.startsAt.getTime()) {
    ctx.addIssue({ code: 'custom', message: 'Return must be after pickup', path: ['endsAt'] })
  }
}

export const createBookingBodySchema = z
  .object({
    organizationId: objectIdSchema.optional(),
    customerId: objectIdSchema,
    vehicleId: objectIdSchema.optional(),
    returnBranchId: objectIdSchema.optional(),
    ...windowFields,
    source: sourceInput.optional(),
    sourceChannel: optionalText(80),
    campaignReference: optionalText(80),
    externalReference: optionalText(120),
    notes: optionalText(2000),
  })
  .superRefine(windowRefine)

export const updateBookingBodySchema = z
  .object({
    customerId: objectIdSchema.optional(),
    vehicleId: objectIdSchema.nullable().optional(),
    returnBranchId: objectIdSchema.optional(),
    startsAt: instantSchema.optional(),
    endsAt: instantSchema.optional(),
    sourceChannel: z.string().trim().max(80).nullable().optional(),
    campaignReference: z.string().trim().max(80).nullable().optional(),
    externalReference: z.string().trim().max(120).nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .refine(atLeastOneField, AT_LEAST_ONE_FIELD_MESSAGE)
  .superRefine((value, ctx) => {
    if (value.startsAt && value.endsAt && value.endsAt.getTime() <= value.startsAt.getTime()) {
      ctx.addIssue({ code: 'custom', message: 'Return must be after pickup', path: ['endsAt'] })
    }
  })

export const holdBookingBodySchema = z.object({ holdMinutes: holdMinutesSchema })

export const cancelBookingBodySchema = z.object({
  reason: z.string().trim().min(3, 'Enter a reason').max(500, 'Use at most 500 characters'),
})

export const intakeBookingBodySchema = z
  .object({
    organizationId: objectIdSchema.optional(),
    customerId: objectIdSchema,
    vehicleId: objectIdSchema,
    returnBranchId: objectIdSchema.optional(),
    ...windowFields,
    source: sourceInput,
    sourceChannel: optionalText(80),
    campaignReference: optionalText(80),
    externalReference: optionalText(120),
    externalEventId: optionalText(200),
    idempotencyKey: optionalText(200),
    notes: optionalText(2000),
    holdMinutes: holdMinutesSchema,
  })
  .superRefine(windowRefine)

export const listBookingsQuerySchema = paginationQuerySchema.extend({
  organizationId: objectIdSchema.optional(),
  status: statusInput.optional(),
  source: sourceInput.optional(),
  branchId: objectIdSchema.optional(),
  vehicleId: objectIdSchema.optional(),
  customerId: objectIdSchema.optional(),
  pickupFrom: instantSchema.optional(),
  pickupTo: instantSchema.optional(),
  returnFrom: instantSchema.optional(),
  returnTo: instantSchema.optional(),
  sort: z.enum(BOOKING_SORT_FIELDS).optional(),
  order: z.enum(['asc', 'desc']).optional(),
})

export const calendarQuerySchema = z
  .object({
    organizationId: objectIdSchema.optional(),
    from: instantSchema,
    to: instantSchema,
    branchId: objectIdSchema.optional(),
    status: statusInput.optional(),
    vehicleId: objectIdSchema.optional(),
    customerId: objectIdSchema.optional(),
    category: categoryInput.optional(),
    source: sourceInput.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.to.getTime() <= value.from.getTime()) {
      ctx.addIssue({ code: 'custom', message: 'The range end must be after the start', path: ['to'] })
    }
  })

export const availabilityQuerySchema = z
  .object({
    organizationId: objectIdSchema.optional(),
    branchId: objectIdSchema.optional(),
    category: categoryInput.optional(),
    ownershipType: ownershipInput.optional(),
    ...windowFields,
  })
  .superRefine(windowRefine)

export const bookingIdParamsSchema = idParamsSchema

export type CreateBookingBody = z.infer<typeof createBookingBodySchema>
export type UpdateBookingBody = z.infer<typeof updateBookingBodySchema>
export type HoldBookingBody = z.infer<typeof holdBookingBodySchema>
export type CancelBookingBody = z.infer<typeof cancelBookingBodySchema>
export type IntakeBookingBody = z.infer<typeof intakeBookingBodySchema>
export type ListBookingsQuery = z.infer<typeof listBookingsQuerySchema>
export type CalendarQuery = z.infer<typeof calendarQuerySchema>
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>
