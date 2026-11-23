// Reduced-motion signals, read in the browser.
//
// There are two: the operating system's `prefers-reduced-motion` and the
// app's own "Reducir animaciones", which `lib/a11y/preferences.ts` writes as
// `data-motion="reduce"` on <html>. Either one means "do not move". CSS reads
// both on its own (app/globals.css); these helpers are for the little that
// has to decide in JavaScript.

const ATTRIBUTE = 'data-motion'

/** The app preference alone: `<html data-motion="reduce">`. */
export function appMotionReduced(): boolean {
  if (typeof document === 'undefined') return false
  return document.documentElement.getAttribute(ATTRIBUTE) === 'reduce'
}

/** The system preference alone. Missing `matchMedia` reads as no preference. */
export function systemMotionReduced(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function')
    return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Either signal, read now. For effects, never for rendering. */
export function motionReducedNow(): boolean {
  return appMotionReduced() || systemMotionReduced()
}

/**
 * Calls `onChange` whenever the app preference flips. The attribute is
 * written by a script before first paint and by <AccessibilityAttributes />
 * afterwards, so watching the attribute is the one way to follow both.
 */
export function subscribeAppMotion(onChange: () => void): () => void {
  if (typeof MutationObserver === 'undefined') return () => {}
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: [ATTRIBUTE],
  })
  return () => observer.disconnect()
}
