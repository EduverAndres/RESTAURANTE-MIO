'use client'

import type {
  RealtimePostgresChangesFilter,
  RealtimePostgresChangesPayload,
  SupabaseClient,
} from '@supabase/supabase-js'
import { MotionConfig } from 'framer-motion'
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
import { createDebouncer } from '@/lib/realtime/debounce'
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

/** One user action can write twice; collapse it into a single refresh. */
const REFRESH_DEBOUNCE_MS = 250
/** Tab focus, a reconnect and a pending event can all land together. */
const RESYNC_DEBOUNCE_MS = 300

export type RealtimeEvent = RealtimePostgresChangesPayload<
  Record<string, unknown>
>

interface RealtimeContextValue {
  acquire: ChannelRegistry<RealtimeEvent>['acquire']
  /** Debounced `router.refresh()`; the shared path back to server truth. */
  refresh: () => void
  status: RealtimeStatus
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null)

function createSupabaseTransport(
  client: SupabaseClient<Database>,
): RealtimeTransport<RealtimeEvent> {
  return {
    open(descriptor, handlers) {
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
    () => createDebouncer(REFRESH_DEBOUNCE_MS),
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
      createChannelRegistry<RealtimeEvent>(
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
      {/* Honours prefers-reduced-motion inside Motion itself, so components
          never branch on a browser-only value while rendering (which would
          desynchronise the server and client markup). */}
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
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
      onEvent: (payload) => handlers.current.onEvent?.(payload),
      onResync: () => (handlers.current.onResync ?? refresh)(),
    })
  }, [acquire, refresh, enabled, name, table, event, filter])
}
