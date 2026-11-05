import { verticalOf, type VerticalKey } from '@/lib/marketplace/verticals'
import { parseSchedule, WEEK_DAY_ORDER } from '@/lib/store/hours'
import type { Database } from '@/types/database'
import type { WeekDay } from '@/types/app'

type StoreRow = Database['public']['Tables']['stores']['Row']

export type StoreJsonLdInput = Pick<
  StoreRow,
  | 'name'
  | 'description'
  | 'category'
  | 'address'
  | 'lat'
  | 'lng'
  | 'whatsapp_phone'
  | 'logo_url'
  | 'cover_url'
  | 'rating_avg'
  | 'rating_count'
> & { schedule: unknown }

/**
 * Below this, an average is noise to a search result. Same bar as the home's
 * review stat (`PROOF_THRESHOLDS` in lib/marketplace/social-proof).
 */
export const JSONLD_MIN_REVIEWS = 10

const SCHEMA_TYPE: Record<VerticalKey, string> = {
  restaurantes: 'Restaurant',
  panaderia: 'Bakery',
  reposteria: 'Bakery',
  mercado: 'GroceryStore',
  farmacia: 'Pharmacy',
  mascotas: 'PetStore',
  regalos: 'Store',
  tecnologia: 'ElectronicsStore',
}

const FOOD: ReadonlySet<VerticalKey> = new Set([
  'restaurantes',
  'panaderia',
  'reposteria',
])

const DAY_URI: Record<WeekDay, string> = {
  mon: 'https://schema.org/Monday',
  tue: 'https://schema.org/Tuesday',
  wed: 'https://schema.org/Wednesday',
  thu: 'https://schema.org/Thursday',
  fri: 'https://schema.org/Friday',
  sat: 'https://schema.org/Saturday',
  sun: 'https://schema.org/Sunday',
}

/**
 * schema.org description of one storefront, for search engines.
 *
 * Everything in it is a column the merchant filled in; nothing is inferred.
 * In particular the address stays the street line they wrote, with no city
 * added: stores in Soledad or Puerto Colombia would otherwise be told to
 * Google as Barranquilla. Empty fields are left out rather than sent blank,
 * and the rating appears only once it rests on enough real reviews.
 *
 * Overnight hours keep their real closing time ("18:00" to "02:00"), which
 * is how Google reads a business open past midnight.
 */
export function storeJsonLd(store: StoreJsonLdInput, url: string) {
  const vertical = verticalOf(store.category)
  const food = FOOD.has(vertical)
  const schedule = parseSchedule(store.schedule)
  const hours = WEEK_DAY_ORDER.flatMap((day) => {
    const entry = schedule[day]
    return entry
      ? [
          {
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: DAY_URI[day],
            opens: entry.open,
            closes: entry.close,
          },
        ]
      : []
  })
  const images = [store.cover_url, store.logo_url].filter(
    (value): value is string => Boolean(value),
  )

  return {
    '@context': 'https://schema.org',
    '@type': SCHEMA_TYPE[vertical],
    name: store.name,
    ...(store.description ? { description: store.description } : {}),
    url,
    ...(images.length > 0 ? { image: images } : {}),
    ...(store.logo_url ? { logo: store.logo_url } : {}),
    ...(store.whatsapp_phone ? { telephone: store.whatsapp_phone } : {}),
    ...(store.address
      ? {
          address: {
            '@type': 'PostalAddress',
            streetAddress: store.address,
            addressCountry: 'CO',
          },
        }
      : {}),
    ...(store.lat !== null && store.lng !== null
      ? {
          geo: {
            '@type': 'GeoCoordinates',
            latitude: store.lat,
            longitude: store.lng,
          },
        }
      : {}),
    ...(hours.length > 0 ? { openingHoursSpecification: hours } : {}),
    ...(food && store.category ? { servesCuisine: store.category } : {}),
    ...(food ? { hasMenu: url } : {}),
    ...(store.rating_count >= JSONLD_MIN_REVIEWS
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: Math.round(Number(store.rating_avg) * 10) / 10,
            reviewCount: store.rating_count,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  }
}

/**
 * JSON for an inline `<script type="application/ld+json">`. Every `<` is
 * written as its unicode escape, so merchant text such as a description
 * containing `</script>` cannot close the tag; JSON.parse reads it back
 * unchanged.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
