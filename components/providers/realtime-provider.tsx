'use client'

import type {
  RealtimePostgresChangesFilter,
  RealtimePostgresChangesPayload,
  SupabaseClient,
} from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { MotionProvider } from '@/components/motion/motion-provider'
import {
  createDebouncer,
  createLeadingDebouncer,
} from '@/lib/realtime/debounce'
import {
  createChannelRegistry,
  type ChannelDescriptor,
  type ChannelRegistry,
  type RealtimeEventType,
  type RealtimeTransport,
} from '@/lib/realtime/registry'
import type { RealtimeStatus } from '@/lib/realtime/status'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'

/**
 * The one place that owns realtime channels.
 *
 * Everything else asks for a *scope* (`useRealtimeChannel`) and gets a shared,
 * ref-counted subscription: a Kanban with twenty orders opens one socket
 * channel, not twenty. The provider also owns the two things a per-component
 * subscription cannot do — a single debounced refresh, so one user action
 * costs one RSC round-trip, and a backfill when the tab comes back or a
 * dropped channel recovers, so a silently dead socket never leaves stale data
 * looking fresh.
 */

/**
 * The first event refreshes at once; more within this window (one action can
 * write twice) fold into a single extra refresh when it closes.
 */
const REFRESH_DEBOUNCE_MS = 250
/** Tab focus, a reconnect and a pending event can all land together. */
const RESYNC_DEBOUNCE_MS = 300

export type RealtimeEvent = RealtimePostgresChangesPayload<
  Record<string, unknown>
>

/** What a Broadcast channel delivers: the payload `realtime.send()` sent. */
export interface BroadcastMessage {
  type: 'broadcast'
  event: string
  payload: Record<string, unknown>
}

type RealtimeMessage = RealtimeEvent | BroadcastMessage

interface RealtimeContextValue {
  acquire: ChannelRegistry<RealtimeMessage>['acquire']
  /** Debounced `router.refresh()`; the shared path back to server truth. */
  refresh: () => void
  status: RealtimeStatus
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null)

function createSupabaseTransport(
  client: SupabaseClient<Database>,
): RealtimeTransport<RealtimeMessage> {
  return {
    open(descriptor, handlers) {
      if (descriptor.kind === 'broadcast') {
        // A private topic joins with the signed-in user's token, which
        // supabase-js hands to Realtime itself; the join is refused unless a
        // policy on realtime.messages lets this user read the topic.
        const channel = client
          .channel(descriptor.name, {
            config: { private: descriptor.private },
          })
          .on('broadcast', { event: descriptor.event }, (message) =>
            handlers.onEvent(message as BroadcastMessage),
          )
          .subscribe((status) => handlers.onStatus(status))
        return () => {
          void client.removeChannel(channel)
        }
      }

      // `.on('postgres_changes', …)` is overloaded per literal event, so a
      // descriptor whose event is only known at runtime is typed through the
      // wildcard filter; the payload shape is identical either way.
      const filter = {
        event: descriptor.event ?? '*',
        schema: 'public',
        table: descriptor.table,
        ...(descriptor.filter ? { filter: descriptor.filter } : {}),
      } as RealtimePostgresChangesFilter<'*'>

      const channel = client
        .channel(descriptor.name)
        .on('postgres_changes', filter, (payload) =>
          handlers.onEvent(payload as RealtimeEvent),
        )
        .subscribe((status) => handlers.onStatus(status))

      return () => {
        void client.removeChannel(channel)
      }
    },
  }
}

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const routerRef = useRef(router)
  const [status, setStatus] = useState<RealtimeStatus>('connecting')

  useEffect(() => {
    routerRef.current = router
  }, [router])

  const refreshDebouncer = useMemo(
    () => createLeadingDebouncer(REFRESH_DEBOUNCE_MS),
    [],
  )
  const resyncDebouncer = useMemo(() => createDebouncer(RESYNC_DEBOUNCE_MS), [])

  const refresh = useCallback(() => {
    refreshDebouncer.schedule(() => routerRef.current.refresh())
  }, [refreshDebouncer])

  // `createClient` is the @supabase/ssr browser client, which is already a
  // per-page singleton; memoising keeps the registry stable across renders.
  const registry = useMemo(
    () =>
      createChannelRegistry<RealtimeMessage>(
        createSupabaseTransport(createClient()),
        setStatus,
      ),
    [],
  )

  useEffect(() => {
    const resync = () => resyncDebouncer.schedule(() => registry.resyncAll())

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') resync()
    }
    // The service worker suppresses its notification when this tab is already
    // showing the order; it says so, and the page refreshes instead.
    const onServiceWorkerMessage = (event: MessageEvent) => {
      if (
        (event.data as { type?: string } | null)?.type === 'push-suppressed'
      ) {
        refresh()
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    navigator.serviceWorker?.addEventListener(
      'message',
      onServiceWorkerMessage as EventListener,
    )
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      navigator.serviceWorker?.removeEventListener(
        'message',
        onServiceWorkerMessage as EventListener,
      )
      resyncDebouncer.cancel()
      refreshDebouncer.cancel()
    }
  }, [refresh, refreshDebouncer, registry, resyncDebouncer])

  const value = useMemo<RealtimeContextValue>(
    () => ({ acquire: registry.acquire, refresh, status }),
    [registry, refresh, status],
  )

  return (
    <RealtimeContext.Provider value={value}>
      {/* Honours both reduced-motion signals — the system's and the app's
          "Reducir animaciones" — inside Motion itself, so components never
          branch on a browser-only value while rendering (which would
          desynchronise the server and client markup). */}
      <MotionProvider>{children}</MotionProvider>
    </RealtimeContext.Provider>
  )
}

