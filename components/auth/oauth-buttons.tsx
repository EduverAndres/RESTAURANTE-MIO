'use client'

import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { AUTH_ERROR_MESSAGES, mapAuthError } from '@/lib/auth/errors'
import {
  LEGAL_PENDING_COOKIE,
  LEGAL_PENDING_MAX_AGE,
  LEGAL_VERSION,
} from '@/lib/legal/consent'
import { createClient } from '@/lib/supabase/client'

function GoogleLogo() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.9 1.5l2.6-2.6C16.8 3 14.6 2 12 2 6.5 2 2 6.5 2 12s4.5 10 10 10c5.8 0 9.6-4.1 9.6-9.8 0-.7-.1-1.2-.2-1.7H12z"
      />
    </svg>
  )
}

function MicrosoftLogo() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5">
      <path fill="#F25022" d="M2 2h9.5v9.5H2z" />
      <path fill="#7FBA00" d="M12.5 2H22v9.5h-9.5z" />
      <path fill="#00A4EF" d="M2 12.5h9.5V22H2z" />
      <path fill="#FFB900" d="M12.5 12.5H22V22h-9.5z" />
    </svg>
  )
}

const PROVIDERS = [
  { key: 'google', supabase: 'google', name: 'Google', Logo: GoogleLogo },
  {
    key: 'microsoft',
    // Supabase calls Microsoft accounts (Outlook, Hotmail, 365) `azure`.
    supabase: 'azure',
    name: 'Microsoft',
    Logo: MicrosoftLogo,
  },
] as const

/**
 * Leaves a short-lived marker that the person ticked the consent box, for
 * the OAuth callback to record: the round-trip to Google or Microsoft leaves
 * this page, so the server never sees the form. `.m` carries the optional
 * marketing choice from the sign-up form.
 */
function markConsentForOAuth(marketingOptIn: boolean) {
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  const value = `${LEGAL_VERSION}${marketingOptIn ? '.m' : ''}`
  document.cookie = `${LEGAL_PENDING_COOKIE}=${value}; Path=/; Max-Age=${LEGAL_PENDING_MAX_AGE}; SameSite=Lax${secure}`
}

interface OAuthButtonsProps {
  /** Which providers Supabase has switched on (see `getAuthProviders`). */
  enabled: { google: boolean; microsoft: boolean }
  /**
   * Development only: also render providers that are off, so the screen can
   * be designed before the dashboard is configured. Clicking one explains
   * instead of sending the person to GoTrue's raw JSON error.
   */
  showUnavailable: boolean
  next: string | null
  /** Asks for the consent box; returns false (and shows why) if unticked. */
  ensureAccepted: () => boolean
  marketingOptIn?: () => boolean
  /** Text of the rule under the buttons, e.g. "o con tu correo". */
  separatorLabel: string
}

/**
 * "Continuar con Google / Microsoft", shared by login and sign-up. Renders
 * nothing when no provider would work, so the email form is never preceded
 * by an empty row or a divider that divides nothing.
 */
export function OAuthButtons({
  enabled,
  showUnavailable,
  next,
  ensureAccepted,
  marketingOptIn,
  separatorLabel,
}: OAuthButtonsProps) {
  const visible = PROVIDERS.filter(
    (provider) => enabled[provider.key] || showUnavailable,
  )
  if (visible.length === 0) return null

  async function start(provider: (typeof PROVIDERS)[number]) {
    if (!ensureAccepted()) return
    if (!enabled[provider.key]) {
      toast.error(
        `El acceso con ${provider.name} aún no está activado. Usa tu correo por ahora.`,
      )
      return
    }
    markConsentForOAuth(marketingOptIn?.() ?? false)
    const params = next ? `?next=${encodeURIComponent(next)}` : ''
    const { error } = await createClient().auth.signInWithOAuth({
      provider: provider.supabase,
      options: {
        redirectTo: `${window.location.origin}/auth/callback${params}`,
        // Microsoft only returns the address when asked for it explicitly.
        ...(provider.supabase === 'azure' ? { scopes: 'email' } : {}),
      },
    })
    if (error) {
      const message = mapAuthError(error)
      toast.error(
        message === AUTH_ERROR_MESSAGES.providerDisabled
          ? `El acceso con ${provider.name} aún no está activado.`
          : message,
      )
    }
  }

  return (
    <div className="space-y-5">
      <div
        className={
          visible.length > 1 ? 'grid gap-3 sm:grid-cols-2' : 'grid gap-3'
        }
      >
        {visible.map((provider) => (
          <Button
            key={provider.key}
            type="button"
            variant="outline"
            onClick={() => start(provider)}
            aria-label={`Continuar con ${provider.name}`}
            className="rounded-pill h-12 w-full text-base"
          >
            <provider.Logo />
            {provider.name}
          </Button>
        ))}
      </div>
      <div className="text-muted-foreground flex items-center gap-3 text-xs">
        <Separator className="flex-1" />
        {separatorLabel}
        <Separator className="flex-1" />
      </div>
    </div>
  )
}
