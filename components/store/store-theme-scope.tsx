import type { CSSProperties, ReactNode } from 'react'
import { themeToCssVars } from '@/lib/theme'
import { cn } from '@/lib/utils'
import type { StoreTheme } from '@/types/app'

interface StoreThemeScopeProps {
  theme: StoreTheme
  children: ReactNode
  className?: string
}

/**
 * Dresses a page that belongs to a restaurant, but is built from the shared
 * UI kit, in that restaurant's theme. The outer element is the storefront's
 * own scope (`data-store-theme`: its colours, type, light/dark, motion and
 * custom CSS); the inner one (`data-store-ui`) points the kit's tokens at it,
 * so buttons, fields, cards and chips read the tenant's brand. See the
 * "Store skin for the shared UI kit" block in globals.css.
 */
export function StoreThemeScope({
  theme,
  children,
  className,
}: StoreThemeScopeProps) {
  return (
    <div
      data-store-theme
      data-store-page
      data-store-scheme={theme.mode === 'auto' ? 'auto' : theme.mode}
      data-store-motion={theme.motion}
      style={themeToCssVars(theme) as CSSProperties}
      className="flex flex-1 flex-col bg-[var(--store-background)] text-[var(--store-text)]"
    >
      {/* Already sanitised and scoped to [data-store-theme] by the theme layer. */}
      {theme.customCss ? <style>{theme.customCss}</style> : null}
      {/* A column that fills the page, so the footer's `mt-auto` takes it to
          the bottom however short the content is (see globals.css). */}
      <div data-store-ui className={cn('flex flex-1 flex-col', className)}>
        {children}
      </div>
    </div>
  )
}
