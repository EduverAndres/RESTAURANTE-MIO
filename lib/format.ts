const NBSP = ' '

const copFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

/**
 * Formats an amount in Colombian pesos: "$ 18.900" with a non-breaking
 * space between the symbol and the digits and no decimals. Fractional
 * amounts are rounded to the nearest peso.
 */
export function formatCOP(amount: number): string {
  const rounded = Math.round(amount)
  const formatted = copFormatter.format(rounded)
  // ICU output differs across runtimes ("$ 18.900", "$18.900", "COP 18.900").
  // Normalise to a single canonical shape.
  const negative = rounded < 0
  const digits = formatted.replace(/[^\d.,]/g, '')
  return `${negative ? '-' : ''}$${NBSP}${digits}`
}

/** Up to two upper-case initials (first and last word) for avatar fallbacks. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0][0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : ''
  return `${first}${last}`.toUpperCase()
}
