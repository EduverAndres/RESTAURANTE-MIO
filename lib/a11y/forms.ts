// Field description wiring.
//
// Pure module. It exists because the repeated bug in this codebase was not a
// missing error message but an unreferenced one: the error rendered, the id
// was computed, and nothing ever pointed at it — so a screen reader said
// "inválido" and stopped. These three helpers make the reference the same
// one-liner everywhere, and make "there is no error right now" produce no
// dangling `aria-describedby` at all.

/** The id of a field's error text. Mirrors `<FieldError id={...} />`. */
export function errorId(fieldId: string): string {
  return `${fieldId}-error`
}

/** The id of a field's helper text. */
export function hintId(fieldId: string): string {
  return `${fieldId}-hint`
}

/**
 * `aria-describedby` for a field, built only from the parts that are on the
 * page. Falsy entries drop out, so the usual call reads as the condition it
 * already is: `describedBy(hint && hintId(id), error && errorId(id))`.
 */
export function describedBy(
  ...ids: (string | false | null | undefined)[]
): string | undefined {
  const present = [...new Set(ids.filter((id): id is string => Boolean(id)))]
  return present.length > 0 ? present.join(' ') : undefined
}
