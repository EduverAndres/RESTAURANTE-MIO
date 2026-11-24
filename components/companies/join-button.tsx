'use client'

import { LoaderCircleIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { acceptInvitation } from '@/app/(protected)/empresa/actions'
import { Button } from '@/components/ui/button'

export function JoinCompanyButton({
  token,
  companyName,
}: {
  token: string
  companyName: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <Button
      type="button"
      disabled={pending}
      className="rounded-pill h-12 w-full px-6 text-base sm:w-auto"
      onClick={() =>
        startTransition(async () => {
          const result = await acceptInvitation(token)
          if (!result.ok) {
            toast.error(result.error)
            router.refresh()
            return
          }
          toast.success(`Ya haces parte de ${companyName}.`)
          router.push('/empresa')
          router.refresh()
        })
      }
    >
      {pending ? (
        <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
      ) : null}
      Unirme a {companyName}
    </Button>
  )
}
