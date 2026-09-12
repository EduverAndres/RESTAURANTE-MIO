/**
 * Export / import of a theme as a JSON file.
 *
 * An imported file is never trusted: it goes through `normalizeTheme` (which
 * clamps, drops unknown keys and sanitises the custom CSS) and then has to
 * clear the Phase 2 zod schema before the editor will show it. A file can
 * therefore make the storefront ugly, but it cannot make it invalid and it
 * cannot smuggle anything into the page.
 */

import { slugify } from '@/lib/slug'
import { normalizeTheme } from '@/lib/theme'
import { storeThemeSchema } from '@/lib/validations/theme'
import type { StoreTheme } from '@/types/app'

/** Marks a file as ours; an unmarked bare theme object is accepted too. */
export const THEME_EXPORT_KIND = 'tienda.store-theme'
export const THEME_EXPORT_VERSION = 1

/** A theme is ~2 KB; anything past this is not a theme file. */
export const MAX_IMPORT_BYTES = 64 * 1024

export interface ThemeExportFile {
  kind: typeof THEME_EXPORT_KIND
  version: number
  theme: StoreTheme
}

export type ThemeImportResult =
  { ok: true; theme: StoreTheme } | { ok: false; error: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Pretty printed so a merchant can open the file and read it. */
export function exportTheme(theme: StoreTheme): string {
  const file: ThemeExportFile = {
    kind: THEME_EXPORT_KIND,
    version: THEME_EXPORT_VERSION,
    theme,
  }
  return `${JSON.stringify(file, null, 2)}\n`
}

/**
 * Parses an exported file (or a bare theme object) into a complete theme.
 * Missing fields fall back to the defaults instead of failing, so a partial
 * file still works, while a file that cannot be read at all is refused.
 */
export function importTheme(text: string): ThemeImportResult {
  if (typeof text !== 'string' || text.trim().length === 0) {
    return { ok: false, error: 'El archivo está vacío.' }
  }
  if (new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) {
    return {
      ok: false,
      error: 'El archivo es demasiado grande para ser un tema.',
    }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return {
      ok: false,
      error: 'No pudimos leer el archivo: no es un JSON válido.',
    }
  }
  if (!isRecord(parsed)) {
    return { ok: false, error: 'El archivo no contiene un tema.' }
  }

  const raw = isRecord(parsed.theme) ? parsed.theme : parsed
  const theme = normalizeTheme(raw)

  const validated = storeThemeSchema.safeParse(theme)
  if (!validated.success) {
    return {
      ok: false,
      error:
        validated.error.issues[0]?.message ??
        'El tema del archivo no es válido.',
    }
  }

  return { ok: true, theme }
}

/** `tema-<tienda>.json`, safe on every file system. */
export function themeFileName(storeName: string): string {
  const slug = slugify(storeName ?? '')
  return `tema-${slug || 'tienda'}.json`
}
