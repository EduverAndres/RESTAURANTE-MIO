import type { Metadata } from 'next'
import Link from 'next/link'
import { ExternalLinkIcon } from 'lucide-react'
import { StoreCommissionForm } from '@/components/admin/store-commission-form'
import { StoreStatusSelect } from '@/components/admin/store-status-select'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { requireRole } from '@/lib/auth'
import { APP_NAME, env } from '@/lib/env'
import { formatDateCO } from '@/lib/format-date'
import { storePublicUrl } from '@/lib/subdomain'
import { createClient } from '@/lib/supabase/server'
import { STORE_STATUSES } from '@/lib/validations/admin'
import type { StoreStatus } from '@/types/app'

export const metadata: Metadata = { title: 'Tiendas' }
export const dynamic = 'force-dynamic'

const STATUS_FILTERS: { value: StoreStatus | 'todas'; label: string }[] = [
  { value: 'todas', label: 'Todas' },
  { value: 'pending', label: 'En revisión' },
  { value: 'active', label: 'Activas' },
  { value: 'suspended', label: 'Suspendidas' },
]

interface StoresPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function isStoreStatus(value: string | undefined): value is StoreStatus {
  return (STORE_STATUSES as readonly string[]).includes(value ?? '')
}

export default async function AdminStoresPage({
  searchParams,
}: StoresPageProps) {
  await requireRole(['admin'], '/admin/stores')
  const params = await searchParams
  const rawFilter = Array.isArray(params.estado) ? params.estado[0] : params.estado
  const filter = isStoreStatus(rawFilter) ? rawFilter : 'todas'

  const supabase = await createClient()
  let query = supabase
    .from('stores')
    .select(
      'id, name, slug, status, commission_pct, rating_avg, rating_count, created_at, profiles!stores_owner_id_fkey(full_name)',
    )
    .order('created_at', { ascending: false })
  if (filter !== 'todas') query = query.eq('status', filter)
  const { data: stores } = await query

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Tiendas
        </h1>
        <p className="text-muted-foreground text-sm">
          Todas las tiendas registradas en {APP_NAME} y su comisión vigente.
        </p>
      </header>

      <nav aria-label="Filtrar por estado" className="bg-muted rounded-pill inline-flex flex-wrap p-1">
        {STATUS_FILTERS.map((item) => {
          const active = item.value === filter
          const href =
            item.value === 'todas'
              ? '/admin/stores'
              : `/admin/stores?estado=${item.value}`
          return (
            <Link
              key={item.value}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'rounded-pill px-3 py-1.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-background text-foreground shadow-soft'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>

      {stores && stores.length > 0 ? (
        <div className="rounded-card border-border bg-card shadow-soft overflow-x-auto border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tienda</TableHead>
                <TableHead>Propietario</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Comisión</TableHead>
                <TableHead className="text-right">Valoración</TableHead>
                <TableHead className="text-right">Creada</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stores.map((store) => (
                <TableRow key={store.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={storePublicUrl({
                        slug: store.slug,
                        siteUrl: env.NEXT_PUBLIC_SITE_URL,
                        rootDomain: env.NEXT_PUBLIC_ROOT_DOMAIN,
                      })}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
                    >
                      {store.name}
                      <ExternalLinkIcon aria-hidden="true" className="size-3" />
                    </Link>
                    <span className="text-muted-foreground block font-mono text-xs">
                      /{store.slug}
                    </span>
                  </TableCell>
                  <TableCell>{store.profiles?.full_name ?? '—'}</TableCell>
                  <TableCell>
                    <StoreStatusSelect
                      storeId={store.id}
                      status={store.status}
                      storeName={store.name}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <StoreCommissionForm
                      storeId={store.id}
                      commissionPct={Number(store.commission_pct)}
                      storeName={store.name}
                    />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {Number(store.rating_avg ?? 0).toFixed(1)}{' '}
                    <span className="text-muted-foreground text-xs">
                      ({store.rating_count ?? 0})
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-right">
                    {formatDateCO(store.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState
          title="No hay tiendas para este filtro"
          description="Cuando un restaurante se registre aparecerá aquí para su revisión."
        />
      )}
    </div>
  )
}
