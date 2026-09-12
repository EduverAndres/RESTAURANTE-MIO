import 'server-only'

import QRCode from 'qrcode'
import { env } from '@/lib/env'
import { listPaymentOptions, type PaymentOption } from '@/lib/payments'
import { storePublicUrl } from '@/lib/subdomain'
import { createClient } from '@/lib/supabase/server'
import {
  resolveTableWithClient,
  type ResolvedTable,
} from '@/lib/tables/resolve'
import {
  TABLE_PAYMENT_LABELS,
  TABLE_PAYMENT_METHODS,
  type TablePaymentMethod,
} from '@/lib/validations/table-order'

export type { ResolvedTable }

/** Resolves a table from the public QR token with the request-scoped client. */
export async function fetchTableByToken(
  slug: string,
  token: string,
): Promise<ResolvedTable | null> {
  return resolveTableWithClient(await createClient(), slug, token)
}

/** Absolute base used for the printed QR codes. */
export function siteBaseUrl(): string {
  return env.NEXT_PUBLIC_SITE_URL
}

/**
 * Absolute URL printed on a table's QR code. Resolves to the store
 * subdomain when one is configured, otherwise falls back to the `/t/<slug>`
 * path so local development and deployments without wildcard DNS keep
 * working.
 */
export function tableQrTargetUrl(slug: string, token: string): string {
  const base = storePublicUrl({
    slug,
    siteUrl: env.NEXT_PUBLIC_SITE_URL,
    rootDomain: env.NEXT_PUBLIC_ROOT_DOMAIN,
  })
  return `${base}/mesa/${token}`
}

/** Inline SVG markup for a QR code; rendered server-side, no client library. */
export async function renderQrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { type: 'svg', margin: 1 })
}

function isTablePaymentMethod(value: string): value is TablePaymentMethod {
  return (TABLE_PAYMENT_METHODS as readonly string[]).includes(value)
}

/** Payment choices offered at the table, with dine-in copy for cash. */
export function listTablePaymentOptions(): PaymentOption[] {
  return listPaymentOptions()
    .filter((option) => isTablePaymentMethod(option.method))
    .map((option) => ({
      ...option,
      ...TABLE_PAYMENT_LABELS[option.method as TablePaymentMethod],
    }))
}
