import { z } from 'zod'
import { REFUND_METHODS, REFUND_REASONS } from '@/lib/refunds/vocabulary'

/** Long enough for "se devolvió en efectivo el martes, recibo 0042". */
export const REFUND_NOTE_MAX = 500

export const refundInputSchema = z.object({
  orderId: z.uuid('Pedido inválido.'),
  reason: z.enum(REFUND_REASONS, 'Selecciona un motivo válido.'),
  method: z.enum(REFUND_METHODS, 'Selecciona un medio de devolución válido.'),
  note: z
    .string()
    .max(
      REFUND_NOTE_MAX,
      `La nota no puede superar ${REFUND_NOTE_MAX} caracteres.`,
    )
    .nullish(),
})

export type RefundFormInput = z.infer<typeof refundInputSchema>
