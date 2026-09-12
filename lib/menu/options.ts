// Consistency rules for a product option group (size, extras...). Pure so the
// zod schema, the form and the tests share one source of truth.

export interface OptionGroupBounds {
  required: boolean
  min: number
  max: number
  valueCount: number
}

/** Spanish message describing the first inconsistency, or null when valid. */
export function optionGroupIssue(group: OptionGroupBounds): string | null {
  if (group.valueCount < 1) return 'Agrega al menos una opción al grupo.'
  if (group.max < group.min)
    return 'El máximo no puede ser menor que el mínimo.'
  if (group.required && group.min < 1)
    return 'Un grupo obligatorio necesita un mínimo de 1.'
  if (group.min > group.valueCount)
    return 'El mínimo no puede superar la cantidad de opciones.'
  return null
}
