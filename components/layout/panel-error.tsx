'use client'

import { RotateCcwIcon } from 'lucide-react'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'

/**
 * Error screen for a panel section (admin, merchant, courier). It renders
 * inside the panel's own layout, so the navigation stays and the visitor can
 * retry or go elsewhere; the root `app/error.tsx` would replace the whole
 * page. Shown, among others, when a query fails: an empty list would read as
 * "nothing here".
 */
export function PanelError({
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
    <div className="mx-auto max-w-xl py-10">
      <EmptyState
        title="No pudimos cargar esta sección"
        description="Puede ser la conexión o un problema momentáneo del servidor. Intenta de nuevo en unos segundos."
        action={
          <Button onClick={reset} className="rounded-pill">
            <RotateCcwIcon aria-hidden="true" />
            Intentar de nuevo
          </Button>
        }
      />
      {error.digest ? (
        <p className="text-muted-foreground mt-4 text-center text-xs">
          Referencia: {error.digest}
        </p>
      ) : null}
    </div>
  )
}
