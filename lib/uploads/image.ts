// Shared rules for merchant image uploads (store assets and product images).
// Pure helpers: no React, no Supabase.

export const MAX_IMAGE_BYTES = 3 * 1024 * 1024

export const EXTENSION_BY_TYPE: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

export const ACCEPTED_IMAGE_TYPES: readonly string[] =
  Object.keys(EXTENSION_BY_TYPE)

export const INVALID_IMAGE_TYPE_MESSAGE = 'Usa una imagen PNG, JPG o WebP.'
export const IMAGE_TOO_LARGE_MESSAGE = 'La imagen no puede superar 3 MB.'

export type ImageValidation = { ok: true } | { ok: false; error: string }

/** Client and server side check for type and size; type is checked first. */
export function validateImageFile(file: File): ImageValidation {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type))
    return { ok: false, error: INVALID_IMAGE_TYPE_MESSAGE }
  if (file.size > MAX_IMAGE_BYTES)
    return { ok: false, error: IMAGE_TOO_LARGE_MESSAGE }
  return { ok: true }
}

/**
 * Object key `${storeId}/${prefix}-${timestamp}.${ext}`. The first folder
 * segment must be the store id (storage policy `owns_store_folder`); the
 * timestamp busts CDN caches. Returns null for unsupported content types.
 */
export function imageObjectPath(
  storeId: string,
  prefix: string,
  contentType: string,
  timestamp: number,
): string | null {
  const extension = EXTENSION_BY_TYPE[contentType]
  if (!extension) return null
  return `${storeId}/${prefix}-${timestamp}.${extension}`
}
