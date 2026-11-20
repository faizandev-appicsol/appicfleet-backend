import { z } from 'zod'

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Enter a valid identifier')

export const idParamsSchema = z.object({ id: objectIdSchema })

export const entityStatuses = ['active', 'inactive'] as const
export const entityStatusSchema = z.enum(entityStatuses)

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().trim().max(100).optional(),
})

export const countrySchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{2}$/, 'Use a 2-letter country code')
  .transform((value) => value.toUpperCase())

export const currencySchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{3}$/, 'Use a 3-letter currency code')
  .transform((value) => value.toUpperCase())

function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value })
    return true
  } catch {
    return false
  }
}

export const timezoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine(isValidTimeZone, 'Enter a valid IANA timezone, for example Asia/Karachi')

export const businessCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]{1,31}$/, 'Use 2-32 letters, numbers, dashes or underscores')
  .transform((value) => value.toUpperCase())

export function atLeastOneField<T extends Record<string, unknown>>(value: T): boolean {
  return Object.values(value).some((field) => field !== undefined)
}

export const AT_LEAST_ONE_FIELD_MESSAGE = 'Provide at least one field to update'
