import { z } from 'zod'
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
