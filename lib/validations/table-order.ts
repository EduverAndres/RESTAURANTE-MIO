import { z } from 'zod'
import { cartItemSchema } from '@/lib/validations/checkout'

// Shared by the table checkout form (client) and placeTableOrder (server).
// The table itself is never part of the payload: the server resolves it from
// the QR token in the URL so a guest cannot pick another table number.

export const TABLE_PAYMENT_METHODS = ['cash', 'mock', 'wompi'] as const
export type TablePaymentMethod = (typeof TABLE_PAYMENT_METHODS)[number]

/** Copy for the payment choices in table mode (cash is paid at the table). */
export const TABLE_PAYMENT_LABELS: Record<
  TablePaymentMethod,
  { label: string; description: string }
> = {
  cash: {
    label: 'Pagar en la mesa',
    description: 'Pagas en efectivo o datáfono cuando te atiendan.',
  },
  mock: {
    label: 'Tarjeta de prueba',
    description: 'Pago simulado para desarrollo. Se aprueba al instante.',
  },
  wompi: {
    label: 'Tarjeta, PSE o Nequi',
    description: 'Pago seguro con Wompi.',
  },
}

export const tableOrderSchema = z.object({
  guestName: z
    .string()
    .trim()
    .min(2, 'Dinos tu nombre (mínimo 2 letras).')
    .max(60, 'El nombre es demasiado largo.'),
  notes: z
    .string()
    .trim()
    .max(300, 'Las notas son demasiado largas.')
    .default(''),
  paymentMethod: z.enum(TABLE_PAYMENT_METHODS, {
    error: 'Elige cómo quieres pagar.',
  }),
  items: z.array(cartItemSchema).min(1, 'Tu carrito está vacío.'),
})
export type TableOrderInput = z.input<typeof tableOrderSchema>
export type TableOrderValues = z.output<typeof tableOrderSchema>

/**
 * Notes stored on the order. Anonymous guests have no profile, so their name
 * travels in the notes where the kitchen and the kanban card can read it.
 */
export function guestOrderNotes(
  guestName: string,
  notes: string,
  anonymous: boolean,
): string | null {
  const trimmed = notes.trim()
  if (!anonymous) return trimmed || null
  const prefix = `Mesa a nombre de ${guestName.trim()}`
  return trimmed ? `${prefix} · ${trimmed}` : prefix
}
