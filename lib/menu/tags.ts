// products.tags is text[]; the form edits it as one comma separated line.

export const MAX_TAGS = 8
export const MAX_TAG_LENGTH = 24

/** "vegano, sin gluten" → ["vegano", "sin gluten"]; deduped, trimmed, capped. */
export function parseTags(raw: string): string[] {
  const seen = new Set<string>()
  const tags: string[] = []
  for (const part of raw.split(',')) {
    const tag = part.trim().slice(0, MAX_TAG_LENGTH)
    const key = tag.toLowerCase()
    if (!tag || seen.has(key)) continue
    seen.add(key)
    tags.push(tag)
    if (tags.length === MAX_TAGS) break
  }
  return tags
}

export function formatTags(tags: readonly string[]): string {
  return tags.join(', ')
}
