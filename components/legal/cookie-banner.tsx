'use client'

import { CookieIcon, XIcon } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  COOKIE_CONSENT_MAX_AGE,
  COOKIE_CONSENT_NAME,
  OPEN_COOKIE_PREFERENCES_EVENT,
  parseConsent,
  readCookie,
  serializeConsent,
  type OptionalCookieCategory,
} from '@/lib/legal/cookies'
import { cn } from '@/lib/utils'

const OPTIONAL: {
  key: OptionalCookieCategory
  title: string
  text: string
}[] = [
  {
    key: 'analytics',
    title: 'Analítica',
    text: 'Medir de forma agregada cómo se usa la plataforma para mejorarla.',
  },
  {
    key: 'marketing',
    title: 'Publicidad',
    text: 'Mostrarte ofertas relevantes y medir campañas.',
  },
]

function writeConsent(choice: Record<OptionalCookieCategory, boolean>) {
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${COOKIE_CONSENT_NAME}=${serializeConsent(choice)}; Path=/; Max-Age=${COOKIE_CONSENT_MAX_AGE}; SameSite=Lax${secure}`
}

/**
 * The cookie notice and preference centre, in one card.
 *
 * Shown until the person decides, then never again for six months — or until
 * they reopen it from "Preferencias de cookies" in the footer. The three
 * choices weigh the same on screen: rejecting the optional ones must be as
 * easy as accepting them, or the "consent" is not free.
 *
 * Rendered after mount only, because whether to show it depends on a cookie
 * the server-rendered HTML must not guess at.
 */
export function CookieBanner() {
  const titleId = useId()
  const [open, setOpen] = useState(false)
  const [configuring, setConfiguring] = useState(false)
  const [choice, setChoice] = useState<Record<OptionalCookieCategory, boolean>>(
    { analytics: false, marketing: false },
  )

  useEffect(() => {
    const stored = parseConsent(
      readCookie(document.cookie, COOKIE_CONSENT_NAME),
    )
    if (!stored) setOpen(true)
    else setChoice({ analytics: stored.analytics, marketing: stored.marketing })

    function reopen() {
      const current = parseConsent(
        readCookie(document.cookie, COOKIE_CONSENT_NAME),
      )
      if (current) {
        setChoice({
          analytics: current.analytics,
          marketing: current.marketing,
        })
      }
      setConfiguring(true)
      setOpen(true)
    }
    window.addEventListener(OPEN_COOKIE_PREFERENCES_EVENT, reopen)
    return () =>
      window.removeEventListener(OPEN_COOKIE_PREFERENCES_EVENT, reopen)
  }, [])

  function decide(next: Record<OptionalCookieCategory, boolean>) {
    writeConsent(next)
    setChoice(next)
    setOpen(false)
    setConfiguring(false)
  }

  if (!open) return null

  return (
    <section
      role="region"
      aria-labelledby={titleId}
      className="animate-fade-up fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-50 mx-auto max-w-xl md:inset-x-auto md:right-6 md:bottom-6 md:left-6"
    >
      <div className="rounded-card bg-popover text-popover-foreground shadow-3 ring-foreground/10 space-y-4 p-5 ring-1">
        <div className="flex items-start gap-3">
          <span className="rounded-control bg-primary/10 text-primary-on-tint grid size-10 shrink-0 place-items-center">
            <CookieIcon aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <h2 id={titleId} className="font-display text-lg font-semibold">
              Tu privacidad, tus reglas
            </h2>
            <p className="text-muted-foreground text-sm text-pretty">
              Usamos cookies esenciales para que la plataforma funcione: tu
              sesión, tu carrito y tu dirección. No usamos cookies de publicidad
              ni vendemos tus datos.{' '}
              <a
                href="/cookies"
                className="text-foreground font-medium underline underline-offset-2"
              >
                Política de cookies
              </a>
            </p>
          </div>
          {configuring ? (
            <button
              type="button"
              onClick={() => {
                setConfiguring(false)
                if (
                  parseConsent(readCookie(document.cookie, COOKIE_CONSENT_NAME))
                )
                  setOpen(false)
              }}
              aria-label="Cerrar preferencias de cookies"
              className="text-muted-foreground hover:text-foreground -mt-1 -mr-1 rounded-full p-1"
            >
              <XIcon aria-hidden="true" className="size-4" />
            </button>
          ) : null}
        </div>

        {configuring ? (
          <ul className="space-y-3">
            <li className="flex items-start justify-between gap-4">
              <span>
                <span className="block text-sm font-medium">Esenciales</span>
                <span className="text-muted-foreground block text-xs">
                  Sesión, seguridad, carrito y ubicación. Siempre activas: sin
                  ellas no podrías pedir.
                </span>
              </span>
              <span className="text-muted-foreground shrink-0 text-xs font-medium">
                Siempre
              </span>
            </li>
            {OPTIONAL.map((category) => (
              <li
                key={category.key}
                className="flex items-start justify-between gap-4"
              >
                <label
                  htmlFor={`cookie-${category.key}`}
                  className="cursor-pointer"
                >
                  <span className="block text-sm font-medium">
                    {category.title}
                  </span>
                  <span className="text-muted-foreground block text-xs">
                    {category.text} Hoy no la usamos; solo se activaría con tu
                    permiso.
                  </span>
                </label>
                <input
                  id={`cookie-${category.key}`}
                  type="checkbox"
                  role="switch"
                  checked={choice[category.key]}
                  onChange={(event) =>
                    setChoice((current) => ({
                      ...current,
                      [category.key]: event.target.checked,
                    }))
                  }
                  className="accent-primary mt-1 size-5 shrink-0 cursor-pointer"
                />
              </li>
            ))}
          </ul>
        ) : null}

        <div
          className={cn(
            'grid gap-2',
            configuring ? 'sm:grid-cols-2' : 'sm:grid-cols-3',
          )}
        >
          {configuring ? (
            <>
              <Button
                type="button"
                variant="outline"
                className="rounded-pill h-10"
                onClick={() => decide({ analytics: false, marketing: false })}
              >
                Solo esenciales
              </Button>
              <Button
                type="button"
                className="rounded-pill h-10"
                onClick={() => decide(choice)}
              >
                Guardar preferencias
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                className="rounded-pill h-10"
                onClick={() => setConfiguring(true)}
              >
                Configurar
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-pill h-10"
                onClick={() => decide({ analytics: false, marketing: false })}
              >
                Solo esenciales
              </Button>
              <Button
                type="button"
                className="rounded-pill h-10"
                onClick={() => decide({ analytics: true, marketing: true })}
              >
                Aceptar todas
              </Button>
            </>
          )}
        </div>
      </div>
    </section>
  )
}

/** A footer link that reopens the panel above. */
export function CookiePreferencesButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() =>
        window.dispatchEvent(new Event(OPEN_COOKIE_PREFERENCES_EVENT))
      }
      className={className}
    >
      Preferencias de cookies
    </button>
  )
}
