'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { setStoreStatus } from '@/app/admin/actions'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { STORE_STATUS_LABELS } from '@/lib/orders/status'
import { STORE_STATUSES } from '@/lib/validations/admin'
import type { StoreStatus } from '@/types/app'

interface StoreStatusSelectProps {
  storeId: string
  status: StoreStatus
  storeName: string
}

export function StoreStatusSelect({
  storeId,
  status,
  storeName,
}: StoreStatusSelectProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function onChange(value: string) {
    startTransition(async () => {
      const result = await setStoreStatus(storeId, value as StoreStatus)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Estado actualizado.')
      router.refresh()
    })
  }

  return (
    <Select value={status} onValueChange={onChange} disabled={pending}>
      <SelectTrigger
        aria-label={`Estado de ${storeName}`}
        className="rounded-control h-9 w-36"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STORE_STATUSES.map((option) => (
          <SelectItem key={option} value={option}>
            {STORE_STATUS_LABELS[option]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
