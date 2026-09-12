'use client'

import { useEffect } from 'react'
import { StoreEmptyState } from '@/components/store/store-empty-state'

/**
 * A storefront that failed to render. The visitor gets the tenant-coloured
 * error drawing and one action that actually helps — try again — rather than a
 * blank screen.
 */
export default function StoreError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Storefront failed to render', error)
  }, [error])

  return (
    <div
      data-store-theme
      className="container-page store-section flex min-h-[60vh] items-center justify-center"
    >
      <StoreEmptyState
        illustration="error"
        title="No pudimos cargar esta tienda"
        description="Algo falló de nuestro lado. Vuelve a intentarlo en un momento."
        action={
          <button type="button" onClick={reset} className="store-btn h-11 px-5">
            Reintentar
          </button>
        }
      />
    </div>
  )
}
