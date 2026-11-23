import {
  ArrowRightIcon,
  Building2Icon,
  ClockIcon,
  LinkIcon,
  ReceiptTextIcon,
  TriangleAlertIcon,
  UsersIcon,
  WalletIcon,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { BillingDialog } from '@/components/companies/billing-dialog'
import { StatusBadge } from '@/components/orders/order-status-badge'
import { Button } from '@/components/ui/button'
import { requireUser } from '@/lib/auth'
import { formatNit } from '@/lib/companies/nit'
import { periodLabel } from '@/lib/companies/period'
import {
  fetchCompany,
  fetchMyCorporateBudget,
  type CorporateBudget,
} from '@/lib/companies/server'
import {
  COMPANY_STATUS_LABELS,
  COMPANY_STATUS_TONES,
} from '@/lib/companies/vocabulary'
import { availableToSpend } from '@/lib/companies/budget'
import { formatCOP } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'
import type { CompanyRow } from '@/types/app'

export const metadata: Metadata = { title: 'Cuenta de empresa' }
export const dynamic = 'force-dynamic'

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'default',
}: {
  icon: typeof WalletIcon
  label: string
  value: string
  hint?: string
  tone?: 'default' | 'alert'
}) {
  return (
    <div className="rounded-card bg-card shadow-1 p-card space-y-2">
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <Icon
          aria-hidden="true"
          className={
            tone === 'alert' ? 'text-destructive size-4' : 'text-primary size-4'
          }
        />
        {label}
      </p>
      <p className="font-display text-2xl font-semibold tabular-nums">
        {value}
      </p>
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </div>
  )
}

/** Why the account cannot be charged today, in words, or nothing. */
function StatusBanner({ budget }: { budget: CorporateBudget }) {
  const message =
    budget.companyStatus === 'pending'
      ? 'Tu empresa está en revisión. Cuando el equipo de Cerquita la apruebe con un cupo, el equipo podrá pedir con la cuenta. Ya puedes invitarlo.'
      : budget.companyStatus === 'suspended'
        ? 'La cuenta está suspendida: por ahora nadie puede pagar con ella. Escríbenos para revisarla.'
        : budget.overdue
          ? 'Hay un estado de cuenta vencido. Mientras no se pague, nadie puede pagar con la cuenta.'
          : null
  if (!message) return null
  return (
    <div
      role="status"
      className="rounded-card bg-accent/15 flex items-start gap-3 p-4 text-sm"
    >
      <TriangleAlertIcon
        aria-hidden="true"
        className="text-accent-strong mt-0.5 size-5 shrink-0"
      />
      <p className="text-pretty">{message}</p>
    </div>
  )
}

function NoCompany() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-h1 font-display font-semibold">
          Cuenta de empresa
        </h1>
        <p className="text-muted-foreground max-w-2xl text-sm text-pretty">
          Tu equipo pide a los restaurantes del barrio y tu empresa paga con un
          solo estado de cuenta al mes.
        </p>
      </header>
      <div className="gap-card grid md:grid-cols-2">
        <section className="rounded-card bg-card shadow-1 p-card space-y-3">
          <span className="rounded-control bg-primary/10 text-primary-on-tint grid size-11 place-items-center">
            <Building2Icon aria-hidden="true" className="size-5" />
          </span>
          <h2 className="font-display text-xl font-semibold">
            Registrar mi empresa
          </h2>
          <p className="text-muted-foreground text-sm text-pretty">
            Con el NIT y los datos de facturación. El equipo de Cerquita revisa
            la solicitud y aprueba el cupo.
          </p>
          <Button asChild className="rounded-pill h-11 px-5">
            <Link href="/empresa/registro">
              Crear cuenta de empresa
              <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
            </Link>
          </Button>
        </section>
        <section className="rounded-card bg-card shadow-1 p-card space-y-3">
          <span className="rounded-control bg-secondary text-foreground grid size-11 place-items-center">
            <LinkIcon aria-hidden="true" className="size-5" />
          </span>
          <h2 className="font-display text-xl font-semibold">¿Te invitaron?</h2>
          <p className="text-muted-foreground text-sm text-pretty">
            Abre el enlace que te envió el administrador de tu empresa, con esta
            misma cuenta, y acepta la invitación.
          </p>
          <Link
            href="/empresas"
            className="text-primary-on-tint inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4"
          >
            Cómo funciona la cuenta de empresa
          </Link>
        </section>
      </div>
    </div>
  )
}

