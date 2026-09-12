import { z } from 'zod'
import { moveItem } from '@/lib/menu/reorder'
import {
  THEME_BANNER_LAYOUTS,
  THEME_BUTTON_STYLES,
  THEME_FONTS,
  THEME_SECTIONS,
  type ThemeSection,
} from '@/types/app'

/** Six digit hex with hash, the only shape `<input type="color">` emits. */
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i

const hexColor = z
  .string()
  .trim()
  .regex(HEX_COLOR_PATTERN, 'Usa un color hexadecimal como #C2410C.')

const nullableUrl = z
  .string()
  .trim()
  .url('Ingresa una URL válida.')
  .max(500)
  .nullable()

export const storeThemeSchema = z.object({
  primary: hexColor,
  accent: hexColor,
  background: hexColor,
  surface: hexColor,
  text: hexColor,
  radius: z
    .number({ error: 'Ingresa un radio válido.' })
    .int('Usa píxeles enteros.')
    .min(0, 'El radio mínimo es 0.')
    .max(64, 'El radio máximo es 64.'),
  fontDisplay: z.enum(THEME_FONTS, { error: 'Elige una tipografía.' }),
  fontBody: z.enum(THEME_FONTS, { error: 'Elige una tipografía.' }),
  banner: z.object({
    imageUrl: nullableUrl,
    overlayOpacity: z
      .number({ error: 'Ingresa una opacidad válida.' })
      .min(0, 'La opacidad mínima es 0.')
      .max(1, 'La opacidad máxima es 1.'),
    layout: z.enum(THEME_BANNER_LAYOUTS, { error: 'Elige un diseño.' }),
  }),
  logoUrl: nullableUrl,
  sectionOrder: z
    .array(z.enum(THEME_SECTIONS, { error: 'Sección desconocida.' }))
    .refine(
      (order) =>
        order.length === THEME_SECTIONS.length &&
        THEME_SECTIONS.every((section) => order.includes(section)),
      'El orden debe incluir todas las secciones una sola vez.',
    ),
  buttonStyle: z.enum(THEME_BUTTON_STYLES, { error: 'Elige un estilo.' }),
})
export type StoreThemeInput = z.input<typeof storeThemeSchema>
export type StoreThemeValues = z.output<typeof storeThemeSchema>

export const THEME_SECTION_LABELS: Record<ThemeSection, string> = {
  hero: 'Portada',
  featured: 'Destacados',
  menu: 'Menú',
  info: 'Información',
}

/** Swaps a section with its neighbour; boundaries return the same order. */
export function moveSection(
  order: readonly ThemeSection[],
  section: ThemeSection,
  direction: 'up' | 'down',
): ThemeSection[] {
  const items = order.map((id, position) => ({ id, position }))
  return moveItem(items, section, direction).map((item) => item.id)
}
