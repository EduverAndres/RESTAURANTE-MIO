import type { Metadata } from 'next'
import { Wordmark } from '@/components/layout/site-header'
import { EmptyState } from '@/components/ui/empty-state'

export const metadata: Metadata = { title: 'Sin conexión' }

// Precached by public/sw.js and served as the navigation fallback when the
// network fails. Kept static: no data fetching, so it renders from the
// service worker cache alone.
export default function OfflinePage() {
  return (
    <div className="container-page flex min-h-dvh flex-col items-center justify-center gap-8 py-10 text-center">
      <Wordmark />
      <EmptyState
        title="Estás sin conexión"
        description="No pudimos cargar esta página. Revisa tu conexión a internet e inténtalo de nuevo."
      />
    </div>
  )
}
