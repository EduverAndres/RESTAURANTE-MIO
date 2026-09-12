'use client'

import dynamic from 'next/dynamic'
import type { FeaturedProductOption } from '@/components/dashboard/theme/featured-picker'
import { Skeleton } from '@/components/ui/skeleton'
import type { StoreTheme } from '@/types/app'

/**
 * Loads the theme editor on demand.
 *
 * The editor pulls in the presets, the OKLCH palette maths, the colour
 * extractor, the cropper and the whole control surface — none of which any
 * other dashboard screen needs. `dynamic()` keeps all of it in its own chunk,
 * so Pedidos and Menú are not paying for a screen the merchant opens once.
 *
 * `ssr: false` because the editor is a browser tool from the first paint: it
 * reads `localStorage` for the recent swatches, measures the preview pane and
 * talks to an iframe.
 */

const ThemeEditor = dynamic(
  () => import('@/components/dashboard/theme/theme-editor'),
  {
    ssr: false,
    loading: () => <ThemeEditorSkeleton />,
  },
)

function ThemeEditorSkeleton() {
  return (
    <div
      role="status"
      aria-label="Cargando el editor"
      className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]"
    >
      <div className="space-y-3">
        <Skeleton className="h-12 w-full rounded-[var(--radius-lg)]" />
        <Skeleton className="h-[28rem] w-full rounded-[var(--radius-lg)]" />
      </div>
      <Skeleton className="hidden h-[32rem] w-full rounded-[var(--radius-lg)] lg:block" />
    </div>
  )
}

export interface ThemeFormProps {
  storeId: string
  storeSlug: string
  storeName: string
  theme: StoreTheme
  products: FeaturedProductOption[]
}

export function ThemeForm(props: ThemeFormProps) {
  return <ThemeEditor {...props} />
}
