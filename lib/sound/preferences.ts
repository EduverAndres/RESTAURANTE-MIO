'use client'

// Whether status-change tones play on this device.
//
// Its own localStorage key rather than a field on `tienda-preferences`: that
// entry is parsed by the no-flash script in `<head>` on every page, and sound
// has nothing to do with first paint.
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export interface SoundPreferences {
  enabled: boolean
}

/** The zustand `persist` name. */
export const SOUND_STORAGE_KEY = 'tienda:sound'

export const DEFAULT_SOUND_PREFERENCES: SoundPreferences = { enabled: true }

/**
 * Parses the persisted payload defensively: anything that is not a boolean
 * `enabled` inside the persist envelope falls back to the default.
 */
export function readSoundPreferences(raw: string | null): SoundPreferences {
  if (!raw) return DEFAULT_SOUND_PREFERENCES
  let state: unknown
  try {
    const parsed: unknown = JSON.parse(raw)
    state =
      parsed && typeof parsed === 'object'
        ? (parsed as { state?: unknown }).state
        : null
  } catch {
    return DEFAULT_SOUND_PREFERENCES
  }
  if (!state || typeof state !== 'object') return DEFAULT_SOUND_PREFERENCES
  const record = state as Record<string, unknown>
  return {
    enabled:
      typeof record.enabled === 'boolean'
        ? record.enabled
        : DEFAULT_SOUND_PREFERENCES.enabled,
  }
}

interface SoundPreferencesState extends SoundPreferences {
  setEnabled: (enabled: boolean) => void
}

export const useSoundPreferences = create<SoundPreferencesState>()(
  persist(
    (set) => ({
      ...DEFAULT_SOUND_PREFERENCES,
      setEnabled: (enabled) => set({ enabled }),
    }),
    {
      name: SOUND_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ enabled: state.enabled }),
      // Rehydrate through the same validation the tests exercise, so a
      // hand-edited or older payload can never leave `enabled` non-boolean.
      merge: (persisted, current) => ({
        ...current,
        ...readSoundPreferences(JSON.stringify({ state: persisted })),
      }),
    },
  ),
)
