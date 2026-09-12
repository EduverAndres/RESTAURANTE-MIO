import { describe, expect, it } from 'vitest'
import { countdownLabel, countdownTo } from '@/lib/orders/countdown'

const NOW = new Date('2026-09-11T15:00:00.000Z')

describe('countdownTo', () => {
  it('returns null without a target', () => {
    expect(countdownTo(null, NOW)).toBeNull()
    expect(countdownTo(undefined, NOW)).toBeNull()
  })

  it('returns null for an unparseable target', () => {
    expect(countdownTo('not a date', NOW)).toBeNull()
  })

  it('splits the remaining time into whole minutes and seconds', () => {
    const result = countdownTo('2026-09-11T15:12:30.000Z', NOW)
    expect(result).toEqual({
      totalSeconds: 750,
      minutes: 12,
      seconds: 30,
      past: false,
    })
  })

  it('accepts a Date as well as an ISO string', () => {
    const result = countdownTo(new Date('2026-09-11T15:01:00.000Z'), NOW)
    expect(result?.totalSeconds).toBe(60)
  })

  it('clamps a target already in the past to zero and flags it', () => {
    const result = countdownTo('2026-09-11T14:45:00.000Z', NOW)
    expect(result).toEqual({
      totalSeconds: 0,
      minutes: 0,
      seconds: 0,
      past: true,
    })
  })

  it('rounds down to the second, so the clock never shows a minute it has not reached', () => {
    const result = countdownTo('2026-09-11T15:00:59.900Z', NOW)
    expect(result?.seconds).toBe(59)
    expect(result?.minutes).toBe(0)
  })
})

describe('countdownLabel', () => {
  it('pads the seconds so the label never changes width', () => {
    expect(
      countdownLabel({
        totalSeconds: 65,
        minutes: 1,
        seconds: 5,
        past: false,
      }),
    ).toBe('1:05')
  })

  it('keeps the minutes unpadded and counts past an hour in minutes', () => {
    expect(
      countdownLabel({
        totalSeconds: 5_400,
        minutes: 90,
        seconds: 0,
        past: false,
      }),
    ).toBe('90:00')
  })

  it('says the order is due rather than showing 0:00', () => {
    expect(
      countdownLabel({ totalSeconds: 0, minutes: 0, seconds: 0, past: true }),
    ).toBe('Llegando')
  })
})
