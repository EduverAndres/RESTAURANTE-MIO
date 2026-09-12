import { HeartIcon, LogOutIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { AddressList } from './address-list'
import { ProfileForm } from './profile-form'
import { initialsOf } from '@/lib/format'
import { PushToggle } from '@/components/notifications/push-toggle'
import { OrderStatusBadge } from '@/components/orders/order-status-badge'
import { StoreCard } from '@/components/store/store-card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { requireUser } from '@/lib/auth'
import { pushConfigured } from '@/lib/env.server'
import { formatCOP } from '@/lib/format'
import { ORDER_TYPE_LABELS, ROLE_LABELS } from '@/lib/orders/status'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Mi cuenta' }
export const dynamic = 'force-dynamic'

const dateFormatter = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

export default async function AccountPage() {
  const { user, profile, role } = await requireUser('/account')
  const supabase = await createClient()

  const [{ data: addresses }, { data: orders }, { data: favorites }] =
    await Promise.all([
      supabase
        .from('addresses')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase
        .from('orders')
        .select(
          'id, short_code, status, type, total, created_at, stores(name, slug)',
        )
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('favorites')
        .select(
          'stores(id, slug, name, category, cover_url, rating_avg, rating_count, prep_time_min, delivery_fee, is_open)',
        )
        .eq('user_id', user.id),
    ])

  const displayName =
    profile?.full_name?.trim() || user.email?.split('@')[0] || 'Tu cuenta'
  const favoriteStores = (favorites ?? [])
    .map((row) => row.stores)
    .filter((store): store is NonNullable<typeof store> => store !== null)

  return (
    <div className="container-page space-y-10 py-10">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="size-16">
            {profile?.avatar_url ? (
              <AvatarImage src={profile.avatar_url} alt="" />
            ) : null}
            <AvatarFallback className="bg-primary/12 text-primary text-lg font-semibold">
              {initialsOf(displayName)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              {displayName}
            </h1>
            <p className="text-muted-foreground text-sm">{user.email}</p>
            <Badge variant="secondary" className="rounded-pill mt-1">
              {ROLE_LABELS[role]}
            </Badge>
          </div>
        </div>
        <form action="/auth/sign-out" method="post">
          <Button type="submit" variant="outline" className="rounded-pill">
            <LogOutIcon aria-hidden="true" />
            Cerrar sesión
          </Button>
        </form>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
        <section aria-labelledby="perfil-title" className="space-y-6">
          <div className="space-y-4">
            <h2
              id="perfil-title"
              className="font-display text-2xl font-semibold"
            >
              Datos personales
            </h2>
            <div className="rounded-card border-border bg-card shadow-soft border p-5">
              <ProfileForm
                fullName={profile?.full_name ?? ''}
                phone={profile?.phone ?? ''}
              />
            </div>
          </div>

          <AddressList addresses={addresses ?? []} />

          {pushConfigured() ? (
            <div className="space-y-2">
              <h2 className="font-display text-2xl font-semibold">
                Notificaciones
              </h2>
              <div className="rounded-card border-border bg-card shadow-soft border p-4">
                <PushToggle enabled />
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <h2 className="font-display text-2xl font-semibold">
              Métodos de pago
            </h2>
            <p className="rounded-card border-border bg-card text-muted-foreground shadow-soft border p-4 text-sm">
              Recordamos tu último método de pago y propina en este dispositivo
              para que el siguiente pedido sea de dos toques. Los pagos con
              tarjeta se procesan en el checkout con la pasarela activa.
            </p>
          </div>
        </section>

        <div className="space-y-10">
          <section
            id="pedidos"
            aria-labelledby="pedidos-title"
            className="scroll-mt-24 space-y-4"
          >
            <h2
              id="pedidos-title"
              className="font-display text-2xl font-semibold"
            >
              Mis pedidos
            </h2>
            {orders && orders.length > 0 ? (
              <ul className="space-y-2">
                {orders.map((order) => (
                  <li key={order.id}>
                    <Link
                      href={`/orders/${order.id}`}
                      className="rounded-card border-border bg-card shadow-soft hover:shadow-lift flex flex-wrap items-center justify-between gap-3 border p-4 transition-shadow"
                    >
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 text-sm font-medium">
                          <span className="text-muted-foreground font-mono text-xs">
                            #{order.short_code}
                          </span>
                          <span className="truncate">
                            {order.stores?.name ?? 'Tienda'}
                          </span>
                        </span>
                        <span className="text-muted-foreground block text-xs">
                          {ORDER_TYPE_LABELS[order.type]} ·{' '}
                          {dateFormatter.format(new Date(order.created_at))}
                        </span>
                      </span>
                      <span className="flex items-center gap-3">
                        <OrderStatusBadge status={order.status} />
                        <span className="text-sm font-semibold tabular-nums">
                          {formatCOP(Number(order.total))}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="Todavía no has pedido nada"
                description="Cuando hagas tu primer pedido aparecerá aquí con su estado en tiempo real."
                action={
                  <Button asChild className="rounded-pill">
                    <Link href="/#restaurantes">Explorar restaurantes</Link>
                  </Button>
                }
              />
            )}
          </section>

          <section aria-labelledby="favoritos-title" className="space-y-4">
            <div className="flex items-center gap-2">
              <HeartIcon aria-hidden="true" className="text-primary size-4" />
              <h2
                id="favoritos-title"
                className="font-display text-2xl font-semibold"
              >
                Favoritos
              </h2>
            </div>
            {favoriteStores.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {favoriteStores.map((store) => (
                  <StoreCard
                    key={store.id}
                    store={{ ...store, is_favorite: true }}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title="Sin favoritos por ahora"
                description="Toca el corazón de un restaurante para encontrarlo aquí más rápido."
                className="py-10"
              />
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
