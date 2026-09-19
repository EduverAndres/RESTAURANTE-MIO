import {
  BarChart3Icon,
  LandmarkIcon,
  StoreIcon,
  TriangleAlertIcon,
  UsersIcon,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { APP_NAME } from '@/lib/env'
import {
  countActionable,
  fetchStuckPaymentEvents,
} from '@/lib/payments/stuck-events'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Resumen' }
export const dynamic = 'force-dynamic'

interface OverviewCard {
  label: string
  href: string
  icon: typeof StoreIcon
  value: string
  hint: string
  /**
   * Paints the card as a problem rather than a statistic. A stuck payment is
   * money the customer already handed over, so the card has to read
   * differently from "how many users are registered".
   */
  alert?: boolean
}

export default async function AdminOverviewPage() {
  await requireRole(['admin'], '/admin')
  const supabase = await createClient()

  const [
    storesResult,
    pendingStoresResult,
    usersResult,
    pendingPayoutsResult,
    stuckEvents,
  ] = await Promise.all([
      supabase.from('stores').select('id', { count: 'exact', head: true }),
      supabase
        .from('stores')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase
        .from('payouts')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
      fetchStuckPaymentEvents(),
    ])

  // Actionable is counted over the rows the screen actually shows (the query
  // is capped), so it reads "at least this many". `total` is not capped, so
  // the hint can name the real size of the backlog rather than implying the
  // capped list is all of it.
  const stuck = countActionable(stuckEvents.rows)

  const cards: OverviewCard[] = [
    {
      label: 'Tiendas',
      href: '/admin/stores',
      icon: StoreIcon,
      value: String(storesResult.count ?? 0),
      hint: `${pendingStoresResult.count ?? 0} en revisión`,
    },
    {
      label: 'Usuarios',
      href: '/admin/users',
      icon: UsersIcon,
      value: String(usersResult.count ?? 0),
      hint: 'Personas registradas',
    },
    {
      label: 'Liquidaciones',
      href: '/admin/payouts',
      icon: LandmarkIcon,
      value: String(pendingPayoutsResult.count ?? 0),
      hint: 'Pendientes de pago',
    },
    {
      label: 'Pagos sin aplicar',
      href: '/admin/payments',
      icon: TriangleAlertIcon,
      value: String(stuck),
      hint:
        stuckEvents.total === 0
          ? 'Todo conciliado'
          : `${stuckEvents.total} sin aplicar en total`,
      alert: stuck > 0 || stuckEvents.truncated,
    },
    {
      label: 'Métricas',
      href: '/admin/metrics',
      icon: BarChart3Icon,
      value: '→',
      hint: 'Pedidos, GMV y comisión',
    },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Resumen
        </h1>
        <p className="text-muted-foreground text-sm">
          Vista general de {APP_NAME} para administrar tiendas, usuarios y
          liquidaciones.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className={cn(
              'rounded-card border-border bg-card shadow-soft hover:border-primary/40 block space-y-3 border p-5 transition-colors',
              card.alert &&
                'border-destructive/50 bg-destructive/6 hover:border-destructive',
            )}
          >
            <card.icon
              aria-hidden="true"
              className={cn(
                'size-5',
                card.alert ? 'text-destructive' : 'text-primary',
              )}
            />
            <div>
              <p
                className={cn(
                  'font-display text-3xl font-semibold',
                  card.alert && 'text-destructive-on-tint',
                )}
              >
                {card.value}
              </p>
              <p className="text-sm font-medium">{card.label}</p>
              <p className="text-muted-foreground text-xs">{card.hint}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
