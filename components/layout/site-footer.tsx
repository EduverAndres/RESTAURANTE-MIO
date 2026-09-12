import { APP_NAME } from '@/lib/env'
import { cn } from '@/lib/utils'

const VENDOR_NAME = 'NEXUS'
const VENDOR_TAGLINE = 'tecnología inteligente'

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
      <div className="px-gutter mx-auto flex w-full max-w-6xl flex-col items-center gap-2 py-8 text-center sm:flex-row sm:justify-between sm:text-left">
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
