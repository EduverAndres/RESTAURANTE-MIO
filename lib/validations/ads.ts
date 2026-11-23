import { z } from 'zod'
import { isDateOnly } from '@/lib/ads/pricing'
import { AD_PLACEMENTS } from '@/lib/ads/vocabulary'

// Input shapes of the paid-placement actions. The date and price rules are
// lib/ads/pricing.ts's; these only check the shape of what arrived.

const dateOnly = z
  .string()
  .refine(isDateOnly, { message: 'Elige una fecha válida.' })

const placement = z.enum(AD_PLACEMENTS, { error: 'Elige una ubicación.' })

const campaignId = z.uuid({ error: 'Campaña inválida.' })

/** A merchant asking for a campaign. */
export const adRequestSchema = z.object({
  placement,
  startsOn: dateOnly,
  endsOn: dateOnly,
})
export type AdRequestInput = z.infer<typeof adRequestSchema>

export const adCampaignIdSchema = z.object({ campaignId })

/** An admin turning a request down: the merchant reads the reason. */
export const adRejectSchema = z.object({
  campaignId,
  reason: z
    .string()
    .trim()
    .min(3, 'Escribe el motivo para el comercio.')
    .max(300, 'El motivo puede tener hasta 300 caracteres.'),
})
export type AdRejectInput = z.infer<typeof adRejectSchema>

/** An admin moving an approved campaign. */
export const adStatusActionSchema = z.object({
  campaignId,
  action: z.enum(['pause', 'resume', 'end'], { error: 'Acción inválida.' }),
})
export type AdStatusActionInput = z.infer<typeof adStatusActionSchema>

const wholeNumber = (label: string, min: number, max: number) =>
  z
    .number({ error: `${label}: escribe un número.` })
    .int(`${label}: usa un número entero.`)
    .min(min, `${label}: mínimo ${min}.`)
    .max(max, `${label}: máximo ${max}.`)

/** An admin editing one row of the price list. */
export const adPlacementSchema = z
  .object({
    placement,
    dailyPrice: wholeNumber('Precio por día', 1000, 1_000_000),
    maxSlots: wholeNumber('Cupos', 1, 20),
    minDays: wholeNumber('Días mínimos', 1, 90),
    maxDays: wholeNumber('Días máximos', 1, 90),
    active: z.boolean(),
  })
  .refine((value) => value.maxDays >= value.minDays, {
    message: 'Los días máximos no pueden ser menos que los mínimos.',
    path: ['maxDays'],
  })
export type AdPlacementInput = z.infer<typeof adPlacementSchema>
