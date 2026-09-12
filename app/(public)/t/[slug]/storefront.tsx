import {
  ClockIcon,
  MapPinIcon,
  StarIcon,
  TruckIcon,
  UtensilsIcon,
} from 'lucide-react'
import Image from 'next/image'
import { Suspense, type CSSProperties } from 'react'
import { StoreMenu } from '@/components/store/store-menu'
import { TableContextSetter } from '@/components/store/table-context-setter'
import { Skeleton } from '@/components/ui/skeleton'
import type { CartTable } from '@/lib/cart'
import { formatCOP } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'
import { mergeTheme, themeToCssVars } from '@/lib/theme'
import type { MenuCategoryWithProducts, Store } from '@/types/app'

// Server rendering shared by /t/[slug] (regular storefront) and
// /t/[slug]/mesa/[token] (same storefront tagged with a table).

export async function fetchStore(slug: string): Promise<Store | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('stores')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'active')
    .maybeSingle()
  return data ?? null
}

async function fetchMenu(storeId: string): Promise<MenuCategoryWithProducts[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('menu_categories')
    .select('*, products(*, product_options(*, product_option_values(*)))')
    .eq('store_id', storeId)
    .eq('is_visible', true)
    .eq('products.is_available', true)
    .order('position', { ascending: true })
    .order('position', { referencedTable: 'products', ascending: true })

  if (error) {
    console.error('Failed to load menu', error)
    return []
  }
  return (data ?? []).filter((category) => category.products.length > 0)
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="shadow-soft rounded-[var(--store-radius)] bg-[var(--store-surface)] p-3 ring-1 ring-[rgb(var(--store-text-rgb)/0.06)]">
      <dt className="flex items-center gap-1.5 text-xs text-[rgb(var(--store-text-rgb)/0.6)]">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 text-lg font-semibold">{value}</dd>
    </div>
  )
}

async function StoreMenuSection({
  store,
  table,
}: {
  store: Store
  table: CartTable | null
}) {
  const categories = await fetchMenu(store.id)
  return (
    <StoreMenu
      store={{
        id: store.id,
        slug: store.slug,
        name: store.name,
        isOpen: Boolean(store.is_open),
        minOrder: store.min_order === null ? null : Number(store.min_order),
      }}
      categories={categories}
      table={table}
    />
  )
}

function MenuSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-8">
      <div className="flex gap-2 py-3">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="rounded-pill h-8 w-24" />
        ))}
      </div>
      <Skeleton className="h-9 w-48" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton
            key={index}
            className="h-28 rounded-[var(--store-radius)] sm:h-64"
          />
        ))}
      </div>
    </div>
  )
}

function TableBanner({ number }: { number: number }) {
  return (
    <div
      role="status"
      className="sticky top-0 z-30 flex items-center justify-center gap-2 bg-[var(--store-primary)] px-4 py-2.5 text-sm font-medium text-white"
    >
      <UtensilsIcon aria-hidden="true" className="size-4" />
      Estás pidiendo desde la mesa {number}
    </div>
  )
}

interface StorefrontProps {
  store: Store
  /** Present when the visitor arrived through a table QR code. */
  table?: CartTable | null
}

export function Storefront({ store, table = null }: StorefrontProps) {
  const theme = mergeTheme(store.theme)
  const bannerUrl = theme.banner.imageUrl ?? store.cover_url
  const logoUrl = theme.logoUrl ?? store.logo_url
  const overlay = theme.banner.overlayOpacity

  return (
    <div
      data-store-theme
      style={themeToCssVars(theme) as CSSProperties}
      className="min-h-dvh bg-[var(--store-background)] font-[family-name:var(--store-font-body)] text-[var(--store-text)]"
    >
      {table ? (
        <>
          <TableBanner number={table.number} />
          <TableContextSetter
            storeId={store.id}
            storeSlug={store.slug}
            table={table}
          />
        </>
      ) : null}

      <section className="relative isolate overflow-hidden">
        <div className="relative h-[42vh] min-h-[280px] w-full sm:h-[48vh]">
          {bannerUrl ? (
            <Image
              src={bannerUrl}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-[var(--store-primary)]" />
          )}
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background: `linear-gradient(to top, rgb(0 0 0 / ${Math.min(overlay + 0.35, 0.95)}), rgb(0 0 0 / ${overlay}) 45%, rgb(0 0 0 / ${Math.max(overlay - 0.25, 0)}))`,
            }}
          />
        </div>

        <div className="container-page relative -mt-24 pb-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
            <div className="shadow-lift relative size-24 shrink-0 overflow-hidden rounded-[var(--store-radius)] bg-[var(--store-surface)] ring-4 ring-[var(--store-background)] sm:size-28">
              {logoUrl ? (
                <Image
                  src={logoUrl}
                  alt={`Logo de ${store.name}`}
                  fill
                  sizes="112px"
                  className="object-cover"
                />
              ) : (
                <span className="flex size-full items-center justify-center font-[family-name:var(--store-font-display)] text-4xl font-semibold text-[var(--store-primary)]">
                  {store.name.charAt(0)}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-2 sm:pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-pill bg-[rgb(var(--store-primary-rgb)/0.14)] px-2.5 py-0.5 text-xs font-medium text-[var(--store-primary)]">
                  {store.category ?? 'Restaurante'}
                </span>
                <span
                  className={
                    store.is_open
                      ? 'rounded-pill bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300'
                      : 'rounded-pill bg-[rgb(var(--store-text-rgb)/0.08)] px-2.5 py-0.5 text-xs font-medium'
                  }
                >
                  {store.is_open ? 'Abierto' : 'Cerrado'}
                </span>
              </div>
              <h1 className="font-[family-name:var(--store-font-display)] text-4xl leading-none font-semibold tracking-tight text-[var(--store-text)] sm:text-5xl">
                {store.name}
              </h1>
              {store.description ? (
                <p className="max-w-2xl text-base text-[rgb(var(--store-text-rgb)/0.72)]">
                  {store.description}
                </p>
              ) : null}
            </div>
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              icon={
                <StarIcon
                  aria-hidden="true"
                  className="size-3.5 text-[var(--store-accent)]"
                />
              }
              label="Valoración"
              value={
                <>
                  {Number(store.rating_avg ?? 0).toFixed(1)}
                  <span className="text-sm font-normal text-[rgb(var(--store-text-rgb)/0.6)]">
                    {' '}
                    ({store.rating_count ?? 0})
                  </span>
                </>
              }
            />
            <StatCard
              icon={<ClockIcon aria-hidden="true" className="size-3.5" />}
              label="Preparación"
              value={`${store.prep_time_min ?? 20} min`}
            />
            <StatCard
              icon={<TruckIcon aria-hidden="true" className="size-3.5" />}
              label="Domicilio"
              value={formatCOP(Number(store.delivery_fee ?? 0))}
            />
            <StatCard
              icon={<MapPinIcon aria-hidden="true" className="size-3.5" />}
              label="Pedido mínimo"
              value={formatCOP(Number(store.min_order ?? 0))}
            />
          </dl>
        </div>
      </section>

      <section className="container-page pb-32" aria-labelledby="menu-title">
        <h2 id="menu-title" className="sr-only">
          Menú de {store.name}
        </h2>
        {/* The hero resolves before the shell is flushed so a missing store
            yields a real 404 status; only the menu streams in. */}
        <Suspense fallback={<MenuSkeleton />}>
          <StoreMenuSection store={store} table={table} />
        </Suspense>
      </section>
    </div>
  )
}
