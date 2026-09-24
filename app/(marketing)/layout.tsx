import Link from 'next/link'
import { Wordmark } from '@/components/layout/site-header'
import { Button } from '@/components/ui/button'

/**
 * Chrome for the pages addressed to restaurant owners.
 *
 * Deliberately NOT the `(public)` layout: that one carries the diner header
 * and the bottom tab bar (Inicio · Buscar · Pedidos · Perfil), which would
 * invite an owner to browse a catalogue of their competitors from the page
 * meant to sell them their own channel. The wordmark still returns to `/`,
 * because the diner marketplace is the best demo of the product.
 */
export default function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-border/60 sticky top-0 z-40 border-b surface-glass">
        <div className="container-page flex h-16 items-center justify-between gap-4">
          <Wordmark />
          <nav
            aria-label="Principal"
            className="flex items-center gap-2 text-sm font-medium"
          >
            <Link
              href="/"
              className="rounded-pill text-muted-foreground hover:bg-muted hover:text-foreground hidden px-3 py-1.5 transition-colors sm:inline-flex"
            >
              Pedir comida
            </Link>
            <Button asChild size="sm">
              <Link href="/register">Crear mi tienda</Link>
            </Button>
          </nav>
        </div>
      </header>
      <main id="contenido" className="flex-1">
        {children}
      </main>
    </div>
  )
}
