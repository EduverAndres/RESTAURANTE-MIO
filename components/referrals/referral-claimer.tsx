'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'
import { claimReferral } from '@/app/(public)/actions'
import { formatCOP } from '@/lib/format'
import {
  claimMessage,
  keepForLater,
  normalizeReferralCode,
  REFERRAL_PARAM,
  REFERRAL_STORAGE_KEY,
  REFERRAL_TTL_MS,
} from '@/lib/referrals'
import { createClient } from '@/lib/supabase/client'

interface StoredInvitation {
  code: string
  at: number
}

function read(): StoredInvitation | null {
  try {
    const raw = localStorage.getItem(REFERRAL_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredInvitation
    if (!normalizeReferralCode(parsed.code)) return null
    if (Date.now() - parsed.at > REFERRAL_TTL_MS) return null
    return parsed
  } catch {
    return null
  }
}

function write(value: StoredInvitation | null) {
  try {
    if (value) localStorage.setItem(REFERRAL_STORAGE_KEY, JSON.stringify(value))
    else localStorage.removeItem(REFERRAL_STORAGE_KEY)
  } catch {
    // Storage blocked: the invitation simply is not remembered.
  }
}

/**
 * Remembers an invitation (`?ref=CODE` on any page) and claims it once its
 * owner is signed in, which is usually right after they create the account.
 * Renders nothing. Anonymous visitors never reach the server: the session is
 * checked in the browser first.
 */
export function ReferralClaimer() {
  useEffect(() => {
    const fromUrl = normalizeReferralCode(
      new URLSearchParams(window.location.search).get(REFERRAL_PARAM),
    )
    // The newest invitation wins: someone who opens a friend's link after
    // another one meant the latest.
    if (fromUrl) write({ code: fromUrl, at: Date.now() })

    const stored = read()
    if (!stored) {
      write(null)
      return
    }

    let cancelled = false
    createClient()
      .auth.getSession()
      .then(async ({ data }) => {
        if (cancelled || !data.session) return
        const { result, amount } = await claimReferral(stored.code)
        if (cancelled) return
        if (!keepForLater(result)) write(null)
        const message = claimMessage(result, formatCOP(amount))
        if (message?.tone === 'success') toast.success(message.text)
        else if (message) toast(message.text)
      })
      .catch(() => {
        // Keep the invitation for the next visit.
      })
    return () => {
      cancelled = true
    }
  }, [])

  return null
}
