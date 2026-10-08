import 'server-only';

import { env } from '@/lib/env';
import { serverEnv, mercadopagoConfigured } from '@/lib/env.server';
import { logger } from '@/lib/log/logger';
import type { PaymentProvider, PaymentResult, CreatePaymentInput } from '@/lib/payments/types';

const MP_API = 'https://api.mercadopago.com';

export const mercadopagoProvider: PaymentProvider = {
  method: 'mercadopago',
  label: 'Tarjeta crédito / débito (Mercado Pago)',
  description: 'Pago con tarjeta, dinero en cuenta o PSE via Mercado Pago',

  isAvailable() {
    return mercadopagoConfigured();
  },

  async createPayment(input: CreatePaymentInput): Promise<PaymentResult> {
    const { MERCADOPAGO_ACCESS_TOKEN: token, MERCADOPAGO_PUBLIC_KEY: publicKey } = serverEnv;
    if (!token || !publicKey) {
      logger.error('mercadopago.not_configured', { orderId: input.orderId });
      return {
        status: 'failed',
        reference: input.shortCode,
        message: 'Mercado Pago no configurado',
      };
    }

    const preference = {
      items: [
        {
          title: `Pedido ${input.shortCode}`,
          quantity: 1,
          // Whole pesos: Mercado Pago takes COP as units, not cents.
          unit_price: Math.round(input.amount),
          currency_id: 'COP',
        },
      ],
      payer: { email: input.customer.email ?? undefined },
      back_urls: {
        success: input.returnUrl,
        failure: `${input.returnUrl}?payment=failed`,
        pending: `${input.returnUrl}?payment=pending`,
      },
      auto_return: 'approved',
      external_reference: input.shortCode,
      notification_url: `${env.NEXT_PUBLIC_SITE_URL}/api/webhooks/mercadopago`,
      expires: false,
    };

    const resp = await fetch(`${MP_API}/checkout/preferences`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preference),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      logger.error('mercadopago.create_preference_failed', { status: resp.status, txt });
      return {
        status: 'failed',
        reference: input.shortCode,
        message: 'No se pudo crear la preferencia de pago',
      };
    }

    const data = await resp.json();
    return {
      status: 'pending',
      reference: input.shortCode,
      redirectUrl: data.init_point,
    };
  },

  async verifyPayment(paymentId: string): Promise<PaymentResult> {
    const { MERCADOPAGO_ACCESS_TOKEN: token } = serverEnv;
    if (!token) {
      return { status: 'pending', reference: paymentId, message: 'MP no configurado' };
    }

    const resp = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) {
      return { status: 'pending', reference: paymentId, message: 'No se pudo verificar el pago' };
    }

    const data = await resp.json();
    const map: Record<string, PaymentResult['status']> = {
      approved: 'paid',
      pending: 'pending',
      in_process: 'pending',
      rejected: 'failed',
      cancelled: 'failed',
      refunded: 'refunded',
      charged_back: 'failed',
    };
    return {
      status: map[data.status] ?? 'pending',
      reference: data.external_reference ?? paymentId,
      message: data.status_detail,
    };
  },
};