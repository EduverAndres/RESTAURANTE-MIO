// "Repeat this order": turns a past order back into cart lines. Pure, so the
// matching rules are tested without Supabase; the server action in
// app/(protected)/orders/[id]/actions.ts loads the rows it needs.
import type { CartItemInput } from '@/lib/cart'
import type { CatalogueProduct } from '@/lib/orders/build-order'
import type { OrderItemOption } from '@/types/app'

/** A catalogue row plus the picture the cart shows. */
export type ReorderProduct = CatalogueProduct & { image_url: string | null }

export interface PastOrderLine {
  product_id: string | null
  name_snapshot: string
  quantity: number
  /** The `order_items.options` snapshot: names, not ids. */
  options: unknown
}

export type ReorderItem = CartItemInput & { quantity: number }

export interface ReorderResult {
  items: ReorderItem[]
  /** Names, as the customer saw them on the receipt, of the lines left out. */
  skipped: string[]
}

function snapshotOptions(
  raw: unknown,
): Pick<OrderItemOption, 'option' | 'value'>[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (entry): entry is Pick<OrderItemOption, 'option' | 'value'> =>
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as OrderItemOption).option === 'string' &&
      typeof (entry as OrderItemOption).value === 'string',
  )
}

/**
 * Rebuilds the cart lines of a past order against today's menu.
 *
 * A past order only kept the option and value *names* it was paid with, so
 * each one is looked up by name in the current product. Prices are always
 * today's: the checkout re-prices every line anyway (`priceCartItems`), and
 * a cart showing last month's price would only change at the last step.
 *
 * A line is left out, and named in `skipped`, when its product is gone,
 * paused or belongs to another store, when one of its choices no longer
 * exists, or when the product now asks for something the old order never
 * chose (a new required option). The same min/max rules as the checkout
 * apply, so whatever lands in the cart can be paid for.
 */
export function rebuildCartFromOrder(
  lines: readonly PastOrderLine[],
  catalogue: readonly ReorderProduct[],
  storeId: string,
): ReorderResult {
  const byId = new Map(catalogue.map((product) => [product.id, product]))
  const items: ReorderItem[] = []
  const skipped: string[] = []

  lines: for (const line of lines) {
    const product = line.product_id ? byId.get(line.product_id) : undefined
    if (!product || product.store_id !== storeId || !product.is_available) {
      skipped.push(line.name_snapshot)
      continue
    }

    const wanted = snapshotOptions(line.options)
    const options: OrderItemOption[] = []
    const optionValueIds: string[] = []
    let matched = 0

    for (const option of product.product_options) {
      const chosen = option.product_option_values.filter((value) =>
        wanted.some(
          (entry) => entry.option === option.name && entry.value === value.name,
        ),
      )
      const min = option.required ? Math.max(1, option.min) : option.min
      if (chosen.length < min || chosen.length > Math.max(1, option.max)) {
        skipped.push(line.name_snapshot)
        continue lines
      }
      matched += chosen.length
      for (const value of chosen) {
        optionValueIds.push(value.id)
        options.push({
          option: option.name,
          value: value.name,
          price_delta: Number(value.price_delta),
        })
      }
    }

    // A choice that matched nothing today means the product changed under it.
    if (matched !== wanted.length) {
      skipped.push(line.name_snapshot)
      continue
    }

    items.push({
      productId: product.id,
      name: product.name,
      unitPrice: Number(product.price),
      imageUrl: product.image_url,
      options,
      optionValueIds,
      notes: '',
      quantity: line.quantity,
    })
  }

  return { items, skipped }
}
