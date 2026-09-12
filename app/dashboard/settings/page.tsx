import type { Metadata } from 'next'
import { ThemeForm } from './theme-form'
import type { FeaturedProductOption } from '@/components/dashboard/theme/featured-picker'
import { requireActiveStoreRow } from '@/lib/dashboard/store-context'
import { createClient } from '@/lib/supabase/server'
import { normalizeTheme } from '@/lib/theme'

export const metadata: Metadata = { title: 'Configuración' }
export const dynamic = 'force-dynamic'

/** The products the featured picker can choose from, category name included. */
async function fetchProductOptions(
  storeId: string,
): Promise<FeaturedProductOption[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('menu_categories')
    .select('name, products(id, name, position)')
    .eq('store_id', storeId)
    .order('position', { ascending: true })
    .order('position', { referencedTable: 'products', ascending: true })

  if (error) {
    console.error('Failed to load products for the theme editor', error)
    return []
  }

  return (data ?? []).flatMap((category) =>
    category.products.map((product) => ({
      id: product.id,
      name: product.name,
      categoryName: category.name,
    })),
  )
}

export default async function SettingsPage() {
  const { store } = await requireActiveStoreRow('/dashboard/settings')
  const products = await fetchProductOptions(store.id)

  return (
    <div className="mx-auto max-w-[110rem] space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Diseño de tu tienda
        </h1>
        <p className="text-muted-foreground text-sm text-pretty">
          Cambia los colores, las letras, la portada y el orden de las secciones
          de {store.name}. Lo que ves a la derecha es tu tienda de verdad.
        </p>
      </header>
      <ThemeForm
        storeId={store.id}
        storeSlug={store.slug}
        storeName={store.name}
        theme={normalizeTheme(store.theme)}
        products={products}
      />
    </div>
  )
}
