// Spanish labels for payout statuses. Pure module, safe on client and server.
import type { PayoutStatus } from '@/types/app'

export const PAYOUT_STATUS_LABELS: Record<PayoutStatus, string> = {
  pending: 'Pendiente',
  paid: 'Pagada',
}
