import { z } from 'zod'

const passwordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character')

export const signupSchema = z.object({
  email:     z.string().email('Invalid email address'),
  password:  passwordSchema,
  firstName: z.string().min(1).max(100).optional(),
  lastName:  z.string().min(1).max(100).optional(),
})

export const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
})

export const verifyEmailSchema = z.object({
  token: z.string().min(1),
})

export type SignupInput    = z.infer<typeof signupSchema>
export type LoginInput     = z.infer<typeof loginSchema>
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>
