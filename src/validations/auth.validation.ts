import { z } from 'zod'

export const loginBodySchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

export const refreshBodySchema = z.object({
  refreshToken: z.string().min(1).optional(),
})

/** Authenticated password change. Email-based reset is intentionally not implemented yet. */
export const changePasswordBodySchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(10, 'New password must be at least 10 characters')
      .max(128, 'New password must be 128 characters or fewer')
      .regex(/[A-Z]/, 'New password must include an uppercase letter')
      .regex(/[a-z]/, 'New password must include a lowercase letter')
      .regex(/[0-9]/, 'New password must include a digit'),
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: 'New password must be different from the current password',
    path: ['newPassword'],
  })

/**
 * Extension point for future email-based password reset.
 * Do not wire a public endpoint until the email delivery workflow exists.
 */
export const requestPasswordResetBodySchema = z.object({
  email: z.email('Enter a valid email address'),
})

export type LoginBody = z.infer<typeof loginBodySchema>
export type RefreshBody = z.infer<typeof refreshBodySchema>
export type ChangePasswordBody = z.infer<typeof changePasswordBodySchema>
export type RequestPasswordResetBody = z.infer<typeof requestPasswordResetBodySchema>
