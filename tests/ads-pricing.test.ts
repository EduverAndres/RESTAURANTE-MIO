import { describe, expect, it } from 'vitest'
import {
  DEFAULT_AD_PLACEMENTS,
  MAX_START_AHEAD_DAYS,
  adDays,
  adTotalPrice,
  daysLabel,
  formatAdDay,
  formatAdRange,
  isDateOnly,
  quoteAdCampaign,
} from '@/lib/ads/pricing'
import { addDays } from '@/lib/store/hours'

const TODAY = '2026-11-23'
const HOME = DEFAULT_AD_PLACEMENTS.home_featured

const quote = (startsOn: string, endsOn: string, settings = HOME) =>
  quoteAdCampaign({ settings, startsOn, endsOn, today: TODAY })

describe('adDays', () => {
  it('counts both ends of the run', () => {
    expect(adDays('2026-11-23', '2026-11-23')).toBe(1)
    expect(adDays('2026-11-23', '2026-11-29')).toBe(7)
  })

  it('crosses month and year ends by the calendar', () => {
    expect(adDays('2026-11-28', '2026-12-03')).toBe(6)
    expect(adDays('2026-12-30', '2027-01-02')).toBe(4)
    expect(adDays('2028-02-28', '2028-03-01')).toBe(3)
  })

  it('is zero for a reversed range, never negative', () => {
    expect(adDays('2026-11-29', '2026-11-23')).toBe(0)
  })
})

describe('adTotalPrice', () => {
  it('is the price per day times the days, like ad_campaigns.total_price', () => {
    expect(adTotalPrice(15000, '2026-11-23', '2026-11-29')).toBe(105000)
    expect(adTotalPrice(6000, '2026-12-30', '2027-01-02')).toBe(24000)
  })
})

describe('isDateOnly', () => {
  it('accepts real calendar dates only', () => {
    expect(isDateOnly('2026-11-23')).toBe(true)
    expect(isDateOnly('2028-02-29')).toBe(true)
    expect(isDateOnly('2026-02-30')).toBe(false)
    expect(isDateOnly('2026-11-23T00:00:00Z')).toBe(false)
    expect(isDateOnly('')).toBe(false)
    expect(isDateOnly(20261123)).toBe(false)
  })
})

describe('quoteAdCampaign', () => {
  it('prices a valid run at the placement price', () => {
    expect(quote('2026-11-23', '2026-11-29')).toEqual({
      ok: true,
      days: 7,
      dailyPrice: 15000,
      total: 105000,
    })
  })

  it('lets a campaign start today, so it can go on the air when approved', () => {
    expect(quote(TODAY, addDays(TODAY, 2)).ok).toBe(true)
  })

  it('refuses a start in the past', () => {
    expect(quote('2026-11-22', '2026-11-29')).toMatchObject({
      ok: false,
      reason: 'start_past',
    })
  })

  it('refuses a start beyond the booking horizon', () => {
    const start = addDays(TODAY, MAX_START_AHEAD_DAYS + 1)
    expect(quote(start, addDays(start, 5))).toMatchObject({
      ok: false,
      reason: 'start_too_far',
    })
    const edge = addDays(TODAY, MAX_START_AHEAD_DAYS)
    expect(quote(edge, addDays(edge, 5)).ok).toBe(true)
  })

  it('enforces the shortest and longest run, both inclusive', () => {
    expect(quote(TODAY, addDays(TODAY, HOME.min_days - 2))).toMatchObject({
      ok: false,
      reason: 'too_short',
      message: 'La campaña mínima es de 3 días.',
    })
    expect(quote(TODAY, addDays(TODAY, HOME.min_days - 1)).ok).toBe(true)
    expect(quote(TODAY, addDays(TODAY, HOME.max_days - 1)).ok).toBe(true)
    expect(quote(TODAY, addDays(TODAY, HOME.max_days))).toMatchObject({
      ok: false,
      reason: 'too_long',
    })
  })

  it('says one day, not one days', () => {
    const single = { ...HOME, min_days: 1, max_days: 1 }
    expect(quote(TODAY, addDays(TODAY, 1), single)).toMatchObject({
      message: 'La campaña máxima es de 1 día.',
    })
  })

  it('refuses reversed or missing dates and an inactive placement', () => {
    expect(quote('2026-11-29', '2026-11-25')).toMatchObject({
      reason: 'end_before_start',
    })
    expect(quote('', '2026-11-25')).toMatchObject({ reason: 'invalid_date' })
    expect(
      quote('2026-11-23', '2026-11-29', { ...HOME, active: false }),
    ).toMatchObject({ reason: 'inactive' })
  })

  it('opens with the prices agreed for launch', () => {
    expect(DEFAULT_AD_PLACEMENTS.home_featured.daily_price).toBe(15000)
    expect(DEFAULT_AD_PLACEMENTS.category_top.daily_price).toBe(8000)
    expect(DEFAULT_AD_PLACEMENTS.search_top.daily_price).toBe(6000)
  })
})

describe('formatAdDay and formatAdRange', () => {
  it('reads the calendar date in Spanish, the same on any ICU build', () => {
    expect(formatAdDay('2026-11-23')).toBe('23 nov')
    expect(formatAdDay('2027-01-02')).toBe('2 ene')
    expect(formatAdRange('2026-11-23', '2026-11-29')).toBe('23 nov – 29 nov')
    expect(formatAdRange('2026-11-23', '2026-11-23')).toBe('23 nov')
    expect(daysLabel(1)).toBe('1 día')
    expect(daysLabel(7)).toBe('7 días')
  })
})
