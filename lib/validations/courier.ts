import { z } from 'zod'

const finite = z.number().refine(Number.isFinite, 'Coordenada inválida.')

/** The browser reports NaN/null without a heading; wrap valid ones into [0, 360). */
function normalizeHeading(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return ((value % 360) + 360) % 360
}

/**
 * Geolocation fix sent by the courier app. Coordinates outside the valid
 * ranges are rejected; the heading is optional and normalised.
 */
export const courierPositionSchema = z
  .object({
    lat: finite.min(-90).max(90),
    lng: finite.min(-180).max(180),
    heading: z.unknown().optional(),
  })
  .transform(({ lat, lng, heading }) => ({
    lat,
    lng,
    heading: normalizeHeading(heading),
  }))

export type CourierPositionInput = z.input<typeof courierPositionSchema>
export type CourierPosition = z.output<typeof courierPositionSchema>
