import type { ComponentType } from 'react'
import { HeroCompact } from '@/components/store/hero/hero-compact'
import { HeroEditorial } from '@/components/store/hero/hero-editorial'
import { HeroFull } from '@/components/store/hero/hero-full'
import { HeroSplit } from '@/components/store/hero/hero-split'
import { HeroVideo } from '@/components/store/hero/hero-video'
import type { StoreSectionProps } from '@/components/store/storefront-context'
import type { ThemeBannerLayout } from '@/types/app'

/**
 * One real component per banner layout — not one skeleton re-skinned. Adding a
 * sixth layout is a new file plus one line here.
 */
const HEROES: Record<ThemeBannerLayout, ComponentType<StoreSectionProps>> = {
  full: HeroFull,
  split: HeroSplit,
  compact: HeroCompact,
  editorial: HeroEditorial,
  video: HeroVideo,
}

export function HeroSection({ context }: StoreSectionProps) {
  const Hero = HEROES[context.theme.banner.layout] ?? HeroFull
  return <Hero context={context} />
}
