import { z } from 'zod'

export const loginBodySchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

export const refreshBodySchema = z.object({
  refreshToken: z.string().min(1).optional(),
})

export type LoginBody = z.infer<typeof loginBodySchema>
export type RefreshBody = z.infer<typeof refreshBodySchema>
