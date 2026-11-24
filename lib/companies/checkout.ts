// "Cuenta de empresa" in the checkout. Pure, safe on client and server.
//
// The page reads the option on the server (lib/companies/server.ts) and the
// form re-checks it as the cart, the tip or the coupon change, so the
// employee sees why the company cannot pay before tapping "Pagar". The
// database decides for real on submit (`authorize_corporate_payment`).
import { tipExceeds } from '@/lib/companies/budget'
import { formatCOP } from '@/lib/format'

/** What the checkout needs to show "Cuenta de empresa — X". */
export interface CorporateCheckoutOption {
  companyName: string
  /** The most this person can charge now: budget left or credit left. */
  available: number
  perOrderLimit: number | null
  maxTipPct: number
  /** Why the option cannot be used today, or null when it can. */
  blocked: string | null
}

/**
 * Why this order cannot go on the company's account, or null when it can.
 * Same order as the database: the company first, then the per-order cap, the
 * tip, and what is left of the budget and the credit line.
 */
export function corporateCheckoutIssue(
  option: CorporateCheckoutOption,
  order: { total: number; subtotal: number; tip: number },
): string | null {
  if (option.blocked) return option.blocked
  if (option.perOrderLimit !== null && order.total > option.perOrderLimit)
    return `Supera tu tope por pedido de ${formatCOP(option.perOrderLimit)}.`
  if (tipExceeds(order, option.maxTipPct))
    return option.maxTipPct === 0
      ? 'Tu empresa no cubre propina: quítala para pagar con la cuenta de empresa.'
      : `Tu empresa cubre propina hasta del ${option.maxTipPct} %. Bájala para pagar con la cuenta de empresa.`
  if (order.total > option.available)
    return `Supera lo que tienes disponible: ${formatCOP(option.available)}.`
  return null
}
