import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HeroSection } from '@/components/store/hero'
import { StoreMenu } from '@/components/store/store-menu'
import {
  THEME_CATEGORY_NAVS,
  THEME_MENU_LAYOUTS,
  type MenuCategoryWithProducts,
} from '@/types/app'
import { ProductCard } from '@/components/store/product-card'
import { StoreEmptyState } from '@/components/store/store-empty-state'
import type { StorefrontContext } from '@/components/store/storefront-context'
import { storeHoursState } from '@/lib/store/hours'
import { normalizeTheme } from '@/lib/theme'
import { useCartStore } from '@/stores/cart.store'
import {
  THEME_BANNER_LAYOUTS,
  type ProductWithOptions,
  type Store,
  type StoreTheme,
} from '@/types/app'

// The menu reads the "?buscar=" deep link; the tests render it outside a route.
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}))

// jsdom ships no IntersectionObserver; the scroll-spy maths is tested on its
// own in tests/store-scroll-spy.test.ts, so a no-op stub is enough here.
vi.stubGlobal(
  'IntersectionObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
  },
)

const STORE = {
  id: 'store-1',
  slug: 'arepa-and-co',
  name: 'Arepa & Co',
  description: 'Arepas rellenas al estilo de la calle.',
  category: 'Comida rápida',
  cover_url: null,
  logo_url: null,
  address: 'Calle 57 # 9-25',
  lat: 4.6486,
  lng: -74.0632,
  delivery_fee: 4000,
  delivery_radius_km: 5,
  min_order: 12000,
  prep_time_min: 15,
  rating_avg: 4.6,
  rating_count: 21,
  is_open: true,
  schedule: { mon: { open: '00:00', close: '23:59' } },
  theme: {},
  whatsapp_phone: '+573100000012',
  status: 'active',
  owner_id: 'owner-1',
  commission_pct: 6,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
} as unknown as Store

function contextFor(theme: StoreTheme): StorefrontContext {
  return {
    store: STORE,
    theme,
    hours: storeHoursState({
      schedule: STORE.schedule,
      isOpen: true,
      now: new Date(2026, 8, 14, 13, 0),
    }),
    table: null,
    distanceKm: 2.4,
    sections: ['hero', 'menu'],
  }
}

function productFixture(
  overrides: Partial<ProductWithOptions> = {},
): ProductWithOptions {
  return {
    id: 'product-1',
    store_id: 'store-1',
    category_id: 'cat-1',
    name: 'Arepa de queso',
    description: 'Con queso costeño derretido.',
    price: 9000,
    image_url: null,
    is_available: true,
    position: 0,
    tags: ['vegetariano'],
    created_at: '2020-01-01T00:00:00Z',
    updated_at: '2020-01-01T00:00:00Z',
    product_options: [],
    ...overrides,
  } as ProductWithOptions
}

afterEach(() => {
  cleanup()
  useCartStore.getState().clear()
})

describe('hero layouts', () => {
  it.each(THEME_BANNER_LAYOUTS)(
    'renders the store name and a live open/closed chip for %s',
    (layout) => {
      const theme = normalizeTheme({
        banner: { layout },
        hero: {
          videoUrl:
            layout === 'video' ? 'https://cdn.example.com/loop.mp4' : null,
        },
      })
      render(<HeroSection context={contextFor(theme)} />)

      expect(
        screen.getByRole('heading', { level: 1, name: 'Arepa & Co' }),
      ).toBeInTheDocument()

      const chip = screen.getByText('Abierto ahora')
      expect(chip).toHaveAttribute('aria-live', 'polite')
      expect(screen.getByRole('link', { name: /Ver el menú/ })).toHaveAttribute(
        'href',
        '#menu',
      )
    },
  )

  it('shows an accessible pause control only for the video hero', () => {
    const theme = normalizeTheme({
      banner: { layout: 'video' },
      hero: { videoUrl: 'https://cdn.example.com/loop.mp4' },
    })
    render(<HeroSection context={contextFor(theme)} />)
    expect(
      screen.getByRole('button', { name: /video de fondo/i }),
    ).toBeInTheDocument()
  })

  it('falls back to the full hero when the video layout has no video', () => {
    const theme = normalizeTheme({ banner: { layout: 'video' } })
    render(<HeroSection context={contextFor(theme)} />)
    expect(
      screen.queryByRole('button', { name: /video de fondo/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 1, name: 'Arepa & Co' }),
    ).toBeInTheDocument()
  })

  it('draws the generated placeholder when there is no photo', () => {
    const theme = normalizeTheme({ banner: { layout: 'full' } })
    const { container } = render(<HeroSection context={contextFor(theme)} />)
    expect(container.querySelector('svg text')?.textContent).toBe('AC')
  })
})

