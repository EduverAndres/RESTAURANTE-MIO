import { CheckIcon, MinusIcon, SparklesIcon } from 'lucide-react'
import { formatDateCO } from '@/lib/format-date'
import { supportWhatsAppUrl } from '@/lib/marketplace/support'
import {
  effectivePlan,
  isFounderActive,
  isPlanId,
  PLAN_LABELS,
  planHas,
  type PlanId,
} from '@/lib/plans'
import {
  monthlyFeeLabel,
  nextPlan,
  PLAN_ROWS,
  planIncludes,
} from '@/lib/plans-copy'

export interface PlanCardStore {
  name: string
  plan: string
  founder_until: string | null
  commission_pct: number
  online_payment_pct: number
}

/** A date-only value read at local noon, so no time zone moves its day. */
function dateLabel(dateOnly: string): string {
  return formatDateCO(new Date(`${dateOnly}T12:00:00`))
}

/**
 * The merchant's plan and exactly what it costs, in their panel. The partner
 * terms say rates are "las que se le informen en su panel": this is that
 * place, so every number here is read from the store row and the plans
 * table, never typed in.
 */
export function PlanCard({
  store,
  fees,
}: {
  store: PlanCardStore
  fees: Record<PlanId, number>
}) {
  const stored: PlanId = isPlanId(store.plan) ? store.plan : 'normal'
  const founder = isFounderActive(store.founder_until)
  const plan = effectivePlan({
    plan: stored,
    founder_until: store.founder_until,
  })
  const online = Number(store.online_payment_pct)
  const base = founder ? 0 : Number(store.commission_pct)
  const upgrade = founder ? null : nextPlan(plan)
  const upgradeUrl = upgrade
    ? supportWhatsAppUrl(
        `Hola, quiero pasar ${store.name} al plan ${PLAN_LABELS[upgrade]}.`,
      )
    : null
  // Priority support is a line, not a separate system: the "[VIP]" tag is
  // what tells whoever answers the WhatsApp to take this one first.
  const prioritySupportUrl = planHas(plan, 'priority-support')
    ? supportWhatsAppUrl(`[VIP] Hola, soy de ${store.name} y necesito ayuda.`)
    : null

  return (
    <section
      aria-labelledby="plan-title"
      className="rounded-card border-border bg-card shadow-soft space-y-5 border p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Tu plan
          </p>
          <h2 id="plan-title" className="font-display text-2xl font-semibold">
            {PLAN_LABELS[plan]}
          </h2>
          <p className="text-muted-foreground text-sm">
            {founder && store.founder_until
              ? `Negocio fundador: VIP y sin comisión hasta el ${dateLabel(store.founder_until)}. Después sigues en ${PLAN_LABELS[stored]} (${monthlyFeeLabel(fees[stored]).toLowerCase()}).`
              : `Mensualidad: ${monthlyFeeLabel(fees[plan]).toLowerCase()}.`}
          </p>
        </div>
        {founder ? (
          <span className="rounded-pill bg-primary/10 text-primary-on-tint inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium">
            <SparklesIcon aria-hidden="true" className="size-3.5" />
            Fundador
          </span>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Comisión por pedido</caption>
          <thead>
            <tr className="text-muted-foreground text-left text-xs">
              <th className="py-1 pr-4 font-medium">Pedido</th>
              <th className="py-1 pr-4 text-right font-medium">
                En efectivo o datáfono
              </th>
              <th className="py-1 text-right font-medium">En línea</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            <tr className="border-border/60 border-t">
              <td className="py-2 pr-4">En la mesa</td>
              <td className="py-2 pr-4 text-right">0 %</td>
              <td className="py-2 text-right">{online} %</td>
            </tr>
            <tr className="border-border/60 border-t">
              <td className="py-2 pr-4">Domicilio y para recoger</td>
              <td className="py-2 pr-4 text-right">{base} %</td>
              <td className="py-2 text-right">{base + online} %</td>
            </tr>
          </tbody>
        </table>
        <p className="text-muted-foreground mt-2 text-xs text-pretty">
          El {online} % en línea cubre lo que cobra la pasarela por tarjeta, PSE
          o Nequi. Sin permanencia: puedes cambiar de plan cuando quieras.
        </p>
      </div>

      <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
        {PLAN_ROWS.map((row) => {
          const included = planIncludes(plan, row)
          return (
            <li
              key={row.label}
              className={
                included
                  ? 'flex items-start gap-2'
                  : 'text-muted-foreground flex items-start gap-2'
              }
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

      {prioritySupportUrl ? (
        <p className="text-sm">
          Soporte prioritario:{' '}
          <a
            href={prioritySupportUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-on-tint font-medium underline-offset-4 hover:underline"
          >
            escríbenos por WhatsApp
          </a>
          , te respondemos primero.
        </p>
      ) : null}

      {upgrade ? (
        <p className="text-sm">
          ¿Quieres más? El plan {PLAN_LABELS[upgrade]} cuesta{' '}
          {monthlyFeeLabel(fees[upgrade]).toLowerCase()}.{' '}
          {upgradeUrl ? (
            <a
              href={upgradeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-on-tint font-medium underline-offset-4 hover:underline"
            >
              Escríbenos por WhatsApp para cambiarte
            </a>
          ) : (
            'Escríbenos para cambiarte.'
          )}
        </p>
      ) : null}
    </section>
  )
}
