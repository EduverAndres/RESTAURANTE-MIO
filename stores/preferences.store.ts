'use client'

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { PaymentMethod } from '@/types/app'

// Remembered checkout choices so a returning customer pays in two taps.
interface PreferencesState {
  paymentMethod: PaymentMethod | null
  tipPercent: number
  setPaymentMethod: (method: PaymentMethod) => void
  setTipPercent: (percent: number) => void
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      paymentMethod: null,
      tipPercent: 0,
      setPaymentMethod: (paymentMethod) => set({ paymentMethod }),
      setTipPercent: (tipPercent) => set({ tipPercent }),
    }),
    {
      name: 'tienda-preferences',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
