// Which storefront sections render, and in which order.
//
// `theme.sectionOrder` is the merchant's answer; this adds the two guarantees
// the renderer needs: every core section is accounted for, and a section with
// nothing to show is dropped instead of rendering an empty band.

import { THEME_CORE_SECTIONS, type ThemeSection } from '@/types/app'

/** Removing these would leave a storefront with no identity and no products. */
const ALWAYS_ON: readonly ThemeSection[] = ['hero', 'menu']

/** `false` means "this section has no content right now". */
export type SectionAvailability = Partial<Record<ThemeSection, boolean>>

function isAvailable(
  section: ThemeSection,
  availability: SectionAvailability,
): boolean {
  if (ALWAYS_ON.includes(section)) return true
  return availability[section] !== false
}

/**
 * Resolves the final render list: the given order first (deduplicated, empty
 * sections dropped), then any core section the order forgot.
 */
export function resolveSections(
  order: readonly ThemeSection[],
  availability: SectionAvailability = {},
): ThemeSection[] {
  const resolved: ThemeSection[] = []
  const seen = new Set<ThemeSection>()

  for (const section of order) {
    if (seen.has(section)) continue
    seen.add(section)
    if (isAvailable(section, availability)) resolved.push(section)
  }

  for (const section of THEME_CORE_SECTIONS) {
    if (seen.has(section)) continue
    seen.add(section)
    if (isAvailable(section, availability)) resolved.push(section)
  }

  return resolved
}
