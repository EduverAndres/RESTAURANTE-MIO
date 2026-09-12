import type { Metadata } from 'next'
import { ThemeForm } from './theme-form'
import { requireActiveStoreRow } from '@/lib/dashboard/store-context'
import { mergeTheme } from '@/lib/theme'

export const metadata: Metadata = { title: 'Configuración' }
export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const { store } = await requireActiveStoreRow('/dashboard/settings')

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Configuración
        </h1>
        <p className="text-muted-foreground text-sm">
          Personaliza los colores, la tipografía y el orden de la tienda pública
          de {store.name}.
        </p>
      </header>
      <ThemeForm
        storeId={store.id}
        storeName={store.name}
        category={store.category}
        theme={mergeTheme(store.theme)}
      />
    </div>
  )
}
