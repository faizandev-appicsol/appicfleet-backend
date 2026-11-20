import { z } from 'zod'
import {
  MAX_UPLOAD_BASE64_LENGTH,
} from '../constants/customers.js'
import {
  ASSIGNMENT_STATUSES,
  COMPLIANCE_STATES,
  DOCUMENT_STATUSES,
  DOCUMENT_TYPES,
  OWNERSHIP_TYPES,
  RATE_STATUSES,
  RATE_TYPES,
  VEHICLE_FUEL_TYPES,
  VEHICLE_SORT_FIELDS,
  VEHICLE_STATUSES,
  VEHICLE_TRANSMISSIONS,
} from '../constants/vehicles.js'
import { MONEY_REGEX, isZeroMoney, normalizeMoney } from '../utils/money.js'
import { validateOwnership } from '../services/vehicles/ownership-rules.js'
import {
  AT_LEAST_ONE_FIELD_MESSAGE,
  atLeastOneField,
  currencySchema,
  idParamsSchema,
  objectIdSchema,
  paginationQuerySchema,
} from './common.validation.js'

const VEHICLE_PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

/** Public JSON uses lowercase enums; they are converted to the stored UPPERCASE form here. */
export function enumInput<T extends string>(values: readonly T[]) {
  const lowered = values.map((value) => value.toLowerCase()) as [Lowercase<T>, ...Lowercase<T>[]]
  return z.enum(lowered).transform((value) => value.toUpperCase() as Uppercase<Lowercase<T>>)
}

const statusInput = enumInput(Object.values(VEHICLE_STATUSES))
const transmissionInput = enumInput(Object.values(VEHICLE_TRANSMISSIONS))
const fuelTypeInput = enumInput(Object.values(VEHICLE_FUEL_TYPES))
const ownershipTypeInput = enumInput(Object.values(OWNERSHIP_TYPES))
const documentTypeInput = enumInput(Object.values(DOCUMENT_TYPES))
const documentStatusInput = enumInput(Object.values(DOCUMENT_STATUSES))
const rateTypeInput = enumInput(Object.values(RATE_TYPES))
const rateStatusInput = enumInput(Object.values(RATE_STATUSES))
const assignmentStatusInput = enumInput(Object.values(ASSIGNMENT_STATUSES))
const complianceStateInput = z.enum(Object.values(COMPLIANCE_STATES))

// ---------------------------------------------------------------------------------------------
// Scalars
// ---------------------------------------------------------------------------------------------

/** Required text. */
export function text(max: number, min = 1) {
  return z.string().trim().min(min, 'This field is required').max(max, `Use at most ${max} characters`)
}

/** Optional text on create; blank is treated as "not provided". */
export function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max, `Use at most ${max} characters`)
    .transform((value) => (value === '' ? undefined : value))
    .optional()
}

/** Optional text on update; null or blank clears the field. */
export function clearableText(max: number) {
  return z
    .string()
    .trim()
    .max(max, `Use at most ${max} characters`)
    .nullable()
    .transform((value) => (value === null || value === '' ? null : value))
    .optional()
}

const plateNumberSchema = z
  .string()
  .trim()
  .min(2, 'Enter the plate number')
  .max(20, 'Use at most 20 characters')
  .regex(/^[A-Za-z0-9][A-Za-z0-9 -]*$/, 'Use letters, numbers, spaces or dashes')
  .transform((value) => value.toUpperCase())

const VIN_REGEX = /^[A-Za-z0-9]{5,32}$/
const vinValue = z
  .string()
  .regex(VIN_REGEX, 'Use 5-32 letters and digits')
  .transform((value) => value.toUpperCase())

/** Create: blank VIN is dropped so the field is omitted (the unique index only covers real VINs). */
const vinCreateSchema = z
  .string()
  .trim()
  .transform((value) => (value === '' ? undefined : value))
  .pipe(vinValue.optional())
  .optional()

/** Update: null or blank clears the VIN. */
const vinUpdateSchema = z
  .string()
  .trim()
  .nullable()
  .transform((value) => (value === '' ? null : value))
  .pipe(vinValue.nullable())
  .optional()

