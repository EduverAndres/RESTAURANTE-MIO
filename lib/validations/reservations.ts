import { z } from 'zod'
import { RESERVATION_OCCASIONS } from '@/lib/reservations/vocabulary'

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida.')

/** A customer's booking request. Mirrors the `reservations` checks. */
export const reservationRequestSchema = z.object({
  storeId: z.uuid('Restaurante inválido.'),
  serviceDate: dateOnly,
  startsAt: z.string().datetime({ offset: true, message: 'Hora inválida.' }),
  partySize: z.coerce
    .number()
    .int()
    .min(1, 'Elige cuántas personas van.')
    .max(50, 'Para grupos tan grandes, escríbele al restaurante.'),
  contactName: z
    .string()
    .trim()
    .min(2, 'Escribe tu nombre.')
    .max(80, 'Máximo 80 caracteres.'),
  contactPhone: z
    .string()
    .trim()
    .transform((value) => value.replace(/[\s().-]/g, ''))
    .refine(
      (value) => /^\+?[0-9]{7,15}$/.test(value),
      'Escribe un celular válido.',
    ),
  occasion: z
    .enum(RESERVATION_OCCASIONS)
    .or(z.literal(''))
    .transform((value) => (value === '' ? null : value)),
  notes: z
    .string()
    .trim()
    .max(300, 'Máximo 300 caracteres.')
    .transform((value) => (value === '' ? null : value)),
})

export type ReservationRequestInput = z.input<typeof reservationRequestSchema>
export type ReservationRequestValues = z.output<typeof reservationRequestSchema>

/** The store's reservation settings form. */
export const reservationSettingsSchema = z.object({
  enabled: z.boolean(),
  slotMinutes: z.coerce
    .number()
    .refine((value) => [15, 30, 60].includes(value), 'Elige 15, 30 o 60.'),
  coversPerSlot: z.coerce
    .number()
    .int()
    .min(1, 'Al menos 1 persona por franja.')
    .max(500, 'Máximo 500.'),
  maxPartySize: z.coerce.number().int().min(1).max(50, 'Máximo 50.'),
  minLeadMinutes: z.coerce.number().int().min(0).max(10080),
  maxDaysAhead: z.coerce.number().int().min(1).max(90, 'Máximo 90 días.'),
  durationMinutes: z.coerce.number().int().min(30).max(360),
  policyText: z.string().trim().max(280, 'Máximo 280 caracteres.'),
  blockedDates: z.array(dateOnly).max(60, 'Máximo 60 fechas bloqueadas.'),
})

export type ReservationSettingsInput = z.input<typeof reservationSettingsSchema>
export type ReservationSettingsValues = z.output<
  typeof reservationSettingsSchema
>

/** A store action on one reservation; declining and cancelling say why. */
export const reservationActionSchema = z
  .object({
    reservationId: z.uuid('Reserva inválida.'),
    action: z.enum(['confirm', 'decline', 'seat', 'no_show', 'cancel', 'undo']),
    reason: z
      .string()
      .trim()
      .max(200, 'Máximo 200 caracteres.')
      .transform((value) => (value === '' ? null : value)),
  })
  .refine(
    (value) =>
      !['decline', 'cancel'].includes(value.action) || value.reason !== null,
    { path: ['reason'], message: 'Cuéntale al cliente por qué.' },
  )

export type ReservationActionInput = z.input<typeof reservationActionSchema>
