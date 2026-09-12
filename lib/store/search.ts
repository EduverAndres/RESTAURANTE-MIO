// In-menu search: accent- and case-insensitive matching plus the segments the
// UI needs to highlight a hit. Pure, so the header can stay a thin input.

export interface HighlightSegment {
  text: string
  match: boolean
}

/** Lower case, no diacritics, single spaces — the comparison form. */
export function foldText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

/**
 * The folded form must keep the same length as the source so a match found in
 * it maps back to the original characters. NFD would break that (one "é"
 * becomes two code points), so folding for *indexing* is done per character.
 */
function foldPreservingLength(value: string): string {
  let out = ''
  for (const char of value) {
    const folded = char.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    // A character that folds to nothing (a lone combining mark) or to several
    // characters keeps its original length so the indexes stay aligned.
    out += folded.length === char.length ? folded : char.toLowerCase()
  }
  return out
}

export interface SearchableProduct {
  name: string
  description: string | null
  tags: string[] | null
}

/** An empty query matches everything, so the menu renders unfiltered. */
export function productMatches(
  product: SearchableProduct,
  query: string,
): boolean {
  const needle = foldText(query)
  if (!needle) return true
  const haystack = foldText(
    [product.name, product.description ?? '', (product.tags ?? []).join(' ')]
      .filter(Boolean)
      .join(' '),
  )
  return haystack.includes(needle)
}

/**
 * Splits `text` around every occurrence of `query`. The concatenation of the
 * segments always reproduces `text` exactly, including its original casing and
 * accents, so rendering them in order can never corrupt a product name.
 */
export function highlightMatches(
  text: string,
  query: string,
): HighlightSegment[] {
  const needle = foldText(query)
  if (!needle) return [{ text, match: false }]

  const haystack = foldPreservingLength(text)
  const segments: HighlightSegment[] = []
  let cursor = 0

  let found = haystack.indexOf(needle, cursor)
  while (found !== -1) {
    if (found > cursor) {
      segments.push({ text: text.slice(cursor, found), match: false })
    }
    segments.push({
      text: text.slice(found, found + needle.length),
      match: true,
    })
    cursor = found + needle.length
    found = haystack.indexOf(needle, cursor)
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), match: false })
  }
  return segments.length > 0 ? segments : [{ text, match: false }]
}

/**
 * Filters a menu: categories keep only their matching products and a category
 * left with none disappears. An empty query returns the input untouched, so
 * the common case allocates nothing.
 */
export function filterMenu<
  P extends SearchableProduct,
  C extends { products: P[] },
>(categories: readonly C[], query: string): C[] {
  if (!foldText(query)) return [...categories]
  const result: C[] = []
  for (const category of categories) {
    const products = category.products.filter((product) =>
      productMatches(product, query),
    )
    if (products.length > 0) result.push({ ...category, products })
  }
  return result
}
