/**
 * The marketplace's verticals: the shelves a visitor expects from a local
 * delivery app, mapped onto the free-text `stores.category` a merchant picks.
 *
 * Counts always come from real stores. A vertical with nothing in it yet is
 * not hidden — it is the clearest invitation the home can make to the
 * pharmacy or the bakery down the street — but it never pretends to have
 * stock: the tile says "Muy pronto" and points the owner to sign up.
 */

import {
  CakeSliceIcon,
  CroissantIcon,
  GiftIcon,
  PawPrintIcon,
  PillIcon,
  ShoppingBasketIcon,
  SmartphoneIcon,
  UtensilsCrossedIcon,
  type LucideIcon,
} from 'lucide-react'

export type VerticalKey =
  | 'restaurantes'
  | 'mercado'
  | 'farmacia'
  | 'mascotas'
  | 'regalos'
  | 'panaderia'
  | 'reposteria'
  | 'tecnologia'

export interface Vertical {
  key: VerticalKey
  label: string
  /** Decorative; the label carries the meaning. */
  icon: LucideIcon
  /** Lower-cased `stores.category` values that belong to this vertical. */
  matches: readonly string[]
}

export const VERTICALS: readonly Vertical[] = [
  {
    key: 'restaurantes',
    label: 'Restaurantes',
    icon: UtensilsCrossedIcon,
    matches: [],
  },
  {
    key: 'mercado',
    label: 'Mercado',
    icon: ShoppingBasketIcon,
    matches: [
      'mercado',
      'minimarket',
      'supermercado',
      'tienda de barrio',
      'licores',
    ],
  },
  {
    key: 'farmacia',
    label: 'Farmacia',
    icon: PillIcon,
    matches: ['farmacia', 'droguería', 'drogueria'],
  },
  {
    key: 'mascotas',
    label: 'Mascotas',
    icon: PawPrintIcon,
    matches: ['mascotas', 'veterinaria', 'pet shop'],
  },
  {
    key: 'regalos',
    label: 'Regalos',
    icon: GiftIcon,
    matches: ['regalos', 'floristería', 'floristeria', 'flores', 'detalles'],
  },
  {
    key: 'panaderia',
    label: 'Panadería',
    icon: CroissantIcon,
    matches: ['panadería', 'panaderia', 'café y panadería', 'cafe y panaderia'],
  },
  {
    key: 'reposteria',
    label: 'Repostería',
    icon: CakeSliceIcon,
    matches: [
      'repostería',
      'reposteria',
      'postres',
      'pastelería',
      'pasteleria',
    ],
  },
  {
    key: 'tecnologia',
    label: 'Tecnología',
    icon: SmartphoneIcon,
    matches: [
      'tecnología',
      'tecnologia',
      'electrónica',
      'electronica',
      'celulares',
    ],
  },
]

/** Every category named by a non-restaurant vertical. */
const NON_FOOD = new Set(VERTICALS.flatMap((vertical) => vertical.matches))

export function verticalOf(category: string | null | undefined): VerticalKey {
  const key = category?.trim().toLowerCase() ?? ''
  if (!NON_FOOD.has(key)) return 'restaurantes'
  return (
    VERTICALS.find((vertical) => vertical.matches.includes(key))?.key ??
    'restaurantes'
  )
}

export interface VerticalSummary extends Vertical {
  count: number
  /**
   * The single store category behind this vertical, when there is exactly
   * one, so the tile can apply the home's existing `?categoria=` filter.
   */
  category: string | null
}

export function summarizeVerticals(
  stores: readonly { category: string | null }[],
): VerticalSummary[] {
  const byVertical = new Map<VerticalKey, Map<string, number>>()
  for (const store of stores) {
    const vertical = verticalOf(store.category)
    const categories = byVertical.get(vertical) ?? new Map<string, number>()
    const name = store.category?.trim() || 'Otros'
    categories.set(name, (categories.get(name) ?? 0) + 1)
    byVertical.set(vertical, categories)
  }

  return VERTICALS.map((vertical) => {
    const categories = byVertical.get(vertical.key)
    const count = categories
      ? [...categories.values()].reduce((sum, value) => sum + value, 0)
      : 0
    const names = categories ? [...categories.keys()] : []
    return {
      ...vertical,
      count,
      category:
        vertical.key !== 'restaurantes' && names.length === 1 ? names[0] : null,
    }
  })
}
