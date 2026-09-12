/**
 * Motion preference, read defensively.
 *
 * `matchMedia` is missing during server rendering and in some test and
 * embedded environments, and a hero that throws because it asked about
 * animation would be a poor trade. Absent support reads as "no preference".
 */
export function reducedMotionQuery(): MediaQueryList | null {
  if (typeof window === 'undefined') return null
  if (typeof window.matchMedia !== 'function') return null
  return window.matchMedia('(prefers-reduced-motion: reduce)')
}

export function prefersReducedMotion(): boolean {
  return reducedMotionQuery()?.matches ?? false
}
