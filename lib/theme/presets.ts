/**
 * Starting points for the theme editor.
 *
 * Each preset is a complete, already normalized `StoreTheme` that scores 100
 * on `auditTheme` — a merchant can apply one and be sure the storefront is
 * still readable. Presets carry *look* only: no logo, no cover, no product
 * picks and no copy, because `applyPreset` has to be safe to click on a shop
 * that is already set up.
 *
 * Thumbnails are generated from these colours and fonts in the editor, so
 * adding a preset never means adding an image asset.
 */

import { DEFAULT_STORE_THEME, type StoreTheme } from '@/types/app'

export interface ThemePreset {
  id: string
  /** Shown on the card. */
  name: string
  /** One neutral Spanish line explaining who it is for. */
  description: string
  theme: StoreTheme
}

/**
 * Every colour field has to be restated in canonical lowercase hex, otherwise
 * `normalizeTheme` would rewrite the preset and the editor would report a
 * change the merchant never made.
 */
function preset(
  id: string,
  name: string,
  description: string,
  theme: Partial<StoreTheme>,
): ThemePreset {
  return {
    id,
    name,
    description,
    theme: {
      ...DEFAULT_STORE_THEME,
      ...theme,
      logoUrl: null,
      banner: {
        ...DEFAULT_STORE_THEME.banner,
        ...theme.banner,
        imageUrl: null,
      },
      featured: {
        ...DEFAULT_STORE_THEME.featured,
        ...theme.featured,
        productIds: [],
      },
      story: { ...DEFAULT_STORE_THEME.story, ...theme.story },
      social: { ...DEFAULT_STORE_THEME.social, ...theme.social },
      footer: { ...DEFAULT_STORE_THEME.footer, ...theme.footer },
      hero: { ...DEFAULT_STORE_THEME.hero, ...theme.hero },
      badges: { ...DEFAULT_STORE_THEME.badges, ...theme.badges },
      customCss: null,
    },
  }
}

