import { describe, expect, it } from 'vitest'
import {
  STORE_CATEGORIES,
  WEEK_DAYS,
  WEEK_DAY_LABELS,
  assetObjectPath,
  deriveSlug,
  emptyScheduleForm,
  formToSchedule,
  scheduleSchema,
  scheduleToForm,
  storeBasicsSchema,
  storeLogisticsSchema,
} from '@/lib/validations/store'

const STORE_ID = '11111111-1111-4111-8111-111111111111'

describe('deriveSlug', () => {
  it('reuses slugify rules', () => {
    expect(deriveSlug('Café Ñandú  Bar')).toBe('cafe-nandu-bar')
    expect(deriveSlug('   ')).toBe('')
  })
})

describe('storeBasicsSchema', () => {
  const valid = {
    name: 'La Parrilla',
    slug: 'la-parrilla',
    category: 'Parrilla',
    description: '',
    whatsapp_phone: '+57 300 123 4567',
  }

  it('accepts a valid store and normalises optional fields', () => {
    const result = storeBasicsSchema.safeParse(valid)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.description).toBeNull()
    expect(result.data.whatsapp_phone).toBe('+573001234567')
  })

  it('rejects slugs that break the database pattern', () => {
    for (const slug of ['La Parrilla', '-parrilla', 'parrilla-', 'a--b', '']) {
      expect(storeBasicsSchema.safeParse({ ...valid, slug }).success).toBe(
        false,
      )
    }
  })

  it('requires a name and allows an empty phone', () => {
    expect(storeBasicsSchema.safeParse({ ...valid, name: 'L' }).success).toBe(
      false,
    )
    const result = storeBasicsSchema.safeParse({ ...valid, whatsapp_phone: '' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.whatsapp_phone).toBeNull()
  })

  it('exposes a curated category list', () => {
    expect(STORE_CATEGORIES).toContain('Parrilla')
    expect(STORE_CATEGORIES).toContain('Comida rápida')
    expect(new Set(STORE_CATEGORIES).size).toBe(STORE_CATEGORIES.length)
  })
})

describe('storeLogisticsSchema', () => {
  const valid = {
    address: 'Carrera 6 # 119-40',
    lat: 4.698,
    lng: -74.041,
    delivery_radius_km: 5,
    delivery_fee: 6000,
    min_order: 0,
    prep_time_min: 25,
  }

  it('accepts sane values', () => {
    expect(storeLogisticsSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects out-of-range numbers', () => {
    expect(
      storeLogisticsSchema.safeParse({ ...valid, delivery_radius_km: 0 })
        .success,
    ).toBe(false)
    expect(
      storeLogisticsSchema.safeParse({ ...valid, delivery_fee: -1 }).success,
    ).toBe(false)
    expect(
      storeLogisticsSchema.safeParse({ ...valid, prep_time_min: 2.5 }).success,
    ).toBe(false)
    expect(storeLogisticsSchema.safeParse({ ...valid, lat: 91 }).success).toBe(
      false,
    )
    expect(
      storeLogisticsSchema.safeParse({ ...valid, prep_time_min: Number.NaN })
        .success,
    ).toBe(false)
  })
})

describe('schedule', () => {
  it('labels every weekday in Spanish', () => {
    expect(WEEK_DAYS).toEqual(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])
    expect(WEEK_DAY_LABELS.mon).toBe('Lunes')
    expect(WEEK_DAY_LABELS.sun).toBe('Domingo')
  })

  it('accepts an empty schedule and HH:MM ranges', () => {
    expect(scheduleSchema.safeParse({}).success).toBe(true)
    expect(
      scheduleSchema.safeParse({ mon: { open: '08:00', close: '22:30' } })
        .success,
    ).toBe(true)
  })

  it('rejects closing before opening and malformed times', () => {
    expect(
      scheduleSchema.safeParse({ mon: { open: '22:00', close: '08:00' } })
        .success,
    ).toBe(false)
    expect(
      scheduleSchema.safeParse({ mon: { open: '8am', close: '22:00' } })
        .success,
    ).toBe(false)
  })

  it('round-trips between the form shape and the column shape', () => {
    const form = emptyScheduleForm()
    expect(form.mon).toEqual({ enabled: false, open: '08:00', close: '20:00' })

    const column = { tue: { open: '10:00', close: '18:00' } }
    const asForm = scheduleToForm(column)
    expect(asForm.tue).toEqual({ enabled: true, open: '10:00', close: '18:00' })
    expect(asForm.mon.enabled).toBe(false)
    expect(formToSchedule(asForm)).toEqual(column)
  })

  it('ignores unknown days when reading the column', () => {
    const asForm = scheduleToForm({ funday: { open: '1', close: '2' } })
    expect(Object.keys(asForm)).toEqual([...WEEK_DAYS])
  })
})

describe('assetObjectPath', () => {
  it('keys uploads under the store folder with a timestamp', () => {
    expect(assetObjectPath(STORE_ID, 'logo', 'image/png', 1700000000000)).toBe(
      `${STORE_ID}/logo-1700000000000.png`,
    )
    expect(assetObjectPath(STORE_ID, 'cover', 'image/jpeg', 5)).toBe(
      `${STORE_ID}/cover-5.jpg`,
    )
    expect(assetObjectPath(STORE_ID, 'cover', 'image/webp', 5)).toBe(
      `${STORE_ID}/cover-5.webp`,
    )
  })

  it('returns null for unsupported types', () => {
    expect(assetObjectPath(STORE_ID, 'logo', 'image/gif', 1)).toBeNull()
    expect(assetObjectPath(STORE_ID, 'logo', 'text/html', 1)).toBeNull()
  })
})
