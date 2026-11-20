import { z } from 'zod'
import {
  AT_LEAST_ONE_FIELD_MESSAGE,
  atLeastOneField,
  objectIdSchema,
} from './common.validation.js'

export { objectIdSchema }

/**
 * Roles the API may assign. `super_admin` is intentionally absent: platform operators are
 * provisioned out of band. `org_admin`, `branch_manager` and `standard_user` are accepted as
 * input aliases of `admin`, `manager` and `user`.
 */
export const directoryRoles = [
  'admin',
  'manager',
  'dispatcher',
  'viewer',
  'user',
  'org_admin',
  'branch_manager',
  'standard_user',
] as const
/** `disabled` is a pre-Module-3 alias of `inactive`. */
export const directoryStatuses = ['active', 'inactive', 'suspended', 'invited', 'disabled'] as const
/** Statuses an administrator may deactivate an account into. */
export const deactivationStatuses = ['inactive', 'suspended'] as const

const nameSchema = z
  .string()
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(80, 'Name must be 80 characters or fewer')

const phoneSchema = z
  .string()
  .trim()
  .max(32, 'Phone must be 32 characters or fewer')
  .regex(/^[0-9+()\-.\s]*$/, 'Phone may only contain digits and + ( ) - .')

const idList = z.array(objectIdSchema).max(200)

export const createUserBodySchema = z.object({
  name: nameSchema,
  email: z.email('Enter a valid email address'),
  role: z.enum(directoryRoles),
  phone: phoneSchema.optional(),
  /** Platform-wide accounts must name the organization; others always use their own. */
  organizationId: objectIdSchema.optional(),
  branchIds: idList.optional(),
  legalEntityIds: idList.optional(),
  accessAllBranches: z.boolean().optional(),
})

export const updateUserBodySchema = z
  .object({
    name: nameSchema.optional(),
    email: z.email('Enter a valid email address').optional(),
    role: z.enum(directoryRoles).optional(),
    status: z.enum(directoryStatuses).optional(),
    phone: phoneSchema.nullable().optional(),
  })
  .refine(atLeastOneField, AT_LEAST_ONE_FIELD_MESSAGE)

// A missing body (Express 5 leaves req.body undefined) means plain deactivation.
export const deactivateUserBodySchema = z
  .object({
    status: z.enum(deactivationStatuses).default('inactive'),
  })
  .default({ status: 'inactive' })

export const assignBranchesBodySchema = z.object({
  branchIds: idList,
  legalEntityIds: idList.optional(),
  accessAllBranches: z.boolean().optional(),
})

export const assignRolesBodySchema = z
  .object({
    role: z.enum(directoryRoles).optional(),
    roleIds: idList.optional(),
  })
  .refine(atLeastOneField, AT_LEAST_ONE_FIELD_MESSAGE)

export const userIdParamsSchema = z.object({
  id: objectIdSchema,
})

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().trim().max(100).optional(),
  sort: z.enum(['name', 'email', 'createdAt']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  status: z.enum(directoryStatuses).optional(),
  /** Honored for platform-wide accounts only; others are always limited to their own organization. */
  organizationId: objectIdSchema.optional(),
})

export type CreateUserBody = z.infer<typeof createUserBodySchema>
export type UpdateUserBody = z.infer<typeof updateUserBodySchema>
export type DeactivateUserBody = z.infer<typeof deactivateUserBodySchema>
export type AssignBranchesBody = z.infer<typeof assignBranchesBodySchema>
export type AssignRolesBody = z.infer<typeof assignRolesBodySchema>
export type UserIdParams = z.infer<typeof userIdParamsSchema>
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>
