import { z } from 'zod'

// E.164-ish: optional "+", 8 to 15 digits, allowing spaces and dashes that
// are stripped before validation.
const PHONE_PATTERN = /^\+?[1-9]\d{7,14}$/

export const phoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s-]/g, ''))
  .refine((value) => PHONE_PATTERN.test(value), {
    message: 'Ingresa un número de teléfono válido, por ejemplo +573001234567.',
  })

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Ingresa tu correo electrónico.')
  .pipe(z.email('Ingresa un correo electrónico válido.').toLowerCase())

export const passwordSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres.')
  .max(72, 'La contraseña no puede superar 72 caracteres.')

export const REGISTER_ROLES = ['customer', 'merchant', 'courier'] as const
export type RegisterRole = (typeof REGISTER_ROLES)[number]

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Ingresa tu contraseña.'),
})
export type LoginInput = z.infer<typeof loginSchema>

export const registerSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, 'Ingresa tu nombre completo.')
    .max(80, 'El nombre es demasiado largo.'),
  email: emailSchema,
  password: passwordSchema,
  phone: z
    .union([z.literal(''), phoneSchema])
    .optional()
    .transform((value) => (value ? value : undefined)),
  role: z.enum(REGISTER_ROLES, {
    error: 'Selecciona cómo quieres usar la plataforma.',
  }),
})
export type RegisterInput = z.input<typeof registerSchema>
export type RegisterValues = z.output<typeof registerSchema>

export const phoneOtpSchema = z.object({
  phone: phoneSchema,
})
export type PhoneOtpInput = z.infer<typeof phoneOtpSchema>

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  token: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'El código debe tener 6 dígitos.'),
})
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>

export const forgotPasswordSchema = z.object({
  email: emailSchema,
})
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((value) => value.password === value.confirm, {
    message: 'Las contraseñas no coinciden.',
    path: ['confirm'],
  })
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>

export const profileSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, 'Ingresa tu nombre completo.')
    .max(80, 'El nombre es demasiado largo.'),
  phone: z
    .union([z.literal(''), phoneSchema])
    .optional()
    .transform((value) => (value ? value : null)),
})
export type ProfileInput = z.input<typeof profileSchema>
export type ProfileValues = z.output<typeof profileSchema>
