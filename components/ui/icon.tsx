'use client'

import { cn } from '@/lib/utils'
import * as Lucide from 'lucide-react'
import * as Tabler from '@tabler/icons-react'

export type LucideIconName = keyof typeof Lucide
export type TablerIconName = keyof typeof Tabler

interface IconProps {
  name: string
  set?: 'lucide' | 'tabler'
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  'aria-hidden'?: boolean
}

const SIZE_MAP = {
  xs: 'size-3.5',   // 14px
  sm: 'size-4',     // 16px
  md: 'size-5',     // 20px
  lg: 'size-6',     // 24px
  xl: 'size-7',     // 28px
} as const

const STROKE_MAP = {
  lucide: 'stroke-2',
  tabler: 'stroke-2',
} as const

export function Icon({
  name,
  set = 'lucide',
  size = 'md',
  className,
  'aria-hidden': ariaHidden = true,
  ...props
}: IconProps) {
  const IconMap = set === 'tabler' ? Tabler : Lucide
  const Component = IconMap[name as keyof typeof IconMap]

  if (!Component) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[Icon] "${name}" not found in ${set}`)
    }
    return null
  }

  return (
    <Component
      className={cn(
        SIZE_MAP[size],
        STROKE_MAP[set],
        'flex-shrink-0',
        className
      )}
      aria-hidden={ariaHidden}
      {...props}
    />
  )
}

/* =============================================================================
 * ICON MAPS SEMÁNTICOS — Uso directo sin magic strings
 * ========================================================================== */

export const CategoryIcons = {
  pizza: { name: 'Pizza', set: 'tabler' as const },
  hamburger: { name: 'Hamburger', set: 'tabler' as const },
  steak: { name: 'Steak', set: 'tabler' as const },
  salad: { name: 'Salad', set: 'tabler' as const },
  coffee: { name: 'Coffee', set: 'tabler' as const },
  fastFood: { name: 'FastFood', set: 'tabler' as const },
  sushi: { name: 'Sushi', set: 'tabler' as const },
  iceCream: { name: 'IceCream', set: 'tabler' as const },
  donut: { name: 'Donut', set: 'tabler' as const },
  bread: { name: 'Bread', set: 'tabler' as const },
  cake: { name: 'Cake', set: 'tabler' as const },
  taco: { name: 'Taco', set: 'tabler' as const },
  burrito: { name: 'Burrito', set: 'tabler' as const },
  ramen: { name: 'BowlChopsticks', set: 'tabler' as const },
  sandwich: { name: 'Sandwich', set: 'tabler' as const },
  chicken: { name: 'Chicken', set: 'tabler' as const },
  fish: { name: 'Fish', set: 'tabler' as const },
  vegetarian: { name: 'Leaf', set: 'tabler' as const },
  vegan: { name: 'Sprout', set: 'tabler' as const },
  glutenFree: { name: 'WheatOff', set: 'tabler' as const },
  healthy: { name: 'Apple', set: 'tabler' as const },
  dessert: { name: 'IceCream', set: 'tabler' as const },
  bakery: { name: 'Bread', set: 'tabler' as const },
  drink: { name: 'Cup', set: 'tabler' as const },
  beer: { name: 'Beer', set: 'tabler' as const },
  wine: { name: 'Wine', set: 'tabler' as const },
  cocktail: { name: 'Cocktail', set: 'tabler' as const },
} as const

export const BadgeIcons = {
  popular: { name: 'Star', set: 'lucide' as const },
  new: { name: 'Sparkles', set: 'lucide' as const },
  spicy: { name: 'Flame', set: 'tabler' as const },
  vegetarian: { name: 'Leaf', set: 'tabler' as const },
  vegan: { name: 'Sprout', set: 'tabler' as const },
  glutenFree: { name: 'WheatOff', set: 'tabler' as const },
  discount: { name: 'Tag', set: 'lucide' as const },
  bestSeller: { name: 'Award', set: 'lucide' as const },
  featured: { name: 'Badge', set: 'lucide' as const },
  limited: { name: 'Timer', set: 'lucide' as const },
  chefKiss: { name: 'HeartHandshake', set: 'tabler' as const },
} as const

export const UIcons = {
  search: { name: 'Search', set: 'lucide' as const },
  location: { name: 'MapPin', set: 'lucide' as const },
  locationFilled: { name: 'MapPinFilled', set: 'tabler' as const },
  filter: { name: 'Filter', set: 'lucide' as const },
  filterOff: { name: 'FilterOff', set: 'lucide' as const },
  truck: { name: 'Truck', set: 'lucide' as const },
  bike: { name: 'Bike', set: 'lucide' as const },
  bag: { name: 'ShoppingBag', set: 'lucide' as const },
  qrCode: { name: 'QrCode', set: 'lucide' as const },
  clock: { name: 'Clock', set: 'lucide' as const },
  star: { name: 'Star', set: 'lucide' as const },
  starHalf: { name: 'StarHalf', set: 'tabler' as const },
  heart: { name: 'Heart', set: 'lucide' as const },
  heartFilled: { name: 'HeartFilled', set: 'tabler' as const },
  user: { name: 'User', set: 'lucide' as const },
  users: { name: 'Users', set: 'lucide' as const },
  lock: { name: 'Lock', set: 'lucide' as const },
  unlock: { name: 'Unlock', set: 'lucide' as const },
  shield: { name: 'Shield', set: 'lucide' as const },
  check: { name: 'Check', set: 'lucide' as const },
  checkCheck: { name: 'CheckCheck', set: 'lucide' as const },
  x: { name: 'X', set: 'lucide' as const },
  chevronDown: { name: 'ChevronDown', set: 'lucide' as const },
  chevronUp: { name: 'ChevronUp', set: 'lucide' as const },
  chevronLeft: { name: 'ChevronLeft', set: 'lucide' as const },
  chevronRight: { name: 'ChevronRight', set: 'lucide' as const },
  menu: { name: 'Menu', set: 'lucide' as const },
  close: { name: 'X', set: 'lucide' as const },
  plus: { name: 'Plus', set: 'lucide' as const },
  minus: { name: 'Minus', set: 'lucide' as const },
  edit: { name: 'Edit', set: 'lucide' as const },
  trash: { name: 'Trash2', set: 'lucide' as const },
  eye: { name: 'Eye', set: 'lucide' as const },
  eyeOff: { name: 'EyeOff', set: 'lucide' as const },
  download: { name: 'Download', set: 'lucide' as const },
  upload: { name: 'Upload', set: 'lucide' as const },
  share: { name: 'Share2', set: 'lucide' as const },
  copy: { name: 'Copy', set: 'lucide' as const },
  link: { name: 'Link2', set: 'lucide' as const },
  externalLink: { name: 'ExternalLink', set: 'lucide' as const },
  mail: { name: 'Mail', set: 'lucide' as const },
  phone: { name: 'Phone', set: 'lucide' as const },
  message: { name: 'MessageSquare', set: 'lucide' as const },
  bell: { name: 'Bell', set: 'lucide' as const },
  bellOff: { name: 'BellOff', set: 'lucide' as const },
  settings: { name: 'Settings', set: 'lucide' as const },
  cog: { name: 'Cog', set: 'lucide' as const },
  home: { name: 'Home', set: 'lucide' as const },
  store: { name: 'Store', set: 'lucide' as const },
  building: { name: 'Building2', set: 'lucide' as const },
  receipt: { name: 'Receipt', set: 'lucide' as const },
  creditCard: { name: 'CreditCard', set: 'lucide' as const },
  wallet: { name: 'Wallet', set: 'lucide' as const },
  coin: { name: 'Coin', set: 'tabler' as const },
  tag: { name: 'Tag', set: 'lucide' as const },
  percent: { name: 'Percent', set: 'lucide' as const },
  gift: { name: 'Gift', set: 'lucide' as const },
  sparkles: { name: 'Sparkles', set: 'lucide' as const },
  flame: { name: 'Flame', set: 'lucide' as const },
  zap: { name: 'Zap', set: 'lucide' as const },
  leaf: { name: 'Leaf', set: 'lucide' as const },
  sun: { name: 'Sun', set: 'lucide' as const },
  moon: { name: 'Moon', set: 'lucide' as const },
  palette: { name: 'Palette', set: 'lucide' as const },
  brush: { name: 'Brush', set: 'lucide' as const },
  image: { name: 'Image', set: 'lucide' as const },
  camera: { name: 'Camera', set: 'lucide' as const },
  video: { name: 'Video', set: 'lucide' as const },
  music: { name: 'Music', set: 'lucide' as const },
  globe: { name: 'Globe', set: 'lucide' as const },
  language: { name: 'Languages', set: 'lucide' as const },
  translate: { name: 'Translate', set: 'lucide' as const },
  alert: { name: 'AlertTriangle', set: 'lucide' as const },
  info: { name: 'Info', set: 'lucide' as const },
  help: { name: 'HelpCircle', set: 'lucide' as const },
  checkCircle: { name: 'CheckCircle', set: 'lucide' as const },
  xCircle: { name: 'XCircle', set: 'lucide' as const },
  alertCircle: { name: 'AlertCircle', set: 'lucide' as const },
  loader: { name: 'Loader2', set: 'lucide' as const },
  refresh: { name: 'RefreshCw', set: 'lucide' as const },
  rotateCcw: { name: 'RotateCcw', set: 'lucide' as const },
  arrowLeft: { name: 'ArrowLeft', set: 'lucide' as const },
  arrowRight: { name: 'ArrowRight', set: 'lucide' as const },
  arrowUp: { name: 'ArrowUp', set: 'lucide' as const },
  arrowDown: { name: 'ArrowDown', set: 'lucide' as const },
  expand: { name: 'Expand', set: 'lucide' as const },
  minimize: { name: 'Minimize', set: 'lucide' as const },
  maximize: { name: 'Maximize', set: 'lucide' as const },
  fullscreen: { name: 'Fullscreen', set: 'lucide' as const },
  sidebar: { name: 'Sidebar', set: 'lucide' as const },
  panelLeft: { name: 'PanelLeft', set: 'lucide' as const },
  panelRight: { name: 'PanelRight', set: 'lucide' as const },
  grid: { name: 'Grid', set: 'lucide' as const },
  list: { name: 'List', set: 'lucide' as const },
  columns: { name: 'Columns', set: 'lucide' as const },
  rows: { name: 'Rows', set: 'lucide' as const },
  layout: { name: 'Layout', set: 'lucide' as const },
  template: { name: 'FileText', set: 'lucide' as const },
  file: { name: 'File', set: 'lucide' as const },
  folder: { name: 'Folder', set: 'lucide' as const },
  database: { name: 'Database', set: 'lucide' as const },
  server: { name: 'Server', set: 'lucide' as const },
  cloud: { name: 'Cloud', set: 'lucide' as const },
  wifi: { name: 'Wifi', set: 'lucide' as const },
  bluetooth: { name: 'Bluetooth', set: 'lucide' as const },
  usb: { name: 'Usb', set: 'lucide' as const },
  battery: { name: 'Battery', set: 'lucide' as const },
  signal: { name: 'Signal', set: 'lucide' as const },
} as const

/* Helper para renderizar icono semántico directo */
export function CategoryIcon({ category, size = 'md', className }: { category: keyof typeof CategoryIcons; size?: IconProps['size']; className?: string }) {
  const config = CategoryIcons[category]
  if (!config) return null
  return <Icon name={config.name} set={config.set} size={size} className={className} />
}

export function BadgeIcon({ badge, size = 'xs', className }: { badge: keyof typeof BadgeIcons; size?: IconProps['size']; className?: string }) {
  const config = BadgeIcons[badge]
  if (!config) return null
  return <Icon name={config.name} set={config.set} size={size} className={className} />
}

export function UIIcon({ name, size = 'md', className }: { name: keyof typeof UIcons; size?: IconProps['size']; className?: string }) {
  const config = UIcons[name]
  if (!config) return null
  return <Icon name={config.name} set={config.set} size={size} className={className} />
}