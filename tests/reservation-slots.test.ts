import { describe, expect, it } from 'vitest'
import {
  bookableDates,
  checkStart,
  loadFromRows,
  nextAvailableDates,
  slotsFor,
  type ReservationConfig,
} from '@/lib/reservations/slots'
import {
  addDays,
  bogotaClock,
  bogotaInstant,
  isWithinOpeningHours,
  openingWindowOn,
  weekDayOfDate,
} from '@/lib/store/hours'

// 2026-11-27 is a Friday. Every instant below is written in UTC; Bogotá is
// UTC-5, so 17:00Z is noon in Barranquilla.
const FRIDAY = '2026-11-27'
const at = (iso: string) => new Date(iso)

const CONFIG: ReservationConfig = {
  slotMinutes: 30,
  coversPerSlot: 20,
  maxPartySize: 8,
  minLeadMinutes: 120,
  maxDaysAhead: 30,
  durationMinutes: 90,
  blockedDates: [],
}

const LUNCH_AND_DINNER = {
  mon: { open: '12:00', close: '22:00' },
  tue: { open: '12:00', close: '22:00' },
  wed: { open: '12:00', close: '22:00' },
  thu: { open: '12:00', close: '22:00' },
  fri: { open: '18:00', close: '02:00' },
  sat: { open: '12:00', close: '22:00' },
}

const base = {
  schedule: LUNCH_AND_DINNER,
  config: CONFIG,
  load: [],
  partySize: 2,
  // Wednesday 25 Nov, 08:00 in Bogotá.
  now: at('2026-11-25T13:00:00.000Z'),
}

describe('Bogotá-explicit time helpers', () => {
  it('reads the Bogotá date and clock of an instant', () => {
    // 23:30 Bogotá on the 25th is already the 26th in UTC.
    expect(bogotaClock(at('2026-11-26T04:30:00.000Z'))).toEqual({
      date: '2026-11-25',
      minutes: 23 * 60 + 30,
      day: 'wed',
    })
  })

  it('builds instants, including past midnight', () => {
    expect(bogotaInstant(FRIDAY, 19 * 60 + 30).toISOString()).toBe(
      '2026-11-28T00:30:00.000Z',
    )
    expect(bogotaInstant(FRIDAY, 25 * 60).toISOString()).toBe(
      '2026-11-28T06:00:00.000Z',
    )
  })

  it('knows weekdays and windows that cross midnight', () => {
    expect(weekDayOfDate(FRIDAY)).toBe('fri')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(openingWindowOn(LUNCH_AND_DINNER, FRIDAY)).toEqual({
      start: 18 * 60,
      end: 26 * 60,
    })
    expect(openingWindowOn(LUNCH_AND_DINNER, '2026-11-29')).toBeNull()
  })

  it('counts the tail of Friday night as open on Saturday morning', () => {
    // Saturday 01:30 Bogotá.
    expect(
      isWithinOpeningHours(LUNCH_AND_DINNER, at('2026-11-28T06:30:00.000Z')),
    ).toBe(true)
    // Saturday 03:00 Bogotá: Friday's window closed at 02:00.
    expect(
      isWithinOpeningHours(LUNCH_AND_DINNER, at('2026-11-28T08:00:00.000Z')),
    ).toBe(false)
  })
})

