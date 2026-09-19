import type {
  Database,
  Enums,
  Tables,
  TablesInsert,
  TablesUpdate,
} from '@/types/database'

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
export type UserRole = Enums<'user_role'>
export type StoreStatus = Enums<'store_status'>
export type OrderType = Enums<'order_type'>
export type OrderStatus = Enums<'order_status'>
export type PaymentStatus = Enums<'payment_status'>
export type PaymentMethod = Enums<'payment_method'>
export type PayoutStatus = Enums<'payout_status'>

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------
export type Profile = Tables<'profiles'>
export type Store = Tables<'stores'>
export type MenuCategory = Tables<'menu_categories'>
export type Product = Tables<'products'>
export type ProductOption = Tables<'product_options'>
export type ProductOptionValue = Tables<'product_option_values'>
export type Address = Tables<'addresses'>
export type Order = Tables<'orders'>
export type OrderItem = Tables<'order_items'>
export type CourierLocation = Tables<'courier_locations'>
export type Review = Tables<'reviews'>
export type Favorite = Tables<'favorites'>
export type StoreTable = Tables<'store_tables'>
export type Payout = Tables<'payouts'>
export type PaymentEvent = Tables<'payment_events'>
export type Refund = Tables<'refunds'>
export type PushSubscriptionRow = Tables<'push_subscriptions'>

// ---------------------------------------------------------------------------
// Inserts / updates
// ---------------------------------------------------------------------------
export type ProfileUpdate = TablesUpdate<'profiles'>
export type StoreInsert = TablesInsert<'stores'>
export type StoreUpdate = TablesUpdate<'stores'>
export type MenuCategoryInsert = TablesInsert<'menu_categories'>
export type ProductInsert = TablesInsert<'products'>
export type ProductUpdate = TablesUpdate<'products'>
export type ProductOptionInsert = TablesInsert<'product_options'>
export type ProductOptionValueInsert = TablesInsert<'product_option_values'>
export type AddressInsert = TablesInsert<'addresses'>
export type OrderInsert = TablesInsert<'orders'>
export type OrderUpdate = TablesUpdate<'orders'>
export type OrderItemInsert = TablesInsert<'order_items'>
export type CourierLocationInsert = TablesInsert<'courier_locations'>
export type ReviewInsert = TablesInsert<'reviews'>
export type StoreTableInsert = TablesInsert<'store_tables'>
export type PaymentEventInsert = TablesInsert<'payment_events'>
export type RefundInsert = TablesInsert<'refunds'>
export type PushSubscriptionInsert = TablesInsert<'push_subscriptions'>

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------
export type StoresNearbyArgs =
  Database['public']['Functions']['stores_nearby']['Args']
export type NearbyStore =
  Database['public']['Functions']['stores_nearby']['Returns'][number]

// ---------------------------------------------------------------------------
// JSON column shapes
// ---------------------------------------------------------------------------
export const THEME_FONTS = [
  'Fraunces',
  'Instrument Serif',
  'Playfair Display',
  'Inter',
  'Geist',
  'DM Sans',
  'Space Grotesk',
] as const
export type ThemeFont = (typeof THEME_FONTS)[number]

export const THEME_BUTTON_STYLES = ['pill', 'rounded', 'square'] as const
export type ThemeButtonStyle = (typeof THEME_BUTTON_STYLES)[number]

export const THEME_BANNER_LAYOUTS = [
  'full',
  'split',
  'compact',
  'editorial',
  'video',
] as const
export type ThemeBannerLayout = (typeof THEME_BANNER_LAYOUTS)[number]

/**
 * Every section a storefront can render. `DEFAULT_STORE_THEME.sectionOrder`
 * holds the four that are on by default; the rest are opt-in, so a merchant
 * adds them to the order explicitly instead of having them appear on upgrade.
 */
export const THEME_SECTIONS = [
  'hero',
  'featured',
  'story',
  'menu',
  'info',
  'reviews',
  'social',
] as const
export type ThemeSection = (typeof THEME_SECTIONS)[number]

/** The sections every storefront always has; the others are opt-in. */
export const THEME_CORE_SECTIONS = [
  'hero',
  'featured',
  'menu',
  'info',
] as const satisfies readonly ThemeSection[]

export const THEME_MODES = ['light', 'dark', 'auto'] as const
export type ThemeMode = (typeof THEME_MODES)[number]

export const THEME_PATTERNS = [
  'none',
  'dots',
  'grid',
  'noise',
  'diagonal',
  'waves',
] as const
export type ThemePattern = (typeof THEME_PATTERNS)[number]