describe('product card', () => {
  const theme = normalizeTheme({})
  const storeRef = { storeId: 'store-1', storeSlug: 'arepa-and-co' }

  it('morphs the + into a stepper in place instead of opening the drawer', () => {
    const onOpenDrawer = vi.fn()
    render(
      <ProductCard
        product={productFixture()}
        theme={theme}
        storeRef={storeRef}
        storeOpen
        onOpenDrawer={onOpenDrawer}
      />,
    )

    fireEvent.click(
      screen.getByRole('button', { name: 'Agregar Arepa de queso al carrito' }),
    )

    expect(onOpenDrawer).not.toHaveBeenCalled()
    expect(useCartStore.getState().items).toHaveLength(1)
    expect(
      screen.getByRole('button', { name: 'Agregar uno de Arepa de queso' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Quitar Arepa de queso del carrito' }),
    ).toBeInTheDocument()
  })

  it('opens the drawer for a product that has option groups', () => {
    const onOpenDrawer = vi.fn()
    const product = productFixture({
      product_options: [
        {
          id: 'opt-1',
          product_id: 'product-1',
          name: 'Tamaño',
          required: true,
          min: 1,
          max: 1,
          position: 0,
          created_at: '2020-01-01T00:00:00Z',
          updated_at: '2020-01-01T00:00:00Z',
          product_option_values: [],
        },
      ],
    })

    render(
      <ProductCard
        product={product}
        theme={theme}
        storeRef={storeRef}
        storeOpen
        onOpenDrawer={onOpenDrawer}
      />,
    )

    fireEvent.click(
      screen.getByRole('button', { name: 'Elegir opciones de Arepa de queso' }),
    )
    expect(onOpenDrawer).toHaveBeenCalledTimes(1)
    expect(useCartStore.getState().items).toHaveLength(0)
  })

  it('highlights the search term inside the product name', () => {
    render(
      <ProductCard
        product={productFixture()}
        theme={theme}
        storeRef={storeRef}
        storeOpen
        onOpenDrawer={vi.fn()}
        query="queso"
      />,
    )
    const marks = screen.getAllByText('queso', { selector: 'mark' })
    expect(marks.length).toBeGreaterThan(0)
  })

  it('gives the product image the product name as its alt text', () => {
    render(
      <ProductCard
        product={productFixture({ image_url: 'https://example.com/a.jpg' })}
        theme={theme}
        storeRef={storeRef}
        storeOpen
        onOpenDrawer={vi.fn()}
      />,
    )
    expect(screen.getByAltText('Arepa de queso')).toBeInTheDocument()
  })
})

describe('store empty state', () => {
  it('draws an illustration and announces itself', () => {
    render(<StoreEmptyState title="Sin resultados" illustration="search" />)
    expect(screen.getByRole('status')).toHaveTextContent('Sin resultados')
  })
})

describe('menu layouts and category nav', () => {
  const menuStore = {
    id: 'store-1',
    slug: 'arepa-and-co',
    name: 'Arepa & Co',
    isOpen: true,
    minOrder: 12000,
  }

  const categories = [
    {
      id: 'cat-1',
      store_id: 'store-1',
      name: 'Arepas',
      position: 0,
      is_visible: true,
      created_at: '2020-01-01T00:00:00Z',
      updated_at: '2020-01-01T00:00:00Z',
      products: [
        productFixture(),
        productFixture({ id: 'product-2', name: 'Arepa de carne' }),
      ],
    },
  ] as unknown as MenuCategoryWithProducts[]

  const expected: Record<(typeof THEME_MENU_LAYOUTS)[number], string> = {
    grid: 'grid-cols-1',
    list: 'flex-col',
    magazine: 'sm:grid-cols-2',
    masonry: 'columns-1',
  }

  it.each(THEME_MENU_LAYOUTS)('renders the %s layout', (menuLayout) => {
    const { container } = render(
      <StoreMenu
        store={menuStore}
        theme={normalizeTheme({ menuLayout })}
        categories={categories}
      />,
    )
    expect(
      screen.getByRole('heading', { level: 3, name: 'Arepas' }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('article')).toHaveLength(2)
    expect(container.innerHTML).toContain(expected[menuLayout])
  })

  it.each(THEME_CATEGORY_NAVS)('renders the %s category nav', (categoryNav) => {
    render(
      <StoreMenu
        store={menuStore}
        theme={normalizeTheme({ categoryNav })}
        categories={categories}
      />,
    )
    const nav = screen.getByRole('navigation', { name: 'Categorías del menú' })
    expect(nav).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Arepas' })).toHaveAttribute(
      'href',
      '#categoria-cat-1',
    )
  })

  it('shows the tenant-drawn empty state for a store with no products', () => {
    render(
      <StoreMenu
        store={menuStore}
        theme={normalizeTheme({})}
        categories={[]}
      />,
    )
    expect(screen.getByRole('status')).toHaveTextContent(
      'El menú está en preparación',
    )
  })
})
