import { z } from 'zod'
import { moveItem } from '@/lib/menu/reorder'
import { isHeroVideoUrl, isSocialHandle, sanitizeCustomCss } from '@/lib/theme'
import {
  DEFAULT_STORE_THEME,
  THEME_BADGE_STYLES,
  THEME_BANNER_LAYOUTS,
  THEME_BUTTON_STYLES,
  THEME_CARD_STYLES,
  THEME_CATEGORY_NAVS,
  THEME_CORE_SECTIONS,
  THEME_DENSITIES,
  THEME_FEATURED_LAYOUTS,
  THEME_FONTS,
  THEME_HEADING_CASES,
  THEME_HEADING_WEIGHTS,
  THEME_HERO_ALIGNS,
  THEME_IMAGE_RATIOS,
  THEME_IMAGE_SHAPES,
  THEME_LETTER_SPACINGS,
  THEME_LOGO_SIZES,
  THEME_MENU_LAYOUTS,
  THEME_MODES,
  THEME_MOTIONS,
  THEME_PATTERNS,
  THEME_PRODUCT_HOVERS,
  THEME_SECTIONS,
  THEME_SHOW_PRICES,
  type ThemeBannerLayout,
  type ThemeCardStyle,
  type ThemeCategoryNav,
  type ThemeDensity,
  type ThemeImageShape,
  type ThemeMenuLayout,
  type ThemeMotion,
  type ThemePattern,
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

/** Hero background video: https only, and only an mp4 file. */
const heroVideoUrl = z
  .string()
  .trim()
  .max(500)
  .refine(isHeroVideoUrl, 'Usa un video MP4 servido por https.')
  .nullable()
  .default(null)

/** `@usuario` or a profile link. */
const socialHandle = z
  .string()
  .trim()
  .max(64, 'Máximo 64 caracteres.')
  .refine(isSocialHandle, 'Usa un @usuario o un enlace.')
  .nullable()
  .default(null)

export const storeThemeSchema = z.object({
  // Identity
  mode: z.enum(THEME_MODES, { error: 'Elige un modo.' }).default('light'),
  logoUrl: nullableUrl,

  // Colour
  primary: hexColor,
  onPrimary: hexColor.default(DEFAULT_STORE_THEME.onPrimary),
  secondary: hexColor.default(DEFAULT_STORE_THEME.secondary),
  accent: hexColor,
  background: hexColor,
  surface: hexColor,
  text: hexColor,
  gradient: z
    .object({
      enabled: z.boolean().default(false),
      from: hexColor.default(DEFAULT_STORE_THEME.gradient.from),
      to: hexColor.default(DEFAULT_STORE_THEME.gradient.to),
      angle: z
        .number({ error: 'Ingresa un ángulo válido.' })
        .min(0, 'El ángulo mínimo es 0.')
        .max(360, 'El ángulo máximo es 360.')
        .default(DEFAULT_STORE_THEME.gradient.angle),
    })
    .default(DEFAULT_STORE_THEME.gradient),
  pattern: z
    .enum(THEME_PATTERNS, { error: 'Elige una textura.' })
    .default('none'),
  patternOpacity: z
    .number({ error: 'Ingresa una opacidad válida.' })
    .min(0, 'La opacidad mínima es 0.')
    .max(0.2, 'La opacidad máxima es 0.2.')
    .default(DEFAULT_STORE_THEME.patternOpacity),

  // Typography
  fontDisplay: z.enum(THEME_FONTS, { error: 'Elige una tipografía.' }),
  fontBody: z.enum(THEME_FONTS, { error: 'Elige una tipografía.' }),
  headingWeight: z
    .literal(THEME_HEADING_WEIGHTS, { error: 'Elige un grosor.' })
    .default(DEFAULT_STORE_THEME.headingWeight),
  headingCase: z
    .enum(THEME_HEADING_CASES, { error: 'Elige un formato.' })
    .default('normal'),
  letterSpacing: z
    .enum(THEME_LETTER_SPACINGS, { error: 'Elige un espaciado.' })
    .default('normal'),

  // Shape and rhythm
  radius: z
    .number({ error: 'Ingresa un radio válido.' })
    .int('Usa píxeles enteros.')
    .min(0, 'El radio mínimo es 0.')
    .max(64, 'El radio máximo es 64.'),
  buttonStyle: z.enum(THEME_BUTTON_STYLES, { error: 'Elige un estilo.' }),
  density: z
    .enum(THEME_DENSITIES, { error: 'Elige una densidad.' })
    .default('comfortable'),
  cardStyle: z
    .enum(THEME_CARD_STYLES, { error: 'Elige un estilo de tarjeta.' })
    .default('elevated'),
  imageRatio: z
    .enum(THEME_IMAGE_RATIOS, { error: 'Elige una proporción.' })
    .default('4:3'),
  imageShape: z
    .enum(THEME_IMAGE_SHAPES, { error: 'Elige una forma.' })
    .default('rounded'),

  // Hero
  banner: z.object({
    imageUrl: nullableUrl,
    overlayOpacity: z
      .number({ error: 'Ingresa una opacidad válida.' })
      .min(0, 'La opacidad mínima es 0.')
      .max(1, 'La opacidad máxima es 1.'),
    layout: z.enum(THEME_BANNER_LAYOUTS, { error: 'Elige un diseño.' }),
  }),
  hero: z
    .object({
      align: z
        .enum(THEME_HERO_ALIGNS, { error: 'Elige una alineación.' })
        .default('left'),
      showLogo: z.boolean().default(true),
      logoSize: z
        .enum(THEME_LOGO_SIZES, { error: 'Elige un tamaño.' })
        .default('md'),
      tagline: z
        .string()
        .trim()
        .max(80, 'Máximo 80 caracteres.')
        .nullable()
        .default(null),
      showRating: z.boolean().default(true),
      showEta: z.boolean().default(true),
      showSchedule: z.boolean().default(true),
      ctaLabel: z
        .string()
        .trim()
        .max(24, 'Máximo 24 caracteres.')
        .nullable()
        .default(null),
      videoUrl: heroVideoUrl,
    })
    .default(DEFAULT_STORE_THEME.hero),

  // Menu
  menuLayout: z
    .enum(THEME_MENU_LAYOUTS, { error: 'Elige un diseño de menú.' })
    .default('grid'),
  categoryNav: z
    .enum(THEME_CATEGORY_NAVS, { error: 'Elige una navegación.' })
    .default('chips'),
  productHover: z
    .enum(THEME_PRODUCT_HOVERS, { error: 'Elige un efecto.' })
    .default('lift'),
  showPrices: z
    .enum(THEME_SHOW_PRICES, { error: 'Elige cuándo mostrar los precios.' })
    .default('always'),
  badges: z
    .object({
      newDays: z
        .number({ error: 'Ingresa un número de días válido.' })
        .int('Usa días enteros.')
        .min(0, 'El mínimo es 0 días.')
        .max(365, 'El máximo es 365 días.')
        .default(DEFAULT_STORE_THEME.badges.newDays),
      popularEnabled: z.boolean().default(true),
      style: z
        .enum(THEME_BADGE_STYLES, { error: 'Elige un estilo.' })
        .default('soft'),
    })
    .default(DEFAULT_STORE_THEME.badges),

  // Sections
  sectionOrder: z
    .array(z.enum(THEME_SECTIONS, { error: 'Sección desconocida.' }))
    .refine(
      (order) => new Set(order).size === order.length,
      'No repitas una sección.',
    )
    .refine(
      (order) =>
        THEME_CORE_SECTIONS.every((section) => order.includes(section)),
      'El orden debe incluir todas las secciones principales.',
    ),
  featured: z
    .object({
      title: z
        .string()
        .trim()
        .min(1, 'Escribe un título.')
        .max(60, 'Máximo 60 caracteres.')
        .default(DEFAULT_STORE_THEME.featured.title),
      productIds: z
        .array(z.string().trim().max(64))
        .max(12, 'Máximo 12 productos destacados.')
        .default([]),
      layout: z
        .enum(THEME_FEATURED_LAYOUTS, { error: 'Elige un diseño.' })
        .default('carousel'),
    })
    .default(DEFAULT_STORE_THEME.featured),
  story: z
    .object({
      enabled: z.boolean().default(false),
      title: z
        .string()
        .trim()
        .min(1, 'Escribe un título.')
        .max(60, 'Máximo 60 caracteres.')
        .default(DEFAULT_STORE_THEME.story.title),
      text: z.string().trim().max(600, 'Máximo 600 caracteres.').default(''),
      imageUrl: nullableUrl.default(null),
    })
    .default(DEFAULT_STORE_THEME.story),
  social: z
    .object({
      instagram: socialHandle,
      tiktok: socialHandle,
      facebook: socialHandle,
      whatsapp: z.boolean().default(false),
    })
    .default(DEFAULT_STORE_THEME.social),
  footer: z
    .object({
      text: z
        .string()
        .trim()
        .max(200, 'Máximo 200 caracteres.')
        .nullable()
        .default(null),
      showMap: z.boolean().default(true),
      showSchedule: z.boolean().default(true),
    })
    .default(DEFAULT_STORE_THEME.footer),

  // Extras
  motion: z
    .enum(THEME_MOTIONS, { error: 'Elige una animación.' })
    .default('full'),
  customCss: z
    .string()
    .max(4096, 'El CSS personalizado no puede superar 4 KB.')
    .nullable()
    .default(null)
    .transform((value) => sanitizeCustomCss(value)),
})
export type StoreThemeInput = z.input<typeof storeThemeSchema>
export type StoreThemeValues = z.output<typeof storeThemeSchema>

// ---------------------------------------------------------------------------
// Editor labels (neutral Spanish)
// ---------------------------------------------------------------------------

export const THEME_SECTION_LABELS: Record<ThemeSection, string> = {
  hero: 'Portada',
  featured: 'Destacados',
  story: 'Nuestra historia',
  menu: 'Menú',
  info: 'Información',
  reviews: 'Reseñas',
  social: 'Redes sociales',
}

export const THEME_PATTERN_LABELS: Record<ThemePattern, string> = {
  none: 'Sin textura',
  dots: 'Puntos',
  grid: 'Cuadrícula',
  noise: 'Grano',
  diagonal: 'Diagonales',
  waves: 'Ondas',
}

export const THEME_DENSITY_LABELS: Record<ThemeDensity, string> = {
  compact: 'Compacta',
  comfortable: 'Equilibrada',
  spacious: 'Amplia',
}

export const THEME_CARD_STYLE_LABELS: Record<ThemeCardStyle, string> = {
  elevated: 'Con sombra',
  flat: 'Plana',
  outlined: 'Con borde',
  glass: 'Vidrio',
}

export const THEME_MENU_LAYOUT_LABELS: Record<ThemeMenuLayout, string> = {
  grid: 'Cuadrícula',
  list: 'Lista',
  magazine: 'Revista',
  masonry: 'Mosaico',
}

export const THEME_CATEGORY_NAV_LABELS: Record<ThemeCategoryNav, string> = {
  tabs: 'Pestañas',
  chips: 'Etiquetas',
  sidebar: 'Barra lateral',
  'sticky-bar': 'Barra fija',
}

export const THEME_IMAGE_SHAPE_LABELS: Record<ThemeImageShape, string> = {
  rounded: 'Redondeada',
  squircle: 'Cuadrado suave',
  circle: 'Círculo',
  arch: 'Arco',
}

export const THEME_BANNER_LAYOUT_LABELS: Record<ThemeBannerLayout, string> = {
  full: 'Completa',
  split: 'Dividida',
  compact: 'Compacta',
  editorial: 'Editorial',
  video: 'Video',
}

export const THEME_MOTION_LABELS: Record<ThemeMotion, string> = {
  full: 'Completas',
  subtle: 'Sutiles',
  none: 'Sin animación',
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
