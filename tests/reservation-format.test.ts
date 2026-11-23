import { describe, expect, it } from 'vitest'
import {
  daySummary,
  groupByServiceDate,
  guestHistory,
  type BoardReservation,
} from '@/lib/reservations/board'
import {
  formatReservationDay,
  formatReservationTime,
  formatReservationWhen,
  partyLabel,
} from '@/lib/reservations/format'
import { buildIcs } from '@/lib/reservations/ics'

const NOW = new Date('2026-11-25T13:00:00.000Z')

describe('reservation formats', () => {
  it('reads in Bogotá time with plain spaces', () => {
    const text = formatReservationWhen('2026-11-28T00:30:00.000Z')
    expect(text).toMatch(/vie/)
    expect(text).toMatch(/27/)
    expect(text).toMatch(/7:30 p\. m\./)
    expect(text).not.toMatch(/[  ]/)
    expect(formatReservationTime('2026-11-28T00:30:00.000Z')).toBe('7:30 p. m.')
  })

  it('names today and tomorrow', () => {
    expect(formatReservationDay('2026-11-25', NOW)).toBe('Hoy')
    expect(formatReservationDay('2026-11-26', NOW)).toBe('Mañana')
    expect(formatReservationDay('2026-11-27', NOW)).toMatch(/vie/)
  })

  it('pluralises the party', () => {
    expect(partyLabel(1)).toBe('1 persona')
    expect(partyLabel(4)).toBe('4 personas')
  })
})

const row = (overrides: Partial<BoardReservation>): BoardReservation => ({
  id: 'r',
  status: 'confirmed',
  starts_at: '2026-11-26T00:00:00.000Z',
  service_date: '2026-11-25',
  party_size: 2,
  customer_id: 'c1',
  ...overrides,
})

describe('the board', () => {
  it('groups by service date and sorts by time', () => {
    const days = groupByServiceDate([
      row({
        id: 'b',
        starts_at: '2026-11-27T01:00:00.000Z',
        service_date: '2026-11-26',
      }),
      row({ id: 'a', starts_at: '2026-11-26T00:00:00.000Z' }),
      row({
        id: 'c',
        starts_at: '2026-11-26T23:00:00.000Z',
        service_date: '2026-11-26',
      }),
    ])
    expect(days.map((d) => [d.date, d.reservations.map((r) => r.id)])).toEqual([
      ['2026-11-25', ['a']],
      ['2026-11-26', ['c', 'b']],
    ])
  })

  it('summarises a day, counting only expected guests', () => {
    expect(
      daySummary([
        row({ status: 'pending', party_size: 4 }),
        row({ status: 'confirmed', party_size: 2 }),
        row({ status: 'seated', party_size: 3 }),
        row({ status: 'declined', party_size: 6 }),
      ]),
    ).toEqual({ reservations: 3, covers: 9, pending: 1, seated: 1 })
  })

  it('remembers visits and no-shows per customer', () => {
    const history = guestHistory([
      row({ status: 'seated' }),
      row({ status: 'no_show' }),
      row({ status: 'seated', customer_id: 'c2' }),
    ])
    expect(history.get('c1')).toEqual({ visits: 1, noShows: 1 })
    expect(history.get('c2')).toEqual({ visits: 1, noShows: 0 })
  })
})

describe('buildIcs', () => {
  it('writes a valid event with escaped text', () => {
    const ics = buildIcs({
      uid: 'abc',
      title: 'Reserva en La Parrilla, 4 personas',
      start: new Date('2026-11-28T00:30:00.000Z'),
      durationMinutes: 90,
      location: 'Calle 84; local 2',
      now: new Date('2026-11-25T13:00:00.000Z'),
    })
    expect(ics).toContain('DTSTART:20261128T003000Z')
    expect(ics).toContain('DTEND:20261128T020000Z')
    expect(ics).toContain('SUMMARY:Reserva en La Parrilla\\, 4 personas')
    expect(ics).toContain('LOCATION:Calle 84\\; local 2')
    expect(ics.split('\r\n')[0]).toBe('BEGIN:VCALENDAR')
  })
})
