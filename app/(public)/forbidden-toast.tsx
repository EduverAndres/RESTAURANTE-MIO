'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { toast } from 'sonner'

const MESSAGES: Record<string, string> = {
  forbidden: 'No tienes permiso para entrar ahí.',
}

/** Shows a one-off toast for `?error=` codes and cleans the URL. */
export function ForbiddenToast({ error }: { error?: string }) {
  const router = useRouter()

  useEffect(() => {
    if (!error) return
    const message = MESSAGES[error]
    if (message) toast.error(message)
    router.replace('/', { scroll: false })
  }, [error, router])

  return null
}