describe('slotsFor', () => {
  it('offers every half hour, the last one leaving the duration before closing', () => {
    const slots = slotsFor({ ...base, date: '2026-11-26' })
    expect(slots[0].time).toBe('12:00')
    expect(slots.at(-1)?.time).toBe('20:30')
    expect(slots).toHaveLength(18)
  })

  it('runs past midnight on the service it belongs to', () => {
    const friday = slotsFor({
      ...base,
      date: FRIDAY,
      config: { ...CONFIG, durationMinutes: 120 },
    })
    expect(friday.at(-1)).toMatchObject({ time: '00:00', afterMidnight: true })
    // Saturday does not repeat Friday's tail.
    const saturday = slotsFor({ ...base, date: '2026-11-28' })
    expect(saturday[0].time).toBe('12:00')
  })

  it('offers nothing on a closed or blocked day', () => {
    expect(slotsFor({ ...base, date: '2026-11-29' })).toEqual([])
    expect(
      slotsFor({
        ...base,
        date: '2026-11-26',
        config: { ...CONFIG, blockedDates: ['2026-11-26'] },
      }),
    ).toEqual([])
  })

  it('hides times sooner than the minimum notice', () => {
    // 17:00 Bogotá with 120 minutes of notice: the first slot is 19:00.
    const slots = slotsFor({
      ...base,
      date: '2026-11-26',
      now: at('2026-11-26T22:00:00.000Z'),
    })
    expect(slots[0].time).toBe('19:00')
  })

  it('counts covers starting inside the slot, and keeps full slots visible', () => {
    const load = loadFromRows([
      {
        starts_at: bogotaInstant('2026-11-26', 19 * 60 + 30).toISOString(),
        party_size: 10,
      },
      // An old reservation at 19:40 still belongs to the 19:30 slot.
      {
        starts_at: bogotaInstant('2026-11-26', 19 * 60 + 40).toISOString(),
        party_size: 8,
      },
    ])
    const slots = slotsFor({ ...base, date: '2026-11-26', load })
    const s1930 = slots.find((slot) => slot.time === '19:30')
    expect(s1930).toMatchObject({ remaining: 2, available: true })
    const full = slotsFor({ ...base, date: '2026-11-26', load, partySize: 3 })
    expect(full.find((slot) => slot.time === '19:30')).toMatchObject({
      available: false,
      reason: 'full',
    })
  })

  it('marks every slot for a group above the limit', () => {
    const slots = slotsFor({ ...base, date: '2026-11-26', partySize: 9 })
    expect(slots.every((slot) => slot.reason === 'party')).toBe(true)
  })

  it('returns nothing beyond the horizon or in the past', () => {
    expect(slotsFor({ ...base, date: addDays('2026-11-25', 31) })).toEqual([])
    expect(slotsFor({ ...base, date: '2026-11-24' })).toEqual([])
  })

  it('gives the same answer whatever the runtime time zone', () => {
    // No getHours() anywhere: the result is a pure function of instants.
    const a = slotsFor({ ...base, date: FRIDAY }).map((slot) => slot.startsAt)
    expect(a[0]).toBe('2026-11-27T23:00:00.000Z')
  })

  it('offers nothing when the window is shorter than a reservation', () => {
    expect(
      slotsFor({
        ...base,
        date: '2026-11-26',
        schedule: { thu: { open: '12:00', close: '13:00' } },
      }),
    ).toEqual([])
  })
})

describe('bookableDates and nextAvailableDates', () => {
  it('lists today through the horizon, saying which days are open', () => {
    const dates = bookableDates(LUNCH_AND_DINNER, CONFIG, base.now)
    expect(dates).toHaveLength(31)
    expect(dates[0]).toEqual({ date: '2026-11-25', open: true })
    expect(dates.find((d) => d.date === '2026-11-29')?.open).toBe(false)
  })

  it('suggests the next days with room', () => {
    expect(nextAvailableDates({ ...base, from: '2026-11-28' }, 2)).toEqual([
      '2026-11-30',
      '2026-12-01',
    ])
  })
})

describe('checkStart', () => {
  it('accepts an offered, available time', () => {
    expect(
      checkStart({
        ...base,
        serviceDate: '2026-11-26',
        startsAt: bogotaInstant('2026-11-26', 19 * 60 + 30),
      }),
    ).toEqual({ ok: true })
  })

  it('refuses a time off the grid', () => {
    expect(
      checkStart({
        ...base,
        serviceDate: '2026-11-26',
        startsAt: bogotaInstant('2026-11-26', 19 * 60 + 10),
      }).ok,
    ).toBe(false)
  })

  it('refuses a group above the limit with a way out', () => {
    const result = checkStart({
      ...base,
      partySize: 12,
      serviceDate: '2026-11-26',
      startsAt: bogotaInstant('2026-11-26', 19 * 60 + 30),
    })
    expect(!result.ok && result.error).toMatch(/más de 8 personas/)
  })
})
