// Scroll-spy arithmetic, kept away from the DOM so it can be unit-tested.
// The client component feeds IntersectionObserver entries in and renders
// whatever id comes out; none of the decisions live in the effect.

export interface SpyEntry {
  id: string
  isIntersecting: boolean
  /** `boundingClientRect.top`, relative to the viewport. */
  top: number
}

/**
 * The section that should read as current.
 *
 * Among the sections in view, the one whose heading has just crossed the
 * sticky header wins: the smallest non-negative `top`, or — when every visible
 * section already scrolled past it — the one closest above. With nothing in
 * view (mid-flight on a long jump) the previous choice is kept, so the nav
 * never blinks back to nothing.
 */
export function pickActiveSection(
  entries: readonly SpyEntry[],
  previous: string | null,
): string | null {
  const visible = entries.filter((entry) => entry.isIntersecting)
  if (visible.length === 0) return previous

  const above = visible.filter((entry) => entry.top <= 0)
  if (above.length > 0) {
    return above.reduce((best, entry) => (entry.top > best.top ? entry : best))
      .id
  }

  return visible.reduce((best, entry) => (entry.top < best.top ? entry : best))
    .id
}

/**
 * Folds a batch of fresh observations into the tracked list. The observer only
 * reports the sections that changed, so the untouched ones must survive; ids
 * that are not tracked (a stale observation after a filter) are ignored.
 */
export function mergeSpyEntries(
  current: readonly SpyEntry[],
  incoming: readonly SpyEntry[],
): SpyEntry[] {
  if (incoming.length === 0) return [...current]
  const patch = new Map(incoming.map((entry) => [entry.id, entry]))
  return current.map((entry) => patch.get(entry.id) ?? entry)
}
