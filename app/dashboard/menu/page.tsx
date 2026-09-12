import type { Metadata } from 'next'
import { MenuManager } from '@/components/dashboard/menu/menu-manager'
import { requireActiveStoreRow } from '@/lib/dashboard/store-context'
import { createClient } from '@/lib/supabase/server'
import type { MenuCategoryWithProducts, ProductWithOptions } from '@/types/app'

export const metadata: Metadata = { title: 'Menú' }
export const dynamic = 'force-dynamic'

const PRODUCT_SELECT = '*, product_options(*, product_option_values(*))'

async function fetchMenu(storeId: string): Promise<{
  categories: MenuCategoryWithProducts[]
  uncategorized: ProductWithOptions[]
}> {
  const supabase = await createClient()
  const [categoriesResult, orphansResult] = await Promise.all([
    supabase
      .from('menu_categories')
      .select(`*, products(${PRODUCT_SELECT})`)
      .eq('store_id', storeId)
      .order('position', { ascending: true })
      .order('created_at', { ascending: true })
      .order('position', { referencedTable: 'products', ascending: true })
      .order('created_at', { referencedTable: 'products', ascending: true }),
    supabase
      .from('products')
      .select(PRODUCT_SELECT)
      .eq('store_id', storeId)
      .is('category_id', null)
      .order('position', { ascending: true })
      .order('created_at', { ascending: true }),
  ])

  if (categoriesResult.error)
    console.error('Failed to load menu categories', categoriesResult.error)
  if (orphansResult.error)
    console.error('Failed to load uncategorized products', orphansResult.error)

  return {
    categories: categoriesResult.data ?? [],
    uncategorized: orphansResult.data ?? [],
  }
}

export default async function MenuPage() {
  const { store } = await requireActiveStoreRow('/dashboard/menu')
  const { categories, uncategorized } = await fetchMenu(store.id)

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Menú
        </h1>
        <p className="text-muted-foreground text-sm">
          Categorías, productos y opciones de {store.name}. Los cambios se
          publican al instante.
        </p>
      </header>
      <MenuManager
        storeId={store.id}
        categories={categories}
        uncategorized={uncategorized}
      />
    </div>
  )
}
