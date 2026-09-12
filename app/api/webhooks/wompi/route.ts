import { NextResponse } from 'next/server'
import { serverEnv, wompiConfigured } from '@/lib/env.server'
import { handleWompiEvent } from '@/lib/payments/wompi/webhook'
import { verifyEventChecksum, type WompiEvent } from '@/lib/payments/wompi/signature'
import { createAdminClient } from '@/lib/supabase/admin'

// Wompi posts JSON and retries up to 3 times over 24h (30 min, 3 h, 24 h) on
// anything other than HTTP 200. The body is parsed only to resolve the signed
// properties, and the checksum is verified before the handler runs, so a
// forged payload never touches an order.
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
    console.error('Failed to parse Wompi webhook body', error)
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!verifyEventChecksum(event, serverEnv.WOMPI_EVENTS_SECRET)) {
    console.error('Wompi webhook checksum mismatch')
    return NextResponse.json({ error: 'Invalid checksum' }, { status: 401 })
  }

  try {
    const outcome = await handleWompiEvent(createAdminClient(), event)
    if (outcome.outcome === 'store_failed') {
      // Nothing was persisted: answer 5xx so Wompi retries the delivery.
      return NextResponse.json({ error: 'Event not stored' }, { status: 500 })
    }
    if (outcome.outcome === 'order_not_found' || outcome.outcome === 'amount_mismatch') {
      console.error('Wompi webhook could not be applied', outcome)
    }
  } catch (error) {
    console.error('Failed to process Wompi webhook', error)
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 })
  }

  // 200 for every decided outcome (applied, ignored, duplicate, unknown
  // order, amount mismatch) so Wompi stops retrying an event we have stored.
  return NextResponse.json({ ok: true })
}
