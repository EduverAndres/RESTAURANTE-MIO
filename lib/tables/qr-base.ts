import 'server-only'

import { networkInterfaces } from 'node:os'
import { headers } from 'next/headers'
import { env } from '@/lib/env'
import { requestOrigin } from '@/lib/http/request-origin'
import { pickLanAddress, qrBaseFor, type QrBase } from '@/lib/tables/qr-reach'

export type { QrBase }

/**
 * The origin printed on table QR codes, and whether a phone can reach it.
 *
 * Production prints the canonical site URL: a QR glued to a table must keep
 * working for years, so it never depends on which host the merchant happened
 * to open the dashboard from.
 *
 * Development is where QR codes used to "do nothing": they pointed at
 * `localhost`, which on the customer's phone is the phone itself. When the
 * dashboard is opened on a loopback host, the code swaps in this machine's
 * Wi-Fi/Ethernet address so a phone on the same network can open it, and
 * reports `reachable: false` when there is no such address to offer.
 */
export async function tableQrBase(): Promise<QrBase> {
  const production = process.env.NODE_ENV === 'production'
  const origin = production
    ? env.NEXT_PUBLIC_SITE_URL
    : requestOrigin(await headers(), env.NEXT_PUBLIC_SITE_URL)

  const lan = production
    ? null
    : pickLanAddress(
        Object.entries(networkInterfaces()).flatMap(([name, entries]) =>
          (entries ?? []).map((entry) => ({ name, ...entry })),
        ),
      )

  return qrBaseFor({ origin, lanAddress: lan, production })
}
