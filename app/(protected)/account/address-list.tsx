'use client'

import {
  MapPinIcon,
  PencilIcon,
  PlusIcon,
  StarIcon,
  Trash2Icon,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { deleteAddress, setDefaultAddress } from './address-actions'
import { AddressFormDialog } from '@/components/address/address-form'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import type { Address } from '@/types/app'

export function AddressList({ addresses }: { addresses: Address[] }) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Address | null>(null)
  const [pending, startTransition] = useTransition()

  function openNew() {
    setEditing(null)
    setDialogOpen(true)
  }

  function remove(address: Address) {
    startTransition(async () => {
      const result = await deleteAddress(address.id)
      if (!result.ok) {
        toast.error(result.error ?? 'No pudimos eliminar la dirección.')
        return
      }
      toast.success('Dirección eliminada.')
      router.refresh()
    })
  }

  function makeDefault(address: Address) {
    startTransition(async () => {
      const result = await setDefaultAddress(address.id)
      if (!result.ok) {
        toast.error(result.error ?? 'No pudimos actualizar la dirección.')
        return
      }
      toast.success(
        `${address.label ?? 'Dirección'} es ahora tu dirección principal.`,
      )
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-semibold">Mis direcciones</h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-pill"
          onClick={openNew}
        >
          <PlusIcon aria-hidden="true" />
          Nueva
        </Button>
      </div>

      {addresses.length === 0 ? (
        <EmptyState
          title="Aún no tienes direcciones"
          description="Guarda una para pedir a domicilio en dos toques."
          className="py-10"
          action={
            <Button type="button" className="rounded-pill" onClick={openNew}>
              Agregar dirección
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {addresses.map((address) => (
            <li
              key={address.id}
              className="rounded-card border-border bg-card shadow-soft flex items-start gap-3 border p-4"
            >
              <MapPinIcon
                aria-hidden="true"
                className="text-primary mt-0.5 size-4 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {address.label ?? 'Dirección'}
                  {address.is_default ? (
                    <Badge
                      variant="secondary"
                      className="rounded-pill text-[10px]"
                    >
                      Principal
                    </Badge>
                  ) : null}
                </p>
                <p className="text-muted-foreground text-sm">
                  {address.line1}
                  {address.line2 ? `, ${address.line2}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                {!address.is_default ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Usar ${address.label ?? 'dirección'} como principal`}
                    disabled={pending}
                    onClick={() => makeDefault(address)}
                  >
                    <StarIcon aria-hidden="true" />
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Editar ${address.label ?? 'dirección'}`}
                  onClick={() => {
                    setEditing(address)
                    setDialogOpen(true)
                  }}
                >
                  <PencilIcon aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Eliminar ${address.label ?? 'dirección'}`}
                  disabled={pending}
                  onClick={() => remove(address)}
                  className="text-destructive"
                >
                  <Trash2Icon aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AddressFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        address={editing}
        onSaved={() => router.refresh()}
      />
    </div>
  )
}
