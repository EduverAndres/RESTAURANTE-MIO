'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { welcomeFor } from '@/lib/auth/welcome'
import { APP_NAME } from '@/lib/env'
import type { UserRole } from '@/types/app'

/**
 * How long the welcome stays before fading out. With FADE_OUT_MS the whole
 * thing lasts 1.6 s, and the destination loads underneath the entire time.
 */
const SUCCESS_MS = 1400
/** Reduced motion: no movement, just long enough to read the line. */
const REDUCED_MS = 250
/** Matches `--animate-success-out` in globals.css. */
const FADE_OUT_MS = 200
/**
 * If the destination is still loading when the animation ends (a slow
 * network, a cold server), the welcome holds its last frame instead of
 * fading back onto the login form — but never longer than this.
 */
const MAX_HOLD_MS = 4000

// The welcome lives in the root layout, not in the login form: a successful
// sign-in sets the session cookies, Next re-renders /login, and that page
// redirects a signed-in visitor at once — the form (and anything it owned)
// unmounts mid-animation. The root layout survives the navigation, so the
// overlay covers it and fades out onto the destination.
interface Shown {
  at: number
  role: UserRole | null
  /** Path the sign-in started on; leaving it means the destination is up. */
  from: string
}

let shown: Shown | null = null
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
 * Plays the sign-in welcome for `role` and navigates to the destination
 * underneath it, so the animation costs no time of its own.
 */
export function useLoginSuccess() {
  const router = useRouter()
  return {
    celebrate(redirectTo: string, role: UserRole | null = null) {
      shown = { at: Date.now(), role, from: window.location.pathname }
      emit()
      router.push(redirectTo)
      router.refresh()
    },
  }
}

/** Mounted once in the root layout; renders the welcome while it plays. */
export function LoginSuccessHost() {
  const current = useSyncExternalStore(
    subscribe,
    () => shown,
    () => null,
  )
  const pathname = usePathname()
  const [leaving, setLeaving] = useState(false)

  // Fades out once the animation has played AND the destination has
  // replaced the login page (or after MAX_HOLD_MS, whichever comes first).
  // Re-runs when the path changes, so arriving early never cuts it short
  // and arriving late never shows the login form again.
  useEffect(() => {
    if (current === null) return
    setLeaving(false)
    const visibleFor = prefersReducedMotion() ? REDUCED_MS : SUCCESS_MS
    const elapsed = Date.now() - current.at
    const untilPlayed = Math.max(0, visibleFor - elapsed)
    const arrived = pathname !== current.from
    const wait = arrived
      ? untilPlayed
      : Math.max(untilPlayed, MAX_HOLD_MS - elapsed)
    const fade = window.setTimeout(() => setLeaving(true), wait)
    const done = window.setTimeout(() => {
      shown = null
      emit()
    }, wait + FADE_OUT_MS)
    return () => {
      window.clearTimeout(fade)
      window.clearTimeout(done)
    }
  }, [current, pathname])

  if (current === null) return null
  return <WelcomeOverlay role={current.role} leaving={leaving} />
}

export function WelcomeOverlay({
  role,
  leaving = false,
}: {
  role: UserRole | null
  leaving?: boolean
}) {
  const { phrase, scene } = welcomeFor(role)
  return (
    <div
      role="status"
      aria-live="polite"
      data-role={role ?? 'customer'}
      className={`${leaving ? 'animate-success-out' : 'animate-success-fade'} bg-background fixed inset-0 z-[100] grid place-items-center px-6`}
      style={{
        backgroundImage:
          'radial-gradient(circle at 50% 42%, color-mix(in oklch, var(--primary) 12%, transparent), transparent 60%)',
      }}
    >
      <div className="flex w-full max-w-sm flex-col items-center gap-5 text-center">
        {scene ? <PinScene /> : null}
        <p className="animate-welcome-brand font-display font-display-soft text-foreground text-4xl font-semibold tracking-tight lowercase sm:text-5xl">
          {APP_NAME}
          <span className="text-primary">.</span>
        </p>
        {phrase ? (
          <p className="animate-welcome-phrase text-muted-foreground text-lg text-balance sm:text-xl">
            {phrase}
          </p>
        ) : null}
      </div>
    </div>
  )
}

/**
 * The idea in one image: a short dotted route leaves a place nearby and a
 * pin lands at your door. Pure SVG painted with the theme tokens, so it is
 * crisp at any size and follows light, dark and high-contrast themes.
 */
function PinScene() {
  return (
    <svg
      viewBox="0 0 240 132"
      aria-hidden="true"
      className="w-full max-w-[17rem] overflow-visible"
    >
      {/* A hint of streets, enough to read "map" without drawing one. */}
      <g stroke="var(--border)" strokeWidth="1.5" strokeLinecap="round">
        <path d="M6 106 H234" />
        <path d="M6 70 H120" />
        <path d="M150 24 V126" />
        <path d="M70 18 V126" />
      </g>

      {/* The route, drawn from the restaurant toward the landing point. */}
      <defs>
        <mask id="welcome-route-mask" maskUnits="userSpaceOnUse">
          <path
            d="M42 104 C 84 104, 104 60, 168 74"
            fill="none"
            stroke="white"
            strokeWidth="10"
            strokeLinecap="round"
            pathLength={1}
            className="animate-welcome-route"
            style={{ strokeDasharray: 1 }}
          />
        </mask>
      </defs>
      <path
        d="M42 104 C 84 104, 104 60, 168 74"
        fill="none"
        stroke="var(--primary)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray="0.1 9"
        mask="url(#welcome-route-mask)"
      />

      {/* The restaurant: a small storefront dot where the route starts. */}
      <g className="animate-welcome-dot welcome-origin">
        <circle cx="42" cy="104" r="11" fill="var(--foreground)" />
        <path
          d="M35 99 H49 V103 a2.4 2.4 0 0 1 -4.7 0 a2.4 2.4 0 0 1 -4.6 0 a2.4 2.4 0 0 1 -4.7 0 Z"
          fill="var(--background)"
        />
      </g>

      {/* Landing: a ripple and a soft shadow where the pin touches down. */}
      <ellipse
        cx="170"
        cy="78"
        rx="16"
        ry="5"
        fill="none"
        stroke="var(--primary)"
        strokeWidth="2"
        className="animate-welcome-ripple welcome-origin"
      />
      <ellipse
        cx="170"
        cy="78"
        rx="9"
        ry="3"
        fill="var(--foreground)"
        className="animate-welcome-shadow welcome-origin"
      />

      {/* The pin, tip at (170, 78). */}
      <g className="animate-welcome-pin welcome-pin">
        <path
          d="M170 78 C 160 64, 152 56, 152 44 a18 18 0 0 1 36 0 c0 12 -8 20 -18 34 Z"
          fill="var(--primary)"
        />
        <circle cx="170" cy="44" r="7" fill="var(--background)" />
      </g>
    </svg>
  )
}
