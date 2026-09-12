'use client'

import { RotateCcwIcon } from 'lucide-react'
import Link from 'next/link'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="container-page flex min-h-dvh items-center justify-center py-16">
      <div className="w-full max-w-xl">
        <EmptyState
          title="Algo salió mal en la cocina"
          description="Ocurrió un error inesperado. Puedes intentar de nuevo o volver al inicio."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={reset} className="rounded-pill">
                <RotateCcwIcon aria-hidden="true" />
                Intentar de nuevo
              </Button>
              <Button asChild variant="outline" className="rounded-pill">
                <Link href="/">Ir al inicio</Link>
              </Button>
            </div>
          }
        />
        {error.digest ? (
          <p className="text-muted-foreground mt-4 text-center text-xs">
            Referencia: {error.digest}
          </p>
        ) : null}
      </div>
    </div>
  )
}
