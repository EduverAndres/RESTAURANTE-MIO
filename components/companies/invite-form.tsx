'use client'

import {
  CheckIcon,
  CopyIcon,
  LinkIcon,
  LoaderCircleIcon,
  MessageCircleIcon,
} from 'lucide-react'
import { useId, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { createInvitation } from '@/app/(protected)/empresa/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  INVITATION_DEFAULT_DAYS,
  INVITATION_MAX_USES,
} from '@/lib/companies/invitations'
import {
  COMPANY_ROLE_LABELS,
  COMPANY_MEMBER_ROLES,
  type CompanyMemberRole,
} from '@/lib/companies/vocabulary'
import { cn } from '@/lib/utils'
import { parsePesosInput } from '@/lib/validations/companies'

const EXPIRY_OPTIONS = [1, 7, 15, 30] as const

/**
 * Opens a join link with the budget the people who use it will get. The link
 * is shown once — the database keeps only its hash — with a copy button and
 * a WhatsApp share, the way teams here actually pass things around.
 */
export function InviteForm({
  companyId,
  companyName,
}: {
  companyId: string
  companyName: string
}) {
  const id = useId()
  const [pending, startTransition] = useTransition()
  const [role, setRole] = useState<CompanyMemberRole>('member')
  const [budget, setBudget] = useState('')
  const [cap, setCap] = useState('')
  const [uses, setUses] = useState('1')
  const [days, setDays] = useState<number>(INVITATION_DEFAULT_DAYS)
  const [error, setError] = useState<string | null>(null)
  const [link, setLink] = useState<{ url: string; whatsappUrl: string } | null>(
    null,
  )
  const [copied, setCopied] = useState(false)

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await createInvitation(
        {
          companyId,
          role,
          monthlyBudget: parsePesosInput(budget),
          perOrderLimit: parsePesosInput(cap),
          maxUses: Number(uses),
          expiresDays: days,
        },
        companyName,
      )
      if (!result.ok) {
        setError(result.error)
        toast.error(result.error)
        return
      }
      setLink({ url: result.url, whatsappUrl: result.whatsappUrl })
      setCopied(false)
      toast.success('Enlace de invitación listo.')
    })
  }

  async function copy() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link.url)
      setCopied(true)
      toast.success('Enlace copiado.')
    } catch {
      toast.error('No pudimos copiarlo. Selecciónalo y cópialo a mano.')
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={submit} noValidate className="space-y-4">
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Rol</legend>
          <div role="radiogroup" className="grid grid-cols-2 gap-2">
            {COMPANY_MEMBER_ROLES.map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={role === value}
                onClick={() => setRole(value)}
                className={cn(
                  'rounded-control border-border flex h-11 items-center justify-center border text-sm font-medium transition-colors',
                  role === value
                    ? 'border-primary bg-primary/10 text-primary-on-tint'
                    : 'hover:bg-muted',
                )}
              >
                {COMPANY_ROLE_LABELS[value]}
              </button>
            ))}
          </div>
          <p className="text-muted-foreground text-xs">
            {role === 'admin'
              ? 'Un administrador también invita, ajusta presupuestos y ve los estados de cuenta.'
              : 'Un empleado pide con la cuenta y ve sus propios pedidos.'}
          </p>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-budget`}>
              Presupuesto mensual por persona{' '}
              <span className="text-muted-foreground font-normal">
                (opcional)
              </span>
            </Label>
            <Input
              id={`${id}-budget`}
              inputMode="numeric"
              placeholder="300.000"
              value={budget}
              onChange={(event) => setBudget(event.target.value)}
              className="rounded-control h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-cap`}>
              Tope por pedido{' '}
              <span className="text-muted-foreground font-normal">
                (opcional)
              </span>
            </Label>
            <Input
              id={`${id}-cap`}
              inputMode="numeric"
              placeholder="60.000"
              value={cap}
              onChange={(event) => setCap(event.target.value)}
              className="rounded-control h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-uses`}>Personas que pueden usarlo</Label>
            <Input
              id={`${id}-uses`}
              type="number"
              min={1}
              max={INVITATION_MAX_USES}
              value={uses}
              onChange={(event) => setUses(event.target.value)}
              className="rounded-control h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-days`}>Vence en</Label>
            <select
              id={`${id}-days`}
              value={days}
              onChange={(event) => setDays(Number(event.target.value))}
              className="border-input bg-background rounded-control h-11 w-full border px-3 text-sm"
            >
              {EXPIRY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option === 1 ? '1 día' : `${option} días`}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-muted-foreground text-xs text-pretty">
          Sin presupuesto ni tope, la persona puede pedir hasta el cupo
          disponible de la empresa.
        </p>

        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}

        <Button
          type="submit"
          disabled={pending}
          className="rounded-pill h-11 px-5"
        >
          {pending ? (
            <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
          ) : (
            <LinkIcon aria-hidden="true" />
          )}
          Crear enlace de invitación
        </Button>
      </form>

      {link ? (
        <div role="status" className="rounded-card bg-success/10 space-y-3 p-4">
          <Label htmlFor={`${id}-link`} className="text-sm font-semibold">
            Enlace de invitación
          </Label>
          <Input
            id={`${id}-link`}
            readOnly
            value={link.url}
            onFocus={(event) => event.currentTarget.select()}
            className="rounded-control bg-card h-11 font-mono text-xs"
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={copy}
              className="rounded-pill h-11"
            >
              {copied ? (
                <CheckIcon aria-hidden="true" />
              ) : (
                <CopyIcon aria-hidden="true" />
              )}
              {copied ? 'Copiado' : 'Copiar enlace'}
            </Button>
            <Button asChild className="rounded-pill h-11">
              <a
                href={link.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircleIcon aria-hidden="true" />
                Compartir por WhatsApp
              </a>
            </Button>
          </div>
          <p className="text-muted-foreground text-xs text-pretty">
            Por seguridad solo lo mostramos ahora. Si lo pierdes, crea otro y
            revoca este.
          </p>
        </div>
      ) : null}
    </div>
  )
}
