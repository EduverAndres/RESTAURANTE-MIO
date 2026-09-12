// The four menu layouts are CSS strategies, not JSX branches: one card
// component renders every product and the container decides how the cards
// flow. Nothing here touches React, so the classes can be asserted directly.

import { hashSeed } from '@/lib/store/placeholder'
import type { ThemeMenuLayout } from '@/types/app'

export interface MenuLayoutStrategy {
  /** Classes for the element that wraps a category's products. */
  container: string
  /** Classes for the wrapper of the product at `index` within its category. */
  item(index: number): string
  /** How the card arranges its image and its text. */
  orientation: 'row' | 'column'
  /** The card at `index` gets the wide editorial treatment. */
  feature(index: number): boolean
  /**
   * `true` when images are locked to `--store-image-ratio`. Masonry is the one
   * layout that lets them keep their natural height, which is the whole point
   * of the column flow.
   */
  fixedRatio: boolean
}

const GRID: MenuLayoutStrategy = {
  container: 'grid grid-cols-1 gap-card sm:grid-cols-2 lg:grid-cols-3',
  item: () => '',
  orientation: 'column',
  feature: () => false,
  fixedRatio: true,
}

const LIST: MenuLayoutStrategy = {
  container: 'flex flex-col gap-card',
  item: () => '',
  orientation: 'row',
  feature: () => false,
  fixedRatio: true,
}

const MAGAZINE: MenuLayoutStrategy = {
  container: 'grid grid-cols-1 gap-card sm:grid-cols-2 lg:grid-cols-3',
  // The first product of every category runs across two columns and shows its
  // full description; the rest fall back to a normal cell.
  item: (index) => (index === 0 ? 'sm:col-span-2' : ''),
  orientation: 'column',
  feature: (index) => index === 0,
  fixedRatio: true,
}

const MASONRY: MenuLayoutStrategy = {
  container: 'columns-1 gap-card sm:columns-2 lg:columns-3',
  item: () => 'mb-card break-inside-avoid',
  orientation: 'column',
  feature: () => false,
  fixedRatio: false,
}

const STRATEGIES: Record<ThemeMenuLayout, MenuLayoutStrategy> = {
  grid: GRID,
  list: LIST,
  magazine: MAGAZINE,
  masonry: MASONRY,
}

/** Never throws: an unknown layout renders as the grid. */
export function menuLayoutStrategy(
  layout: ThemeMenuLayout,
): MenuLayoutStrategy {
  return STRATEGIES[layout] ?? GRID
}

/**
 * Masonry wants images of different heights, and the database does not store
 * intrinsic dimensions. Deriving the ratio from the product id gives the
 * staggered column flow without a single pixel of layout shift: the height is
 * known before the image loads and never changes between renders.
 */
const MASONRY_RATIOS = ['3 / 4', '1 / 1', '4 / 5', '5 / 4'] as const

export function masonryRatio(seed: string): string {
  return MASONRY_RATIOS[hashSeed(seed) % MASONRY_RATIOS.length]
}
