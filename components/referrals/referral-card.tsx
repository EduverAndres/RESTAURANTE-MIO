import { GiftIcon } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { CopyLink } from '@/components/referrals/copy-link'
import { env } from '@/lib/env'
import { formatCOP } from '@/lib/format'
import { formatDateCO } from '@/lib/format-date'
import { openCredits } from '@/lib/orders/discounts-server'
import { referralLink } from '@/lib/referrals'
import type { Database } from '@/types/database'

/**
 * "Invita a un vecino": the customer's link, the deal in one sentence, and
 * the credits they can spend. Cerquita pays these credits; the store is
 * settled on its full sale. Renders nothing if the programme's tables are
 * not there yet.
 */
export async function ReferralCard({
  supabase,
  userId,
}: {
  supabase: SupabaseClient<Database>
  userId: string
}) {
  const [codeResult, settingsResult, credits] = await Promise.all([
    supabase.rpc('ensure_referral_code'),
    supabase
      .from('platform_settings')
      .select('referral_amount, referral_min_order, referral_monthly_budget')
      .maybeSingle(),
    openCredits(supabase, userId).catch(() => []),
  ])
  const code = codeResult.data
  const settings = settingsResult.data
  if (!code || !settings || Number(settings.referral_monthly_budget) <= 0) {
    return null
  }
  const amount = formatCOP(Number(settings.referral_amount))
  const minOrder = formatCOP(Number(settings.referral_min_order))

  return (
    <section aria-labelledby="invita-title" className="space-y-4">
      <div className="flex items-center gap-2">
        <GiftIcon aria-hidden="true" className="text-primary size-4" />
        <h2 id="invita-title" className="font-display text-2xl font-semibold">
          Invita a un vecino
        </h2>
      </div>
      <p className="text-muted-foreground text-sm text-pretty">
        Comparte tu enlace. Quien se registre con él tiene {amount} en su primer
        pedido desde {minOrder}, y tú recibes {amount} cuando se lo entreguen.
        Los créditos los pone Cerquita.
      </p>
      <CopyLink
        value={referralLink(env.NEXT_PUBLIC_SITE_URL, code)}
        label="Tu enlace para invitar"
      />
      {credits.length > 0 ? (
        <ul className="space-y-1.5 text-sm">
          {credits.map((credit) => (
            <li key={credit.id} className="flex justify-between gap-3">
              <span>
                Crédito de {formatCOP(credit.amount)} para pedidos desde{' '}
                {formatCOP(credit.min_order)}
              </span>
              <span className="text-muted-foreground shrink-0 text-xs">
                hasta el {formatDateCO(credit.expires_at)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
