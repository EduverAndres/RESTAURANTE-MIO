import { describe, expect, it } from 'vitest'
import {
  checkTransition,
  customerCanCancel,
  displayStatus,
  storeActionsFor,
} from '@/lib/reservations/transitions'

const START = new Date('2026-11-27T00:30:00.000Z')
const minutes = (n: number) => new Date(START.getTime() + n * 60_000)
const BEFORE = minutes(-180)

const store = (
  from: Parameters<typeof checkTransition>[0]['from'],
  to: Parameters<typeof checkTransition>[0]['to'],
  now: Date,
  changed: Date | null = null,
) =>
  checkTransition({
    from,
    to,
    actor: 'store',
    startsAt: START,
    statusChangedAt: changed,
    now,
  }).ok

describe('the store', () => {
  it('confirms or declines a request before its time', () => {
    expect(store('pending', 'confirmed', BEFORE)).toBe(true)
    expect(store('pending', 'declined', BEFORE)).toBe(true)
    expect(store('pending', 'confirmed', minutes(1))).toBe(false)
  })

  it('declines a request rather than cancelling it', () => {
    expect(store('pending', 'cancelled', BEFORE)).toBe(false)
    expect(store('confirmed', 'cancelled', BEFORE)).toBe(true)
  })

  it('marks arrival from an hour before', () => {
    expect(store('confirmed', 'seated', minutes(-61))).toBe(false)
    expect(store('confirmed', 'seated', minutes(-60))).toBe(true)
    expect(store('pending', 'seated', minutes(5))).toBe(true)
  })

  it('marks a no-show only fifteen minutes after the time', () => {
    expect(store('confirmed', 'no_show', minutes(14))).toBe(false)
    expect(store('confirmed', 'no_show', minutes(15))).toBe(true)
  })

  it('lets a late arrival in after a no-show, for a few hours', () => {
    expect(store('no_show', 'seated', minutes(60), minutes(20))).toBe(true)
    expect(store('no_show', 'seated', minutes(500), minutes(20))).toBe(false)
  })

  it('undoes a mistaken arrival within ten minutes', () => {
    expect(store('seated', 'confirmed', minutes(5), minutes(0))).toBe(true)
    expect(store('seated', 'confirmed', minutes(11), minutes(0))).toBe(false)
  })

  it('never reopens a closed reservation', () => {
    for (const from of ['declined', 'cancelled'] as const) {
      for (const to of ['pending', 'confirmed', 'seated', 'no_show'] as const) {
        expect(store(from, to, BEFORE)).toBe(false)
      }
    }
  })
})

describe('the customer', () => {
  const customer = (
    from: 'pending' | 'confirmed',
    to: 'cancelled' | 'confirmed',
    now: Date,
  ) =>
    checkTransition({
      from,
      to,
      actor: 'customer',
      startsAt: START,
      statusChangedAt: null,
      now,
    }).ok

  it('cancels before the time, never after', () => {
    expect(customer('pending', 'cancelled', BEFORE)).toBe(true)
    expect(customer('confirmed', 'cancelled', BEFORE)).toBe(true)
    expect(customer('confirmed', 'cancelled', minutes(0))).toBe(false)
  })

  it('cannot confirm their own request', () => {
    expect(customer('pending', 'confirmed', BEFORE)).toBe(false)
  })

  it('is offered the cancel button accordingly', () => {
    expect(
      customerCanCancel({ status: 'pending', startsAt: START }, BEFORE),
    ).toBe(true)
    expect(
      customerCanCancel({ status: 'seated', startsAt: START }, BEFORE),
    ).toBe(false)
  })
})

describe('storeActionsFor', () => {
  it('shows confirm and decline on a fresh request', () => {
    expect(
      storeActionsFor(
        { status: 'pending', startsAt: START, statusChangedAt: null },
        BEFORE,
      ),
    ).toEqual(['confirm', 'decline'])
  })

  it('shows arrival and cancel near the time of a confirmed one', () => {
    expect(
      storeActionsFor(
        { status: 'confirmed', startsAt: START, statusChangedAt: null },
        minutes(-30),
      ),
    ).toEqual(['seat', 'cancel'])
  })

  it('offers undo right after an arrival', () => {
    expect(
      storeActionsFor(
        { status: 'seated', startsAt: START, statusChangedAt: minutes(0) },
        minutes(2),
      ),
    ).toEqual(['undo'])
  })
})

describe('displayStatus', () => {
  it('shows an unanswered request whose time passed as expired', () => {
    expect(
      displayStatus({ status: 'pending', startsAt: START }, minutes(1)),
    ).toBe('expired')
    expect(displayStatus({ status: 'pending', startsAt: START }, BEFORE)).toBe(
      'pending',
    )
    expect(
      displayStatus({ status: 'confirmed', startsAt: START }, minutes(1)),
    ).toBe('confirmed')
  })
})