const yearSchema = z.number().int('Use a whole year').min(1980).max(2100)
const seatingSchema = z.number().int('Use a whole number').min(1).max(60)
const mileageSchema = z.number().int('Use whole kilometres').min(0).max(5_000_000)

/** Calendar date, `YYYY-MM-DD`, stored as UTC midnight. */
export const dateOnlySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`)
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
  }, 'Enter a real calendar date')
  .transform((value) => new Date(`${value}T00:00:00.000Z`))

/** Calendar date that must be today or in the future (UTC day). */
export const futureDateOnlySchema = dateOnlySchema.refine((value) => {
  const today = new Date()
  const utcToday = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  return value.getTime() >= utcToday
}, 'Expiry dates must be today or a future date')

/** ISO 8601 instant with an explicit offset (`Z` or `+05:00`). */
export const instantSchema = z
  .string()
  .trim()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/,
    'Use an ISO 8601 date-time with a timezone, for example 2026-01-31T09:00:00Z',
  )
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Enter a real date and time')
  .transform((value) => new Date(value))

/** Money is a decimal string, never a number. "150" is normalized to "150.00". */
export const moneySchema = z
  .string()
  .trim()
  .regex(MONEY_REGEX, 'Use an amount such as 150.00 (up to 2 decimals)')
  .transform(normalizeMoney)

export const positiveMoneySchema = z
  .string()
  .trim()
  .regex(MONEY_REGEX, 'Use an amount such as 150.00 (up to 2 decimals)')
  .refine((value) => !isZeroMoney(value), 'Amount must be greater than zero')
  .transform(normalizeMoney)

/** Opaque object-store key: no scheme, query string or credentials (so it cannot be a URL). */
const storageKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(300)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._\-/]*$/, 'Use an opaque storage key, not a URL')
  .refine((value) => !value.includes('..'), 'Storage key must not contain ".."')

// ---------------------------------------------------------------------------------------------
// Vehicle
// ---------------------------------------------------------------------------------------------

const interestRateSchema = z
  .string()
  .trim()
  .regex(/^\d{1,3}(\.\d{1,4})?$/, 'Use a rate such as 5.5')
  .refine((value) => Number(value) <= 100, 'Interest rate must be at most 100')

const ownershipInputSchema = z.object({
  investorName: text(120).optional(),
  investorReference: text(80).optional(),
  lenderName: text(120).optional(),
  expectedReturnOn: dateOnlySchema.optional(),
  lessorName: text(120).optional(),
  leaseStartsOn: dateOnlySchema.optional(),
  leaseEndsOn: dateOnlySchema.optional(),
  leaseAmount: moneySchema.optional(),
  leaseCurrency: currencySchema.optional(),
  purchasePrice: moneySchema.optional(),
  downPayment: moneySchema.optional(),
  financedAmount: moneySchema.optional(),
  interestRate: interestRateSchema.optional(),
  numberOfInstallments: z.number().int().min(1).max(600).optional(),
})

const complianceCreateSchema = z.object({
  registrationExpiresOn: futureDateOnlySchema.optional(),
  insuranceExpiresOn: futureDateOnlySchema.optional(),
  inspectionExpiresOn: futureDateOnlySchema.optional(),
})

/** Updates may keep an existing past expiry; clearing uses null. New values should still be valid dates. */
const complianceUpdateSchema = z.object({
  registrationExpiresOn: dateOnlySchema.nullable().optional(),
  insuranceExpiresOn: dateOnlySchema.nullable().optional(),
  inspectionExpiresOn: dateOnlySchema.nullable().optional(),
})

export const createVehicleBodySchema = z
  .object({
    /** Platform-wide accounts must name the organization; everyone else is bound to their own. */
    organizationId: objectIdSchema.optional(),
    branchId: objectIdSchema,
    /** Defaults to the branch's legal entity. */
    legalEntityId: objectIdSchema.optional(),
    plateNumber: plateNumberSchema,
    vin: vinCreateSchema,
    make: text(60),
    model: text(60),
    year: yearSchema,
    color: optionalText(40),
    category: text(60),
    transmission: transmissionInput,
    fuelType: fuelTypeInput,
    seatingCapacity: seatingSchema,
    engineNumber: optionalText(60),
    mileageKm: mileageSchema.default(0),
    purchasedOn: dateOnlySchema.optional(),
    salikTagNumber: optionalText(40),
    mulkiyaNumber: optionalText(60),
    latitude: optionalText(24),
    longitude: optionalText(24),
    featureOnWebsite: z.boolean().optional(),
    notes: optionalText(2000),
    ownershipType: ownershipTypeInput,
    ownership: ownershipInputSchema.optional(),
    compliance: complianceCreateSchema.optional(),
  })
  .superRefine((value, ctx) => {
    const errors = validateOwnership(value.ownershipType, value.ownership)
    for (const [field, message] of Object.entries(errors)) {
      ctx.addIssue({ code: 'custom', message, path: ['ownership', field] })
    }
  })

/**
 * Status is not editable here (use POST /:id/status). Ownership is validated against the
 * effective ownership type in the service, because it may rely on the stored type.
 */
export const updateVehicleBodySchema = z
  .object({
    branchId: objectIdSchema.optional(),
    legalEntityId: objectIdSchema.optional(),
    plateNumber: plateNumberSchema.optional(),
    vin: vinUpdateSchema,
    make: text(60).optional(),
    model: text(60).optional(),
    year: yearSchema.optional(),
    color: clearableText(40),
    category: text(60).optional(),
    transmission: transmissionInput.optional(),
    fuelType: fuelTypeInput.optional(),
    seatingCapacity: seatingSchema.optional(),
    engineNumber: clearableText(60),
    mileageKm: mileageSchema.optional(),
    purchasedOn: dateOnlySchema.nullable().optional(),
    salikTagNumber: clearableText(40),
    mulkiyaNumber: clearableText(60),
    latitude: clearableText(24),
    longitude: clearableText(24),
    featureOnWebsite: z.boolean().optional(),
    notes: clearableText(2000),
    ownershipType: ownershipTypeInput.optional(),
    ownership: ownershipInputSchema.optional(),
    compliance: complianceUpdateSchema.optional(),
  })
  .refine(atLeastOneField, AT_LEAST_ONE_FIELD_MESSAGE)

export const vehicleIdParamsSchema = idParamsSchema

/** Primary vehicle photo upload (JPEG / PNG / WebP, max ~5 MB decoded). */
export const uploadVehiclePhotoBodySchema = z.object({
  filename: z.string().trim().min(1, 'Enter a filename').max(255, 'Use at most 255 characters'),
  mimeType: z.enum(VEHICLE_PHOTO_MIME_TYPES, {
    error: 'Use a JPEG, PNG or WebP image',
  }),
  contentBase64: z
    .string()
    .min(1, 'Provide the file content')
    .max(MAX_UPLOAD_BASE64_LENGTH, 'The file is too large (5 MB maximum)'),
})

export const listVehiclesQuerySchema = paginationQuerySchema.extend({
  /** Only used by platform-wide accounts; ignored for organization-bound accounts. */
  organizationId: objectIdSchema.optional(),
  status: statusInput.optional(),
  ownershipType: ownershipTypeInput.optional(),
  branchId: objectIdSchema.optional(),
  compliance: complianceStateInput.optional(),
  /** Free-text vehicle type filter (case-insensitive exact). */
  category: text(60).optional(),
  sort: z.enum(VEHICLE_SORT_FIELDS).optional(),
  order: z.enum(['asc', 'desc']).optional(),
})

/** Same filters as the register list, without pagination/status (status is aggregated). */
export const vehicleStatsQuerySchema = z.object({
  organizationId: objectIdSchema.optional(),
  ownershipType: ownershipTypeInput.optional(),
  branchId: objectIdSchema.optional(),
  compliance: complianceStateInput.optional(),
  category: text(60).optional(),
  search: z.string().trim().max(120).optional(),
})

export const changeVehicleStatusBodySchema = z.object({
  status: statusInput,
  reason: text(500, 3),
})

export const vehicleStatusHistoryQuerySchema = paginationQuerySchema.omit({ search: true })

// ---------------------------------------------------------------------------------------------
// Rates
// ---------------------------------------------------------------------------------------------

export const listVehicleRatesQuerySchema = paginationQuerySchema.omit({ search: true }).extend({
  rateType: rateTypeInput.optional(),
  status: rateStatusInput.optional(),
})

export const createVehicleRateBodySchema = z
  .object({
    rateType: rateTypeInput,
    amount: positiveMoneySchema,
    currency: currencySchema,
    effectiveFrom: instantSchema,
    /** Omit or null for an open-ended card. */
    effectiveTo: instantSchema.nullable().optional(),
  })
  .refine(
    (value) => !value.effectiveTo || value.effectiveTo.getTime() > value.effectiveFrom.getTime(),
    { message: 'effectiveTo must be after effectiveFrom', path: ['effectiveTo'] },
  )

// ---------------------------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------------------------

export const listVehicleDocumentsQuerySchema = paginationQuerySchema.omit({ search: true }).extend({
  status: documentStatusInput.optional(),
  documentType: documentTypeInput.optional(),
})

export const createVehicleDocumentBodySchema = z
  .object({
    documentType: documentTypeInput,
    documentNumber: optionalText(80),
    issuedOn: dateOnlySchema.optional(),
    expiresOn: futureDateOnlySchema.optional(),
    storageKey: storageKeySchema,
  })
  .refine(
    (value) =>
      !value.issuedOn || !value.expiresOn || value.expiresOn.getTime() >= value.issuedOn.getTime(),
    { message: 'expiresOn must not be before issuedOn', path: ['expiresOn'] },
  )

export const vehicleDocumentParamsSchema = z.object({
  id: objectIdSchema,
  documentId: objectIdSchema,
})

// ---------------------------------------------------------------------------------------------
// Availability and assignments
// ---------------------------------------------------------------------------------------------

export const checkAvailabilityBodySchema = z
  .object({
    startsAt: instantSchema,
    endsAt: instantSchema,
  })
  .refine((value) => value.endsAt.getTime() > value.startsAt.getTime(), {
    message: 'endsAt must be after startsAt',
    path: ['endsAt'],
  })

export const createVehicleAssignmentBodySchema = z
  .object({
    startsAt: instantSchema,
    endsAt: instantSchema,
    reason: text(200, 3),
  })
  .refine((value) => value.endsAt.getTime() > value.startsAt.getTime(), {
    message: 'endsAt must be after startsAt',
    path: ['endsAt'],
  })

export const listVehicleAssignmentsQuerySchema = paginationQuerySchema.omit({ search: true }).extend({
  status: assignmentStatusInput.optional(),
})

export const vehicleAssignmentParamsSchema = z.object({
  id: objectIdSchema,
  assignmentId: objectIdSchema,
})

export type CreateVehicleBody = z.infer<typeof createVehicleBodySchema>
export type UpdateVehicleBody = z.infer<typeof updateVehicleBodySchema>
export type UploadVehiclePhotoBody = z.infer<typeof uploadVehiclePhotoBodySchema>
export type VehicleIdParams = z.infer<typeof vehicleIdParamsSchema>
export type ListVehiclesQuery = z.infer<typeof listVehiclesQuerySchema>
export type VehicleStatsQuery = z.infer<typeof vehicleStatsQuerySchema>
export type ChangeVehicleStatusBody = z.infer<typeof changeVehicleStatusBodySchema>
export type VehicleStatusHistoryQuery = z.infer<typeof vehicleStatusHistoryQuerySchema>
export type ListVehicleRatesQuery = z.infer<typeof listVehicleRatesQuerySchema>
export type CreateVehicleRateBody = z.infer<typeof createVehicleRateBodySchema>
export type ListVehicleDocumentsQuery = z.infer<typeof listVehicleDocumentsQuerySchema>
export type CreateVehicleDocumentBody = z.infer<typeof createVehicleDocumentBodySchema>
export type VehicleDocumentParams = z.infer<typeof vehicleDocumentParamsSchema>
export type CheckAvailabilityBody = z.infer<typeof checkAvailabilityBodySchema>
export type CreateVehicleAssignmentBody = z.infer<typeof createVehicleAssignmentBodySchema>
export type ListVehicleAssignmentsQuery = z.infer<typeof listVehicleAssignmentsQuerySchema>
export type VehicleAssignmentParams = z.infer<typeof vehicleAssignmentParamsSchema>
