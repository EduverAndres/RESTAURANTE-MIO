import { SectionShell } from '@/components/store/sections/section-shell'
import { StoreMenu } from '@/components/store/store-menu'
import type { StoreSectionProps } from '@/components/store/storefront-context'
import { fetchMenu } from '@/lib/store/data'

/** The anchor every hero CTA and the "Ver el menú" link point at. */
export const MENU_SECTION_ID = 'menu'

export async function MenuSection({ context }: StoreSectionProps) {
  const { store, theme, table } = context
  const categories = await fetchMenu(store.id)

  return (
    <SectionShell id={MENU_SECTION_ID} className="pb-32">
      <h2 className="sr-only">Menú de {store.name}</h2>
      <StoreMenu
        store={{
          id: store.id,
          slug: store.slug,
          name: store.name,
          isOpen: Boolean(store.is_open),
          minOrder: store.min_order === null ? null : Number(store.min_order),
        }}
        theme={theme}
        categories={categories}
        table={table}
      />
    </SectionShell>
  )
}
