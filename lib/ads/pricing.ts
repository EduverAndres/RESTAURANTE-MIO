// What a campaign costs, and whether its dates can be asked for. Pure: the
// merchant's live quote, the request action and the tests all run this.
//
// A campaign is a run of whole Bogotá calendar days, both ends included, at
// the placement's price per day as it stood when the merchant asked. The
// database stores that price on the campaign and computes the same total
// (`ad_campaigns.total_price`), so a later price change never touches a
// campaign already requested. The total is a quote: the settlement charges
// the days that actually ran (lib/ads/billing.ts), which is never more.
import type { AdPlacement } from '@/lib/ads/vocabulary'

export interface AdPlacementSettings {
  placement: AdPlacement
  /** Whole pesos per day. */
  daily_price: number
  /** Campaigns that may run on the same day (per category for category_top). */
  max_slots: number
  min_days: number
  max_days: number
  active: boolean
}

/**
 * The prices the migration seeds `ad_placements` with. The admin edits them
 * afterwards; tests/ads-migration.test.ts checks the seed matches.
 */
export const DEFAULT_AD_PLACEMENTS: Record<
  AdPlacement,
  Omit<AdPlacementSettings, 'placement'>
> = {
  home_featured: {
    daily_price: 15000,
    max_slots: 3,
    min_days: 3,
    max_days: 30,
    active: true,
  },
  category_top: {
    daily_price: 8000,
    max_slots: 2,
    min_days: 3,
    max_days: 30,
    active: true,
  },
  search_top: {
    daily_price: 6000,
    max_slots: 2,
    min_days: 3,
    max_days: 30,
    active: true,
  },
}

/** How far ahead a campaign may start. */
export const MAX_START_AHEAD_DAYS = 60

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

/** A real `YYYY-MM-DD` calendar date (not 2026-02-30). */
export function isDateOnly(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_ONLY.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  )
}

export function dayNumber(dateOnly: string): number {
  return Math.round(
    new Date(`${dateOnly}T00:00:00.000Z`).getTime() / 86_400_000,
  )
}

/** Days from `startsOn` to `endsOn`, both included. 0 when reversed. */
export function adDays(startsOn: string, endsOn: string): number {
  return Math.max(0, dayNumber(endsOn) - dayNumber(startsOn) + 1)
}

/** Mirror of `ad_campaigns.total_price`. */
export function adTotalPrice(
  dailyPrice: number,
  startsOn: string,
  endsOn: string,
): number {
  return dailyPrice * adDays(startsOn, endsOn)
}

export type AdQuoteError =
  | 'inactive'
  | 'invalid_date'
  | 'start_past'
  | 'start_too_far'
  | 'end_before_start'
  | 'too_short'
  | 'too_long'

export type AdQuote =
  | { ok: true; days: number; dailyPrice: number; total: number }
  | { ok: false; reason: AdQuoteError; message: string }

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

/**
 * Prices a campaign and says what is wrong with its dates, if anything.
 * `today` is the Bogotá date: a campaign may start today, so an admin who
 * approves it at once puts it on the air the same day.
 */
export function quoteAdCampaign(input: {
  settings: Pick<
    AdPlacementSettings,
    'daily_price' | 'min_days' | 'max_days' | 'active'
  >
  startsOn: string
  endsOn: string
  today: string
}): AdQuote {
  const { settings, startsOn, endsOn, today } = input
  if (!settings.active) {
    return {
      ok: false,
      reason: 'inactive',
      message: 'Esta ubicación no está disponible por ahora.',
    }
  }
  if (!isDateOnly(startsOn) || !isDateOnly(endsOn)) {
    return {
      ok: false,
      reason: 'invalid_date',
      message: 'Elige la fecha de inicio y la de fin.',
    }
  }
  if (startsOn < today) {
    return {
      ok: false,
      reason: 'start_past',
      message: 'La campaña no puede empezar antes de hoy.',
    }
  }
  if (dayNumber(startsOn) - dayNumber(today) > MAX_START_AHEAD_DAYS) {
    return {
      ok: false,
      reason: 'start_too_far',
      message: `Puedes programarla con hasta ${MAX_START_AHEAD_DAYS} días de anticipación.`,
    }
  }
  if (endsOn < startsOn) {
    return {
      ok: false,
      reason: 'end_before_start',
      message: 'La fecha de fin debe ser igual o posterior a la de inicio.',
    }
  }
  const days = adDays(startsOn, endsOn)
  if (days < settings.min_days) {
    return {
      ok: false,
      reason: 'too_short',
      message: `La campaña mínima es de ${plural(settings.min_days, 'día', 'días')}.`,
    }
  }
  if (days > settings.max_days) {
    return {
      ok: false,
      reason: 'too_long',
      message: `La campaña máxima es de ${plural(settings.max_days, 'día', 'días')}.`,
    }
  }
  return {
    ok: true,
    days,
    dailyPrice: settings.daily_price,
    total: adTotalPrice(settings.daily_price, startsOn, endsOn),
  }
}

// A calendar date is formatted at UTC midnight in UTC, so no zone can move
// it to the day before. Only the day and month parts are kept, without
// ICU's literals ("de", dots, no-break spaces), which differ between Node
// and browsers: the server HTML and the client render the same text.
const dayFormatter = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
})

/** "23 nov" for a `YYYY-MM-DD` date. */
export function formatAdDay(date: string): string {
  const parts = dayFormatter.formatToParts(new Date(`${date}T00:00:00.000Z`))
  const day = parts.find((part) => part.type === 'day')?.value ?? ''
  const month = (
    parts.find((part) => part.type === 'month')?.value ?? ''
  ).replace(/\.$/, '')
  return `${day} ${month}`
}

/** "23 nov – 29 nov" (or a single day). */
export function formatAdRange(startsOn: string, endsOn: string): string {
  return startsOn === endsOn
    ? formatAdDay(startsOn)
    : `${formatAdDay(startsOn)} – ${formatAdDay(endsOn)}`
}

/** "1 día" / "7 días". */
export function daysLabel(days: number): string {
  return `${days} ${days === 1 ? 'día' : 'días'}`
}
