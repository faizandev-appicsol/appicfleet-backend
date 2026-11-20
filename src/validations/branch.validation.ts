import { z } from 'zod'
import {
  AT_LEAST_ONE_FIELD_MESSAGE,
  atLeastOneField,
  businessCodeSchema,
  countrySchema,
  entityStatusSchema,
  idParamsSchema,
  objectIdSchema,
  paginationQuerySchema,
  timezoneSchema,
} from './common.validation.js'

const nameSchema = z.string().trim().min(2, 'Name must be at least 2 characters').max(120)
const line = z.string().trim().max(160).optional()

export const branchAddressSchema = z.object({
  line1: line,
  line2: line,
  city: z.string().trim().max(80).optional(),
  region: z.string().trim().max(80).optional(),
  postalCode: z.string().trim().max(20).optional(),
  country: countrySchema.optional(),
})

export const createBranchBodySchema = z.object({
  /** Platform-wide accounts must name the organization; others may only name their own. */
  organizationId: objectIdSchema.optional(),
  legalEntityId: objectIdSchema,
  name: nameSchema,
  code: businessCodeSchema,
  address: branchAddressSchema.optional(),
  timezone: timezoneSchema,
  status: entityStatusSchema.optional(),
})

// `code` is immutable once created (it is the stable per-organization identifier).
export const updateBranchBodySchema = z
  .object({
    legalEntityId: objectIdSchema.optional(),
    name: nameSchema.optional(),
    address: branchAddressSchema.optional(),
    timezone: timezoneSchema.optional(),
    status: entityStatusSchema.optional(),
  })
  .refine(atLeastOneField, AT_LEAST_ONE_FIELD_MESSAGE)

export const branchIdParamsSchema = idParamsSchema

export const listBranchesQuerySchema = paginationQuerySchema.extend({
  organizationId: objectIdSchema.optional(),
  legalEntityId: objectIdSchema.optional(),
  status: entityStatusSchema.optional(),
})

export type CreateBranchBody = z.infer<typeof createBranchBodySchema>
export type UpdateBranchBody = z.infer<typeof updateBranchBodySchema>
export type BranchIdParams = z.infer<typeof branchIdParamsSchema>
export type ListBranchesQuery = z.infer<typeof listBranchesQuerySchema>
