import { z } from 'zod'
import {
  INVITATION_MAX_DAYS,
  INVITATION_MAX_USES,
} from '@/lib/companies/invitations'
import { isValidNit, parseNit } from '@/lib/companies/nit'
import { isPeriod } from '@/lib/companies/period'
import {
  COMPANY_MEMBER_ROLES,
  PAYMENT_TERMS_OPTIONS,
} from '@/lib/companies/vocabulary'

// Shared by the company forms (client) and their server actions. Amounts are
// whole pesos. The database checks the same bounds again.

const PHONE = /^\+?[0-9]{7,15}$/

/**
 * Pesos typed in a form: `300.000`, `$ 300000` or empty. Empty is null ("no
 * limit"); anything else that is not whole pesos is NaN, which the schemas
 * below refuse with a message.
 */
export function parsePesosInput(value: string): number | null {
  const cleaned = value.replace(/[$\s.]/g, '')
  if (cleaned === '') return null
  return /^[0-9]+$/.test(cleaned) ? Number(cleaned) : Number.NaN
}

/** Digits (and a leading +) of a phone typed with spaces or dashes. */
export function normalizePhone(value: string): string {
  return value.replace(/[\s()-]/g, '')
}

const phone = z
  .string()
  .trim()
  .refine((value) => PHONE.test(normalizePhone(value)), {
    message: 'Escribe un celular válido, por ejemplo 300 123 4567.',
  })

const email = z
  .email({ error: 'Escribe un correo válido.' })
  .max(160, 'El correo es demasiado largo.')

const billing = {
  billingEmail: email,
  billingAddress: z
    .string()
    .trim()
    .min(5, 'Escribe la dirección de facturación completa.')
    .max(200, 'La dirección es demasiado larga.'),
  city: z
    .string()
    .trim()
    .min(2, 'Escribe la ciudad.')
    .max(80, 'La ciudad es demasiado larga.'),
  contactName: z
    .string()
    .trim()
    .min(2, 'Escribe el nombre de la persona de contacto.')
    .max(80, 'El nombre es demasiado largo.'),
  contactPhone: phone,
}

export const companyRegisterSchema = z.object({
  legalName: z
    .string()
    .trim()
    .min(2, 'Escribe la razón social como aparece en el RUT.')
    .max(160, 'La razón social es demasiado larga.'),
  tradeName: z
    .string()
    .trim()
    .max(80, 'El nombre comercial es demasiado largo.')
    .default(''),
  nit: z
    .string()
    .trim()
    .superRefine((value, ctx) => {
      const parsed = parseNit(value)
      if (!parsed) {
        ctx.addIssue({
          code: 'custom',
          message: 'Escribe el NIT con su dígito de verificación: 900123456-8.',
        })
        return
      }
      if (parsed.dv === null) {
        ctx.addIssue({
          code: 'custom',
          message:
            'Falta el dígito de verificación (el número después del guion).',
        })
        return
      }
      if (!isValidNit(parsed.nit, parsed.dv)) {
        ctx.addIssue({
          code: 'custom',
          message:
            'El dígito de verificación no corresponde a ese NIT. Revísalo en el RUT.',
        })
      }
    }),
  ...billing,
  acceptTerms: z.literal(true, {
    error: 'Debes aceptar los Términos para Empresas.',
  }),
})
export type CompanyRegisterInput = z.input<typeof companyRegisterSchema>
export type CompanyRegisterValues = z.output<typeof companyRegisterSchema>

export const companyBillingSchema = z.object({
  companyId: z.uuid(),
  ...billing,
})
export type CompanyBillingInput = z.input<typeof companyBillingSchema>

/** A budget or cap in pesos; empty means "no limit". */
const optionalAmount = z
  .number({ error: 'Escribe un valor en pesos.' })
  .int('Escribe un valor sin decimales.')
  .min(1_000, 'El valor mínimo es $1.000.')
  .max(50_000_000, 'El valor máximo es $50.000.000.')
  .nullable()

export const invitationCreateSchema = z.object({
  companyId: z.uuid(),
  role: z.enum(COMPANY_MEMBER_ROLES),
  monthlyBudget: optionalAmount,
  perOrderLimit: optionalAmount,
  maxUses: z
    .number()
    .int()
    .min(1, 'Al menos una persona.')
    .max(
      INVITATION_MAX_USES,
      `Hasta ${INVITATION_MAX_USES} personas por enlace.`,
    ),
  expiresDays: z
    .number()
    .int()
    .min(1, 'Al menos un día.')
    .max(INVITATION_MAX_DAYS, `Hasta ${INVITATION_MAX_DAYS} días.`),
})
export type InvitationCreateInput = z.input<typeof invitationCreateSchema>

export const memberUpdateSchema = z.object({
  memberId: z.uuid(),
  role: z.enum(COMPANY_MEMBER_ROLES),
  monthlyBudget: optionalAmount,
  perOrderLimit: optionalAmount,
  active: z.boolean(),
})
export type MemberUpdateInput = z.input<typeof memberUpdateSchema>

export const companyApprovalSchema = z.object({
  companyId: z.uuid(),
  creditLimit: z
    .number({ error: 'Escribe el cupo en pesos.' })
    .int()
    .min(100_000, 'El cupo mínimo es $100.000.')
    .max(1_000_000_000, 'El cupo es demasiado alto.'),
  paymentTermsDays: z
    .number()
    .int()
    .refine(
      (value) => (PAYMENT_TERMS_OPTIONS as readonly number[]).includes(value),
      { message: 'Elige un plazo de pago.' },
    ),
  maxTipPct: z
    .number()
    .int()
    .min(0, 'El tope de propina va de 0 % a 30 %.')
    .max(30, 'El tope de propina va de 0 % a 30 %.'),
})
export type CompanyApprovalInput = z.input<typeof companyApprovalSchema>

export const companySuspendSchema = z.object({
  companyId: z.uuid(),
  note: z
    .string()
    .trim()
    .min(3, 'Escribe el motivo de la suspensión.')
    .max(300, 'El motivo es demasiado largo.'),
})
export type CompanySuspendInput = z.input<typeof companySuspendSchema>

export const statementPeriodSchema = z
  .string()
  .refine(isPeriod, { message: 'Elige un mes.' })

export const statementPaidSchema = z.object({
  statementId: z.uuid(),
  paymentRef: z
    .string()
    .trim()
    .max(80, 'La referencia es demasiado larga.')
    .default(''),
})
export type StatementPaidInput = z.input<typeof statementPaidSchema>

export const statementVoidSchema = z.object({
  statementId: z.uuid(),
  reason: z
    .string()
    .trim()
    .min(3, 'Escribe por qué se anula.')
    .max(200, 'El motivo es demasiado largo.'),
})
export type StatementVoidInput = z.input<typeof statementVoidSchema>

export const merchantInvoiceSchema = z.object({
  orderId: z.uuid(),
  invoiceRef: z
    .string()
    .trim()
    .min(1, 'Escribe el número de la factura.')
    .max(60, 'El número de factura es demasiado largo.'),
})
export type MerchantInvoiceInput = z.input<typeof merchantInvoiceSchema>
