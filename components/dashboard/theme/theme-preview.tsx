import type { CSSProperties } from 'react'
import { mergeTheme, themeToCssVars } from '@/lib/theme'
import { THEME_SECTION_LABELS } from '@/lib/validations/theme'
import type { StoreTheme, ThemeSection } from '@/types/app'

interface ThemePreviewProps {
  /** Raw form values; invalid pieces fall back to the defaults. */
  theme: unknown
  storeName: string
  category: string | null
}

const SAMPLE_PRODUCTS = [
  { name: 'Bandeja paisa', price: '$ 32.000' },
  { name: 'Limonada de coco', price: '$ 9.000' },
]

function Hero({
  theme,
  storeName,
  category,
}: ThemePreviewProps & { theme: StoreTheme }) {
  const compact = theme.banner.layout === 'compact'
  const split = theme.banner.layout === 'split'
  return (
    <div
      className={
        split ? 'grid grid-cols-[1fr_auto] items-end gap-3' : 'space-y-2'
      }
    >
      <div
        aria-hidden="true"
        className={compact ? 'h-10 w-full' : 'h-20 w-full'}
        style={{
          background: `linear-gradient(to top, rgb(0 0 0 / ${theme.banner.overlayOpacity}), transparent), var(--store-primary)`,
          borderRadius: 'var(--store-radius)',
        }}
      />
      <div className="space-y-1">
        <span className="rounded-pill inline-block bg-[rgb(var(--store-primary-rgb)/0.14)] px-2 py-0.5 text-[10px] font-medium text-[var(--store-primary)]">
          {category ?? 'Restaurante'}
        </span>
        <p className="font-[family-name:var(--store-font-display)] text-xl leading-none font-semibold">
          {storeName}
        </p>
      </div>
    </div>
  )
}

function Featured() {
  return (
    <div
      className="p-3 text-xs"
      style={{
        background: 'rgb(var(--store-accent-rgb) / 0.18)',
        borderRadius: 'var(--store-radius)',
      }}
    >
      <p className="font-medium">Favorito de la casa</p>
      <p className="opacity-70">Recomendado por tus clientes</p>
    </div>
  )
}

function Menu() {
  return (
    <ul className="space-y-2">
      {SAMPLE_PRODUCTS.map((product) => (
        <li
          key={product.name}
          className="flex items-center justify-between gap-2 bg-[var(--store-surface)] p-2.5 text-xs ring-1 ring-[rgb(var(--store-text-rgb)/0.06)]"
          style={{ borderRadius: 'var(--store-radius)' }}
        >
          <span className="font-[family-name:var(--store-font-display)] text-sm font-semibold">
            {product.name}
          </span>
          <span className="font-semibold text-[var(--store-primary)]">
            {product.price}
          </span>
        </li>
      ))}
      <li>
        <span
          className="inline-block bg-[var(--store-primary)] px-3 py-1.5 text-xs font-medium text-white"
          style={{ borderRadius: 'var(--store-button-radius)' }}
        >
          Agregar al carrito
        </span>
      </li>
    </ul>
  )
}

function Info() {
  return (
    <p className="text-[11px] opacity-70">
      Abierto hoy · Domicilio $ 4.000 · Pedido mínimo $ 15.000
    </p>
  )
}

const SECTION_COMPONENTS: Record<ThemeSection, () => React.ReactNode> = {
  hero: () => null,
  featured: Featured,
  menu: Menu,
  info: Info,
}

/** Miniature storefront driven by the same CSS variables as the public page. */
export function ThemePreview({
  theme,
  storeName,
  category,
}: ThemePreviewProps) {
  const merged = mergeTheme(theme)
  return (
    <div
      data-store-theme
      aria-label="Vista previa de la tienda"
      style={themeToCssVars(merged) as CSSProperties}
      className="rounded-card ring-border/60 space-y-4 bg-[var(--store-background)] p-4 font-[family-name:var(--store-font-body)] text-[var(--store-text)] ring-1"
    >
      {merged.sectionOrder.map((section) => {
        if (section === 'hero')
          return (
            <Hero
              key={section}
              theme={merged}
              storeName={storeName}
              category={category}
            />
          )
        const Section = SECTION_COMPONENTS[section]
        return (
          <section key={section} aria-label={THEME_SECTION_LABELS[section]}>
            <Section />
          </section>
        )
      })}
    </div>
  )
}
