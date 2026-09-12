import { cn } from '@/lib/utils'

interface SectionShellProps {
  id: string
  title?: string
  /** Small line above the title. */
  eyebrow?: string
  description?: string
  children: React.ReactNode
  className?: string
  /** Lets a section sit on the surface colour instead of the background. */
  tone?: 'background' | 'surface'
}

/**
 * The frame every storefront band shares: the anchor id the category nav and
 * hero CTA point at, the tenant's vertical rhythm, and a heading wired to the
 * section with `aria-labelledby`.
 */
export function SectionShell({
  id,
  title,
  eyebrow,
  description,
  children,
  className,
  tone = 'background',
}: SectionShellProps) {
  const headingId = `${id}-title`
  return (
    <section
      id={id}
      aria-labelledby={title ? headingId : undefined}
      aria-label={title ? undefined : id}
      className={cn(
        'store-section scroll-mt-[var(--store-scroll-offset)]',
        tone === 'surface' && 'bg-[var(--store-surface)]',
        className,
      )}
    >
      <div className="container-page">
        {title ? (
          <div className="mb-8 max-w-2xl space-y-2">
            {eyebrow ? (
              <p className="text-sm font-medium tracking-[0.18em] text-[var(--store-primary)] uppercase">
                {eyebrow}
              </p>
            ) : null}
            <h2
              id={headingId}
              className="store-heading text-h2 text-[var(--store-text)]"
            >
              {title}
            </h2>
            {description ? (
              <p className="text-pretty text-[rgb(var(--store-text-rgb)/0.7)]">
                {description}
              </p>
            ) : null}
          </div>
        ) : null}
        {children}
      </div>
    </section>
  )
}
