import { NextRequest, NextResponse } from 'next/server';
import { serverEnv } from '@/lib/env.server';
import { mercadopagoProvider } from '@/lib/payments/providers/mercadopago';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/log/logger';

export async function POST(req: NextRequest) {
  // 1️⃣ Validate signature (HMAC SHA256) – MP sends `x-signature`
  const signature = req.headers.get('x-signature') ?? '';
  const body = await req.text();
  const expected = crypto
    .createHmac('sha256', serverEnv.MERCADOPAGO_WEBHOOK_SECRET!)
    .update(body)
    .digest('hex');
  if (signature !== expected) {
    logger.warn('mercadopago.webhook_invalid_signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  let payload: { data: { id: string }; type: string };
  try {
    payload = JSON.parse(body);
  } catch {
    logger.error('mercadopago.webhook_invalid_json');
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { data, type } = payload; // type = "payment"
  if (type !== 'payment') return NextResponse.json({ ok: true });

  const paymentId = data.id.toString();
  const result = await mercadopagoProvider.verifyPayment(paymentId);

  // 2️⃣ Update order (service role)
  const admin = createAdminClient();
  const { error } = await admin
    .from('orders')
    .update({ payment_status: result.status, payment_reference: result.reference })
    .eq('short_code', result.reference);

  if (error) logger.error('mercadopago.webhook_update_failed', { error });
  return NextResponse.json({ ok: true });
}