import {
  BeefIcon,
  CakeIcon,
  CakeSliceIcon,
  CoffeeIcon,
  CookingPotIcon,
  CroissantIcon,
  CupSodaIcon,
  DrumstickIcon,
  FishIcon,
  FlameIcon,
  Flower2Icon,
  GiftIcon,
  HamburgerIcon,
  IceCreamConeIcon,
  PawPrintIcon,
  PillIcon,
  PizzaIcon,
  SaladIcon,
  ShoppingBasketIcon,
  SmartphoneIcon,
  StoreIcon,
  UtensilsCrossedIcon,
  type LucideIcon,
} from 'lucide-react'

/**
 * One icon per store category, all from the same family (Lucide) the rest of
 * the interface already uses, so a category chip, a navigation tab and a
 * card badge share stroke, corner and optical size. Emoji were the opposite:
 * each platform draws them differently, in full colour, and they never sat
 * on the same baseline as the text beside them.
 *
 * Keys are lower-cased `stores.category` values; anything unknown falls back
 * to the generic cutlery, which is right for most of the marketplace.
 */
const BY_CATEGORY: Record<string, LucideIcon> = {
  parrilla: BeefIcon,
  saludable: SaladIcon,
  italiana: PizzaIcon,
  'comida rápida': HamburgerIcon,
  japonesa: FishIcon,
  'café y panadería': CoffeeIcon,
  postres: IceCreamConeIcon,
  mexicana: FlameIcon,
  colombiana: CookingPotIcon,
  pollo: DrumstickIcon,
  panadería: CroissantIcon,
  repostería: CakeSliceIcon,
  pastelería: CakeIcon,
  mercado: ShoppingBasketIcon,
  minimarket: ShoppingBasketIcon,
  supermercado: ShoppingBasketIcon,
  'tienda de barrio': StoreIcon,
  licores: CupSodaIcon,
  farmacia: PillIcon,
  droguería: PillIcon,
  mascotas: PawPrintIcon,
  regalos: GiftIcon,
  floristería: Flower2Icon,
  tecnología: SmartphoneIcon,
}

export const DEFAULT_CATEGORY_ICON: LucideIcon = UtensilsCrossedIcon

export function iconForCategory(name: string | null | undefined): LucideIcon {
  return BY_CATEGORY[name?.trim().toLowerCase() ?? ''] ?? DEFAULT_CATEGORY_ICON
}
