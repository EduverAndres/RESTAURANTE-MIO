'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { usePushSubscription } from '@/hooks/use-push-subscription'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { needsHomeScreenInstall } from '@/lib/push/platform'
import { cn } from '@/lib/utils'

const HOME_SCREEN_HINT =
  'En iPhone o iPad, agrega Tienda a la pantalla de inicio (Compartir → Agregar a inicio) para recibir notificaciones.'

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

interface PushToggleProps {
  /** Server-computed: `pushConfigured()`. Hides the toggle when false. */
  enabled: boolean
  className?: string
}

/**
 * Notification switch shown on /account, the merchant dashboard header and
 * the courier header. Renders nothing when the browser lacks push support
 * or the server has no VAPID keys configured.
 */
export function PushToggle({ enabled, className }: PushToggleProps) {
  const { state, pending, error, subscribe, unsubscribe } =
    usePushSubscription()

  const needsInstall = useNeedsHomeScreenInstall()

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
    return hint ? <div className={className}>{hint}</div> : null
  }

  const checked = state === 'subscribed'
  const label =
    state === 'denied' ? 'Bloqueadas' : checked ? 'Activadas' : 'Desactivadas'

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <Label
        htmlFor="push-toggle"
        className="text-muted-foreground flex items-center gap-2 text-sm"
      >
        Notificaciones push
        <span className="text-foreground font-medium">{label}</span>
      </Label>
      <Switch
        id="push-toggle"
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
