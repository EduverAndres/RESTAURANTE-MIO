'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useSyncExternalStore } from 'react'

/** How long the welcome plays before it fades to the destination. */
const SUCCESS_MS = 1100
/** With reduced motion there is nothing to watch: just a beat to read it. */
const REDUCED_MS = 250
/** Fade-out length; matches `--animate-success-out` in globals.css. */
const FADE_OUT_MS = 240
/** Length of the tick path, so the dash animation fits it exactly. */
const CHECK_LENGTH = 36

// The welcome lives in the root layout, not in the login form: a successful
// sign-in sets the session cookies, Next re-renders /login, and that page
// redirects a signed-in visitor at once — the form (and anything it owned)
// unmounts mid-animation. The root layout survives the navigation, so the
// overlay covers it and fades out onto the destination.
let shownAt: number | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function prefersReducedMotion(): boolean {
  return (
    document.documentElement.getAttribute('data-motion') === 'reduce' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * Plays the sign-in welcome and navigates to the destination underneath it.
 * The destination starts loading immediately, so the animation costs no
 * extra time beyond its own length.
 */
export function useLoginSuccess() {
  const router = useRouter()
  return {
    celebrate(redirectTo: string) {
      shownAt = Date.now()
      emit()
      router.push(redirectTo)
      router.refresh()
    },
  }
}

/** Mounted once in the root layout; renders the welcome while it plays. */
export function LoginSuccessHost() {
  const started = useSyncExternalStore(
    subscribe,
    () => shownAt,
    () => null,
  )
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (started === null) return
    setLeaving(false)
    const visibleFor = prefersReducedMotion() ? REDUCED_MS : SUCCESS_MS
    const remaining = Math.max(0, started + visibleFor - Date.now())
    const fade = window.setTimeout(() => setLeaving(true), remaining)
    const done = window.setTimeout(() => {
      shownAt = null
      emit()
    }, remaining + FADE_OUT_MS)
    return () => {
      window.clearTimeout(fade)
      window.clearTimeout(done)
    }
  }, [started])

  if (started === null) return null
  return <LoginSuccessOverlay leaving={leaving} />
}

function LoginSuccessOverlay({ leaving }: { leaving: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`${leaving ? 'animate-success-out' : 'animate-success-fade'} bg-background fixed inset-0 z-[100] grid place-items-center px-6`}
      style={{
        backgroundImage:
          'radial-gradient(circle at 50% 45%, color-mix(in oklch, var(--primary) 14%, transparent), transparent 55%)',
      }}
    >
      <div className="flex flex-col items-center gap-6 text-center">
        <span className="relative grid size-28 place-items-center">
          <span
            aria-hidden="true"
            className="animate-success-ripple bg-primary/25 absolute inset-2 rounded-full"
          />
          <span
            aria-hidden="true"
            className="animate-success-ripple bg-primary/15 absolute inset-2 rounded-full [animation-delay:420ms]"
          />
          <span className="animate-check-pop bg-primary text-primary-foreground shadow-lift relative grid size-20 place-items-center rounded-full">
            <svg
              viewBox="0 0 48 48"
              aria-hidden="true"
              className="size-11"
              fill="none"
            >
              <path
                d="M13 24.5 21 32 35 17"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="animate-check-draw"
                style={{
                  strokeDasharray: CHECK_LENGTH,
                  // Consumed by the `check-draw` keyframes in globals.css.
                  ['--check-length' as string]: CHECK_LENGTH,
                }}
              />
            </svg>
          </span>
        </span>
        <div className="animate-fade-up space-y-1.5 [animation-delay:220ms]">
          <p className="font-display text-h2 font-semibold">¡Hola de nuevo!</p>
          <p className="text-muted-foreground">Preparando tu espacio…</p>
        </div>
        <span
          aria-hidden="true"
          className="bg-muted h-1 w-40 overflow-hidden rounded-full"
        >
          <span className="animate-success-bar bg-primary block h-full rounded-full" />
        </span>
      </div>
    </div>
  )
}
