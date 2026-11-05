import { ArrowRightIcon, CheckIcon, MinusIcon } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  BASE_COMMISSION_PCT,
  FOUNDER_DAYS,
  ONLINE_PAYMENT_PCT,
  PLAN_IDS,
  PLAN_LABELS,
  type PlanId,
} from '@/lib/plans'
import { monthlyFeeLabel, PLAN_ROWS, planIncludes } from '@/lib/plans-copy'
import { fetchPlanFees } from '@/lib/plans-server'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

const PLAN_PITCH: Record<PlanId, string> = {
  normal: 'Para empezar a vender hoy, sin pagar nada fijo.',
  mediano: 'Para que tu tienda se vea exactamente como tu negocio.',
  vip: 'Para estar arriba en la página principal y no tener límites.',
}

/**
 * Prices, read from `public.plans`, and the commission, read from
 * lib/plans.ts: the same two sources the panel and the payouts use, so the
 * page can never promise a number the platform does not charge.
 */
export async function PlansSection() {
  const fees = await fetchPlanFees(await createClient())
  const online = BASE_COMMISSION_PCT + ONLINE_PAYMENT_PCT

  return (
    <section
      id="planes"
      aria-labelledby="planes-title"
      className="border-border/60 scroll-mt-24 border-t"
    >
      <div className="container-page py-section space-y-10">
        <div className="max-w-2xl space-y-3">
          <p className="text-primary-on-tint text-xs font-semibold tracking-wide uppercase">
            Planes
          </p>
          <h2 id="planes-title" className="text-h1 font-display font-semibold">
            Empieza gratis. Paga solo cuando vendes.
          </h2>
          <p className="text-muted-foreground text-pretty">
            La comisión es la misma en los tres planes. Lo que cambia es cuánto
            puedes personalizar tu tienda y qué tan visible estás.
          </p>
        </div>

        <div className="rounded-card border-border bg-card shadow-1 overflow-x-auto border">
          <table className="w-full text-sm">
            <caption className="sr-only">Comisión por pedido</caption>
            <thead>
              <tr className="text-muted-foreground text-left text-xs">
                <th className="p-4 font-medium">Pedido</th>
                <th className="p-4 text-right font-medium">
                  En efectivo o datáfono
                </th>
                <th className="p-4 text-right font-medium">En línea</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              <tr className="border-border/60 border-t">
                <td className="p-4 font-medium">En la mesa</td>
                <td className="p-4 text-right text-lg font-semibold">0 %</td>
                <td className="p-4 text-right">{ONLINE_PAYMENT_PCT} %</td>
              </tr>
              <tr className="border-border/60 border-t">
                <td className="p-4 font-medium">Domicilio y para recoger</td>
                <td className="p-4 text-right text-lg font-semibold">
                  {BASE_COMMISSION_PCT} %
                </td>
                <td className="p-4 text-right">{online} %</td>
              </tr>
            </tbody>
          </table>
          <p className="text-muted-foreground border-border/60 border-t p-4 text-xs text-pretty">
            Lo que te pagan en línea lleva {ONLINE_PAYMENT_PCT} % más porque
            cubre la pasarela de tarjeta, PSE y Nequi. Sin permanencia.
          </p>
        </div>

        <ul className="gap-card grid lg:grid-cols-3">
          {PLAN_IDS.map((plan) => (
            <li
              key={plan}
              className={cn(
                'rounded-card bg-card p-card flex flex-col gap-5 border',
                plan === 'vip'
                  ? 'border-primary/40 shadow-2'
                  : 'border-border shadow-1',
              )}
            >
              <div className="space-y-1">
                <h3 className="font-display text-2xl font-semibold">
                  {PLAN_LABELS[plan]}
                </h3>
                <p className="text-h3 font-semibold tabular-nums">
                  {monthlyFeeLabel(fees[plan])}
                </p>
                <p className="text-muted-foreground text-sm text-pretty">
                  {PLAN_PITCH[plan]}
                </p>
              </div>
              <ul className="flex-1 space-y-2 text-sm">
                {PLAN_ROWS.map((row) => {
                  const included = planIncludes(plan, row)
                  return (
                    <li
                      key={row.label}
                      className={cn(
                        'flex items-start gap-2',
                        !included && 'text-muted-foreground',
                      )}
                    >
                      {included ? (
                        <CheckIcon
                          aria-hidden="true"
                          className="text-success-on-tint mt-0.5 size-4 shrink-0"
                        />
                      ) : (
                        <MinusIcon
                          aria-hidden="true"
                          className="mt-0.5 size-4 shrink-0"
                        />
                      )}
                      <span>
                        <span className="sr-only">
                          {included ? 'Incluido: ' : 'No incluido: '}
                        </span>
                        {row.label}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </li>
          ))}
        </ul>

        <div className="rounded-card bg-primary/10 flex flex-wrap items-center justify-between gap-4 p-5">
          <p className="max-w-2xl text-sm text-pretty">
            <strong>Negocios fundadores:</strong> los primeros negocios en
            unirse tienen {FOUNDER_DAYS} días de VIP gratis y 0 % de comisión.
            El {ONLINE_PAYMENT_PCT} % de los pagos en línea sí aplica.
          </p>
          <Button asChild className="rounded-pill">
            <Link href="/register?role=merchant">
              Crear mi tienda
              <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
