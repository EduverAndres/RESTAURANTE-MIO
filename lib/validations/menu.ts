import { z } from 'zod'
import { optionGroupIssue } from '@/lib/menu/options'
import { parseTags } from '@/lib/menu/tags'
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  imageObjectPath,
} from '@/lib/uploads/image'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const uuid = (message: string) => z.string().regex(UUID_PATTERN, message)

const MAX_MONEY = 10_000_000

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Ingresa el nombre de la categoría.')
    .max(40, 'El nombre es demasiado largo.'),
})
export type CategoryInput = z.input<typeof categorySchema>
export type CategoryValues = z.output<typeof categorySchema>

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export const productSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Ingresa el nombre del producto.')
    .max(80, 'El nombre es demasiado largo.'),
  description: z
    .string()
    .trim()
    .max(300, 'La descripción es demasiado larga.')
    .transform((value) => (value ? value : null)),
  price: z
    .number({ error: 'Ingresa un precio válido.' })
    .min(0, 'El precio no puede ser negativo.')
    .max(MAX_MONEY, 'El precio es demasiado alto.'),
  is_available: z.boolean(),
  tags: z
    .string()
    .max(400, 'Demasiadas etiquetas.')
    .transform((value) => parseTags(value)),
  category_id: uuid('Categoría inválida.').nullable(),
})
export type ProductInput = z.input<typeof productSchema>
export type ProductValues = z.output<typeof productSchema>

// ---------------------------------------------------------------------------
// Option groups
// ---------------------------------------------------------------------------

export const optionValueSchema = z.object({
  id: uuid('Opción inválida.').optional(),
  name: z
    .string()
    .trim()
    .min(1, 'Ingresa el nombre de la opción.')
    .max(40, 'El nombre es demasiado largo.'),
  price_delta: z
    .number({ error: 'Ingresa un valor válido.' })
    .min(-MAX_MONEY, 'El valor es demasiado bajo.')
    .max(MAX_MONEY, 'El valor es demasiado alto.'),
})

export const optionGroupSchema = z
  .object({
    id: uuid('Grupo inválido.').optional(),
    name: z
      .string()
      .trim()
      .min(1, 'Ingresa el nombre del grupo.')
      .max(40, 'El nombre es demasiado largo.'),
    required: z.boolean(),
    min: z
      .number({ error: 'Ingresa un mínimo válido.' })
      .int('Usa números enteros.')
      .min(0, 'El mínimo no puede ser negativo.')
      .max(20, 'El mínimo es demasiado alto.'),
    max: z
      .number({ error: 'Ingresa un máximo válido.' })
      .int('Usa números enteros.')
      .min(1, 'El máximo debe ser al menos 1.')
      .max(20, 'El máximo es demasiado alto.'),
    values: z
      .array(optionValueSchema)
      .min(1, 'Agrega al menos una opción al grupo.')
      .max(20, 'Demasiadas opciones en el grupo.'),
  })
  .superRefine((group, ctx) => {
    const issue = optionGroupIssue({
      required: group.required,
      min: group.min,
      max: group.max,
      valueCount: group.values.length,
    })
    if (issue) ctx.addIssue({ code: 'custom', message: issue, path: ['max'] })
  })
export type OptionGroupInput = z.input<typeof optionGroupSchema>
export type OptionGroupValues = z.output<typeof optionGroupSchema>

export const optionGroupsSchema = z
  .array(optionGroupSchema)
  .max(10, 'Demasiados grupos de opciones.')

/** Full product sheet payload: base fields plus its option groups. */
export const productFormSchema = productSchema.extend({
  options: optionGroupsSchema,
})
export type ProductFormInput = z.input<typeof productFormSchema>
export type ProductFormValues = z.output<typeof productFormSchema>

// ---------------------------------------------------------------------------
// Images (storage bucket product-images, keyed `${storeId}/...`)
// ---------------------------------------------------------------------------

/** Shared image rules live in `lib/uploads/image`; these keep old imports. */
export const MAX_PRODUCT_IMAGE_BYTES = MAX_IMAGE_BYTES
export const ACCEPTED_PRODUCT_IMAGE_TYPES = ACCEPTED_IMAGE_TYPES

/** Object key `${storeId}/product-${timestamp}.${ext}` (see imageObjectPath). */
export function productImageObjectPath(
  storeId: string,
  contentType: string,
  timestamp: number,
): string | null {
  return imageObjectPath(storeId, 'product', contentType, timestamp)
}
