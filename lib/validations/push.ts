import { z } from 'zod'

// Shape of the browser's PushSubscription.toJSON(): the fields the server
// needs to target the device (endpoint) and encrypt the payload (keys).
export const pushSubscriptionSchema = z.object({
  endpoint: z.url('Suscripción inválida.'),
  keys: z.object({
    p256dh: z.string().min(1, 'Suscripción inválida.'),
    auth: z.string().min(1, 'Suscripción inválida.'),
  }),
})
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>

export const deletePushSubscriptionSchema = z.object({
  endpoint: z.url('Suscripción inválida.'),
})
export type DeletePushSubscriptionInput = z.infer<
  typeof deletePushSubscriptionSchema
>
