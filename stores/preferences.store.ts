'use client'

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  ACCESSIBILITY_STORAGE_KEY,
  DEFAULT_ACCESSIBILITY_PREFERENCES,
  type AccessibilityPreferences,
  type TextSize,
} from '@/lib/a11y/preferences'
import type { PaymentMethod } from '@/types/app'

// Remembered checkout choices so a returning customer pays in two taps, plus
// the accessibility preferences that shape the whole app. They share one
// persisted key: a customer who sets extra-large text has one place where
// "how I like to use this" lives, and the no-flash script only has to read
// a single localStorage entry before first paint.
interface PreferencesState extends AccessibilityPreferences {
  paymentMethod: PaymentMethod | null
  tipPercent: number
  setPaymentMethod: (method: PaymentMethod) => void
  setTipPercent: (percent: number) => void
  setTextSize: (size: TextSize) => void
  setHighContrast: (enabled: boolean) => void
  setReduceMotion: (enabled: boolean) => void
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      paymentMethod: null,
      tipPercent: 0,
      ...DEFAULT_ACCESSIBILITY_PREFERENCES,
      setPaymentMethod: (paymentMethod) => set({ paymentMethod }),
      setTipPercent: (tipPercent) => set({ tipPercent }),
      setTextSize: (textSize) => set({ textSize }),
      setHighContrast: (highContrast) => set({ highContrast }),
      setReduceMotion: (reduceMotion) => set({ reduceMotion }),
    }),
    {
      name: ACCESSIBILITY_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