function MemberBudget({ budget }: { budget: CorporateBudget }) {
  const available = availableToSpend(
    { credit_limit: budget.creditAvailable, credit_used: 0 },
    {
      active: true,
      monthly_budget: budget.monthlyBudget,
      per_order_limit: budget.perOrderLimit,
      spent_this_month: budget.spentThisMonth,
    },
  )
  const share =
    budget.monthlyBudget !== null && budget.monthlyBudget > 0
      ? Math.min(100, (budget.spentThisMonth / budget.monthlyBudget) * 100)
      : null

  return (
    <section
      aria-labelledby="presupuesto-title"
      className="rounded-card bg-card shadow-1 p-card space-y-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="presupuesto-title"
          className="font-display text-xl font-semibold"
        >
          Tu presupuesto de {periodLabel(budget.period)}
        </h2>
        <StatusBadge
          label={COMPANY_STATUS_LABELS[budget.companyStatus]}
          tone={COMPANY_STATUS_TONES[budget.companyStatus]}
        />
      </div>
      <div className="space-y-1">
        <p className="text-muted-foreground text-sm">Disponible para pedir</p>
        <p className="text-display font-display font-semibold tabular-nums">
          {formatCOP(budget.companyStatus === 'active' ? available : 0)}
        </p>
      </div>
      {share !== null ? (
        <div className="space-y-1.5">
          <div
            aria-hidden="true"
            className="bg-muted h-2.5 overflow-hidden rounded-full"
          >
            <div
              className="bg-primary h-full rounded-full"
              style={{ width: `${share}%` }}
            />
          </div>
          <p className="text-muted-foreground text-xs">
            Llevas {formatCOP(budget.spentThisMonth)} de{' '}
            {formatCOP(budget.monthlyBudget ?? 0)} este mes.
          </p>
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">
          Llevas {formatCOP(budget.spentThisMonth)} este mes. No tienes un tope
          mensual propio: aplica el cupo de la empresa.
        </p>
      )}
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Tope por pedido</dt>
          <dd className="font-medium">
            {budget.perOrderLimit !== null
              ? formatCOP(budget.perOrderLimit)
              : 'Sin tope'}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">
            Propina que cubre la empresa
          </dt>
          <dd className="font-medium">Hasta {budget.maxTipPct} %</dd>
        </div>
      </dl>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button asChild className="rounded-pill h-11 px-5">
          <Link href="/#restaurantes">
            Pedir ahora
            <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
          </Link>
        </Button>
        <Button asChild variant="outline" className="rounded-pill h-11 px-5">
          <Link href="/empresa/pedidos">Ver pedidos</Link>
        </Button>
      </div>
      <p className="text-muted-foreground text-xs text-pretty">
        Al pagar, elige «Cuenta de empresa». El pedido llega al estado de cuenta
        mensual de tu empresa; tú no pagas nada.
      </p>
    </section>
  )
}

function BillingCard({ company }: { company: CompanyRow }) {
  return (
    <section
      aria-labelledby="facturacion-title"
      className="rounded-card bg-card shadow-1 p-card space-y-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h2
          id="facturacion-title"
          className="font-display text-xl font-semibold"
        >
          Datos de facturación
        </h2>
        <BillingDialog
          defaults={{
            companyId: company.id,
            billingEmail: company.billing_email,
            billingAddress: company.billing_address,
            city: company.city,
            contactName: company.contact_name,
            contactPhone: company.contact_phone,
          }}
        />
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Razón social</dt>
          <dd className="font-medium">{company.legal_name}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">NIT</dt>
          <dd className="font-medium tabular-nums">
            {formatNit(company.nit, company.dv)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Correo para facturas</dt>
          <dd className="font-medium break-all">{company.billing_email}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Dirección</dt>
          <dd className="font-medium">
            {company.billing_address}, {company.city}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Contacto</dt>
          <dd className="font-medium">
            {company.contact_name} · {company.contact_phone}
          </dd>
        </div>
      </dl>
      <p className="text-muted-foreground text-xs text-pretty">
        Cada restaurante factura a nombre de tu empresa. Cerquita te envía un
        estado de cuenta al mes con todos los pedidos.
      </p>
    </section>
  )
}

export default async function CompanyHomePage() {
  await requireUser('/empresa')
  const supabase = await createClient()
  const budget = await fetchMyCorporateBudget(supabase)
  if (!budget) return <NoCompany />

  const isAdmin = budget.role === 'admin'
  const [company, summaryResult] = isAdmin
    ? await Promise.all([
        fetchCompany(supabase, budget.companyId),
        supabase.rpc('company_month_summary', {
          p_company_id: budget.companyId,
          p_period: budget.period,
        }),
      ])
    : [null, null]
  const summary = Array.isArray(summaryResult?.data)
    ? summaryResult.data[0]
    : null

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-h1 font-display font-semibold">
          {isAdmin ? 'Resumen de la cuenta' : 'Tu cuenta de empresa'}
        </h1>
        <p className="text-muted-foreground text-sm">
          {periodLabel(budget.period).replace(/^./, (c) => c.toUpperCase())}
        </p>
      </header>

      <StatusBanner budget={budget} />

      {isAdmin && summary ? (
        <>
          <div className="gap-card grid sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              icon={ReceiptTextIcon}
              label="Consumo del mes"
              value={formatCOP(Number(summary.orders_total))}
              hint={`${summary.orders_count} pedido${Number(summary.orders_count) === 1 ? '' : 's'}`}
            />
            <Stat
              icon={WalletIcon}
              label="Cupo disponible"
              value={formatCOP(
                Math.max(
                  0,
                  Number(summary.credit_limit) - Number(summary.credit_used),
                ),
              )}
              hint={`De ${formatCOP(Number(summary.credit_limit))}`}
            />
            <Stat
              icon={ClockIcon}
              label="Por pagar"
              value={formatCOP(Number(summary.open_balance))}
              hint={
                summary.overdue
                  ? 'Hay un estado de cuenta vencido'
                  : `Plazo de ${company?.payment_terms_days ?? 30} días`
              }
              tone={summary.overdue ? 'alert' : 'default'}
            />
            <Stat
              icon={UsersIcon}
              label="Equipo"
              value={String(summary.members_active)}
              hint="personas activas"
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild className="rounded-pill h-11 px-5">
              <Link href="/empresa/equipo">Invitar al equipo</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="rounded-pill h-11 px-5"
            >
              <Link href="/empresa/estados-de-cuenta">Estados de cuenta</Link>
            </Button>
          </div>
        </>
      ) : null}

      <div className="gap-card grid lg:grid-cols-2 lg:items-start">
        <MemberBudget budget={budget} />
        {company ? <BillingCard company={company} /> : null}
      </div>
    </div>
  )
}
