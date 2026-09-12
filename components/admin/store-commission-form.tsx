'use client'

import { LoaderCircleIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { setStoreCommission } from '@/app/admin/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface StoreCommissionFormProps {
  storeId: string
  commissionPct: number
  storeName: string
}

export function StoreCommissionForm({
  storeId,
  commissionPct,
  storeName,
}: StoreCommissionFormProps) {
  const router = useRouter()
  const [value, setValue] = useState(String(commissionPct))
  const [pending, startTransition] = useTransition()

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = Number(value)
    if (Number.isNaN(parsed)) {
      toast.error('Ingresa un número válido.')
      return
    }
    startTransition(async () => {
      const result = await setStoreCommission(storeId, parsed)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Comisión actualizada.')
      router.refresh()
    })
  }

  return (
    <form onSubmit={onSubmit} className="flex items-center justify-end gap-1.5">
      <Input
        type="number"
        min={0}
        max={30}
        step={0.1}
        inputMode="decimal"
        aria-label={`Comisión de ${storeName} en porcentaje`}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="rounded-control h-9 w-20 text-right tabular-nums"
      />
      <span className="text-muted-foreground text-sm">%</span>
      <Button
        type="submit"
        size="sm"
        variant="outline"
        disabled={pending}
        className="rounded-pill"
      >
        {pending ? (
          <LoaderCircleIcon aria-hidden="true" className="size-3.5 animate-spin" />
        ) : (
          'Guardar'
        )}
      </Button>
    </form>
  )
}
