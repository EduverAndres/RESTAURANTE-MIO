// Builds prefilled wa.me links. Used as the notification fallback for
// restaurants without a WhatsApp Business API and as the customer contact
// button on the tracking page. Pure module.
import { formatCOP } from '@/lib/format'
import { ORDER_TYPE_LABELS } from '@/lib/orders/status'
import type { OrderItemOption, OrderType } from '@/types/app'

const COLOMBIA_CODE = '57'

/** Digits only, with the Colombian country code assumed for local numbers. */
export function normalizePhone(
  phone: string | null | undefined,
): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 7) return null
  if (digits.length === 10 && digits.startsWith('3'))
    return `${COLOMBIA_CODE}${digits}`
  return digits
}

export function buildWhatsAppUrl(
  phone: string | null | undefined,
  message: string,
): string | null {
  const normalized = normalizePhone(phone)
  if (!normalized) return null
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`
}

export interface OrderMessageInput {
  shortCode: string
  storeName: string
  customerName: string
  type: OrderType
  items: { name: string; quantity: number; options: OrderItemOption[] }[]
  total: number
  address?: string | null
  tableNumber?: number | null
  notes?: string | null
}

function describeItem(item: OrderMessageInput['items'][number]): string {
  const options = item.options
    .map((option) => `${option.option}: ${option.value}`)
    .join(', ')
  return `${item.quantity}× ${item.name}${options ? ` (${options})` : ''}`
}

export function buildOrderMessage(input: OrderMessageInput): string {
  const lines = [
    `Pedido #${input.shortCode} · ${input.storeName}`,
    `Cliente: ${input.customerName}`,
    `Tipo: ${ORDER_TYPE_LABELS[input.type]}${input.tableNumber ? ` ${input.tableNumber}` : ''}`,
  ]
  if (input.address) lines.push(`Dirección: ${input.address}`)
  lines.push('', ...input.items.map((item) => `• ${describeItem(item)}`), '')
  if (input.notes) lines.push(`Notas: ${input.notes}`, '')
  lines.push(`Total: ${formatCOP(input.total)}`)
  return lines.join('\n')
}

export function buildCustomerInquiry(
  shortCode: string,
  storeName: string,
): string {
  return `Hola ${storeName}, tengo una consulta sobre mi pedido #${shortCode}.`
}
