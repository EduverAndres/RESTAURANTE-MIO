'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'
import { usePushSubscription } from '@/hooks/use-push-subscription'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

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

  useEffect(() => {
    if (error) toast.error(error)
  }, [error])

  if (!enabled || state === 'unsupported') return null

  const checked = state === 'subscribed'
  const label =
    state === 'denied'
      ? 'Bloqueadas'
      : checked
        ? 'Activadas'
        : 'Desactivadas'

  return (
    <div className={cn('flex items-center gap-2', className)}>
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
    </div>
  )
}
