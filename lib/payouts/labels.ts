// Spanish labels for payout statuses. Pure module, safe on client and server.
import type { PayoutDisplayStatus } from '@/lib/payouts/carry'
import type { StatusTone } from '@/lib/orders/status'

export const PAYOUT_STATUS_LABELS: Record<PayoutDisplayStatus, string> = {
  pending: 'Pendiente',
  paid: 'Pagada',
  carried: 'Arrastrada',
}

export const PAYOUT_STATUS_TONES: Record<PayoutDisplayStatus, StatusTone> = {
  pending: 'warning',
  paid: 'success',
  carried: 'neutral',
}
