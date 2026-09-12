import type {
  ThemeBadgeStyle,
  ThemeButtonStyle,
  ThemeFeaturedLayout,
  ThemeHeadingCase,
  ThemeHeadingWeight,
  ThemeHeroAlign,
  ThemeImageRatio,
  ThemeLetterSpacing,
  ThemeLogoSize,
  ThemeMode,
  ThemeProductHover,
  ThemeShowPrices,
} from '@/types/app'

/**
 * Editor labels for the theme options Phase 2 did not already name.
 *
 * The maps that already exist (`THEME_SECTION_LABELS`, `THEME_PATTERN_LABELS`,
 * `THEME_DENSITY_LABELS`, `THEME_CARD_STYLE_LABELS`,
 * `THEME_MENU_LAYOUT_LABELS`, `THEME_CATEGORY_NAV_LABELS`,
 * `THEME_IMAGE_SHAPE_LABELS`, `THEME_BANNER_LAYOUT_LABELS` and
 * `THEME_MOTION_LABELS`) live in lib/validations/theme and are imported from
 * there — they are not restated here.
 *
 * Neutral Spanish, tuteo, written for someone who runs a restaurant and not a
 * design studio.
 */

export const THEME_MODE_LABELS: Record<ThemeMode, string> = {
  light: 'Claro',
  dark: 'Oscuro',
  auto: 'Según el cliente',
}

export const THEME_BUTTON_STYLE_LABELS: Record<ThemeButtonStyle, string> = {
  pill: 'Redondeado',
  rounded: 'Esquinas suaves',
  square: 'Recto',
}

export const THEME_HEADING_WEIGHT_LABELS: Record<ThemeHeadingWeight, string> = {
  400: 'Fino',
  500: 'Normal',
  600: 'Medio',
  700: 'Grueso',
  800: 'Muy grueso',
}

export const THEME_HEADING_CASE_LABELS: Record<ThemeHeadingCase, string> = {
  normal: 'Como lo escribes',
  uppercase: 'TODO EN MAYÚSCULAS',
}

export const THEME_LETTER_SPACING_LABELS: Record<ThemeLetterSpacing, string> = {
  tight: 'Junto',
  normal: 'Normal',
  wide: 'Separado',
}

export const THEME_IMAGE_RATIO_LABELS: Record<ThemeImageRatio, string> = {
  '1:1': 'Cuadrada',
  '4:3': 'Clásica',
  '3:2': 'Foto',
  '16:9': 'Panorámica',
}

export const THEME_PRODUCT_HOVER_LABELS: Record<ThemeProductHover, string> = {
  lift: 'Se levanta',
  zoom: 'Se acerca la foto',
  reveal: 'Aparece el detalle',
  none: 'Sin efecto',
}

export const THEME_SHOW_PRICES_LABELS: Record<ThemeShowPrices, string> = {
  always: 'Siempre visibles',
  'on-hover': 'Al pasar el cursor',
}

export const THEME_BADGE_STYLE_LABELS: Record<ThemeBadgeStyle, string> = {
  solid: 'Rellenas',
  soft: 'Suaves',
  outline: 'Con borde',
}

export const THEME_HERO_ALIGN_LABELS: Record<ThemeHeroAlign, string> = {
  left: 'A la izquierda',
  center: 'Al centro',
}

export const THEME_LOGO_SIZE_LABELS: Record<ThemeLogoSize, string> = {
  sm: 'Pequeño',
  md: 'Mediano',
  lg: 'Grande',
}

export const THEME_FEATURED_LAYOUT_LABELS: Record<ThemeFeaturedLayout, string> =
  {
    carousel: 'Carrusel',
    bento: 'Mosaico',
    row: 'Fila',
  }

/**
 * Crop ratio of the cover image for each hero layout, so the merchant frames
 * the photo the way it will actually be shown.
 */
export const BANNER_CROP_ASPECT: Record<string, number> = {
  full: 16 / 9,
  split: 4 / 5,
  compact: 21 / 9,
  editorial: 3 / 4,
  video: 16 / 9,
}
