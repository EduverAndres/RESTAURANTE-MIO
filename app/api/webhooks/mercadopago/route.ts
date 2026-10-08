import { NextResponse, type NextRequest } from 'next/server'
import { serverEnv } from '@/lib/env.server'
import { logger } from '@/lib/log/logger'
import { verifyMercadoPagoSignature } from '@/lib/payments/mercadopago/signature'
import { mercadopagoProvider } from '@/lib/payments/providers/mercadopago'
import { createAdminClient } from '@/lib/supabase/admin'

// Mercado Pago notifications. The signature is checked against the manifest
// Mercado Pago actually signs (see lib/payments/mercadopago/signature.ts),
// then the payment is re-read from Mercado Pago's API — the notification is
// only a hint that something changed, never the source of truth.
//
// Any failure on our side answers 500 so Mercado Pago retries; a 200 would
// tell it the event was handled and a paid order could stay `pending`.
export async function POST(req: NextRequest) {
  const secret = serverEnv.MERCADOPAGO_WEBHOOK_SECRET
  if (!secret) {
    logger.error('mercadopago.webhook_not_configured')
    return NextResponse.json({ error: 'Not configured' }, { status: 500 })
  }

  const body = await req.text()
  let payload: { type?: string; data?: { id?: string | number } }
  try {
    payload = JSON.parse(body)
  } catch {
    logger.warn('mercadopago.webhook_invalid_json')
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const dataId =
    req.nextUrl.searchParams.get('data.id') ??
    (payload.data?.id !== undefined ? String(payload.data.id) : null)

  const valid = verifyMercadoPagoSignature({
    secret,
    signatureHeader: req.headers.get('x-signature'),
    requestId: req.headers.get('x-request-id'),
    dataId,
  })
  if (!valid) {
    logger.warn('mercadopago.webhook_invalid_signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const type = payload.type ?? req.nextUrl.searchParams.get('type')
  if (type !== 'payment' || !dataId) return NextResponse.json({ ok: true })

  const result = await mercadopagoProvider.verifyPayment(dataId)
  // `pending` is where every order starts; writing it again could only move
  // a settled order backwards if notifications arrive out of order.
  if (result.status === 'pending') return NextResponse.json({ ok: true })

  const { error } = await createAdminClient()
    .from('orders')
    .update({ payment_status: result.status, payment_ref: dataId })
    .eq('short_code', result.reference)
    .eq('payment_method', 'mercadopago')

  if (error) {
    logger.error('mercadopago.webhook_update_failed', { error })
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
