'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { welcomeFor, type WelcomeScene } from '@/lib/auth/welcome'
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
  const Scene = SCENES[scene]
  return (
    <div
      role="status"
      aria-live="polite"
      data-role={role ?? 'customer'}
      data-scene={scene}
      className={`${leaving ? 'animate-success-out' : 'animate-success-fade'} bg-background fixed inset-0 z-[100] grid place-items-center px-6`}
      style={{
        backgroundImage:
          'radial-gradient(circle at 50% 42%, color-mix(in oklch, var(--primary) 12%, transparent), transparent 60%)',
      }}
    >
      <div className="flex w-full max-w-sm flex-col items-center gap-5 text-center">
        <Scene />
        <p className="animate-welcome-brand font-display font-display-soft text-foreground text-4xl font-semibold tracking-tight lowercase sm:text-5xl">
          {APP_NAME}
          <span className="text-primary">.</span>
        </p>
        <p className="animate-welcome-phrase text-muted-foreground text-lg text-balance sm:text-xl">
          {phrase}
        </p>
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

/**
 * The merchant's side of the same story, with less on screen: a storefront
 * in thin lines, the dotted route leaving it, and a home in the brand colour
 * that pulses as the order arrives. Store to home, where the customer's
 * scene reads home to store.
 */
function StoreToHomeScene() {
  const route = 'M72 84 C 102 46, 140 46, 168 84'
  return (
    <svg
      viewBox="0 0 240 120"
      aria-hidden="true"
      className="w-full max-w-[17rem] overflow-visible"
    >
      <path
        d="M24 98 H216"
        stroke="var(--border)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      {/* The store, where the route starts. */}
      <g
        className="animate-welcome-dot welcome-origin"
        fill="none"
        stroke="var(--foreground)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M34 62 L37 52 H63 L66 62" />
        <path d="M34 62 a4 4 0 0 0 8 0 a4 4 0 0 0 8 0 a4 4 0 0 0 8 0 a4 4 0 0 0 8 0" />
        <path d="M37 67 V96 H63 V67" />
        <path d="M46 96 V83 H54 V96" />
      </g>

      {/* The route, drawn from the store to the door. */}
      <defs>
        <mask id="welcome-dispatch-mask" maskUnits="userSpaceOnUse">
          <path
            d={route}
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
        d={route}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray="0.1 9"
        mask="url(#welcome-dispatch-mask)"
      />

      {/* Arrival: a ripple at the door, and the home in the brand colour. */}
      <ellipse
        cx="192"
        cy="98"
        rx="18"
        ry="5"
        fill="none"
        stroke="var(--primary)"
        strokeWidth="2"
        className="animate-welcome-ripple welcome-origin"
      />
      <g
        className="animate-welcome-arrive welcome-origin"
        fill="none"
        stroke="var(--primary)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M172 76 L192 58 L212 76" />
        <path d="M177 71 V96 H207 V71" />
        <path d="M188 96 V84 H196 V96" />
      </g>
    </svg>
  )
}

/**
 * Admins run the platform: a small panel whose three bars rise one after
 * the other, the last in the brand colour. Nothing to sell, just "all here".
 */
function DashboardScene() {
  return (
    <svg
      viewBox="0 0 240 120"
      aria-hidden="true"
      className="w-full max-w-[17rem] overflow-visible"
    >
      <g className="animate-welcome-panel">
        <rect
          x="62"
          y="16"
          width="116"
          height="88"
          rx="14"
          fill="none"
          stroke="var(--border)"
          strokeWidth="2"
        />
        <path
          d="M80 88 H160"
          stroke="var(--border)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="160" cy="32" r="3.5" fill="var(--primary)" />
      </g>
      <rect
        x="84"
        y="62"
        width="16"
        height="24"
        rx="4"
        fill="var(--foreground)"
        opacity="0.22"
        className="animate-welcome-bar-1 welcome-bar"
      />
      <rect
        x="112"
        y="48"
        width="16"
        height="38"
        rx="4"
        fill="var(--foreground)"
        opacity="0.38"
        className="animate-welcome-bar-2 welcome-bar"
      />
      <rect
        x="140"
        y="34"
        width="16"
        height="52"
        rx="4"
        fill="var(--primary)"
        className="animate-welcome-bar-3 welcome-bar"
      />
    </svg>
  )
}

const SCENES: Record<WelcomeScene, () => React.JSX.Element> = {
  'route-pin': PinScene,
  'store-to-home': StoreToHomeScene,
  dashboard: DashboardScene,
}
