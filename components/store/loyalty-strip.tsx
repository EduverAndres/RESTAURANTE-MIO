import { GiftIcon } from 'lucide-react'
import Link from 'next/link'
import { loyaltyCard } from '@/lib/orders/discounts-server'
import { createClient } from '@/lib/supabase/server'

/**
 * The store's stamp card, under the store header. A signed-in customer sees
 * their own count; anyone else sees the offer and a way in. Nothing renders
 * when the store has no active card. Painted with the store's tokens: this
 * is the store's programme, not the platform's.
 */
export async function LoyaltyStrip({
  storeId,
  storeSlug,
}: {
  storeId: string
  storeSlug: string
}) {
  const supabase = await createClient()
  const [{ data: program }, { data: auth }] = await Promise.all([
    supabase
      .from('loyalty_programs')
      .select('enabled, stamps_required, reward_label, reward_value')
      .eq('store_id', storeId)
      .maybeSingle(),
    supabase.auth.getUser(),
  ])
  if (!program?.enabled || Number(program.reward_value) <= 0) return null

  const card = auth.user
    ? await loyaltyCard(supabase, storeId, auth.user.id).catch(() => null)
    : null

  let text: React.ReactNode
  if (card && card.available > 0) {
    text = (
      <>
        <strong>Tienes un premio:</strong> {card.rewardLabel}. Úsalo al pagar.
      </>
    )
  } else if (card) {
    text = (
      <>
        Llevas <strong className="tabular-nums">{card.stamps}</strong> de{' '}
        {card.required} sellos. Con {card.required} te regalan{' '}
        {card.rewardLabel}.
      </>
    )
  } else {
    text = (
      <>
        Cada {program.stamps_required} pedidos te regalan {program.reward_label}
        .{' '}
        <Link
          href={`/login?next=${encodeURIComponent(`/t/${storeSlug}`)}`}
          className="store-link"
        >
          Inicia sesión para sumar sellos
        </Link>
      </>
    )
  }

  return (
    <div className="container-page pt-3">
      <p className="store-chip inline-flex items-center gap-2 px-3 py-1.5 text-sm">
        <GiftIcon aria-hidden="true" className="size-4 shrink-0" />
        <span>{text}</span>
      </p>
    </div>
  )
}