export const THEME_PRESETS: readonly ThemePreset[] = [
  preset(
    'elegante',
    'Elegante',
    'Para manteles largos: serif de autor, mucho aire y una paleta vino discreta.',
    {
      mode: 'light',
      primary: '#5b1e3d',
      onPrimary: '#ffffff',
      secondary: '#7c2d4f',
      accent: '#c99a6e',
      background: '#faf6f4',
      surface: '#ffffff',
      text: '#211119',
      gradient: { enabled: false, from: '#5b1e3d', to: '#c99a6e', angle: 135 },
      pattern: 'none',
      patternOpacity: 0.05,
      fontDisplay: 'Playfair Display',
      fontBody: 'DM Sans',
      headingWeight: 500,
      headingCase: 'normal',
      letterSpacing: 'wide',
      radius: 6,
      buttonStyle: 'rounded',
      density: 'spacious',
      cardStyle: 'flat',
      imageRatio: '3:2',
      imageShape: 'rounded',
      banner: { imageUrl: null, overlayOpacity: 0.45, layout: 'editorial' },
      menuLayout: 'magazine',
      categoryNav: 'tabs',
      productHover: 'reveal',
      showPrices: 'always',
      badges: { newDays: 21, popularEnabled: false, style: 'outline' },
      motion: 'subtle',
    },
  ),
  preset(
    'callejero',
    'Callejero',
    'Comida rápida sin vueltas: rojo fuerte, títulos en mayúsculas y esquinas rectas.',
    {
      mode: 'light',
      primary: '#dc2626',
      onPrimary: '#ffffff',
      secondary: '#7c2d12',
      accent: '#facc15',
      background: '#fffaf0',
      surface: '#ffffff',
      text: '#1c1917',
      gradient: { enabled: true, from: '#dc2626', to: '#facc15', angle: 120 },
      pattern: 'diagonal',
      patternOpacity: 0.07,
      fontDisplay: 'Space Grotesk',
      fontBody: 'Inter',
      headingWeight: 800,
      headingCase: 'uppercase',
      letterSpacing: 'normal',
      radius: 4,
      buttonStyle: 'square',
      density: 'comfortable',
      cardStyle: 'outlined',
      imageRatio: '4:3',
      imageShape: 'rounded',
      banner: { imageUrl: null, overlayOpacity: 0.4, layout: 'full' },
      menuLayout: 'grid',
      categoryNav: 'chips',
      productHover: 'lift',
      showPrices: 'always',
      badges: { newDays: 10, popularEnabled: true, style: 'solid' },
      motion: 'full',
    },
  ),
  preset(
    'fresco',
    'Fresco',
    'Ensaladas, bowls y jugos: verdes claros, mucho blanco y fotos grandes.',
    {
      mode: 'light',
      primary: '#15803d',
      onPrimary: '#ffffff',
      secondary: '#166534',
      accent: '#84cc16',
      background: '#f4fbf5',
      surface: '#ffffff',
      text: '#12241a',
      gradient: { enabled: false, from: '#15803d', to: '#84cc16', angle: 150 },
      pattern: 'none',
      patternOpacity: 0.05,
      fontDisplay: 'Fraunces',
      fontBody: 'Inter',
      headingWeight: 600,
      headingCase: 'normal',
      letterSpacing: 'normal',
      radius: 24,
      buttonStyle: 'pill',
      density: 'spacious',
      cardStyle: 'elevated',
      imageRatio: '4:3',
      imageShape: 'squircle',
      banner: { imageUrl: null, overlayOpacity: 0.28, layout: 'split' },
      menuLayout: 'grid',
      categoryNav: 'chips',
      productHover: 'zoom',
      showPrices: 'always',
      badges: { newDays: 14, popularEnabled: true, style: 'soft' },
      motion: 'full',
    },
  ),
  preset(
    'nocturno',
    'Nocturno',
    'Bar o cena tarde: fondo oscuro, ámbar cálido y un aire de cocktail.',
    {
      mode: 'dark',
      primary: '#f59e0b',
      onPrimary: '#1c1917',
      secondary: '#fbbf24',
      accent: '#fb7185',
      background: '#0e0d0b',
      surface: '#1a1815',
      text: '#f3efe8',
      gradient: { enabled: true, from: '#f59e0b', to: '#fb7185', angle: 160 },
      pattern: 'noise',
      patternOpacity: 0.08,
      fontDisplay: 'Instrument Serif',
      fontBody: 'Geist',
      headingWeight: 400,
      headingCase: 'normal',
      letterSpacing: 'wide',
      radius: 16,
      buttonStyle: 'pill',
      density: 'comfortable',
      cardStyle: 'glass',
      imageRatio: '16:9',
      imageShape: 'rounded',
      banner: { imageUrl: null, overlayOpacity: 0.6, layout: 'full' },
      menuLayout: 'masonry',
      categoryNav: 'sticky-bar',
      productHover: 'reveal',
      showPrices: 'always',
      badges: { newDays: 14, popularEnabled: true, style: 'soft' },
      motion: 'subtle',
    },
  ),
  preset(
    'cafeteria',
    'Cafetería',
    'Café de barrio y panadería: tonos tostados, lista de productos y fotos redondas.',
    {
      mode: 'light',
      primary: '#7c5c3e',
      onPrimary: '#ffffff',
      secondary: '#5b4130',
      accent: '#c98b4b',
      background: '#f8f3ec',
      surface: '#fffdf9',
      text: '#2a211a',
      gradient: { enabled: false, from: '#7c5c3e', to: '#c98b4b', angle: 135 },
      pattern: 'grid',
      patternOpacity: 0.05,
      fontDisplay: 'Fraunces',
      fontBody: 'DM Sans',
      headingWeight: 600,
      headingCase: 'normal',
      letterSpacing: 'normal',
      radius: 12,
      buttonStyle: 'rounded',
      density: 'comfortable',
      cardStyle: 'outlined',
      imageRatio: '1:1',
      imageShape: 'circle',
      banner: { imageUrl: null, overlayOpacity: 0.35, layout: 'compact' },
      menuLayout: 'list',
      categoryNav: 'sidebar',
      productHover: 'lift',
      showPrices: 'always',
      badges: { newDays: 7, popularEnabled: true, style: 'soft' },
      motion: 'subtle',
    },
  ),
  preset(
    'mar',
    'Mar',
    'Pescados y mariscos: azules profundos, arcos y mucho espacio entre platos.',
    {
      mode: 'light',
      primary: '#0e7490',
      onPrimary: '#ffffff',
      secondary: '#155e75',
      accent: '#22d3ee',
      background: '#f1f8fb',
      surface: '#ffffff',
      text: '#0c2330',
      gradient: { enabled: true, from: '#0e7490', to: '#22d3ee', angle: 200 },
      pattern: 'waves',
      patternOpacity: 0.07,
      fontDisplay: 'Space Grotesk',
      fontBody: 'Inter',
      headingWeight: 700,
      headingCase: 'normal',
      letterSpacing: 'normal',
      radius: 28,
      buttonStyle: 'pill',
      density: 'spacious',
      cardStyle: 'elevated',
      imageRatio: '16:9',
      imageShape: 'arch',
      banner: { imageUrl: null, overlayOpacity: 0.42, layout: 'split' },
      menuLayout: 'grid',
      categoryNav: 'chips',
      productHover: 'zoom',
      showPrices: 'always',
      badges: { newDays: 14, popularEnabled: true, style: 'soft' },
      motion: 'full',
    },
  ),
  preset(
    'minimal',
    'Minimal',
    'Todo el foco en la comida: blanco, negro, sin sombras y sin adornos.',
    {
      mode: 'light',
      primary: '#18181b',
      onPrimary: '#ffffff',
      secondary: '#3f3f46',
      accent: '#52525b',
      background: '#ffffff',
      surface: '#fafafa',
      text: '#18181b',
      gradient: { enabled: false, from: '#18181b', to: '#52525b', angle: 135 },
      pattern: 'none',
      patternOpacity: 0,
      fontDisplay: 'Geist',
      fontBody: 'Geist',
      headingWeight: 500,
      headingCase: 'normal',
      letterSpacing: 'tight',
      radius: 0,
      buttonStyle: 'square',
      density: 'comfortable',
      cardStyle: 'flat',
      imageRatio: '1:1',
      imageShape: 'rounded',
      banner: { imageUrl: null, overlayOpacity: 0.2, layout: 'compact' },
      menuLayout: 'list',
      categoryNav: 'tabs',
      productHover: 'none',
      showPrices: 'always',
      badges: { newDays: 0, popularEnabled: false, style: 'outline' },
      motion: 'subtle',
    },
  ),
  preset(
    'fiesta',
    'Fiesta',
    'Postres, heladerías y celebraciones: fucsia, curvas grandes y confeti de puntos.',
    {
      mode: 'light',
      primary: '#be185d',
      onPrimary: '#ffffff',
      secondary: '#7e22ce',
      accent: '#f59e0b',
      background: '#fff5fa',
      surface: '#ffffff',
      text: '#2a1020',
      gradient: { enabled: true, from: '#be185d', to: '#7e22ce', angle: 135 },
      pattern: 'dots',
      patternOpacity: 0.1,
      fontDisplay: 'Fraunces',
      fontBody: 'Space Grotesk',
      headingWeight: 800,
      headingCase: 'normal',
      letterSpacing: 'normal',
      radius: 32,
      buttonStyle: 'pill',
      density: 'spacious',
      cardStyle: 'glass',
      imageRatio: '4:3',
      imageShape: 'squircle',
      banner: { imageUrl: null, overlayOpacity: 0.3, layout: 'full' },
      menuLayout: 'masonry',
      categoryNav: 'chips',
      productHover: 'lift',
      showPrices: 'always',
      badges: { newDays: 14, popularEnabled: true, style: 'solid' },
      motion: 'full',
    },
  ),
]

