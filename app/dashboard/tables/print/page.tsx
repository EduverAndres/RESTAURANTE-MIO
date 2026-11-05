import { ChevronLeftIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { fetchTablesWithQr } from '../page'
import { PrintButton } from '@/components/dashboard/tables/print-button'
import { QrReachNotice } from '@/components/dashboard/tables/qr-reach-notice'
import { QrWithMark } from '@/components/dashboard/tables/qr-with-mark'
import { EmptyState } from '@/components/ui/empty-state'
import { requireActiveStoreRow } from '@/lib/dashboard/store-context'
import { APP_NAME } from '@/lib/env'
import { tableQrBase } from '@/lib/tables/qr-base'

export const metadata: Metadata = { title: 'Imprimir códigos QR' }
export const dynamic = 'force-dynamic'

/**
 * Print-friendly sheet: one card per table, two per row on paper.
 *
 * The card belongs to the business: its logo and name go on top. The table
 * number is the largest thing on it because a waiter reads it from across
 * the room. The platform only signs the foot, which is the one line that
 * tells a diner where they can order from this place again.
 */
export default async function PrintTablesPage() {
  const { store } = await requireActiveStoreRow('/dashboard/tables/print')
  const qrBase = await tableQrBase()
  const tables = await fetchTablesWithQr(store.id, store.slug, qrBase.origin)

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <style>{`@media print { @page { margin: 12mm } }`}</style>

      <header className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div className="space-y-1">
          <Link
            href="/dashboard/tables"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
          >
            <ChevronLeftIcon aria-hidden="true" className="size-4" />
            Mesas
          </Link>
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Imprimir códigos QR
          </h1>
          <p className="text-muted-foreground text-sm">
            Recorta cada tarjeta y ponla sobre la mesa correspondiente.
          </p>
        </div>
        {/* Never print codes a phone cannot open: they end up glued to tables. */}
        {tables.length > 0 && qrBase.reachable ? <PrintButton /> : null}
      </header>

      <QrReachNotice base={qrBase} className="print:hidden" />

      {tables.length === 0 ? (
        <EmptyState
          illustration="table"
          title="No hay mesas para imprimir"
          description="Crea mesas primero desde la sección Mesas."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-2 print:gap-6">
          {tables.map((table) => (
            <article
              key={table.id}
              aria-label={`Mesa ${table.number}`}
              className="rounded-card flex break-inside-avoid flex-col items-center gap-3 border border-dashed border-neutral-400 bg-white p-6 text-center text-neutral-900 print:border-neutral-500"
            >
              <div className="flex items-center gap-2">
                {store.logo_url ? (
                  <Image
                    src={store.logo_url}
                    alt=""
                    width={36}
                    height={36}
                    // Every card goes to paper at once: a lazy logo below the
                    // fold would print as an empty circle.
                    loading="eager"
                    className="size-9 rounded-full object-cover"
                  />
                ) : null}
                <p className="font-display text-xl font-semibold">
                  {store.name}
                </p>
              </div>
              <QrWithMark
                svg={table.svg}
                label={`Código QR de la mesa ${table.number}`}
                className="size-44"
              />
              <p className="text-4xl font-bold tracking-tight tabular-nums">
                Mesa {table.number}
              </p>
              <p className="max-w-[24ch] text-sm text-neutral-600">
                Escanea con la cámara de tu celular para ver la carta y pedir
                desde aquí.
              </p>
              <p className="w-full truncate text-[10px] text-neutral-500">
                {table.url}
              </p>
              <p className="w-full border-t border-neutral-200 pt-2 text-xs text-neutral-600">
                Pide con{' '}
                <span className="font-display font-semibold text-neutral-900 lowercase">
                  {APP_NAME}.
                </span>
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
