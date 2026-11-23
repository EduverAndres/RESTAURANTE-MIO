import { Building2Icon } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { JoinCompanyButton } from '@/components/companies/join-button'
import { Button } from '@/components/ui/button'
import { requireUser } from '@/lib/auth'
import {
  INVITATION_OUTCOME_MESSAGES,
  isInvitationTokenShape,
  type InvitationOutcome,
} from '@/lib/companies/invitations'
import { COMPANY_ROLE_LABELS } from '@/lib/companies/vocabulary'
import { formatCOP } from '@/lib/format'
import { formatDateCO } from '@/lib/format-date'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Invitación a una cuenta de empresa',
  // The link is a credential: keep it out of search results and referrers.
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}
export const dynamic = 'force-dynamic'

/**
 * Where an invitation link lands. The middleware already asked for a session
 * (and brings the person back here after signing in); this shows what the
 * link offers and lets them accept it with one tap.
 */
export default async function JoinCompanyPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  await requireUser(`/empresa/unirse/${token}`)

  let outcome: InvitationOutcome = 'not_found'
  let offer: {
    company_name: string
    role: string
    monthly_budget: number | null
    per_order_limit: number | null
    expires_at: string
  } | null = null
  if (isInvitationTokenShape(token)) {
    const supabase = await createClient()
    const { data } = await supabase.rpc('peek_company_invitation', {
      p_token: token,
    })
    const row = Array.isArray(data) ? data[0] : null
    if (row) {
      outcome = row.outcome as InvitationOutcome
      offer = row.company_name ? row : null
    }
  }

  if (outcome !== 'ok' || !offer) {
    return (
      <div className="rounded-card bg-card shadow-1 p-card mx-auto max-w-xl space-y-4">
        <h1 className="text-h2 font-display font-semibold">
          {outcome === 'already_member'
            ? 'Ya tienes una cuenta de empresa'
            : 'Esta invitación no está disponible'}
        </h1>
        <p className="text-muted-foreground text-pretty">
          {outcome === 'ok'
            ? INVITATION_OUTCOME_MESSAGES.not_found
            : INVITATION_OUTCOME_MESSAGES[outcome]}
        </p>
        <Button asChild variant="outline" className="rounded-pill h-11 px-5">
          <Link href="/empresa">Ir a la cuenta de empresa</Link>
        </Button>
      </div>
    )
  }

  const role = offer.role === 'admin' ? 'admin' : 'member'
  return (
    <div className="rounded-card bg-card shadow-2 p-card mx-auto max-w-xl space-y-6">
      <div className="space-y-3">
        <span className="rounded-control bg-primary/10 text-primary-on-tint grid size-12 place-items-center">
          <Building2Icon aria-hidden="true" className="size-6" />
        </span>
        <h1 className="text-h2 font-display font-semibold text-balance">
          {offer.company_name} te invita a pedir con su cuenta
        </h1>
        <p className="text-muted-foreground text-pretty">
          Pide a los restaurantes de Cerquita y paga con la cuenta de la
          empresa: tú no pagas nada y el pedido llega a su estado de cuenta
          mensual.
        </p>
      </div>
      <dl className="rounded-card bg-muted/60 grid gap-3 p-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Rol</dt>
          <dd className="font-medium">{COMPANY_ROLE_LABELS[role]}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Presupuesto mensual</dt>
          <dd className="font-medium">
            {offer.monthly_budget === null
              ? 'El cupo de la empresa'
              : formatCOP(Number(offer.monthly_budget))}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Tope por pedido</dt>
          <dd className="font-medium">
            {offer.per_order_limit === null
              ? 'Sin tope'
              : formatCOP(Number(offer.per_order_limit))}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">El enlace vence</dt>
          <dd className="font-medium">{formatDateCO(offer.expires_at)}</dd>
        </div>
      </dl>
      <div className="space-y-3">
        <JoinCompanyButton token={token} companyName={offer.company_name} />
        <p className="text-muted-foreground text-xs text-pretty">
          Al unirte aceptas los{' '}
          <Link
            href="/terminos-empresas"
            className="text-primary-on-tint underline underline-offset-2"
          >
            Términos para Empresas
          </Link>
          . Tu empresa verá los pedidos que pagues con su cuenta: restaurante,
          valor y motivo.
        </p>
      </div>
    </div>
  )
}
