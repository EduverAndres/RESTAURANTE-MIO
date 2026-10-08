import {
  BadgeCheckIcon,
  KeyRoundIcon,
  MapPinIcon,
  MessageCircleIcon,
  ShieldCheckIcon,
} from 'lucide-react'
import Link from 'next/link'
import { CookiePreferencesButton } from '@/components/legal/cookie-banner'
import { APP_NAME } from '@/lib/env'
import { supportWhatsAppUrl } from '@/lib/marketplace/support'
import { cn } from '@/lib/utils'

const VENDOR_NAME = 'NEXUS'
const VENDOR_TAGLINE = 'tecnología inteligente'

const COLUMNS = [
  {
    title: 'Para clientes',
    links: [
      { href: '/#restaurantes', label: 'Explorar negocios' },
      { href: '/account#pedidos', label: 'Mis pedidos' },
      { href: '/register', label: 'Crear una cuenta' },
    ],
  },
  {
    title: 'Para negocios',
    links: [
      { href: '/register?role=merchant', label: 'Registrar mi negocio' },
      { href: '/para-restaurantes', label: 'Planes y calculadora' },
      { href: '/dashboard', label: 'Panel de comercio' },
    ],
  },
] as const

/** On every page, storefronts included: a customer orders there too. */
const LEGAL_LINKS = [
  { href: '/terminos', label: 'Términos' },
  { href: '/privacidad', label: 'Privacidad' },
  { href: '/cookies', label: 'Cookies' },
  { href: '/proteccion-al-consumidor', label: 'Protección al consumidor' },
] as const

const TRUST = [
  { icon: BadgeCheckIcon, label: 'Comercios verificados' },
  { icon: ShieldCheckIcon, label: 'Pagos protegidos' },
  { icon: KeyRoundIcon, label: 'Entrega con código' },
] as const

/**
 * The marketplace's own footer block: where to go next for each audience and
 * the promises again, for the visitor who scrolled all the way down still
 * deciding. Only on the app tone — inside a storefront the merchant's brand
 * owns the page and the footer stays a one-line credit.
 */
function AppFooterNav() {
  const support = supportWhatsAppUrl('Hola, necesito ayuda.')

  return (
    <div className="px-gutter mx-auto grid w-full max-w-6xl gap-10 pt-12 pb-8 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
      <div className="space-y-3">
        <p className="font-display font-display-soft text-2xl font-semibold tracking-tight">
          {APP_NAME}
          <span className="text-primary">.</span>
        </p>
        <p className="text-muted-foreground max-w-xs text-sm text-pretty">
          La plataforma del comercio local: restaurantes y negocios de aquí, a
          un toque de distancia.
        </p>
        <p className="text-muted-foreground inline-flex items-center gap-1.5 text-sm">
          <MapPinIcon aria-hidden="true" className="text-primary size-4" />
          Barranquilla, Colombia
        </p>
      </div>

      {COLUMNS.map((column) => (
        <nav key={column.title} aria-label={column.title} className="space-y-3">
          <h2 className="text-sm font-semibold">{column.title}</h2>
          <ul className="space-y-2 text-sm">
            {column.links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ))}

      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Compra con confianza</h2>
        <ul className="space-y-2 text-sm">
          {TRUST.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="text-muted-foreground inline-flex w-full items-center gap-2"
            >
              <Icon aria-hidden="true" className="text-primary size-4" />
              {label}
            </li>
          ))}
          {support ? (
            <li>
              <a
                href={support}
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground inline-flex items-center gap-2 font-medium underline-offset-4 hover:underline"
              >
                <MessageCircleIcon
                  aria-hidden="true"
                  className="text-success size-4"
                />
                Soporte por WhatsApp
              </a>
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  )
}

/**
 * Vendor credit shown at the bottom of every public page.
 *
 * `tone="store"` switches the colours to the `--store-*` scope so the credit
 * sits inside a storefront without breaking the merchant's palette; the
 * default tone uses the app's own tokens.
 */
export function SiteFooter({
  tone = 'app',
  className,
}: {
  tone?: 'app' | 'store'
  className?: string
}) {
  const isStore = tone === 'store'
  const year = new Date().getFullYear()

  return (
    <footer
      className={cn(
        'mt-auto border-t',
        isStore
          ? 'border-[color-mix(in_oklch,var(--store-text)_12%,transparent)] bg-[var(--store-surface)] text-[var(--store-text)]'
          : 'border-border bg-surface text-foreground',
        className,
      )}
    >
      {isStore ? null : <AppFooterNav />}
      <nav
        aria-label="Legal"
        className={cn(
          'px-gutter mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-x-4 gap-y-2 pt-6 text-xs sm:justify-start',
          isStore
            ? 'store-muted'
            : 'text-muted-foreground border-border/60 border-t',
        )}
      >
        {LEGAL_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="hover:text-foreground underline-offset-4 hover:underline"
          >
            {link.label}
          </Link>
        ))}
        <CookiePreferencesButton className="hover:text-foreground cursor-pointer underline-offset-4 hover:underline" />
        <a
          href="https://www.sic.gov.co"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-foreground underline-offset-4 hover:underline"
        >
          Superintendencia de Industria y Comercio
        </a>
      </nav>
      <div
        className={cn(
          'px-gutter mx-auto flex w-full max-w-6xl flex-col items-center gap-2 pt-4 pb-8 text-center sm:flex-row sm:justify-between sm:text-left',
        )}
      >
        <p
          className={cn(
            'text-sm',
            isStore ? 'store-muted' : 'text-muted-foreground',
          )}
        >
          © {year} {APP_NAME}
        </p>

        <p
          className={cn(
            'text-sm',
            isStore ? 'store-muted' : 'text-muted-foreground',
          )}
        >
          <span>Powered by </span>
          <span
            className={cn(
              'font-display font-semibold',
              isStore ? 'text-[var(--store-primary)]' : 'text-primary',
            )}
          >
            {VENDOR_NAME}
          </span>
          <span> {VENDOR_TAGLINE}</span>
        </p>
      </div>
    </footer>
  )
}
