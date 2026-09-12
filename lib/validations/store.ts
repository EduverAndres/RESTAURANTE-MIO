import { z } from 'zod'
import { SLUG_PATTERN, slugify } from '@/lib/slug'
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  imageObjectPath,
} from '@/lib/uploads/image'
import { phoneSchema } from '@/lib/validations/auth'
import type { ScheduleDay, StoreSchedule, WeekDay } from '@/types/app'

// ---------------------------------------------------------------------------
// Catalogue data
// ---------------------------------------------------------------------------

/** Curated categories; they match the glyphs on the home carousel. */
export const STORE_CATEGORIES = [
  'Parrilla',
  'Saludable',
  'Italiana',
  'Comida rápida',
  'Japonesa',
  'Café y panadería',
  'Postres',
  'Mexicana',
  'Colombiana',
  'Pollo',
  'Otra',
] as const

export const WEEK_DAYS: readonly WeekDay[] = [
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
]

export const WEEK_DAY_LABELS: Record<WeekDay, string> = {
  mon: 'Lunes',
  tue: 'Martes',
  wed: 'Miércoles',
  thu: 'Jueves',
  fri: 'Viernes',
  sat: 'Sábado',
  sun: 'Domingo',
}

/** Slug suggested from the store name; the merchant may still edit it. */
export function deriveSlug(name: string): string {
  return slugify(name)
}

// ---------------------------------------------------------------------------
// Step 1: basics
// ---------------------------------------------------------------------------

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => (value ? value : null))

export const storeBasicsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Ingresa el nombre de tu restaurante.')
    .max(60, 'El nombre es demasiado largo.'),
  slug: z
    .string()
    .trim()
    .min(2, 'La dirección web debe tener al menos 2 caracteres.')
    .max(60, 'La dirección web es demasiado larga.')
    .regex(
      SLUG_PATTERN,
      'Usa solo letras minúsculas, números y guiones, por ejemplo mi-restaurante.',
    ),
  category: z
    .string()
    .trim()
    .min(1, 'Elige una categoría.')
    .max(40, 'La categoría es demasiado larga.'),
  description: optionalText(300, 'La descripción es demasiado larga.'),
  whatsapp_phone: z
    .union([z.literal(''), phoneSchema])
    .optional()
    .transform((value) => (value ? value : null)),
})
export type StoreBasicsInput = z.input<typeof storeBasicsSchema>
export type StoreBasicsValues = z.output<typeof storeBasicsSchema>

// ---------------------------------------------------------------------------
// Step 2: logistics
// ---------------------------------------------------------------------------

const money = (message: string) =>
  z.number({ error: message }).min(0, message).max(10_000_000, message)

export const storeLogisticsSchema = z.object({
  address: z
    .string()
    .trim()
    .min(5, 'Ingresa la dirección del local.')
    .max(160, 'La dirección es demasiado larga.'),
  lat: z.number({ error: 'Ubica el local en el mapa.' }).min(-90).max(90),
  lng: z.number({ error: 'Ubica el local en el mapa.' }).min(-180).max(180),
  delivery_radius_km: z
    .number({ error: 'Ingresa el radio de entrega en kilómetros.' })
    .min(0.5, 'El radio mínimo es 0,5 km.')
    .max(50, 'El radio máximo es 50 km.'),
  delivery_fee: money('Ingresa un costo de domicilio válido.'),
  min_order: money('Ingresa un pedido mínimo válido.'),
  prep_time_min: z
    .number({ error: 'Ingresa el tiempo de preparación en minutos.' })
    .int('Usa minutos enteros.')
    .min(1, 'El tiempo mínimo es 1 minuto.')
    .max(240, 'El tiempo máximo es 240 minutos.'),
})
export type StoreLogisticsInput = z.input<typeof storeLogisticsSchema>
export type StoreLogisticsValues = z.output<typeof storeLogisticsSchema>

export const createStoreSchema = storeBasicsSchema.extend(
  storeLogisticsSchema.shape,
)
export type CreateStoreInput = z.input<typeof createStoreSchema>
export type CreateStoreValues = z.output<typeof createStoreSchema>

// ---------------------------------------------------------------------------
// Schedule (stores.schedule jsonb)
// ---------------------------------------------------------------------------

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

const scheduleDaySchema = z
  .object({
    open: z.string().regex(TIME_PATTERN, 'Usa el formato HH:MM.'),
    close: z.string().regex(TIME_PATTERN, 'Usa el formato HH:MM.'),
  })
  .refine((day) => day.open < day.close, {
    message: 'La hora de cierre debe ser posterior a la de apertura.',
    path: ['close'],
  })

export const scheduleSchema = z.object({
  mon: scheduleDaySchema.optional(),
  tue: scheduleDaySchema.optional(),
  wed: scheduleDaySchema.optional(),
  thu: scheduleDaySchema.optional(),
  fri: scheduleDaySchema.optional(),
  sat: scheduleDaySchema.optional(),
  sun: scheduleDaySchema.optional(),
})

export interface ScheduleDayForm extends ScheduleDay {
  enabled: boolean
}
export type ScheduleForm = Record<WeekDay, ScheduleDayForm>

const DEFAULT_DAY: ScheduleDayForm = {
  enabled: false,
  open: '08:00',
  close: '20:00',
}

export function emptyScheduleForm(): ScheduleForm {
  return Object.fromEntries(
    WEEK_DAYS.map((day) => [day, { ...DEFAULT_DAY }]),
  ) as ScheduleForm
}

function isScheduleDay(value: unknown): value is ScheduleDay {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ScheduleDay).open === 'string' &&
    typeof (value as ScheduleDay).close === 'string'
  )
}

/** Reads the untrusted jsonb column into the 7-row form shape. */
export function scheduleToForm(column: unknown): ScheduleForm {
  const form = emptyScheduleForm()
  if (typeof column !== 'object' || column === null) return form
  const record = column as Record<string, unknown>
  for (const day of WEEK_DAYS) {
    const entry = record[day]
    if (isScheduleDay(entry)) {
      form[day] = { enabled: true, open: entry.open, close: entry.close }
    }
  }
  return form
}

/** Serialises the form back to the column shape, dropping disabled days. */
export function formToSchedule(form: ScheduleForm): StoreSchedule {
  const schedule: StoreSchedule = {}
  for (const day of WEEK_DAYS) {
    const entry = form[day]
    if (entry?.enabled) schedule[day] = { open: entry.open, close: entry.close }
  }
  return schedule
}

export const storeSettingsSchema = createStoreSchema.extend({
  schedule: scheduleSchema,
})
export type StoreSettingsInput = z.input<typeof storeSettingsSchema>
export type StoreSettingsValues = z.output<typeof storeSettingsSchema>

// ---------------------------------------------------------------------------
// Assets (storage bucket store-assets, keyed `${storeId}/...`)
// ---------------------------------------------------------------------------

export const STORE_ASSET_KINDS = ['logo', 'cover'] as const
export type StoreAssetKind = (typeof STORE_ASSET_KINDS)[number]

/** Shared image rules live in `lib/uploads/image`; these keep old imports. */
export const MAX_ASSET_BYTES = MAX_IMAGE_BYTES
export const ACCEPTED_ASSET_TYPES = ACCEPTED_IMAGE_TYPES

/** Object key `${storeId}/${kind}-${timestamp}.${ext}` (see imageObjectPath). */
export function assetObjectPath(
  storeId: string,
  kind: StoreAssetKind,
  contentType: string,
  timestamp: number,
): string | null {
  return imageObjectPath(storeId, kind, contentType, timestamp)
}
