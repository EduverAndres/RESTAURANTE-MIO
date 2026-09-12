import { ChevronLeftIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { TableCheckoutForm } from './table-checkout-form'
import { getCurrentUser } from '@/lib/auth'
import { tableEntryPath } from '@/lib/tables/qr'
import { fetchTableByToken, listTablePaymentOptions } from '@/lib/tables/server'

export const metadata: Metadata = { title: 'Pedido en mesa' }
export const dynamic = 'force-dynamic'

interface TableCheckoutPageProps {
  params: Promise<{ slug: string; token: string }>
}

/** Public dine-in checkout: no login needed, logged-in customers keep theirs. */
export default async function TableCheckoutPage({
  params,
}: TableCheckoutPageProps) {
  const { slug, token } = await params
  const resolved = await fetchTableByToken(slug, token)
  if (!resolved) notFound()
  const { store, table } = resolved
  const current = await getCurrentUser()

  return (
    <div className="container-page max-w-3xl py-8 lg:py-12">
      <Link
        href={tableEntryPath(slug, token)}
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeftIcon aria-hidden="true" className="size-4" />
        Volver al menú
      </Link>
      <header className="mb-6 space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Mesa {table.number} · {store.name}
        </h1>
        <p className="text-muted-foreground text-sm">
          Confirma tu pedido y lo llevamos a tu mesa. No necesitas crear una
          cuenta.
        </p>
      </header>
      <TableCheckoutForm
        store={{
          id: store.id,
          slug: store.slug,
          name: store.name,
          isOpen: Boolean(store.is_open),
          minOrder: Number(store.min_order ?? 0),
          prepTimeMin: store.prep_time_min ?? 20,
        }}
        table={{ number: table.number, token: table.token }}
        paymentOptions={listTablePaymentOptions()}
        defaultGuestName={current?.profile?.full_name?.trim() ?? ''}
      />
    </div>
  )
}
