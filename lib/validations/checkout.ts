import { z } from 'zod'

// Shared by the checkout form (client) and the placeOrder action (server).
// Prices are never accepted from the client: only product ids, option value
// ids and quantities travel, and the server re-prices from the database.

export const cartItemSchema = z.object({
  productId: z.uuid('Producto inválido.'),
  quantity: z.number().int().min(1).max(50),
  optionValueIds: z.array(z.uuid()).max(30).default([]),
  notes: z
    .string()
    .trim()
    .max(200, 'Las notas son demasiado largas.')
    .default(''),
})
export type CartItemPayload = z.infer<typeof cartItemSchema>

export const addressSchema = z.object({
  label: z.string().trim().min(1, 'Ponle un nombre, por ejemplo Casa.').max(40),
  line1: z.string().trim().min(5, 'Ingresa la dirección completa.').max(120),
  line2: z.string().trim().max(120).optional().default(''),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  is_default: z.boolean().default(false),
})
export type AddressInput = z.input<typeof addressSchema>
export type AddressValues = z.output<typeof addressSchema>

export const CHECKOUT_TYPES = ['delivery', 'pickup'] as const
export const SCHEDULE_KINDS = ['asap', 'scheduled'] as const

export const checkoutSchema = z
  .object({
    storeId: z.uuid(),
    type: z.enum(CHECKOUT_TYPES, {
      error: 'Elige cómo quieres recibir el pedido.',
    }),
    addressId: z.uuid().nullable().default(null),
    schedule: z.enum(SCHEDULE_KINDS).default('asap'),
    scheduledAt: z.string().datetime({ offset: true }).nullable().default(null),
    paymentMethod: z.enum(['cash', 'mock', 'wompi', 'mercadopago'], {
      error: 'Elige un método de pago.',
    }),
    tipPercent: z.number().int().min(0).max(50).default(0),
    notes: z
      .string()
      .trim()
      .max(300, 'Las notas son demasiado largas.')
      .default(''),
    items: z.array(cartItemSchema).min(1, 'Tu carrito está vacío.'),
  })
  .superRefine((value, ctx) => {
    if (value.type === 'delivery' && !value.addressId) {
      ctx.addIssue({
        code: 'custom',
        path: ['addressId'],
        message: 'Selecciona una dirección de entrega.',
      })
    }
    if (value.schedule === 'scheduled') {
      const when = value.scheduledAt ? new Date(value.scheduledAt) : null
      if (
        !when ||
        Number.isNaN(when.getTime()) ||
        when.getTime() < Date.now() + 15 * 60 * 1000
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['scheduledAt'],
          message:
            'Programa el pedido con al menos 15 minutos de anticipación.',
        })
      }
    }
  })
export type CheckoutInput = z.input<typeof checkoutSchema>
export type CheckoutValues = z.output<typeof checkoutSchema>

export const reviewSchema = z.object({
  orderId: z.uuid(),
  rating: z.number().int().min(1, 'Elige una calificación.').max(5),
  comment: z
    .string()
    .trim()
    .max(500, 'El comentario es demasiado largo.')
    .default(''),
})
export type ReviewInput = z.input<typeof reviewSchema>
