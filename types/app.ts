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

export const THEME_BANNER_LAYOUTS = ['full', 'split', 'compact'] as const
export type ThemeBannerLayout = (typeof THEME_BANNER_LAYOUTS)[number]

export const THEME_SECTIONS = ['hero', 'featured', 'menu', 'info'] as const
export type ThemeSection = (typeof THEME_SECTIONS)[number]

export interface StoreThemeBanner {
  imageUrl: string | null
  overlayOpacity: number
  layout: ThemeBannerLayout
}

/** Shape of stores.theme (mirrors the column default in the migration). */
export interface StoreTheme {
  primary: string
  accent: string
  background: string
  surface: string
  text: string
  radius: number
  fontDisplay: ThemeFont
  fontBody: ThemeFont
  banner: StoreThemeBanner
  logoUrl: string | null
  sectionOrder: ThemeSection[]
  buttonStyle: ThemeButtonStyle
}

export const DEFAULT_STORE_THEME: StoreTheme = {
  primary: '#C2410C',
  accent: '#F59E0B',
  background: '#FBF8F3',
  surface: '#FFFFFF',
  text: '#1C1917',
  radius: 20,
  fontDisplay: 'Fraunces',
  fontBody: 'Inter',
  banner: { imageUrl: null, overlayOpacity: 0.35, layout: 'full' },
  logoUrl: null,
  sectionOrder: ['hero', 'featured', 'menu', 'info'],
  buttonStyle: 'pill',
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
