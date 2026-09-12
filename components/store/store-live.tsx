'use client'

import {
  useRealtimeChannel,
  useRealtimeRefresh,
} from '@/components/providers/realtime-provider'

/**
 * Flips the storefront when the merchant changes the store row.
 *
 * `stores` is safe to publish: its SELECT policy is `status = 'active' or
 * owner_id = auth.uid()`, i.e. data the storefront already renders publicly.
 * A refresh re-derives the whole skin on the server — open/closed chip,
 * schedule, theme, delivery fee — instead of patching one field in the
 * browser.
 */
export function StoreLive({ storeId }: { storeId: string }) {
  const refresh = useRealtimeRefresh()

  useRealtimeChannel({
    name: `store-${storeId}`,
    table: 'stores',
    event: 'UPDATE',
    filter: `id=eq.${storeId}`,
    onEvent: () => refresh(),
  })

  return null
}
