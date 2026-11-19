'use client'

import { EyeIcon, EyeOffIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { setProductReviewHidden } from '@/app/admin/actions'
import { Button } from '@/components/ui/button'

export function ReviewVisibilityButton({
  reviewId,
  hidden,
  dishName,
}: {
  reviewId: string
  hidden: boolean
  dishName: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function toggle() {
    startTransition(async () => {
      const result = await setProductReviewHidden(reviewId, !hidden)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(hidden ? 'Reseña visible de nuevo.' : 'Reseña oculta.')
      router.refresh()
    })
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="rounded-pill"
      disabled={pending}
      onClick={toggle}
      aria-label={`${hidden ? 'Mostrar' : 'Ocultar'} reseña de ${dishName}`}
    >
      {hidden ? (
        <EyeIcon aria-hidden="true" />
      ) : (
        <EyeOffIcon aria-hidden="true" />
      )}
      {hidden ? 'Mostrar' : 'Ocultar'}
    </Button>
  )
}
