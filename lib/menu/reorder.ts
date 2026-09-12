// Pure reorder helpers for categories and products. Lists arrive in display
// order; positions are normalised to the index so rows created with the
// column default (0) still end up with a stable, unique order.

export interface Positioned {
  id: string
  position: number
}

export type MoveDirection = 'up' | 'down'

export interface PositionUpdate {
  id: string
  position: number
}

/** Returns a new list with the item swapped with its neighbour. */
export function moveItem<T extends Positioned>(
  items: readonly T[],
  id: string,
  direction: MoveDirection,
): T[] {
  const index = items.findIndex((item) => item.id === id)
  const target = direction === 'up' ? index - 1 : index + 1
  if (index === -1 || target < 0 || target >= items.length) return [...items]
  const next = [...items]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

/** Rows whose stored position differs from their index in the list. */
export function positionUpdates(
  items: readonly Positioned[],
): PositionUpdate[] {
  const updates: PositionUpdate[] = []
  items.forEach((item, index) => {
    if (item.position !== index) updates.push({ id: item.id, position: index })
  })
  return updates
}
