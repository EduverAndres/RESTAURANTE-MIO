import { z } from 'zod'
import { DISH_COMMENT_MAX } from '@/lib/reviews/dish-rating'

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
    paymentMethod: z.enum(
      ['cash', 'mock', 'wompi', 'mercadopago', 'corporate'],
      {
        error: 'Elige un método de pago.',
      },
    ),
    tipPercent: z.number().int().min(0).max(50).default(0),
    notes: z
      .string()
      .trim()
      .max(300, 'Las notas son demasiado largas.')
      .default(''),
    items: z.array(cartItemSchema).min(1, 'Tu carrito está vacío.'),
    /** A store coupon; validated and priced on the server. */
    couponCode: z.string().trim().max(30).default(''),
    /** Spend a completed loyalty card on this order. */
    useReward: z.boolean().default(false),
    /** "Motivo o centro de costo" of an order paid with a company account. */
    corporateReference: z
      .string()
      .trim()
      .max(80, 'El motivo admite hasta 80 caracteres.')
      .default(''),
  })
  .superRefine((value, ctx) => {
    if (value.type === 'delivery' && !value.addressId) {
      ctx.addIssue({
        code: 'custom',
        path: ['addressId'],
        message: 'Selecciona una dirección de entrega.',
      })
    }
    if (value.paymentMethod === 'corporate' && value.useReward) {
      ctx.addIssue({
        code: 'custom',
        path: ['useReward'],
        message:
          'El premio de sellos es personal: no aplica en pedidos que paga tu empresa.',
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

export const dishReviewSchema = z.object({
  orderItemId: z.uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z
    .string()
    .trim()
    .max(
      DISH_COMMENT_MAX,
      `El comentario de un plato admite hasta ${DISH_COMMENT_MAX} caracteres.`,
    )
    .default(''),
})
export type DishReviewInput = z.input<typeof dishReviewSchema>

export const reviewSchema = z.object({
  orderId: z.uuid(),
  rating: z.number().int().min(1, 'Elige una calificación.').max(5),
  comment: z
    .string()
    .trim()
    .max(500, 'El comentario es demasiado largo.')
    .default(''),
  // Optional: rating the dishes never blocks rating the restaurant.
  items: z.array(dishReviewSchema).max(50).default([]),
})
export type ReviewInput = z.input<typeof reviewSchema>
