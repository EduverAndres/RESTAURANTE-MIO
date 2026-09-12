// Mirrors the check constraint on stores.slug in the database.
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Turns free text (store names, product names) into a URL-safe slug that
 * satisfies SLUG_PATTERN. Returns an empty string when nothing usable remains.
 */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function isValidSlug(value: string): boolean {
  return SLUG_PATTERN.test(value)
}
