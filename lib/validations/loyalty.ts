import { z } from 'zod'
import { normalizeCouponCode } from '@/lib/discounts'

const pesos = (label: string) =>
  z
    .number({ error: `${label} debe ser un número.` })
    .int(`${label} va en pesos, sin decimales.`)
    .min(0, `${label} no puede ser negativo.`)
    .max(5_000_000, `${label} es demasiado alto.`)

/** The store's stamp card. A live card needs a reward with a value. */
export const loyaltySchema = z
  .object({
    enabled: z.boolean(),
    stampsRequired: z
      .number()
      .int()
      .min(3, 'Pide al menos 3 sellos.')
      .max(20, 'Máximo 20 sellos.'),
    minOrder: pesos('El pedido mínimo'),
    rewardLabel: z
      .string()
      .trim()
      .max(60, 'Describe el premio en menos de 60 letras.'),
    rewardValue: pesos('El valor del premio'),
  })
  .superRefine((value, ctx) => {
    if (!value.enabled) return
    if (value.rewardLabel.length < 3)
      ctx.addIssue({
        code: 'custom',
        path: ['rewardLabel'],
        message: 'Di qué regalas, por ejemplo «una arepa de huevo».',
      })
    if (value.rewardValue < 1000)
      ctx.addIssue({
        code: 'custom',
        path: ['rewardValue'],
        message: 'El premio debe valer al menos $1.000.',
      })
  })
export type LoyaltyInput = z.input<typeof loyaltySchema>

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida.')
  .nullable()

/** A store coupon, as the merchant creates it. */
export const couponSchema = z
  .object({
    code: z
      .string()
      .transform(normalizeCouponCode)
      .pipe(
        z
          .string()
          .min(3, 'El código necesita al menos 3 letras o números.')
          .max(20, 'El código puede tener hasta 20 letras o números.'),
      ),
    kind: z.enum(['percent', 'fixed']),
    value: z.number().int('Sin decimales.').positive('Debe ser mayor que 0.'),
    minOrder: pesos('El pedido mínimo'),
    startsAt: dateOnly,
    endsAt: dateOnly,
    maxUses: z.number().int().positive('Debe ser mayor que 0.').nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.kind === 'percent' && value.value > 100)
      ctx.addIssue({
        code: 'custom',
        path: ['value'],
        message: 'Un porcentaje va de 1 a 100.',
      })
    if (value.kind === 'fixed' && value.value < 500)
      ctx.addIssue({
        code: 'custom',
        path: ['value'],
        message: 'Un descuento fijo debe ser de al menos $500.',
      })
    if (value.startsAt && value.endsAt && value.startsAt > value.endsAt)
      ctx.addIssue({
        code: 'custom',
        path: ['endsAt'],
        message: 'La fecha final va después de la inicial.',
      })
  })
export type CouponInput = z.input<typeof couponSchema>
