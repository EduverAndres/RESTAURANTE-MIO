import 'server-only'

import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import QRCode from 'qrcode'
import { env } from '@/lib/env'
import {
  GUEST_ORDERS_COOKIE,
  parseGuestOrders,
} from '@/lib/orders/guest-orders'
import { listPaymentOptions, type PaymentOption } from '@/lib/payments'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { tableEntryPath, tableEntryUrl } from '@/lib/tables/qr'
import {
  currentSlugForTableWithClient,
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

/**
 * The table behind a QR page, or the end of the request.
 *
 * When the slug in the URL no longer matches (the store renamed its link
 * after the codes were printed) but the token still belongs to an active
 * store, the visitor is sent to the same page under the current slug.
 * `rest` is whatever follows the token (`/checkout`, `/pedido/<id>?id=…`).
 * The redirect is temporary on purpose: a cached permanent one would loop if
 * the store ever took its old link back. Anything else is a 404.
 */
export async function requireTableOrRedirect(
  slug: string,
  token: string,
  rest = '',
): Promise<ResolvedTable> {
  const resolved = await fetchTableByToken(slug, token)
  if (resolved) return resolved

  const current = await currentSlugForTableWithClient(
    await createClient(),
    token,
  )
  if (current && current !== slug) {
    redirect(`${tableEntryPath(current, token)}${rest}`)
  }
  notFound()
}

export interface OpenGuestOrder {
  id: string
  shortCode: string
}

/**
 * The orders this browser placed at this store from a table and that are
 * still open, newest first.
 *
 * A guest has no account and no "Mis pedidos": once the tab was closed the
 * only way back to the order was the cookie, and nothing read it outside the
 * order page itself. The cookie is the proof of ownership here too, exactly
 * as on that page, so the rows are read with the service role. Any failure
 * means "nothing to show".
 */
export async function fetchOpenGuestOrders(
  storeId: string,
): Promise<OpenGuestOrder[]> {
  const ids = parseGuestOrders(
    (await cookies()).get(GUEST_ORDERS_COOKIE)?.value,
  )
  if (ids.length === 0) return []
  try {
    const { data, error } = await createAdminClient()
      .from('orders')
      .select('id, short_code')
      .in('id', ids)
      .eq('store_id', storeId)
      .eq('type', 'table')
      .not('status', 'in', '(delivered,cancelled)')
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map((order) => ({
      id: order.id,
      shortCode: order.short_code,
    }))
  } catch (error) {
    console.error('Failed to load the guest open orders', error)
    return []
  }
}

/** Absolute base used for the printed QR codes. */
export function siteBaseUrl(): string {
  return env.NEXT_PUBLIC_SITE_URL
}

/**
 * Absolute URL printed on a table's QR code: always the path form
 * `<origin>/t/<slug>/mesa/<token>`, never the store subdomain.
 *
 * A printed QR outlives every infrastructure decision. The subdomain form
 * only resolves with wildcard DNS and a wildcard TLS certificate in place, so
 * a deployment without them printed codes that opened nothing. The path form
 * works on any host that serves the app; a store subdomain, where it exists,
 * still serves the same page. `origin` comes from `tableQrBase()`.
 */
export function tableQrTargetUrl(
  origin: string,
  slug: string,
  token: string,
): string {
  return tableEntryUrl(origin, slug, token)
}

/**
 * Inline SVG markup for a QR code; rendered server-side, no client library.
 *
 * Error correction H (about 30% of the code recoverable) because the platform
 * mark is laid over the centre of every table card (see `QrWithMark`), and a
 * four-module quiet zone, the margin scanners are specified against: a
 * printed code is read in dim light, at an angle, by any phone.
 */
export async function renderQrSvg(url: string): Promise<string> {
  return QRCode.toString(url, {
    type: 'svg',
    margin: 4,
    errorCorrectionLevel: 'H',
  })
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
