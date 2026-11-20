import { z } from 'zod'
import {
  AT_LEAST_ONE_FIELD_MESSAGE,
  atLeastOneField,
  businessCodeSchema,
  entityStatusSchema,
  idParamsSchema,
  paginationQuerySchema,
} from './common.validation.js'

const nameSchema = z
  .string()
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(120, 'Name must be 120 characters or fewer')

export const createOrganizationBodySchema = z.object({
  name: nameSchema,
  code: businessCodeSchema,
  status: entityStatusSchema.optional(),
})

// `code` is immutable once created.
export const updateOrganizationBodySchema = z
  .object({
    name: nameSchema.optional(),
    status: entityStatusSchema.optional(),
  })
  .refine(atLeastOneField, AT_LEAST_ONE_FIELD_MESSAGE)

export const organizationIdParamsSchema = idParamsSchema

export const listOrganizationsQuerySchema = paginationQuerySchema.extend({
  status: entityStatusSchema.optional(),
})

export type CreateOrganizationBody = z.infer<typeof createOrganizationBodySchema>
export type UpdateOrganizationBody = z.infer<typeof updateOrganizationBodySchema>
export type OrganizationIdParams = z.infer<typeof organizationIdParamsSchema>
export type ListOrganizationsQuery = z.infer<typeof listOrganizationsQuerySchema>
