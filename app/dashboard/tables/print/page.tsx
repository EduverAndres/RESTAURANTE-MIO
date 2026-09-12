import { ChevronLeftIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { fetchTablesWithQr } from '../page'
import { PrintButton } from '@/components/dashboard/tables/print-button'
import { EmptyState } from '@/components/ui/empty-state'
import { requireActiveStoreRow } from '@/lib/dashboard/store-context'

export const metadata: Metadata = { title: 'Imprimir códigos QR' }
export const dynamic = 'force-dynamic'

/** Print-friendly sheet: one card per table, two per row on paper. */
export default async function PrintTablesPage() {
  const { store } = await requireActiveStoreRow('/dashboard/tables/print')
  const tables = await fetchTablesWithQr(store.id, store.slug)

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
        {tables.length > 0 ? <PrintButton /> : null}
      </header>

      {tables.length === 0 ? (
        <EmptyState
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
              <p className="font-display text-xl font-semibold">{store.name}</p>
              <div
                role="img"
                aria-label={`Código QR de la mesa ${table.number}`}
                className="size-44 [&_svg]:size-full"
                dangerouslySetInnerHTML={{ __html: table.svg }}
              />
              <p className="font-display text-3xl font-semibold">
                Mesa {table.number}
              </p>
              <p className="text-sm text-neutral-600">
                Escanea el código con la cámara de tu celular para ver el menú y
                pedir desde tu mesa.
              </p>
              <p className="w-full truncate text-[10px] text-neutral-500">
                {table.url}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
