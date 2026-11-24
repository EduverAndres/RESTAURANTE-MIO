import type { Metadata } from 'next'
import { InviteForm } from '@/components/companies/invite-form'
import {
  EditMemberDialog,
  RemoveMemberButton,
  RevokeInvitationButton,
} from '@/components/companies/team-actions'
import { StatusBadge } from '@/components/orders/order-status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  INVITATION_STATE_LABELS,
  invitationState,
} from '@/lib/companies/invitations'
import { requireCompanyMember } from '@/lib/companies/server'
import {
  COMPANY_MEMBER_ROLES,
  COMPANY_ROLE_LABELS,
  type CompanyMemberRole,
} from '@/lib/companies/vocabulary'
import { formatCOP } from '@/lib/format'
import { formatDateCO } from '@/lib/format-date'
import { throwOnQueryError } from '@/lib/supabase/query-error'

export const metadata: Metadata = { title: 'Equipo de la empresa' }
export const dynamic = 'force-dynamic'

const roleOf = (value: string): CompanyMemberRole =>
  (COMPANY_MEMBER_ROLES as readonly string[]).includes(value)
    ? (value as CompanyMemberRole)
    : 'member'

const limit = (value: number | null) =>
  value === null ? 'Sin tope' : formatCOP(Number(value))

export default async function CompanyTeamPage() {
  const { budget, supabase } = await requireCompanyMember('/empresa/equipo', {
    admin: true,
  })
  const [teamResult, invitationsResult] = await Promise.all([
    supabase.rpc('company_team', { p_company_id: budget.companyId }),
    supabase
      .from('company_invitations')
      .select(
        'id, role, monthly_budget, per_order_limit, max_uses, uses, expires_at, revoked_at, created_at',
      )
      .eq('company_id', budget.companyId)
      .order('created_at', { ascending: false })
      .limit(30),
  ])
  throwOnQueryError(teamResult.error, 'company team')
  throwOnQueryError(invitationsResult.error, 'company invitations')

  const team = (teamResult.data ?? []).filter((member) => member.active)
  const now = new Date()
  const invitations = (invitationsResult.data ?? []).map((invitation) => ({
    ...invitation,
    state: invitationState(invitation, now),
  }))
  const open = invitations.filter((invitation) => invitation.state === 'active')

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-h1 font-display font-semibold">Equipo</h1>
        <p className="text-muted-foreground max-w-2xl text-sm text-pretty">
          Invita a tu equipo con un enlace y asígnale un presupuesto mensual y
          un tope por pedido. Cada persona paga sus pedidos con la cuenta de la
          empresa.
        </p>
      </header>

      <div className="gap-card grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        <section
          aria-labelledby="invitar-title"
          className="rounded-card bg-card shadow-1 p-card space-y-4"
        >
          <h2 id="invitar-title" className="font-display text-xl font-semibold">
            Invitar
          </h2>
          <InviteForm
            companyId={budget.companyId}
            companyName={budget.companyName}
          />
        </section>

        <section
          aria-labelledby="enlaces-title"
          className="rounded-card bg-card shadow-1 p-card space-y-4"
        >
          <h2 id="enlaces-title" className="font-display text-xl font-semibold">
            Enlaces activos
          </h2>
          {open.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No hay enlaces abiertos. Los que creas aparecen aquí hasta que
              vencen, se agotan o los revocas.
            </p>
          ) : (
            <ul className="divide-border divide-y">
              {open.map((invitation) => (
                <li
                  key={invitation.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
                >
                  <div className="space-y-0.5">
                    <p className="font-medium">
                      {COMPANY_ROLE_LABELS[roleOf(invitation.role)]} ·{' '}
                      {invitation.uses} de {invitation.max_uses} usos
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Presupuesto {limit(invitation.monthly_budget)} · tope{' '}
                      {limit(invitation.per_order_limit)} · vence{' '}
                      {formatDateCO(invitation.expires_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge
                      label={INVITATION_STATE_LABELS[invitation.state]}
                      tone="success"
                    />
                    <RevokeInvitationButton invitationId={invitation.id} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section aria-labelledby="equipo-title" className="space-y-3">
        <h2 id="equipo-title" className="font-display text-xl font-semibold">
          Personas ({team.length})
        </h2>
        {team.length === 0 ? (
          <EmptyState
            title="Todavía no hay nadie"
            description="Crea un enlace de invitación y compártelo con tu equipo."
          />
        ) : (
          <div className="rounded-card bg-card shadow-1 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Persona</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead className="text-right">Este mes</TableHead>
                  <TableHead className="text-right">Presupuesto</TableHead>
                  <TableHead className="text-right">Tope por pedido</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Acciones</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {team.map((member) => {
                  const name =
                    member.full_name?.trim() || member.email || 'Sin nombre'
                  const person = {
                    memberId: member.member_id,
                    name,
                    role: roleOf(member.role),
                    monthlyBudget:
                      member.monthly_budget === null
                        ? null
                        : Number(member.monthly_budget),
                    perOrderLimit:
                      member.per_order_limit === null
                        ? null
                        : Number(member.per_order_limit),
                  }
                  return (
                    <TableRow key={member.member_id}>
                      <TableCell>
                        <span className="block font-medium">{name}</span>
                        <span className="text-muted-foreground text-xs">
                          {member.email}
                        </span>
                      </TableCell>
                      <TableCell>{COMPANY_ROLE_LABELS[person.role]}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCOP(Number(member.spent_this_month))}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {limit(person.monthlyBudget)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {limit(person.perOrderLimit)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <EditMemberDialog member={person} />
                        <RemoveMemberButton member={person} />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  )
}
