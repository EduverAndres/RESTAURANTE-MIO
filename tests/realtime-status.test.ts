import { describe, expect, it } from 'vitest'
import {
  aggregateStatus,
  shouldResync,
  statusFromChannel,
  type RealtimeStatus,
} from '@/lib/realtime/status'

describe('statusFromChannel', () => {
  it('maps SUBSCRIBED to connected', () => {
    expect(statusFromChannel('SUBSCRIBED')).toBe('connected')
  })

  it('maps every drop reason to disconnected', () => {
    expect(statusFromChannel('CHANNEL_ERROR')).toBe('disconnected')
    expect(statusFromChannel('TIMED_OUT')).toBe('disconnected')
    expect(statusFromChannel('CLOSED')).toBe('disconnected')
  })

  it('treats anything else as still connecting', () => {
    expect(statusFromChannel('')).toBe('connecting')
    expect(statusFromChannel('JOINING')).toBe('connecting')
  })
})

describe('shouldResync', () => {
  it('backfills only when a dropped channel comes back', () => {
    expect(shouldResync('disconnected', 'connected')).toBe(true)
  })

  it('does not backfill on the first successful subscribe', () => {
    // The page was just server-rendered; its data is already fresh.
    expect(shouldResync('connecting', 'connected')).toBe(false)
  })

  it('does not backfill on a drop or on a repeated connected status', () => {
    expect(shouldResync('connected', 'disconnected')).toBe(false)
    expect(shouldResync('connected', 'connected')).toBe(false)
    expect(shouldResync('disconnected', 'connecting')).toBe(false)
  })
})

describe('aggregateStatus', () => {
  it('reads as connecting when nothing is open', () => {
    expect(aggregateStatus([])).toBe('connecting')
  })

  it('is connected only when every channel is', () => {
    expect(aggregateStatus(['connected', 'connected'])).toBe('connected')
  })

  it('reports the worst channel', () => {
    const mixed: RealtimeStatus[] = ['connected', 'connecting']
    expect(aggregateStatus(mixed)).toBe('connecting')
    expect(aggregateStatus(['connecting', 'disconnected'])).toBe('disconnected')
    expect(aggregateStatus(['connected', 'disconnected'])).toBe('disconnected')
  })
})
