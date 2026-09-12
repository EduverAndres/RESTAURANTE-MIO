import { describe, expect, it } from 'vitest'
import {
  parseSchedule,
  storeHoursState,
  timeToMinutes,
  weekDayOf,
  weeklySchedule,
} from '@/lib/store/hours'

const FULL_WEEK = {
  mon: { open: '12:00', close: '22:00' },
  tue: { open: '12:00', close: '22:00' },
  wed: { open: '12:00', close: '22:00' },
  thu: { open: '12:00', close: '23:00' },
  fri: { open: '12:00', close: '23:30' },
  sat: { open: '12:00', close: '23:30' },
  sun: { open: '12:00', close: '20:00' },
}

// 2026-09-14 is a Monday.
const monday = (hour: number, minute = 0) =>
  new Date(2026, 8, 14, hour, minute, 0, 0)

describe('timeToMinutes', () => {
  it('reads HH:MM', () => {
    expect(timeToMinutes('00:00')).toBe(0)
    expect(timeToMinutes('12:30')).toBe(750)
    expect(timeToMinutes('23:59')).toBe(1439)
  })

  it('rejects anything else', () => {
    expect(timeToMinutes('24:00')).toBeNull()
    expect(timeToMinutes('12:60')).toBeNull()
    expect(timeToMinutes('nope')).toBeNull()
    expect(timeToMinutes('')).toBeNull()
  })
})

describe('weekDayOf', () => {
  it('maps Sunday to sun and Monday to mon', () => {
    expect(weekDayOf(new Date(2026, 8, 13))).toBe('sun')
    expect(weekDayOf(new Date(2026, 8, 14))).toBe('mon')
    expect(weekDayOf(new Date(2026, 8, 19))).toBe('sat')
  })
})

describe('parseSchedule', () => {
  it('keeps valid days and drops the rest', () => {
    const parsed = parseSchedule({
      mon: { open: '09:00', close: '17:00' },
      tue: { open: 'bad', close: '17:00' },
      xxx: { open: '09:00', close: '17:00' },
      wed: null,
    })
    expect(parsed).toEqual({ mon: { open: '09:00', close: '17:00' } })
  })

  it('never throws on junk', () => {
    expect(parseSchedule(null)).toEqual({})
    expect(parseSchedule('nope')).toEqual({})
    expect(parseSchedule([1, 2])).toEqual({})
  })
})

describe('weeklySchedule', () => {
  it('returns the seven days in order with today flagged', () => {
    const rows = weeklySchedule(FULL_WEEK, monday(13))
    expect(rows).toHaveLength(7)
    expect(rows[0].day).toBe('mon')
    expect(rows[0].label).toBe('Lunes')
    expect(rows[0].today).toBe(true)
    expect(rows[1].today).toBe(false)
    expect(rows[6].day).toBe('sun')
  })

  it('marks a missing day as closed', () => {
    const rows = weeklySchedule({ mon: { open: '09:00', close: '17:00' } })
    expect(rows[0].hours).toEqual({ open: '09:00', close: '17:00' })
    expect(rows[1].hours).toBeNull()
  })
})

describe('storeHoursState', () => {
  it('is closed when the merchant switch is off, whatever the schedule says', () => {
    const state = storeHoursState({
      schedule: FULL_WEEK,
      isOpen: false,
      now: monday(13),
    })
    expect(state.open).toBe(false)
    expect(state.label).toBe('Cerrado ahora')
  })

  it('is open inside the window', () => {
    const state = storeHoursState({
      schedule: FULL_WEEK,
      isOpen: true,
      now: monday(13),
    })
    expect(state.open).toBe(true)
    expect(state.closesInMin).toBeNull()
    expect(state.label).toBe('Abierto ahora')
  })

  it('warns when it closes soon', () => {
    const state = storeHoursState({
      schedule: FULL_WEEK,
      isOpen: true,
      now: monday(21, 35),
    })
    expect(state.open).toBe(true)
    expect(state.closesInMin).toBe(25)
    expect(state.label).toBe('Cierra en 25 min')
  })

  it('announces today’s opening time when it has not opened yet', () => {
    const state = storeHoursState({
      schedule: FULL_WEEK,
      isOpen: true,
      now: monday(9),
    })
    expect(state.open).toBe(false)
    expect(state.opensAt).toBe('12:00')
    expect(state.label).toBe('Abre hoy a las 12:00')
  })

  it('rolls over to tomorrow once the day is done', () => {
    const state = storeHoursState({
      schedule: FULL_WEEK,
      isOpen: true,
      now: monday(23),
    })
    expect(state.open).toBe(false)
    expect(state.label).toBe('Abre mañana a las 12:00')
  })

  it('names the next open weekday when it is further away', () => {
    const state = storeHoursState({
      schedule: { fri: { open: '18:00', close: '23:00' } },
      isOpen: true,
      now: monday(13),
    })
    expect(state.open).toBe(false)
    expect(state.label).toBe('Abre el viernes a las 18:00')
  })

  it('handles a window that crosses midnight', () => {
    const schedule = { mon: { open: '18:00', close: '02:00' } }
    expect(
      storeHoursState({ schedule, isOpen: true, now: monday(23) }).open,
    ).toBe(true)
    // 01:00 on Tuesday still belongs to Monday's window.
    expect(
      storeHoursState({
        schedule,
        isOpen: true,
        now: new Date(2026, 8, 15, 1, 0),
      }).open,
    ).toBe(true)
    expect(
      storeHoursState({
        schedule,
        isOpen: true,
        now: new Date(2026, 8, 15, 3, 0),
      }).open,
    ).toBe(false)
  })

  it('falls back to the merchant switch when there is no usable schedule', () => {
    const state = storeHoursState({
      schedule: {},
      isOpen: true,
      now: monday(13),
    })
    expect(state.open).toBe(true)
    expect(state.label).toBe('Abierto ahora')
  })

  it('reports today', () => {
    expect(
      storeHoursState({ schedule: FULL_WEEK, isOpen: true, now: monday(13) })
        .today,
    ).toBe('mon')
  })
})
