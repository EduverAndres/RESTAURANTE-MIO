import { NextResponse } from 'next/server'
import { serverEnv, wompiConfigured } from '@/lib/env.server'
import { logger } from '@/lib/log/logger'
import { handleWompiEvent } from '@/lib/payments/wompi/webhook'
import { verifyEventChecksum, type WompiEvent } from '@/lib/payments/wompi/signature'
import { createAdminClient } from '@/lib/supabase/admin'

// Wompi posts JSON and retries up to 3 times over 24h (30 min, 3 h, 24 h) on
// anything other than HTTP 200. The body is parsed only to resolve the signed
// properties, and the checksum is verified before the handler runs, so a
// forged payload never touches an order.
//
// ---------------------------------------------------------------------------
// Why this endpoint is deliberately NOT rate limited
// ---------------------------------------------------------------------------
// It looks like the obvious candidate — public, unauthenticated, writes to
// orders — but a limiter here makes things strictly worse, whatever it
// answers when it trips:
//
//   * 429 (or any non-200) is, to Wompi, indistinguishable from a failure,
//     so it retries. Throttling therefore does not shed the load, it defers
//     it — and it spends one of only three retries over 24h. Those retries
//     are the mechanism that heals a payment whose apply failed (a stored
//     event with `applied_at IS NULL`, see the 500s below). A limiter that
//     burned them would re-break exactly what that fix exists to guarantee.
//   * 200 is worse still: it tells Wompi the event was handled and it is
//     never redelivered. A throttled-away notification is a paid order stuck
//     on `pending` forever, with no signal anywhere that it happened.
//
// Nor is there load to shed. Deliveries are bounded by real transactions,
// and a forged flood is rejected by `verifyEventChecksum` — an in-process
// HMAC over a few hundred bytes, no database, no allocation worth counting.
// A limiter would put a network round trip and a row lock *in front of* that
// HMAC, so the defence would cost more per request than the attack it
// defends against: it would amplify the flood rather than absorb it.
//
// The protections that do apply are already here and are the right shape:
// the checksum gate, the `(provider, event_id, status)` unique constraint,
// and the amount check in `handleWompiEvent`.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  if (!wompiConfigured() || !serverEnv.WOMPI_EVENTS_SECRET) {
    return NextResponse.json(
      { error: 'Wompi is not configured' },
      { status: 503 },
    )
  }

  const rawBody = await request.text()
  let event: WompiEvent
  try {
    event = JSON.parse(rawBody) as WompiEvent
  } catch (error) {
    // The body itself is never logged: it is unverified at this point and
    // carries customer details.
    logger.error('wompi.webhook.invalid_json', { bytes: rawBody.length }, error)
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!verifyEventChecksum(event, serverEnv.WOMPI_EVENTS_SECRET)) {
    logger.error('wompi.webhook.checksum_mismatch', { eventType: event.event })
    return NextResponse.json({ error: 'Invalid checksum' }, { status: 401 })
  }

  try {
    const outcome = await handleWompiEvent(createAdminClient(), event)
    if (outcome.outcome === 'store_failed') {
      // Nothing was persisted: answer 5xx so Wompi retries the delivery.
      return NextResponse.json({ error: 'Event not stored' }, { status: 500 })
    }
    if (outcome.outcome === 'apply_failed') {
      // The event is stored but the order did not move, so the customer has
      // been charged against an order that still reads `pending`. The stored
      // row was left with `applied_at IS NULL`, so Wompi's retry re-applies
      // instead of short-circuiting as a duplicate: answer 5xx to get it.
      return NextResponse.json({ error: 'Order not updated' }, { status: 500 })
    }
    if (outcome.outcome === 'order_not_found' || outcome.outcome === 'amount_mismatch') {
      // Deliberately 200. Neither is transient: no code path creates the
      // missing order, and a mismatched amount is a configuration or fraud
      // signal, not a lost write — three retries over 24h would reach the
      // same answer and then stop, having only delayed the alert. The event
      // row stays `applied_at IS NULL`, so it shows up in the unapplied
      // index (see `payment_events_unapplied_idx`) for a human to resolve,
      // which is strictly more actionable than a retry loop.
      logger.error('wompi.webhook.needs_review', { outcome: outcome.outcome })
    }
  } catch (error) {
    logger.error('wompi.webhook.unhandled_error', undefined, error)
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 })
  }

  // 200 for every decided outcome (applied, ignored, duplicate, unknown
  // order, amount mismatch) so Wompi stops retrying an event we have stored.
  return NextResponse.json({ ok: true })
}
