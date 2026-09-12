import { describe, expect, it, vi } from 'vitest'
import {
  createChannelRegistry,
  type ChannelDescriptor,
  type RealtimeTransport,
} from '@/lib/realtime/registry'
import type { RealtimeStatus } from '@/lib/realtime/status'

interface OpenChannel {
  descriptor: ChannelDescriptor
  emit(payload: unknown): void
  setStatus(raw: string): void
  close: ReturnType<typeof vi.fn>
}

/** In-memory stand-in for the Supabase channel transport. */
function fakeTransport() {
  const open: OpenChannel[] = []
  const transport: RealtimeTransport = {
    open(descriptor, handlers) {
      const close = vi.fn()
      const entry: OpenChannel = {
        descriptor,
        emit: handlers.onEvent,
        setStatus: handlers.onStatus,
        close,
      }
      open.push(entry)
      return () => {
        close()
      }
    },
  }
  return { transport, open }
}

const ORDERS: ChannelDescriptor = {
  name: 'store-orders-1',
  table: 'orders',
  event: '*',
  filter: 'store_id=eq.1',
}

describe('createChannelRegistry', () => {
  it('opens one transport channel per name and fans events out', () => {
    const { transport, open } = fakeTransport()
    const registry = createChannelRegistry(transport)
    const first = vi.fn()
    const second = vi.fn()

    registry.acquire(ORDERS, { onEvent: first })
    registry.acquire(ORDERS, { onEvent: second })

    expect(open).toHaveLength(1)
    expect(registry.size()).toBe(1)

    open[0].emit({ eventType: 'UPDATE' })
    expect(first).toHaveBeenCalledWith({ eventType: 'UPDATE' })
    expect(second).toHaveBeenCalledWith({ eventType: 'UPDATE' })
  })

  it('keeps the channel until the last subscriber releases it', () => {
    const { transport, open } = fakeTransport()
    const registry = createChannelRegistry(transport)

    const releaseFirst = registry.acquire(ORDERS, {})
    const releaseSecond = registry.acquire(ORDERS, {})

    releaseFirst()
    expect(open[0].close).not.toHaveBeenCalled()
    expect(registry.size()).toBe(1)

    releaseSecond()
    expect(open[0].close).toHaveBeenCalledTimes(1)
    expect(registry.size()).toBe(0)
  })

  it('releasing twice does not close a channel another subscriber reopened', () => {
    const { transport, open } = fakeTransport()
    const registry = createChannelRegistry(transport)

    const release = registry.acquire(ORDERS, {})
    release()
    release()
    expect(open[0].close).toHaveBeenCalledTimes(1)

    registry.acquire(ORDERS, {})
    expect(open).toHaveLength(2)
    expect(open[1].close).not.toHaveBeenCalled()
  })

  it('opens separate channels for separate scopes', () => {
    const { transport, open } = fakeTransport()
    const registry = createChannelRegistry(transport)

    registry.acquire(ORDERS, {})
    registry.acquire({ name: 'order-9', table: 'orders', event: 'UPDATE' }, {})

    expect(open).toHaveLength(2)
    expect(registry.size()).toBe(2)
  })

  it('does not deliver events to a released subscriber', () => {
    const { transport, open } = fakeTransport()
    const registry = createChannelRegistry(transport)
    const gone = vi.fn()
    const staying = vi.fn()

    const release = registry.acquire(ORDERS, { onEvent: gone })
    registry.acquire(ORDERS, { onEvent: staying })
    release()

    open[0].emit({ eventType: 'INSERT' })
    expect(gone).not.toHaveBeenCalled()
    expect(staying).toHaveBeenCalledTimes(1)
  })

  it('calls onResync only when a dropped channel recovers', () => {
    const { transport, open } = fakeTransport()
    const registry = createChannelRegistry(transport)
    const onResync = vi.fn()

    registry.acquire(ORDERS, { onResync })

    open[0].setStatus('SUBSCRIBED')
    expect(onResync).not.toHaveBeenCalled()

    open[0].setStatus('TIMED_OUT')
    open[0].setStatus('SUBSCRIBED')
    expect(onResync).toHaveBeenCalledTimes(1)
  })

  it('resyncAll reaches every subscriber of every channel', () => {
    const { transport } = fakeTransport()
    const registry = createChannelRegistry(transport)
    const a = vi.fn()
    const b = vi.fn()
    const c = vi.fn()

    registry.acquire(ORDERS, { onResync: a })
    registry.acquire(ORDERS, { onResync: b })
    registry.acquire({ name: 'order-9', table: 'orders' }, { onResync: c })

    registry.resyncAll()
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
    expect(c).toHaveBeenCalledTimes(1)
  })

  it('reports the aggregate status and notifies on change', () => {
    const { transport, open } = fakeTransport()
    const seen: RealtimeStatus[] = []
    const registry = createChannelRegistry(transport, (status) =>
      seen.push(status),
    )

    registry.acquire(ORDERS, {})
    registry.acquire({ name: 'order-9', table: 'orders' }, {})
    expect(registry.status()).toBe('connecting')

    open[0].setStatus('SUBSCRIBED')
    expect(registry.status()).toBe('connecting')

    open[1].setStatus('SUBSCRIBED')
    expect(registry.status()).toBe('connected')

    open[1].setStatus('CHANNEL_ERROR')
    expect(registry.status()).toBe('disconnected')
    expect(seen.at(-1)).toBe('disconnected')
  })
})
