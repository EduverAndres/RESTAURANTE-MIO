'use client'

import { useEffect, useId, useState } from 'react'
import { toast } from 'sonner'
import { usePushSubscription } from '@/hooks/use-push-subscription'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { APP_NAME } from '@/lib/env'
import { needsHomeScreenInstall } from '@/lib/push/platform'
import { cn } from '@/lib/utils'

const HOME_SCREEN_HINT = `En iPhone o iPad, agrega ${APP_NAME} a la pantalla de inicio (Compartir → Agregar a inicio) para recibir notificaciones.`

/**
 * True on an iPhone or iPad that is browsing rather than running the
 * installed app. Read after mount: the user agent is not known on the server.
 */
function useNeedsHomeScreenInstall(): boolean {
  const [needsInstall, setNeedsInstall] = useState(false)
  useEffect(() => {
    const standalone =
      (navigator as Navigator & { standalone?: boolean }).standalone === true ||
      (typeof window.matchMedia === 'function' &&
        window.matchMedia('(display-mode: standalone)').matches)
    setNeedsInstall(needsHomeScreenInstall(navigator.userAgent, standalone))
  }, [])
  return needsInstall
}

/**
 * Why push is missing, read after mount. Push needs a service worker, which
 * browsers only allow on https (or localhost): on `http://<IP>` the toggle
 * used to vanish and the merchant never learned why no alert arrived.
 */
function useUnavailableReason(): string {
  const [reason, setReason] = useState('')
  useEffect(() => {
    setReason(
      window.isSecureContext === false
        ? 'Las notificaciones push necesitan que el sitio use HTTPS. Mientras tanto, mantén esta pestaña abierta para ver los pedidos al instante.'
        : 'Este navegador no permite notificaciones push. Prueba con Chrome, Edge o Firefox.',
    )
  }, [])
  return reason
}

interface PushToggleProps {
  /** Server-computed: `pushConfigured()`. Hides the toggle when false. */
  enabled: boolean
  className?: string
  /**
   * Say why when the browser cannot do push (menus and /account). Off in the
   * compact desktop header, where a sentence does not fit.
   */
  explainUnavailable?: boolean
}

/**
 * Notification switch shown on /account, the merchant dashboard header and
 * the courier header. Renders nothing when the browser lacks push support
 * or the server has no VAPID keys configured.
 */
export function PushToggle({
  enabled,
  className,
  explainUnavailable = false,
}: PushToggleProps) {
  const { state, pending, error, subscribe, unsubscribe } =
    usePushSubscription()
  // Unique per instance: the header and the mobile menu can both render one.
  const switchId = useId()

  const needsInstall = useNeedsHomeScreenInstall()
  const unavailableReason = useUnavailableReason()

  useEffect(() => {
    if (error) toast.error(error)
  }, [error])

  if (!enabled) return null

  // iOS exposes no PushManager to a browser tab, so the hint is the only
  // thing this toggle can offer until the app is on the home screen.
  const hint = needsInstall ? (
    <p className="text-muted-foreground max-w-prose text-xs">
      {HOME_SCREEN_HINT}
    </p>
  ) : null

  if (state === 'unsupported') {
    if (hint) return <div className={className}>{hint}</div>
    if (explainUnavailable && unavailableReason) {
      return (
        <p
          className={cn('text-muted-foreground max-w-prose text-xs', className)}
        >
          {unavailableReason}
        </p>
      )
    }
    return null
  }

  const checked = state === 'subscribed'
  const label =
    state === 'denied' ? 'Bloqueadas' : checked ? 'Activadas' : 'Desactivadas'

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <Label
        htmlFor={switchId}
        className="text-muted-foreground flex items-center gap-2 text-sm"
      >
        Notificaciones push
        <span className="text-foreground font-medium">{label}</span>
      </Label>
      <Switch
        id={switchId}
        checked={checked}
        disabled={pending || state === 'checking' || state === 'denied'}
        onCheckedChange={(next) => {
          if (next) void subscribe()
          else void unsubscribe()
        }}
        aria-label="Notificaciones push"
      />
      {hint ? <div className="basis-full">{hint}</div> : null}
    </div>
  )
}
