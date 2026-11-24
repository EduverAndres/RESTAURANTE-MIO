'use client'

import { BellIcon, CheckCheckIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  useBroadcastChannel,
  useRealtimeRefresh,
} from '@/components/providers/realtime-provider'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  isInAppPath,
  relativeTimeLabel,
  unreadBadge,
} from '@/lib/notifications/time'
import {
  ACTION_REQUIRED_KINDS,
  type NotificationKind,
} from '@/lib/notifications/vocabulary'
import { playSoundEvent } from '@/lib/sound/player'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

/** How many recent notifications the menu lists. */
const LIST_SIZE = 20

const COLUMNS = 'id, kind, title, body, url, read_at, created_at'

interface NotificationItem {
  id: string
  kind: string
  title: string
  body: string
  url: string
  read_at: string | null
  created_at: string
}

export interface NotificationBellProps {
  userId: string
  /**
   * Kinds another live view on this screen already rings and toasts (the
   * merchant panel's reservations listener): the bell only counts them.
   */
  quietKinds?: readonly NotificationKind[]
  className?: string
}

/**
 * The in-app inbox. It loads the newest notifications, then listens on the
 * user's private Broadcast topic (`user:<id>`), where the database sends each
 * new row the moment it commits: it rings, shows a toast and refreshes the
 * screen within milliseconds, so a status the event changed (a campaign
 * approved, a new request in an admin list) appears without reloading.
 */
