import { z } from 'zod'
import {
  AT_LEAST_ONE_FIELD_MESSAGE,
  atLeastOneField,
  countrySchema,
  currencySchema,
  entityStatusSchema,
  idParamsSchema,
  objectIdSchema,
  paginationQuerySchema,
  timezoneSchema,
} from './common.validation.js'

const legalNameSchema = z.string().trim().min(2, 'Legal name is too short').max(160)
const displayNameSchema = z.string().trim().min(2, 'Display name is too short').max(120)
const taxIdentifierSchema = z.string().trim().min(1).max(64)

export const createLegalEntityBodySchema = z.object({
  /** Platform-wide accounts must name the organization; others may only name their own. */
  organizationId: objectIdSchema.optional(),
  legalName: legalNameSchema,
  displayName: displayNameSchema,
  country: countrySchema,
  taxIdentifier: taxIdentifierSchema.optional(),
  defaultCurrency: currencySchema,
  timezone: timezoneSchema,
  status: entityStatusSchema.optional(),
})

export const updateLegalEntityBodySchema = z
  .object({
    legalName: legalNameSchema.optional(),
    displayName: displayNameSchema.optional(),
    country: countrySchema.optional(),
    taxIdentifier: taxIdentifierSchema.nullable().optional(),
    defaultCurrency: currencySchema.optional(),
    timezone: timezoneSchema.optional(),
    status: entityStatusSchema.optional(),
  })
  .refine(atLeastOneField, AT_LEAST_ONE_FIELD_MESSAGE)

export const legalEntityIdParamsSchema = idParamsSchema

export const listLegalEntitiesQuerySchema = paginationQuerySchema.extend({
  organizationId: objectIdSchema.optional(),
  status: entityStatusSchema.optional(),
})

export type CreateLegalEntityBody = z.infer<typeof createLegalEntityBodySchema>
export type UpdateLegalEntityBody = z.infer<typeof updateLegalEntityBodySchema>
export type LegalEntityIdParams = z.infer<typeof legalEntityIdParamsSchema>
export type ListLegalEntitiesQuery = z.infer<typeof listLegalEntitiesQuerySchema>
