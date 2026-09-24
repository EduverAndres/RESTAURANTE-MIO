import { z } from 'zod'

/** Order identifier as received from the browser: a UUID, never a short code. */
export const orderIdSchema = z.uuid('Pedido inválido.')
