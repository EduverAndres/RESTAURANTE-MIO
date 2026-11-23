import { describe, expect, it } from 'vitest'
import {
  addDaysToDate,
  bogotaMonthStart,
  bogotaToday,
  isPeriod,
  nextPeriod,
  periodBounds,
  periodLabel,
  previousPeriod,
  recentClosedPeriods,
} from '@/lib/companies/period'

describe('bogotaMonthStart', () => {
  it('is the first day of the month in Bogotá, not in UTC', () => {
    // 1 Dec 03:00 UTC is still 30 Nov 22:00 in Bogotá.
    expect(bogotaMonthStart(new Date('2026-12-01T03:00:00Z'))).toBe(
      '2026-11-01',
    )
    expect(bogotaMonthStart(new Date('2026-12-01T05:00:00Z'))).toBe(
      '2026-12-01',
    )
    expect(bogotaMonthStart(new Date('2027-01-01T04:59:59Z'))).toBe(
      '2026-12-01',
    )
  })

  it('bogotaToday follows the same clock', () => {
    expect(bogotaToday(new Date('2026-12-01T03:00:00Z'))).toBe('2026-11-30')
  })
})

describe('periods', () => {
  it('recognises a month start', () => {
    expect(isPeriod('2026-11-01')).toBe(true)
    expect(isPeriod('2026-11-02')).toBe(false)
    expect(isPeriod('2026-13-01')).toBe(false)
    expect(isPeriod('nope')).toBe(false)
  })

  it('steps months across years', () => {
    expect(nextPeriod('2026-12-01')).toBe('2027-01-01')
    expect(previousPeriod('2027-01-01')).toBe('2026-12-01')
    expect(nextPeriod('2026-01-01')).toBe('2026-02-01')
  })

  it('bounds a period at Bogotá midnight (05:00 UTC)', () => {
    const { start, end } = periodBounds('2026-11-01')
    expect(start.toISOString()).toBe('2026-11-01T05:00:00.000Z')
    expect(end.toISOString()).toBe('2026-12-01T05:00:00.000Z')
  })

  it('names a period in Spanish', () => {
    expect(periodLabel('2026-11-01')).toBe('noviembre de 2026')
    expect(periodLabel('2027-01-01')).toBe('enero de 2027')
  })

  it('lists the most recent closed months, newest first', () => {
    expect(recentClosedPeriods(new Date('2026-11-23T15:00:00Z'), 3)).toEqual([
      '2026-10-01',
      '2026-09-01',
      '2026-08-01',
    ])
  })
})

describe('addDaysToDate', () => {
  it('adds calendar days to a date-only string', () => {
    expect(addDaysToDate('2026-11-23', 30)).toBe('2026-12-23')
    expect(addDaysToDate('2026-12-15', 30)).toBe('2027-01-14')
    expect(addDaysToDate('2026-02-28', 1)).toBe('2026-03-01')
  })
})
