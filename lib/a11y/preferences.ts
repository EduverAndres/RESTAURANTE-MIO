// Customer accessibility preferences.
//
// Pure module: safe to import from server components, client components, the
// inline no-flash script builder and tests. The state itself lives in
// `stores/preferences.store.ts`; this file owns the vocabulary — what a valid
// preference is, which data attribute it becomes on `<html>`, and how the
// change is described out loud.

export type TextSize = 'normal' | 'large' | 'xlarge'

export interface AccessibilityPreferences {
  textSize: TextSize
  highContrast: boolean
  reduceMotion: boolean
}

/** The zustand `persist` name; one localStorage key for every preference. */
export const ACCESSIBILITY_STORAGE_KEY = 'tienda-preferences'

export const TEXT_SIZES: readonly TextSize[] = ['normal', 'large', 'xlarge']

export const DEFAULT_ACCESSIBILITY_PREFERENCES: AccessibilityPreferences = {
  textSize: 'normal',
  highContrast: false,
  reduceMotion: false,
}

/** Menu copy, kept next to the values so the two cannot drift apart. */
export const TEXT_SIZE_LABELS: Record<TextSize, string> = {
  normal: 'Normal',
  large: 'Grande',
  xlarge: 'Extra grande',
}

const ANNOUNCED_TEXT_SIZE: Record<TextSize, string> = {
  normal: 'normal',
  large: 'grande',
  xlarge: 'extra grande',
}

/**
 * The attributes to stamp on `<html>`. `null` means "remove it": a default
 * preference leaves no attribute behind, so the CSS only has to describe the
 * exceptions and the document stays clean for anyone inspecting it.
 */
export function accessibilityDataAttributes(
  preferences: AccessibilityPreferences,
): Record<'data-text-size' | 'data-contrast' | 'data-motion', string | null> {
  return {
    'data-text-size':
      preferences.textSize === 'normal' ? null : preferences.textSize,
    'data-contrast': preferences.highContrast ? 'high' : null,
    'data-motion': preferences.reduceMotion ? 'reduce' : null,
  }
}

function isTextSize(value: unknown): value is TextSize {
  return (
    typeof value === 'string' && TEXT_SIZES.includes(value as TextSize)
  )
}

/**
 * Parses the persisted payload defensively. The same localStorage key also
 * holds checkout preferences and may have been written by an older build, so
 * every field is validated on its own and anything unexpected falls back to
 * the default rather than reaching the DOM.
 */
export function readAccessibilityPreferences(
  raw: string | null,
): AccessibilityPreferences {
  if (!raw) return DEFAULT_ACCESSIBILITY_PREFERENCES
  let state: unknown
  try {
    const parsed: unknown = JSON.parse(raw)
    state =
      parsed && typeof parsed === 'object'
        ? (parsed as { state?: unknown }).state
        : null
  } catch {
    return DEFAULT_ACCESSIBILITY_PREFERENCES
  }
  if (!state || typeof state !== 'object') {
    return DEFAULT_ACCESSIBILITY_PREFERENCES
  }
  const record = state as Record<string, unknown>
  return {
    textSize: isTextSize(record.textSize)
      ? record.textSize
      : DEFAULT_ACCESSIBILITY_PREFERENCES.textSize,
    highContrast: record.highContrast === true,
    reduceMotion: record.reduceMotion === true,
  }
}

/**
 * Source for the tiny blocking script in `<head>`.
 *
 * It runs before first paint so a customer who chose extra-large text never
 * sees a frame of the normal size. It only writes `data-*` attributes, which
 * is why it can live alongside next-themes: that library owns the `class`
 * attribute on the same element and the two never touch the same value.
 */
export function accessibilityPreferencesScript(): string {
  // Written by hand rather than serialised from the functions above: it has to
  // be ES5-plain, self-contained and small enough to inline on every page.
  return `(function(){try{var r=document.documentElement;var s=localStorage.getItem(${JSON.stringify(
    ACCESSIBILITY_STORAGE_KEY,
  )});if(!s)return;var p=JSON.parse(s);var v=p&&p.state?p.state:null;if(!v)return;if(v.textSize==='large'||v.textSize==='xlarge')r.setAttribute('data-text-size',v.textSize);if(v.highContrast===true)r.setAttribute('data-contrast','high');if(v.reduceMotion===true)r.setAttribute('data-motion','reduce');}catch(e){}})()`
}

/** One sentence for the live region after a preference changes. */
export function accessibilityAnnouncement(
  preferences: AccessibilityPreferences,
): string {
  return [
    `Texto ${ANNOUNCED_TEXT_SIZE[preferences.textSize]}.`,
    `Contraste ${preferences.highContrast ? 'alto' : 'normal'}.`,
    `Animaciones ${preferences.reduceMotion ? 'reducidas' : 'activadas'}.`,
  ].join(' ')
}
