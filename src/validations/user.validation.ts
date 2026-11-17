import { z } from 'zod'

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Enter a valid identifier')

export const directoryRoles = ['admin', 'manager', 'dispatcher', 'viewer'] as const
export const directoryStatuses = ['active', 'invited', 'disabled'] as const

export const createUserBodySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(80, 'Name must be 80 characters or fewer'),
  email: z.email('Enter a valid email address'),
  role: z.enum(directoryRoles),
})

export const updateUserBodySchema = createUserBodySchema.extend({
  status: z.enum(directoryStatuses),
})

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
})

export type CreateUserBody = z.infer<typeof createUserBodySchema>
export type UpdateUserBody = z.infer<typeof updateUserBodySchema>
export type UserIdParams = z.infer<typeof userIdParamsSchema>
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>