export const THEME_HEADING_WEIGHTS = [400, 500, 600, 700, 800] as const
export type ThemeHeadingWeight = (typeof THEME_HEADING_WEIGHTS)[number]

export const THEME_HEADING_CASES = ['normal', 'uppercase'] as const
export type ThemeHeadingCase = (typeof THEME_HEADING_CASES)[number]

export const THEME_LETTER_SPACINGS = ['tight', 'normal', 'wide'] as const
export type ThemeLetterSpacing = (typeof THEME_LETTER_SPACINGS)[number]

export const THEME_DENSITIES = ['compact', 'comfortable', 'spacious'] as const
export type ThemeDensity = (typeof THEME_DENSITIES)[number]

export const THEME_CARD_STYLES = [
  'elevated',
  'flat',
  'outlined',
  'glass',
] as const
export type ThemeCardStyle = (typeof THEME_CARD_STYLES)[number]

export const THEME_IMAGE_RATIOS = ['1:1', '4:3', '3:2', '16:9'] as const
export type ThemeImageRatio = (typeof THEME_IMAGE_RATIOS)[number]

export const THEME_IMAGE_SHAPES = [
  'rounded',
  'squircle',
  'circle',
  'arch',
] as const
export type ThemeImageShape = (typeof THEME_IMAGE_SHAPES)[number]

export const THEME_MENU_LAYOUTS = [
  'grid',
  'list',
  'magazine',
  'masonry',
] as const
export type ThemeMenuLayout = (typeof THEME_MENU_LAYOUTS)[number]

export const THEME_CATEGORY_NAVS = [
  'tabs',
  'chips',
  'sidebar',
  'sticky-bar',
] as const
export type ThemeCategoryNav = (typeof THEME_CATEGORY_NAVS)[number]

export const THEME_PRODUCT_HOVERS = ['lift', 'zoom', 'reveal', 'none'] as const
export type ThemeProductHover = (typeof THEME_PRODUCT_HOVERS)[number]

export const THEME_SHOW_PRICES = ['always', 'on-hover'] as const
export type ThemeShowPrices = (typeof THEME_SHOW_PRICES)[number]

export const THEME_BADGE_STYLES = ['solid', 'soft', 'outline'] as const
export type ThemeBadgeStyle = (typeof THEME_BADGE_STYLES)[number]

export const THEME_HERO_ALIGNS = ['left', 'center'] as const
export type ThemeHeroAlign = (typeof THEME_HERO_ALIGNS)[number]

export const THEME_LOGO_SIZES = ['sm', 'md', 'lg'] as const
export type ThemeLogoSize = (typeof THEME_LOGO_SIZES)[number]

export const THEME_FEATURED_LAYOUTS = ['carousel', 'bento', 'row'] as const
export type ThemeFeaturedLayout = (typeof THEME_FEATURED_LAYOUTS)[number]

export const THEME_MOTIONS = ['full', 'subtle', 'none'] as const
export type ThemeMotion = (typeof THEME_MOTIONS)[number]

export interface StoreThemeBanner {
  imageUrl: string | null
  overlayOpacity: number
  layout: ThemeBannerLayout
}

/** Optional brand wash painted behind the hero. */
export interface StoreThemeGradient {
  enabled: boolean
  from: string
  to: string
  angle: number
}

/** "Nuevo" / "Popular" pills on product cards. */
export interface StoreThemeBadges {
  newDays: number
  popularEnabled: boolean
  style: ThemeBadgeStyle
}

export interface StoreThemeHero {
  align: ThemeHeroAlign
  showLogo: boolean
  logoSize: ThemeLogoSize
  tagline: string | null
  showRating: boolean
  showEta: boolean
  showSchedule: boolean
  ctaLabel: string | null
  videoUrl: string | null
}

export interface StoreThemeFeatured {
  title: string
  productIds: string[]
  layout: ThemeFeaturedLayout
}

export interface StoreThemeStory {
  enabled: boolean
  title: string
  text: string
  imageUrl: string | null
}

export interface StoreThemeSocial {
  instagram: string | null
  tiktok: string | null
  facebook: string | null
  whatsapp: boolean
}

export interface StoreThemeFooter {
  text: string | null
  showMap: boolean
  showSchedule: boolean
}

