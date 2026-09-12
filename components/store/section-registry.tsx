import { HeroSection } from '@/components/store/hero'
import { MenuSkeleton } from '@/components/store/menu-skeleton'
import { FeaturedSection } from '@/components/store/sections/featured-section'
import { InfoSection } from '@/components/store/sections/info-section'
import { MenuSection } from '@/components/store/sections/menu-section'
import { ReviewsSection } from '@/components/store/sections/reviews-section'
import { SocialSection } from '@/components/store/sections/social-section'
import { StorySection } from '@/components/store/sections/story-section'
import type { StoreSectionProps } from '@/components/store/storefront-context'
import type { StoreTheme, ThemeSection } from '@/types/app'

/** Sections may be async server components, so React.ReactNode is the contract. */
type SectionComponent = (
  props: StoreSectionProps,
) => React.ReactNode | Promise<React.ReactNode>

/**
 * Section name → component. `theme.sectionOrder` decides what renders and in
 * what order; this map decides what each name means. Adding a section is one
 * entry here plus one in `THEME_SECTIONS` — never surgery on the storefront.
 */
const SECTIONS: Record<ThemeSection, SectionComponent> = {
  hero: HeroSection,
  featured: FeaturedSection,
  story: StorySection,
  menu: MenuSection,
  info: InfoSection,
  reviews: ReviewsSection,
  social: SocialSection,
}

export function StoreSection({
  name,
  context,
}: {
  name: ThemeSection
  context: StoreSectionProps['context']
}) {
  const Section = SECTIONS[name]
  if (!Section) return null
  return <Section context={context} />
}

function Band({ className = 'h-64' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`container-page store-section ${className}`}
    >
      <div className="size-full animate-pulse rounded-[var(--store-radius)] bg-[rgb(var(--store-text-rgb)/0.06)]" />
    </div>
  )
}

/**
 * What a streaming section shows while its data is in flight. The menu gets a
 * real skeleton that mirrors its layout and image ratio; the rest get a band
 * of the right height, so nothing below them moves when they arrive.
 */
export function SectionFallback({
  name,
  theme,
}: {
  name: ThemeSection
  theme: StoreTheme
}) {
  switch (name) {
    case 'menu':
      return (
        <div className="container-page store-section">
          <MenuSkeleton theme={theme} />
        </div>
      )
    case 'featured':
      return <Band className="h-80" />
    case 'reviews':
      return <Band className="h-72" />
    default:
      return null
  }
}