export function findPreset(id: string): ThemePreset | null {
  return THEME_PRESETS.find((preset) => preset.id === id) ?? null
}

/**
 * Applies the look of `preset` on top of `current` while keeping everything
 * the merchant typed or uploaded: images, product picks, section copy, social
 * handles and custom CSS. Sections the merchant had switched on are appended
 * to the preset's order rather than dropped, so applying a look never makes a
 * storefront lose a band.
 */
export function applyPreset(
  current: StoreTheme,
  preset: ThemePreset,
): StoreTheme {
  const sectionOrder = [...preset.theme.sectionOrder]
  for (const section of current.sectionOrder) {
    if (!sectionOrder.includes(section)) sectionOrder.push(section)
  }

  return {
    ...preset.theme,
    logoUrl: current.logoUrl,
    banner: { ...preset.theme.banner, imageUrl: current.banner.imageUrl },
    hero: {
      ...preset.theme.hero,
      tagline: current.hero.tagline,
      ctaLabel: current.hero.ctaLabel,
      videoUrl: current.hero.videoUrl,
    },
    sectionOrder,
    featured: {
      ...preset.theme.featured,
      title: current.featured.title,
      productIds: [...current.featured.productIds],
    },
    story: { ...current.story },
    social: { ...current.social },
    footer: { ...preset.theme.footer, text: current.footer.text },
    customCss: current.customCss,
  }
}
