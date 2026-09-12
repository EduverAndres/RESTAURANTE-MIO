import type { Metadata } from 'next'
import { CheckoutForm } from './checkout-form'
import { requireUser } from '@/lib/auth'
import { listPaymentOptions } from '@/lib/payments'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Pagar' }
export const dynamic = 'force-dynamic'

export default async function CheckoutPage() {
  const { user } = await requireUser('/checkout')
  const supabase = await createClient()
  const { data: addresses } = await supabase
    .from('addresses')
    .select('*')
    .eq('user_id', user.id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })

  return (
    <div className="container-page py-8 lg:py-12">
      <header className="mb-6 space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Finalizar pedido
        </h1>
        <p className="text-muted-foreground text-sm">
          Revisa la entrega, elige cómo pagar y confirma. Guardamos tus
          preferencias para la próxima vez.
        </p>
      </header>
      <CheckoutForm
        addresses={addresses ?? []}
        paymentOptions={listPaymentOptions()}
      />
    </div>
  )
}