export function NotificationBell({
  userId,
  quietKinds = [],
  className,
}: NotificationBellProps) {
  const router = useRouter()
  const refresh = useRealtimeRefresh()
  const supabase = useMemo(() => createClient(), [])
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const newestId = useRef<string | null>(null)
  /** Ids already shown, so a backfill and a live message never count twice. */
  const seen = useRef(new Set<string>())

  /** Reads the inbox; true when something arrived since the last read. */
  const load = useCallback(async (): Promise<boolean> => {
    const [list, count] = await Promise.all([
      supabase
        .from('notifications')
        .select(COLUMNS)
        .eq('recipient_id', userId)
        .order('created_at', { ascending: false })
        .limit(LIST_SIZE),
      supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', userId)
        .is('read_at', null),
    ])
    if (list.error || count.error) return false
    const rows = list.data ?? []
    const changed =
      newestId.current !== null && rows[0]?.id !== newestId.current
    newestId.current = rows[0]?.id ?? ''
    for (const row of rows) seen.current.add(row.id)
    setItems(rows)
    setUnread(count.count ?? 0)
    return changed
  }, [supabase, userId])

  useEffect(() => {
    void load()
  }, [load])

  const open = useCallback(
    (item: NotificationItem) => {
      if (!item.read_at) {
        const readAt = new Date().toISOString()
        setItems((current) =>
          current.map((entry) =>
            entry.id === item.id ? { ...entry, read_at: readAt } : entry,
          ),
        )
        setUnread((count) => Math.max(0, count - 1))
        void supabase
          .from('notifications')
          .update({ read_at: readAt })
          .eq('id', item.id)
          .is('read_at', null)
          .then()
      }
      // In-app paths only; the table refuses anything else too.
      if (isInAppPath(item.url)) router.push(item.url)
    },
    [router, supabase],
  )

  const markAllRead = useCallback(() => {
    const readAt = new Date().toISOString()
    setItems((current) =>
      current.map((entry) =>
        entry.read_at ? entry : { ...entry, read_at: readAt },
      ),
    )
    setUnread(0)
    void supabase
      .from('notifications')
      .update({ read_at: readAt })
      .eq('recipient_id', userId)
      .is('read_at', null)
      .then()
  }, [supabase, userId])

  useBroadcastChannel({
    topic: `user:${userId}`,
    event: 'notification',
    onMessage: (payload) => {
      const row = payload as unknown as NotificationItem
      if (typeof row.id !== 'string' || seen.current.has(row.id)) return
      seen.current.add(row.id)
      newestId.current = row.id
      setItems((current) =>
        [row, ...current.filter((entry) => entry.id !== row.id)].slice(
          0,
          LIST_SIZE,
        ),
      )
      setUnread((count) => count + 1)
      if (!quietKinds.includes(row.kind as NotificationKind)) {
        playSoundEvent('notification')
        toast(row.title, {
          description: row.body || undefined,
          action: { label: 'Ver', onClick: () => open(row) },
        })
      }
      // The event usually changed what this screen shows.
      refresh()
    },
    // After a dropped connection or a return to the tab: catch up, and
    // refresh the screen only if something arrived meanwhile.
    onResync: () => {
      void load().then((changed) => {
        if (changed) refresh()
      })
    },
  })

  const badge = unreadBadge(unread)

  return (
    <DropdownMenu onOpenChange={(isOpen) => isOpen && setNow(Date.now())}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('rounded-pill relative size-11', className)}
          aria-label={
            unread > 0 ? `Notificaciones, ${unread} sin leer` : 'Notificaciones'
          }
          data-testid="notification-bell"
        >
          <BellIcon aria-hidden="true" className="size-5" />
          {badge ? (
            <span
              aria-hidden="true"
              data-testid="notification-badge"
              className="bg-primary text-primary-foreground ring-background absolute top-1.5 right-1.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1 text-[10px] leading-none font-semibold tabular-nums ring-2"
            >
              {badge}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[min(22rem,calc(100vw-2rem))] rounded-2xl p-1.5"
      >
        <DropdownMenuLabel className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-semibold">Notificaciones</span>
          {unread > 0 ? (
            <span className="text-muted-foreground text-xs font-normal">
              {unread} sin leer
            </span>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <p className="text-muted-foreground px-3 py-8 text-center text-sm">
            Aquí verás los avisos importantes en cuanto ocurran.
          </p>
        ) : (
          // Focusable, so the list can be scrolled from the keyboard too.
          <div
            role="group"
            aria-label="Notificaciones recientes"
            tabIndex={0}
            className="focus-visible:ring-ring max-h-[min(26rem,60vh)] overflow-y-auto rounded-xl outline-none focus-visible:ring-2"
          >
            {items.map((item) => {
              const pending = !item.read_at
              const needsAction =
                pending &&
                ACTION_REQUIRED_KINDS.includes(item.kind as NotificationKind)
              return (
                <DropdownMenuItem
                  key={item.id}
                  onSelect={() => open(item)}
                  className="items-start gap-3 rounded-xl px-2.5 py-2.5"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'mt-1.5 size-2 shrink-0 rounded-full',
                      pending ? 'bg-primary' : 'bg-transparent',
                    )}
                  />
                  <span className="min-w-0 flex-1 space-y-0.5">
                    <span
                      className={cn(
                        'block text-sm leading-snug',
                        pending ? 'font-semibold' : 'font-medium',
                      )}
                    >
                      {item.title}
                      {pending ? (
                        <span className="sr-only"> (sin leer)</span>
                      ) : null}
                    </span>
                    {item.body ? (
                      <span className="text-muted-foreground line-clamp-2 block text-xs leading-relaxed">
                        {item.body}
                      </span>
                    ) : null}
                    <span className="text-muted-foreground flex items-center gap-2 text-[11px]">
                      <time dateTime={item.created_at}>
                        {relativeTimeLabel(item.created_at, now)}
                      </time>
                      {needsAction ? (
                        <span className="text-primary-on-tint font-medium">
                          · Requiere acción
                        </span>
                      ) : null}
                    </span>
                  </span>
                </DropdownMenuItem>
              )
            })}
          </div>
        )}
        {unread > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault()
                markAllRead()
              }}
              className="justify-center rounded-xl text-sm font-medium"
            >
              <CheckCheckIcon aria-hidden="true" />
              Marcar todas como leídas
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
