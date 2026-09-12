import type { Metadata } from 'next'
import { TableCardActions } from '@/components/dashboard/tables/table-card-actions'
import { TableQrCard } from '@/components/dashboard/tables/table-qr-card'
import { TablesToolbar } from '@/components/dashboard/tables/tables-toolbar'
import { EmptyState } from '@/components/ui/empty-state'
import { requireActiveStoreRow } from '@/lib/dashboard/store-context'
import { createClient } from '@/lib/supabase/server'
import { MAX_TABLES_PER_STORE, nextTableNumber } from '@/lib/tables/qr'
import { renderQrSvg, tableQrTargetUrl } from '@/lib/tables/server'

export const metadata: Metadata = { title: 'Mesas' }
export const dynamic = 'force-dynamic'

export interface TableWithQr {
  id: string
  number: number
  url: string
  svg: string
}

/** Tables of the store with their QR codes rendered server-side. */
export async function fetchTablesWithQr(
  storeId: string,
  slug: string,
): Promise<TableWithQr[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('store_tables')
    .select('id, number, qr_token')
    .eq('store_id', storeId)
    .order('number', { ascending: true })
    .limit(MAX_TABLES_PER_STORE)
  if (error) {
    console.error('Failed to load tables', error)
    return []
  }
  return Promise.all(
    (data ?? []).map(async (table) => {
      const url = tableQrTargetUrl(slug, table.qr_token)
      return { id: table.id, number: table.number, url, svg: await renderQrSvg(url) }
    }),
  )
}

export default async function TablesPage() {
  const { store } = await requireActiveStoreRow('/dashboard/tables')
  const tables = await fetchTablesWithQr(store.id, store.slug)
  const nextNumber = nextTableNumber(tables.map((table) => table.number))

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Mesas
          </h1>
          <p className="text-muted-foreground text-sm">
            Cada mesa tiene un código QR. Tus clientes lo escanean, ven el menú
            y piden sin registrarse.
          </p>
        </div>
        <TablesToolbar nextNumber={nextNumber} hasTables={tables.length > 0} />
      </header>

      {tables.length === 0 ? (
        <EmptyState
          title="Todavía no tienes mesas"
          description="Crea tu primera mesa o agrega varias de una vez con un rango como 1-12."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {tables.map((table) => (
            <TableQrCard
              key={table.id}
              number={table.number}
              url={table.url}
              svg={table.svg}
              actions={
                <TableCardActions tableId={table.id} number={table.number} />
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}
