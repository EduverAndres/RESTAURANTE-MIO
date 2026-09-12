// Ref-counted channel registry: the single owner of every open realtime
// subscription. It knows nothing about Supabase or React — the provider hands
// it a transport and reads the status back — so it is unit testable end to end.

import {
  aggregateStatus,
  shouldResync,
  statusFromChannel,
  type RealtimeStatus,
} from '@/lib/realtime/status'

export type RealtimeEventType = '*' | 'INSERT' | 'UPDATE' | 'DELETE'

/**
 * A realtime scope. The `name` is the identity: two components asking for the
 * same name share one subscription, so a board with twenty orders opens one
 * channel and not twenty. The filter always travels here, server-side, and is
 * never applied in the browser.
 */
export interface ChannelDescriptor {
  name: string
  table: string
  event?: RealtimeEventType
  filter?: string
}

export interface ChannelSubscriber<TPayload = unknown> {
  onEvent?: (payload: TPayload) => void
  /** Runs when this channel recovers from a drop, or on a visibility backfill. */
  onResync?: () => void
}

export interface TransportHandlers<TPayload> {
  onEvent: (payload: TPayload) => void
  /** Raw Supabase channel status (`SUBSCRIBED`, `CHANNEL_ERROR`, …). */
  onStatus: (raw: string) => void
}

export interface RealtimeTransport<TPayload = unknown> {
  /** Opens the channel and returns its closer. */
  open(
    descriptor: ChannelDescriptor,
    handlers: TransportHandlers<TPayload>,
  ): () => void
}

export interface ChannelRegistry<TPayload = unknown> {
  /** Subscribes to `descriptor`; call the returned function to release it. */
  acquire(
    descriptor: ChannelDescriptor,
    subscriber: ChannelSubscriber<TPayload>,
  ): () => void
  /** Runs every subscriber's `onResync`. Used by the tab-visibility backfill. */
  resyncAll(): void
  status(): RealtimeStatus
  /** Number of open channels; for tests and diagnostics. */
  size(): number
}

interface Entry<TPayload> {
  subscribers: Set<ChannelSubscriber<TPayload>>
  status: RealtimeStatus
  close: (() => void) | null
}

export function createChannelRegistry<TPayload = unknown>(
  transport: RealtimeTransport<TPayload>,
  onStatusChange?: (status: RealtimeStatus) => void,
): ChannelRegistry<TPayload> {
  const entries = new Map<string, Entry<TPayload>>()
  let current: RealtimeStatus = 'connecting'

  const notify = () => {
    const next = aggregateStatus(
      [...entries.values()].map((entry) => entry.status),
    )
    if (next === current) return
    current = next
    onStatusChange?.(next)
  }

  return {
    acquire(descriptor, subscriber) {
      let entry = entries.get(descriptor.name)
      if (!entry) {
        // The entry is registered before the transport opens: `open` may report
        // a status synchronously and the handler has to find it.
        entry = { subscribers: new Set(), status: 'connecting', close: null }
        entries.set(descriptor.name, entry)
        const opened = entry
        opened.close = transport.open(descriptor, {
          onEvent: (payload) => {
            for (const listener of [...opened.subscribers]) {
              listener.onEvent?.(payload)
            }
          },
          onStatus: (raw) => {
            const previous = opened.status
            const next = statusFromChannel(raw)
            opened.status = next
            if (shouldResync(previous, next)) {
              for (const listener of [...opened.subscribers]) {
                listener.onResync?.()
              }
            }
            notify()
          },
        })
      }
      entry.subscribers.add(subscriber)
      notify()

      let released = false
      return () => {
        if (released) return
        released = true
        const open = entries.get(descriptor.name)
        if (!open) return
        open.subscribers.delete(subscriber)
        if (open.subscribers.size > 0) return
        entries.delete(descriptor.name)
        open.close?.()
        notify()
      }
    },

    resyncAll() {
      for (const entry of [...entries.values()]) {
        for (const listener of [...entry.subscribers]) listener.onResync?.()
      }
    },

    status() {
      return current
    },

    size() {
      return entries.size
    },
  }
}
