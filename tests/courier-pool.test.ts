import { describe, expect, it } from 'vitest'
import { createPoolTracker, isPoolRow } from '@/lib/courier/pool'

describe('isPoolRow', () => {
  it('accepts an unclaimed ready delivery', () => {
    expect(
      isPoolRow({
        id: 'o1',
        courier_id: null,
        status: 'ready',
        type: 'delivery',
      }),
    ).toBe(true)
  })

  it('rejects claimed, unready, non-delivery and empty rows', () => {
    expect(
      isPoolRow({
        id: 'o1',
        courier_id: 'c1',
        status: 'ready',
        type: 'delivery',
      }),
    ).toBe(false)
    expect(
      isPoolRow({
        id: 'o1',
        courier_id: null,
        status: 'preparing',
        type: 'delivery',
      }),
    ).toBe(false)
    expect(
      isPoolRow({
        id: 'o1',
        courier_id: null,
        status: 'ready',
        type: 'pickup',
      }),
    ).toBe(false)
    // `payload.old` under the default replica identity: primary key only.
    expect(isPoolRow({ id: 'o1' })).toBe(false)
    expect(isPoolRow(null)).toBe(false)
  })
})

describe('createPoolTracker', () => {
  const poolRow = {
    id: 'o1',
    courier_id: null,
    status: 'ready',
    type: 'delivery',
  } as const

  it('announces an order the first time it enters the pool', () => {
    const tracker = createPoolTracker()
    expect(tracker.observe(poolRow)).toBe(true)
  })

  it('stays silent on later edits of an order already in the pool', () => {
    const tracker = createPoolTracker()
    tracker.observe(poolRow)
    // This is the bug: payload.old is empty, so the old code re-announced here.
    expect(tracker.observe(poolRow)).toBe(false)
    expect(tracker.observe({ ...poolRow, status: 'ready' })).toBe(false)
  })

  it('stays silent for orders the server already rendered', () => {
    const tracker = createPoolTracker(['o1'])
    expect(tracker.observe(poolRow)).toBe(false)
    expect(tracker.has('o1')).toBe(true)
  })

  it('drops an order that leaves the pool and re-announces if it returns', () => {
    const tracker = createPoolTracker(['o1'])

    expect(tracker.observe({ ...poolRow, courier_id: 'c1' })).toBe(false)
    expect(tracker.has('o1')).toBe(false)

    expect(tracker.observe(poolRow)).toBe(true)
  })

  it('ignores rows with no id', () => {
    const tracker = createPoolTracker()
    expect(tracker.observe({})).toBe(false)
    expect(tracker.observe(null)).toBe(false)
    expect(tracker.ids()).toEqual([])
  })

  it('reset replaces what is known with the reconciled server list', () => {
    const tracker = createPoolTracker(['o1', 'o2'])
    tracker.reset(['o2', 'o3'])

    expect(tracker.has('o1')).toBe(false)
    expect(tracker.has('o2')).toBe(true)
    expect(tracker.ids().sort()).toEqual(['o2', 'o3'])
  })

  it('does not re-announce an order the reconciliation confirmed', () => {
    const tracker = createPoolTracker()
    tracker.reset(['o1'])
    expect(tracker.observe(poolRow)).toBe(false)
  })
})
