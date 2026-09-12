'use client'

import { XIcon } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

const DISMISS_KEY = 'tienda:install-prompt-dismissed'
const DISMISS_DAYS = 7

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStorefrontPath(pathname: string): boolean {
  return pathname === '/' || pathname.startsWith('/t/')
}

function isDismissed(): boolean {
  const raw = window.localStorage.getItem(DISMISS_KEY)
  if (!raw) return false
  const dismissedAt = Number(raw)
  if (Number.isNaN(dismissedAt)) return false
  const days = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24)
  return days < DISMISS_DAYS
}

/**
 * Dismissible bottom card offering to install the PWA. Only shown on
 * storefront pages (home and store pages) once the browser fires
 * `beforeinstallprompt`; a dismissal is remembered for a week.
 */
export function InstallPrompt() {
  const pathname = usePathname()
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  )
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    setDismissed(isDismissed())
    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault()
      setDeferred(event as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    return () =>
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  }, [])

  if (!deferred || dismissed || !isStorefrontPath(pathname)) return null

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setDismissed(true)
  }

  const install = async () => {
    await deferred.prompt()
    await deferred.userChoice
    setDeferred(null)
  }

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 sm:inset-x-auto sm:right-4 sm:w-80">
      <div className="rounded-card border-border bg-card shadow-lift flex items-center gap-3 border p-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Instala Tienda</p>
          <p className="text-muted-foreground text-xs">
            Agrégala a tu pantalla de inicio para pedir más rápido.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button size="sm" className="rounded-pill" onClick={install}>
            Instalar
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="rounded-pill"
            aria-label="Cerrar"
            onClick={dismiss}
          >
            <XIcon aria-hidden="true" className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
