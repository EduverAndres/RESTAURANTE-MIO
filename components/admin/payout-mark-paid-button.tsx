'use client'

import { LoaderCircleIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { markPayoutPaid } from '@/app/admin/actions'
import { Button } from '@/components/ui/button'

interface PayoutMarkPaidButtonProps {
  payoutId: string
}

export function PayoutMarkPaidButton({ payoutId }: PayoutMarkPaidButtonProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function onClick() {
    startTransition(async () => {
      const result = await markPayoutPaid(payoutId)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Liquidación marcada como pagada.')
      router.refresh()
    })
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={onClick}
      className="rounded-pill"
    >
      {pending ? (
        <LoaderCircleIcon aria-hidden="true" className="size-3.5 animate-spin" />
      ) : (
        'Marcar pagado'
      )}
    </Button>
  )
}
