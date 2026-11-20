import { z } from 'zod'
import { isPermission } from '../constants/permissions.js'
import { businessCodeSchema, idParamsSchema, objectIdSchema } from './common.validation.js'

const permissionKeySchema = z
  .string()
  .trim()
  .refine(isPermission, 'Unknown permission key')

const permissionKeysSchema = z
  .array(permissionKeySchema)
  .max(100)
  .transform((keys) => [...new Set(keys)])

export const createRoleBodySchema = z.object({
  /** Platform-wide accounts must name the organization; others may only name their own. */
  organizationId: objectIdSchema.optional(),
  code: businessCodeSchema,
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  description: z.string().trim().max(240).optional(),
  permissionKeys: permissionKeysSchema.default([]),
})

export const assignPermissionsBodySchema = z.object({
  permissionKeys: permissionKeysSchema,
})

export const roleIdParamsSchema = idParamsSchema

export const listRolesQuerySchema = z.object({
  organizationId: objectIdSchema.optional(),
})

export type CreateRoleBody = z.infer<typeof createRoleBodySchema>
export type AssignPermissionsBody = z.infer<typeof assignPermissionsBodySchema>
export type RoleIdParams = z.infer<typeof roleIdParamsSchema>
export type ListRolesQuery = z.infer<typeof listRolesQuerySchema>