/**
 * Shape of stores.theme (mirrors the column default in the migration).
 *
 * Grouped by intent: identity, colour, typography, layout, hero, menu,
 * sections and extras. Everything that is pure *skin* (colour, pattern,
 * shadow, density, image ratio and shape, motion) is emitted as a CSS custom
 * property by `themeToCssVars`, so components read variables instead of props;
 * everything that changes *structure* (menuLayout, categoryNav, section
 * content) is read from the object itself.
 */
export interface StoreTheme {
  // Identity
  mode: ThemeMode
  logoUrl: string | null

  // Colour
  primary: string
  /** Computed by `ensureReadable`, never picked by the merchant. */
  onPrimary: string
  secondary: string
  accent: string
  background: string
  surface: string
  text: string
  gradient: StoreThemeGradient
  pattern: ThemePattern
  patternOpacity: number

  // Typography
  fontDisplay: ThemeFont
  fontBody: ThemeFont
  headingWeight: ThemeHeadingWeight
  headingCase: ThemeHeadingCase
  letterSpacing: ThemeLetterSpacing

  // Shape and rhythm
  radius: number
  buttonStyle: ThemeButtonStyle
  density: ThemeDensity
  cardStyle: ThemeCardStyle
  imageRatio: ThemeImageRatio
  imageShape: ThemeImageShape

  // Hero
  banner: StoreThemeBanner
  hero: StoreThemeHero

  // Menu
  menuLayout: ThemeMenuLayout
  categoryNav: ThemeCategoryNav
  productHover: ThemeProductHover
  showPrices: ThemeShowPrices
  badges: StoreThemeBadges

  // Sections
  sectionOrder: ThemeSection[]
  featured: StoreThemeFeatured
  story: StoreThemeStory
  social: StoreThemeSocial
  footer: StoreThemeFooter

  // Extras
  motion: ThemeMotion
  /** Sanitised by `sanitizeCustomCss`; scoped to `[data-store-theme]`. */
  customCss: string | null
}

export const DEFAULT_STORE_THEME: StoreTheme = {
  mode: 'light',
  logoUrl: null,

  primary: '#C2410C',
  onPrimary: '#FFFFFF',
  secondary: '#7C2D12',
  accent: '#F59E0B',
  background: '#FBF8F3',
  surface: '#FFFFFF',
  text: '#1C1917',
  gradient: { enabled: false, from: '#C2410C', to: '#F59E0B', angle: 135 },
  pattern: 'none',
  patternOpacity: 0.06,

  fontDisplay: 'Fraunces',
  fontBody: 'Inter',
  headingWeight: 700,
  headingCase: 'normal',
  letterSpacing: 'normal',

  radius: 20,
  buttonStyle: 'pill',
  density: 'comfortable',
  cardStyle: 'elevated',
  imageRatio: '4:3',
  imageShape: 'rounded',

  banner: { imageUrl: null, overlayOpacity: 0.35, layout: 'full' },
  hero: {
    align: 'left',
    showLogo: true,
    logoSize: 'md',
    tagline: null,
    showRating: true,
    showEta: true,
    showSchedule: true,
    ctaLabel: null,
    videoUrl: null,
  },

  menuLayout: 'grid',
  categoryNav: 'chips',
  productHover: 'lift',
  showPrices: 'always',
  badges: { newDays: 14, popularEnabled: true, style: 'soft' },

  sectionOrder: [...THEME_CORE_SECTIONS],
  featured: { title: 'Destacados', productIds: [], layout: 'carousel' },
  story: {
    enabled: false,
    title: 'Nuestra historia',
    text: '',
    imageUrl: null,
  },
  social: { instagram: null, tiktok: null, facebook: null, whatsapp: false },
  footer: { text: null, showMap: true, showSchedule: true },

  motion: 'full',
  customCss: null,
}

/** One day entry of stores.schedule, keyed by mon..sun. */
export interface ScheduleDay {
  open: string
  close: string
}
export type WeekDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
export type StoreSchedule = Partial<Record<WeekDay, ScheduleDay>>

/** One selected option stored inside order_items.options. */
export interface OrderItemOption {
  option: string
  value: string
  price_delta: number
}

// ---------------------------------------------------------------------------
// Convenience composites
// ---------------------------------------------------------------------------
export type ProductOptionWithValues = ProductOption & {
  product_option_values: ProductOptionValue[]
}

export type ProductWithOptions = Product & {
  product_options: ProductOptionWithValues[]
}

export type MenuCategoryWithProducts = MenuCategory & {
  products: ProductWithOptions[]
}

export type OrderWithItems = Order & {
  order_items: OrderItem[]
}
