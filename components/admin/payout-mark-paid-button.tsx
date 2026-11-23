'use client'

import { LoaderCircleIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { markCourierPayoutPaid, markPayoutPaid } from '@/app/admin/actions'
import { Button } from '@/components/ui/button'

interface PayoutMarkPaidButtonProps {
  payoutId: string
  /** A store payout (default) or a courier payout. */
  target?: 'stores' | 'couriers'
}

export function PayoutMarkPaidButton({
  payoutId,
  target = 'stores',
}: PayoutMarkPaidButtonProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function onClick() {
    startTransition(async () => {
      const markPaid =
        target === 'couriers' ? markCourierPayoutPaid : markPayoutPaid
      const result = await markPaid(payoutId)
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
      aria-busy={pending}
      onClick={onClick}
      className="rounded-pill"
    >
      {/*
        The label stays while the request is in flight: swapping it for the
        spinner left the button with no accessible name at all.
      */}
      {pending ? (
        <LoaderCircleIcon
          aria-hidden="true"
          className="size-3.5 animate-spin"
        />
      ) : null}
      Marcar pagado
    </Button>
  )
}
