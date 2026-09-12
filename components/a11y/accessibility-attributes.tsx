'use client'

import { useEffect } from 'react'
import {
  accessibilityDataAttributes,
  type AccessibilityPreferences,
} from '@/lib/a11y/preferences'
import { usePreferencesStore } from '@/stores/preferences.store'

/**
 * Keeps `<html>` in step with the customer's accessibility preferences.
 *
 * Renders nothing, on the server and on the client alike, so there is no
 * markup to mismatch during hydration. The first paint is already correct
 * because the inline script in `<head>` (see `accessibilityPreferencesScript`)
 * stamped the same attributes before React booted; this component only takes
 * over afterwards, when the customer changes a preference or a second tab
 * rehydrates the store.
 *
 * It writes `data-*` attributes only. next-themes owns the `class` attribute
 * on the same element, so the two coexist without fighting.
 */
export function AccessibilityAttributes() {
  const textSize = usePreferencesStore((state) => state.textSize)
  const highContrast = usePreferencesStore((state) => state.highContrast)
  const reduceMotion = usePreferencesStore((state) => state.reduceMotion)

  useEffect(() => {
    const preferences: AccessibilityPreferences = {
      textSize,
      highContrast,
      reduceMotion,
    }
    const root = document.documentElement
    for (const [name, value] of Object.entries(
      accessibilityDataAttributes(preferences),
    )) {
      if (value === null) root.removeAttribute(name)
      else root.setAttribute(name, value)
    }
  }, [textSize, highContrast, reduceMotion])

  return null
}
