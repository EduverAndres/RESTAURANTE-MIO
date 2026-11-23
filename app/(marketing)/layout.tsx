import { AccessibilityMenu } from '@/components/a11y/accessibility-menu'
import { MarketingCta } from '@/components/layout/marketing-cta'
import { MarketingNav } from '@/components/layout/marketing-nav'
import { Wordmark } from '@/components/layout/site-header'
import { ThemeToggle } from '@/components/theme/theme-toggle'

/**
 * Chrome for the pages addressed to an audience other than the diner:
 * restaurant owners, couriers and companies.
 *
 * Deliberately NOT the `(public)` layout: that one carries the diner header
 * and the bottom tab bar (Inicio · Buscar · Pedidos · Perfil), which would
 * invite an owner to browse a catalogue of their competitors from the page
 * meant to sell them their own channel. It keeps what every page owes its
 * visitors — the skip link, the accessibility menu and the theme toggle —
 * and one call to action that depends on the route (MarketingCta). The
 * wordmark still returns to `/`, because the diner marketplace is the best
 * demo of the product.
 */
export default function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-border/60 surface-glass sticky top-0 z-40 border-b">
        {/* First stop for a keyboard user: hidden until focused, it jumps
            past the header to the page's own content. */}
        <a
          href="#contenido"
          className="bg-background text-foreground rounded-control focus-visible:ring-ring sr-only px-4 py-2 text-sm font-medium shadow-lg focus-visible:not-sr-only focus-visible:absolute focus-visible:top-2 focus-visible:left-2 focus-visible:z-50 focus-visible:ring-2"
        >
          Saltar al contenido
        </a>
        <div className="container-page flex h-16 items-center justify-between gap-3">
          <Wordmark />
          <div className="flex items-center gap-1">
            <MarketingNav />
            <AccessibilityMenu className="size-11" />
            <ThemeToggle className="size-11" />
            <MarketingCta placement="header" className="ml-1" />
          </div>
        </div>
      </header>
      <main id="contenido" className="flex-1">
        {children}
      </main>
      <MarketingCta placement="bar" />
    </div>
  )
}
