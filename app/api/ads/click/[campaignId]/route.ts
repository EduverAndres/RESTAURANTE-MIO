import { NextResponse, type NextRequest } from 'next/server'
import { isUuid } from '@/lib/dashboard/active-store'
import { isAutomatedUserAgent } from '@/lib/http/bots'
import { clientIp } from '@/lib/http/client-ip'
import { logger } from '@/lib/log/logger'
import { AD_CLICK_POLICY, rateLimitIdentifier } from '@/lib/rate-limit/policy'
import {
  enforceRateLimit,
  postgresRateLimitStore,
} from '@/lib/rate-limit/store'
import { createAdminClient } from '@/lib/supabase/admin'

// A click on a sponsored placement ("Patrocinado"): count it, then take the
// visitor to the store.
//
// Public and unauthenticated by nature: anyone who sees the ad may click it.
// What it protects is the merchant's click count, which is informative (the
// fee is per day, not per click), so the guards are about honesty rather
// than money:
//
//   * a crawler, a link preview or a script is redirected without counting;
//   * one address counts a few clicks per campaign per half hour
//     (AD_CLICK_POLICY); past that it is redirected without counting;
//   * `record_ad_click` (service role only) counts only a campaign that is on
//     the air today, of an active store.
//
// The visitor always reaches the store, even when counting fails: an ad that
// breaks on click would cost the merchant the customer they paid for. An
// unknown id goes to the home page. The Location header is relative, so it
// never depends on the Host header the proxy forwards.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function redirectTo(path: string): NextResponse {
  return new NextResponse(null, {
    status: 302,
    headers: {
      Location: path,
      // Never cache a counted hop; never index it.
      'Cache-Control': 'no-store, max-age=0',
      'X-Robots-Tag': 'noindex, nofollow',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
  })
}

function storePath(slug: unknown): string | null {
  return typeof slug === 'string' && SLUG.test(slug) ? `/t/${slug}` : null
}

/** Whether this click should be counted at all. */
async function countable(
  request: NextRequest,
  campaignId: string,
  admin: ReturnType<typeof createAdminClient>,
): Promise<boolean> {
  if (isAutomatedUserAgent(request.headers.get('user-agent'))) return false
  const ip = clientIp(request.headers)
  // Without a proxy header there is no address to key on; count it rather
  // than lump every such request into one shared bucket.
  if (!ip) return true
  const decision = await enforceRateLimit(postgresRateLimitStore(admin), [
    {
      policy: AD_CLICK_POLICY,
      identifier: rateLimitIdentifier('ip', ip, 'campaign', campaignId),
    },
  ])
  return decision.allowed
}

/** The store's slug, without counting anything. */
async function lookupSlug(
  admin: ReturnType<typeof createAdminClient>,
  campaignId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from('ad_campaigns')
    .select('stores(slug)')
    .eq('id', campaignId)
    .maybeSingle()
  if (error) {
    logger.error('ads.click_lookup_failed', { campaignId }, error)
    return null
  }
  return data?.stores?.slug ?? null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  const { campaignId } = await params
  if (!isUuid(campaignId)) return redirectTo('/')

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch (error) {
    logger.error('ads.click_unavailable', { campaignId }, error)
    return redirectTo('/')
  }

  let slug: string | null = null
  try {
    if (await countable(request, campaignId, admin)) {
      const { data, error } = await admin.rpc('record_ad_click', {
        p_id: campaignId,
      })
      if (error) logger.error('ads.click_record_failed', { campaignId }, error)
      else slug = data ?? null
    }
    // Not counted (a bot, over the budget) or counting failed: still go.
    if (slug === null) slug = await lookupSlug(admin, campaignId)
  } catch (error) {
    logger.error('ads.click_failed', { campaignId }, error)
  }

  return redirectTo(storePath(slug) ?? '/')
}
