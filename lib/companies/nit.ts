// The Colombian NIT and its check digit (dígito de verificación, DV).
//
// The DIAN algorithm: weigh the digits from right to left by 3, 7, 13, 17,
// 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71; r = sum mod 11; the DV is r
// when r is 0 or 1, otherwise 11 − r.
//
// MIRRORED IN SQL: `public.nit_check_digit()` in
// supabase/migrations/20261124000600_companies.sql embeds `NIT_WEIGHTS`
// between `codegen:` markers, and `companies.dv` is checked against it;
// tests/companies-sql-drift.test.ts compares the two.

export const NIT_WEIGHTS = [
  3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71,
] as const

/** Digits a company NIT may have (a person's cédula can be short). */
export const NIT_MIN_DIGITS = 6
export const NIT_MAX_DIGITS = 15

/** The check digit of `nit` (digits only), or null when it is not 1–15 digits. */
export function nitCheckDigit(nit: string): number | null {
  if (!/^[0-9]{1,15}$/.test(nit)) return null
  let sum = 0
  for (let index = 0; index < nit.length; index += 1) {
    const digit = Number(nit[nit.length - 1 - index])
    sum += digit * NIT_WEIGHTS[index]
  }
  const remainder = sum % 11
  return remainder <= 1 ? remainder : 11 - remainder
}

/**
 * Reads `900.123.456-8`, `900123456-8`, `900 123 456 - 8` or `900123456`.
 * Null when what is left is not a NIT of 6 to 15 digits with an optional
 * single check digit.
 */
export function parseNit(
  raw: string,
): { nit: string; dv: number | null } | null {
  const match = /^([0-9][0-9. ]*[0-9])\s*(?:-\s*([0-9]))?$/.exec(raw.trim())
  if (!match) return null
  const nit = match[1].replace(/[. ]/g, '')
  if (nit.length < NIT_MIN_DIGITS || nit.length > NIT_MAX_DIGITS) return null
  return { nit, dv: match[2] === undefined ? null : Number(match[2]) }
}

/** True when `nit` has 6 to 15 digits and `dv` is its check digit. */
export function isValidNit(nit: string, dv: number): boolean {
  return (
    nit.length >= NIT_MIN_DIGITS &&
    nit.length <= NIT_MAX_DIGITS &&
    nitCheckDigit(nit) === dv
  )
}

/** `900.123.456-8`. */
export function formatNit(nit: string, dv: number): string {
  return `${nit.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${dv}`
}
