import type { Metadata } from 'next'
import {
  CouponsManager,
  type CouponListItem,
} from '@/components/dashboard/loyalty/coupons-manager'
import { LoyaltyForm } from '@/components/dashboard/loyalty/loyalty-form'
import { requireActiveStoreRow } from '@/lib/dashboard/store-context'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Fidelidad' }
export const dynamic = 'force-dynamic'

/**
 * Stamp card and coupons: the two ways a store brings its own customers
 * back. Both are paid by the store, which is why they live here and not in
 * any platform promotion.
 */
export default async function LoyaltyPage() {
  const { store } = await requireActiveStoreRow('/dashboard/fidelidad')
  const supabase = await createClient()

  const [{ data: program }, { data: coupons }, { data: used }] =
    await Promise.all([
      supabase
        .from('loyalty_programs')
        .select(
          'enabled, stamps_required, min_order, reward_label, reward_value',
        )
        .eq('store_id', store.id)
        .maybeSingle(),
      supabase
        .from('coupons')
        .select(
          'id, code, kind, value, min_order, starts_at, ends_at, max_uses, active',
        )
        .eq('store_id', store.id)
        .order('created_at', { ascending: false }),
      // The owner reads its store's orders under RLS; enough to count uses.
      // Paged: one request stops at 1000 rows.
      fetchAllRows((from, to) =>
        supabase
          .from('orders')
          .select('coupon_id')
          .eq('store_id', store.id)
          .not('coupon_id', 'is', null)
          .neq('status', 'cancelled')
          .order('id')
          .range(from, to),
      ),
    ])

  const usesById = new Map<string, number>()
  for (const order of used ?? []) {
    if (order.coupon_id)
      usesById.set(order.coupon_id, (usesById.get(order.coupon_id) ?? 0) + 1)
  }
  const list: CouponListItem[] = (coupons ?? []).map((coupon) => ({
    ...coupon,
    kind: coupon.kind === 'fixed' ? 'fixed' : 'percent',
    value: Number(coupon.value),
    min_order: Number(coupon.min_order),
    uses: usesById.get(coupon.id) ?? 0,
  }))

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Fidelidad
        </h1>
        <p className="text-muted-foreground text-sm text-pretty">
          Haz que tus clientes vuelvan a {store.name}: una tarjeta de sellos
          para los de siempre y cupones para tus promociones.
        </p>
      </header>

      <section
        aria-labelledby="sellos-title"
        className="rounded-card border-border bg-card shadow-soft space-y-4 border p-5"
      >
        <h2 id="sellos-title" className="font-display text-2xl font-semibold">
          Tarjeta de sellos
        </h2>
        <LoyaltyForm
          storeId={store.id}
          initial={{
            enabled: program?.enabled ?? false,
            stampsRequired: program?.stamps_required ?? 8,
            minOrder: Number(program?.min_order ?? 0),
            rewardLabel: program?.reward_label ?? '',
            rewardValue: Number(program?.reward_value ?? 0),
          }}
        />
      </section>

      <section
        aria-labelledby="cupones-title"
        className="rounded-card border-border bg-card shadow-soft space-y-4 border p-5"
      >
        <h2 id="cupones-title" className="font-display text-2xl font-semibold">
          Cupones
        </h2>
        <CouponsManager storeId={store.id} coupons={list} />
      </section>
    </div>
  )
}
