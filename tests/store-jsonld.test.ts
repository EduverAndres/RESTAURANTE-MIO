import { describe, expect, it } from 'vitest'
import { serializeJsonLd, storeJsonLd } from '@/lib/seo/store-jsonld'

const URL = 'https://parrilla.cerquita.co'

const base = {
  name: 'La Parrilla del Norte',
  description: 'Carnes a la brasa en Alto Prado.',
  category: 'Parrilla',
  address: 'Carrera 53 # 79-120, Alto Prado',
  lat: 10.9985,
  lng: -74.8085,
  whatsapp_phone: '+573001112233',
  logo_url: 'https://x.supabase.co/storage/v1/object/public/logos/a.png',
  cover_url: 'https://x.supabase.co/storage/v1/object/public/covers/a.jpg',
  rating_avg: 4.6666,
  rating_count: 12,
  schedule: {
    mon: { open: '11:00', close: '22:00' },
    sat: { open: '18:00', close: '02:00' },
    tue: { open: 'nope', close: '22:00' },
  },
}

describe('storeJsonLd', () => {
  it('describes a restaurant with its real address, position and contact', () => {
    const data = storeJsonLd(base, URL)
    expect(data).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'Restaurant',
      name: 'La Parrilla del Norte',
      description: 'Carnes a la brasa en Alto Prado.',
      url: URL,
      telephone: '+573001112233',
      servesCuisine: 'Parrilla',
      hasMenu: URL,
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Carrera 53 # 79-120, Alto Prado',
        addressCountry: 'CO',
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: 10.9985,
        longitude: -74.8085,
      },
    })
    expect(data.image).toEqual([base.cover_url, base.logo_url])
  })

  it('never invents a city the store did not write', () => {
    const data = storeJsonLd(base, URL)
    expect(JSON.stringify(data)).not.toContain('Barranquilla')
  })

  it('turns the weekly schedule into opening hours, overnight included', () => {
    expect(storeJsonLd(base, URL).openingHoursSpecification).toEqual([
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: 'https://schema.org/Monday',
        opens: '11:00',
        closes: '22:00',
      },
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: 'https://schema.org/Saturday',
        opens: '18:00',
        closes: '02:00',
      },
    ])
  })

  it('adds the rating only once there are enough real reviews', () => {
    expect(storeJsonLd(base, URL).aggregateRating).toEqual({
      '@type': 'AggregateRating',
      ratingValue: 4.7,
      reviewCount: 12,
      bestRating: 5,
      worstRating: 1,
    })
    expect(
      storeJsonLd({ ...base, rating_count: 9 }, URL).aggregateRating,
    ).toBeUndefined()
  })

  it('maps non-food businesses to their own schema.org type', () => {
    expect(storeJsonLd({ ...base, category: 'Farmacia' }, URL)['@type']).toBe(
      'Pharmacy',
    )
    const shop = storeJsonLd({ ...base, category: 'Minimarket' }, URL)
    expect(shop['@type']).toBe('GroceryStore')
    // Cuisine and menu only make sense for food.
    expect(shop.servesCuisine).toBeUndefined()
    expect(shop.hasMenu).toBeUndefined()
  })

  it('leaves out what the store has not filled in', () => {
    const data = storeJsonLd(
      {
        ...base,
        description: null,
        address: null,
        lat: null,
        lng: null,
        whatsapp_phone: null,
        logo_url: null,
        cover_url: null,
        schedule: null,
      },
      URL,
    )
    for (const key of [
      'description',
      'address',
      'geo',
      'telephone',
      'image',
      'openingHoursSpecification',
    ]) {
      expect(data).not.toHaveProperty(key)
    }
  })
})

describe('serializeJsonLd', () => {
  it('cannot be closed from inside a store description', () => {
    const out = serializeJsonLd({
      description: '</script><script>alert(1)</script>',
    })
    expect(out).not.toContain('</script>')
    expect(JSON.parse(out)).toEqual({
      description: '</script><script>alert(1)</script>',
    })
  })
})
