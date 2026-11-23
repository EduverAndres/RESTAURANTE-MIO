import { z } from 'zod'
import {
  COURIER_STATUSES,
  VEHICLE_TYPES,
  isMotorized,
} from '@/lib/couriers/vocabulary'
import { deliveryCodeSchema } from '@/lib/tracking/delivery-code'

const finite = z.number().refine(Number.isFinite, 'Coordenada inválida.')

/** The browser reports NaN/null without a heading; wrap valid ones into [0, 360). */
function normalizeHeading(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return ((value % 360) + 360) % 360
}

/** GPS accuracy radius in metres; anything that is not a finite length is unknown. */
function normalizeAccuracy(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
    return null
  return value
}

/**
 * Geolocation fix sent by the courier app. Coordinates outside the valid
 * ranges are rejected; heading and accuracy are optional and normalised.
 */
export const courierPositionSchema = z
  .object({
    lat: finite.min(-90).max(90),
    lng: finite.min(-180).max(180),
    heading: z.unknown().optional(),
    accuracyM: z.unknown().optional(),
  })
  .transform(({ lat, lng, heading, accuracyM }) => ({
    lat,
    lng,
    heading: normalizeHeading(heading),
    accuracyM: normalizeAccuracy(accuracyM),
  }))

export type CourierPositionInput = z.input<typeof courierPositionSchema>
export type CourierPosition = z.output<typeof courierPositionSchema>

/**
 * Optional payload of `advanceOrder`. The handover code is only meaningful
 * for the `delivered` step of a delivery order; the action decides whether
 * it is required.
 */
export const advanceOrderInputSchema = z
  .object({ code: deliveryCodeSchema.optional() })
  .optional()

export type AdvanceOrderInput = z.input<typeof advanceOrderInputSchema>

/** `YYYY-MM-DD` or empty, as `<input type="date">` sends it. */
const optionalDate = z
  .string()
  .trim()
  .refine(
    (value) => value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value),
    'Fecha inválida.',
  )
  .transform((value) => (value === '' ? null : value))

/**
 * The courier's own profile form. Motorised vehicles need a plate, a licence
 * and SOAT (mirrors `missingForApproval` in `lib/couriers/profile.ts` and
 * the `courier_profiles_approved_complete` check), so the form asks for them
 * up front rather than letting the courier submit something an admin can
 * never approve.
 */
export const courierProfileSchema = z
  .object({
    vehicleType: z.enum(VEHICLE_TYPES, { error: 'Elige tu vehículo.' }),
    plate: z
      .string()
      .trim()
      .toUpperCase()
      .transform((value) => value.replace(/[\s-]/g, ''))
      .refine(
        (value) => value === '' || /^[A-Z]{3}[0-9]{2}[0-9A-Z]$/.test(value),
        'Escribe la placa como ABC123 o ABC12D.',
      )
      .transform((value) => (value === '' ? null : value)),
    documentNumber: z
      .string()
      .trim()
      .transform((value) => value.replace(/[.\s]/g, ''))
      .refine(
        (value) => /^[0-9]{5,12}$/.test(value),
        'Escribe tu número de documento, solo números.',
      ),
    city: z
      .string()
      .trim()
      .min(2, 'Escribe tu ciudad.')
      .max(60, 'Máximo 60 caracteres.'),
    zone: z
      .string()
      .trim()
      .max(80, 'Máximo 80 caracteres.')
      .transform((value) => (value === '' ? null : value)),
    licenseExpiresOn: optionalDate,
    soatExpiresOn: optionalDate,
  })
  .superRefine((value, ctx) => {
    if (!isMotorized(value.vehicleType)) return
    if (!value.plate)
      ctx.addIssue({
        code: 'custom',
        path: ['plate'],
        message: 'La placa es obligatoria para moto o carro.',
      })
    if (!value.licenseExpiresOn)
      ctx.addIssue({
        code: 'custom',
        path: ['licenseExpiresOn'],
        message: 'Indica cuándo vence tu licencia.',
      })
    if (!value.soatExpiresOn)
      ctx.addIssue({
        code: 'custom',
        path: ['soatExpiresOn'],
        message: 'Indica cuándo vence tu SOAT.',
      })
  })

export type CourierProfileInput = z.input<typeof courierProfileSchema>
export type CourierProfileValues = z.output<typeof courierProfileSchema>

/** The admin's review of a courier. Suspending always says why. */
export const courierReviewSchema = z
  .object({
    userId: z.uuid('Domiciliario inválido.'),
    status: z.enum(COURIER_STATUSES),
    note: z
      .string()
      .trim()
      .max(300, 'Máximo 300 caracteres.')
      .transform((value) => (value === '' ? null : value)),
  })
  .refine((value) => value.status !== 'suspended' || value.note !== null, {
    path: ['note'],
    message: 'Explica por qué se suspende.',
  })

export type CourierReviewInput = z.input<typeof courierReviewSchema>

/**
 * A ledger entry the admin records: a deposit (cash the courier handed over,
 * always positive) or an adjustment (signed, for corrections).
 */
export const courierLedgerEntrySchema = z
  .object({
    courierId: z.uuid('Domiciliario inválido.'),
    kind: z.enum(['deposit', 'adjustment']),
    amount: z.coerce
      .number({ error: 'Escribe un valor.' })
      .int('Escribe el valor en pesos, sin decimales.')
      .refine((value) => value !== 0, 'El valor no puede ser cero.')
      .refine(
        (value) => Math.abs(value) <= 10_000_000,
        'El valor es demasiado alto.',
      ),
    note: z
      .string()
      .trim()
      .max(200, 'Máximo 200 caracteres.')
      .transform((value) => (value === '' ? null : value)),
  })
  .refine((value) => value.kind !== 'deposit' || value.amount > 0, {
    path: ['amount'],
    message: 'Una consignación siempre es un valor positivo.',
  })
  .refine((value) => value.kind !== 'adjustment' || value.note !== null, {
    path: ['note'],
    message: 'Explica el ajuste.',
  })

export type CourierLedgerEntryInput = z.input<typeof courierLedgerEntrySchema>
