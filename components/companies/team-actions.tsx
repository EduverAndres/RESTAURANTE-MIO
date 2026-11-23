'use client'

import { LoaderCircleIcon, PencilIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useId, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  revokeInvitation,
  updateMember,
} from '@/app/(protected)/empresa/actions'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  COMPANY_MEMBER_ROLES,
  COMPANY_ROLE_LABELS,
  type CompanyMemberRole,
} from '@/lib/companies/vocabulary'
import { parsePesosInput } from '@/lib/validations/companies'

export interface TeamMember {
  memberId: string
  name: string
  role: CompanyMemberRole
  monthlyBudget: number | null
  perOrderLimit: number | null
}

const pesos = (value: number | null) =>
  value === null ? '' : value.toLocaleString('es-CO')

/** Role, monthly budget and per-order cap of one person. */
export function EditMemberDialog({ member }: { member: TeamMember }) {
  const id = useId()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [role, setRole] = useState<CompanyMemberRole>(member.role)
  const [budget, setBudget] = useState(pesos(member.monthlyBudget))
  const [cap, setCap] = useState(pesos(member.perOrderLimit))

  function save(event: React.FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      const result = await updateMember({
        memberId: member.memberId,
        role,
        monthlyBudget: parsePesosInput(budget),
        perOrderLimit: parsePesosInput(cap),
        active: true,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Cambios guardados.')
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="rounded-pill">
          <PencilIcon aria-hidden="true" />
          Editar<span className="sr-only"> a {member.name}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-card">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {member.name}
          </DialogTitle>
          <DialogDescription>
            Vacío significa sin tope: aplica el cupo de la empresa.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-role`}>Rol</Label>
            <select
              id={`${id}-role`}
              value={role}
              onChange={(event) =>
                setRole(event.target.value as CompanyMemberRole)
              }
              className="border-input bg-background rounded-control h-11 w-full border px-3 text-sm"
            >
              {COMPANY_MEMBER_ROLES.map((value) => (
                <option key={value} value={value}>
                  {COMPANY_ROLE_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-budget`}>Presupuesto mensual</Label>
            <Input
              id={`${id}-budget`}
              inputMode="numeric"
              value={budget}
              onChange={(event) => setBudget(event.target.value)}
              className="rounded-control h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-cap`}>Tope por pedido</Label>
            <Input
              id={`${id}-cap`}
              inputMode="numeric"
              value={cap}
              onChange={(event) => setCap(event.target.value)}
              className="rounded-control h-11"
            />
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={pending}
              className="rounded-pill h-11 px-6"
            >
              {pending ? (
                <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
              ) : null}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Takes someone off the team. Their past orders stay on the statements. */
export function RemoveMemberButton({ member }: { member: TeamMember }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function remove() {
    startTransition(async () => {
      const result = await updateMember({
        memberId: member.memberId,
        role: member.role,
        monthlyBudget: member.monthlyBudget,
        perOrderLimit: member.perOrderLimit,
        active: false,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(`${member.name} ya no hace parte del equipo.`)
      router.refresh()
    })
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          className="rounded-pill text-destructive-on-tint"
        >
          Retirar<span className="sr-only"> a {member.name}</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="rounded-card">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display text-xl">
            ¿Retirar a {member.name}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Ya no podrá pagar con la cuenta de la empresa. Sus pedidos
            anteriores siguen en los estados de cuenta.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-pill">Volver</AlertDialogCancel>
          <AlertDialogAction
            onClick={remove}
            className="rounded-pill bg-destructive hover:bg-destructive/90 text-white"
          >
            Sí, retirar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function RevokeInvitationButton({
  invitationId,
}: {
  invitationId: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      className="rounded-pill"
      onClick={() =>
        startTransition(async () => {
          const result = await revokeInvitation(invitationId)
          if (!result.ok) {
            toast.error(result.error)
            return
          }
          toast.success('Enlace revocado.')
          router.refresh()
        })
      }
    >
      Revocar
    </Button>
  )
}
