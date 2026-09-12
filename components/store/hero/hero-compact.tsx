import {
  HeroCta,
  HeroLogo,
  HeroName,
  HeroTagline,
} from '@/components/store/hero/hero-parts'
import { StatusChips } from '@/components/store/status-chips'
import type { StoreSectionProps } from '@/components/store/storefront-context'

/**
 * A slim bar: circular logo, name, the facts. For a shop with no photograph
 * worth showing full-bleed — it gets the visitor to the menu in one screen
 * instead of asking them to scroll past a stock image.
 */
export function HeroCompact({ context }: StoreSectionProps) {
  const { store } = context

  return (
    <header className="relative isolate border-b border-[rgb(var(--store-text-rgb)/0.08)] bg-[var(--store-surface)] bg-[image:var(--store-gradient)]">
      <div className="container-page flex flex-col gap-4 py-8 sm:flex-row sm:items-center sm:gap-6">
        <HeroLogo context={context} shape="circle" />

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {store.category ? (
              <span className="store-chip">{store.category}</span>
            ) : null}
          </div>
          <HeroName
            name={store.name}
            className="text-h2 text-[var(--store-text)]"
          />
          <HeroTagline
            context={context}
            className="line-clamp-2 max-w-prose text-[rgb(var(--store-text-rgb)/0.7)]"
          />
          <StatusChips context={context} />
        </div>

        <div className="shrink-0">
          <HeroCta context={context} />
        </div>
      </div>
    </header>
  )
}
