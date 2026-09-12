import { describe, expect, it } from 'vitest'
import { monthBounds, startOfLocalDay, toDateOnly, weekBounds } from '@/lib/dates'

describe('startOfLocalDay', () => {
  it('zeroes the time components', () => {
    const start = startOfLocalDay(new Date(2026, 8, 12, 14, 30, 5))
    expect(start.getHours()).toBe(0)
    expect(start.getMinutes()).toBe(0)
    expect(start.getSeconds()).toBe(0)
    expect(start.getMilliseconds()).toBe(0)
    expect(start.getDate()).toBe(12)
  })
})

describe('toDateOnly', () => {
  it('formats a date as YYYY-MM-DD', () => {
    expect(toDateOnly(new Date(2026, 8, 1))).toBe('2026-09-01')
    expect(toDateOnly(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})

describe('weekBounds', () => {
  it('returns the Monday-to-Sunday range containing the date', () => {
    // Saturday 2026-09-12
    expect(weekBounds(new Date(2026, 8, 12))).toEqual({
      start: '2026-09-07',
      end: '2026-09-13',
    })
  })

  it('handles a Sunday correctly (week ends on the same day)', () => {
    // Sunday 2026-09-13
    expect(weekBounds(new Date(2026, 8, 13))).toEqual({
      start: '2026-09-07',
      end: '2026-09-13',
    })
  })

  it('handles a Monday correctly (week starts on the same day)', () => {
    // Monday 2026-09-07
    expect(weekBounds(new Date(2026, 8, 7))).toEqual({
      start: '2026-09-07',
      end: '2026-09-13',
    })
  })

  it('crosses a month boundary correctly', () => {
    // Tuesday 2026-09-01
    expect(weekBounds(new Date(2026, 8, 1))).toEqual({
      start: '2026-08-31',
      end: '2026-09-06',
    })
  })
})

describe('monthBounds', () => {
  it('returns the first and last day of the month', () => {
    expect(monthBounds(new Date(2026, 8, 12))).toEqual({
      start: '2026-09-01',
      end: '2026-09-30',
    })
  })

  it('handles February in a leap year', () => {
    expect(monthBounds(new Date(2028, 1, 10))).toEqual({
      start: '2028-02-01',
      end: '2028-02-29',
    })
  })

  it('handles December (year rollover for the next month calc)', () => {
    expect(monthBounds(new Date(2026, 11, 25))).toEqual({
      start: '2026-12-01',
      end: '2026-12-31',
    })
  })
})