function useRealtimeContext(): RealtimeContextValue {
  const context = useContext(RealtimeContext)
  if (!context) {
    throw new Error('useRealtime* must be used inside <RealtimeProvider>')
  }
  return context
}

/** Current connection state, worst-of across every open channel. */
export function useRealtimeStatus(): RealtimeStatus {
  return useRealtimeContext().status
}

/** The shared debounced `router.refresh()`. */
export function useRealtimeRefresh(): () => void {
  return useRealtimeContext().refresh
}

export interface UseRealtimeChannelOptions {
  /** Scope identity. Same name, same subscription. */
  name: string
  table: string
  event?: RealtimeEventType
  /** Server-side filter, e.g. `store_id=eq.<uuid>`. */
  filter?: string
  onEvent?: (payload: RealtimeEvent) => void
  /** Backfill after a drop or a tab focus. Defaults to the shared refresh. */
  onResync?: () => void
  /** False keeps the component mounted without opening a channel. */
  enabled?: boolean
}

/**
 * Subscribes to one realtime scope for as long as the component is mounted.
 *
 * The handlers are read through a ref, so passing inline closures does not
 * tear the subscription down and back up on every render.
 */
export function useRealtimeChannel(options: UseRealtimeChannelOptions): void {
  const { acquire, refresh } = useRealtimeContext()
  const { name, table, event, filter, enabled = true } = options

  const handlers = useRef({
    onEvent: options.onEvent,
    onResync: options.onResync,
  })
  useEffect(() => {
    handlers.current = { onEvent: options.onEvent, onResync: options.onResync }
  })

  useEffect(() => {
    if (!enabled) return
    const descriptor: ChannelDescriptor = { name, table, event, filter }
    return acquire(descriptor, {
      onEvent: (payload) =>
        handlers.current.onEvent?.(payload as RealtimeEvent),
      onResync: () => (handlers.current.onResync ?? refresh)(),
    })
  }, [acquire, refresh, enabled, name, table, event, filter])
}

export interface UseBroadcastChannelOptions {
  /** The topic, e.g. `user:<uuid>`. Same topic, same subscription. */
  topic: string
  event: string
  /** Private topics are authorised by RLS on realtime.messages. */
  private?: boolean
  onMessage?: (payload: Record<string, unknown>) => void
  /** Backfill after a drop or a tab focus. Defaults to the shared refresh. */
  onResync?: () => void
  enabled?: boolean
}

/**
 * Subscribes to a Broadcast topic for as long as the component is mounted:
 * the fast path, for messages the database sends as a row commits. Shares the
 * provider's bookkeeping (status, reconnect backfill, tab-focus backfill)
 * with `useRealtimeChannel`.
 */
export function useBroadcastChannel(options: UseBroadcastChannelOptions): void {
  const { acquire, refresh } = useRealtimeContext()
  const { topic, event, enabled = true } = options
  const isPrivate = options.private ?? true

  const handlers = useRef({
    onMessage: options.onMessage,
    onResync: options.onResync,
  })
  useEffect(() => {
    handlers.current = {
      onMessage: options.onMessage,
      onResync: options.onResync,
    }
  })

  useEffect(() => {
    if (!enabled) return
    const descriptor: ChannelDescriptor = {
      kind: 'broadcast',
      name: topic,
      event,
      private: isPrivate,
    }
    return acquire(descriptor, {
      onEvent: (message) =>
        handlers.current.onMessage?.((message as BroadcastMessage).payload),
      onResync: () => (handlers.current.onResync ?? refresh)(),
    })
  }, [acquire, refresh, enabled, topic, event, isPrivate])
}
