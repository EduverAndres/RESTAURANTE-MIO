/**
 * Undo / redo for the theme editor.
 *
 * A plain past/present/future triple, kept pure and generic so the editor can
 * hold it in `useState` and so the behaviour (dropping the redo branch on a new
 * edit, ignoring no-op pushes, capping the stack) is testable without React.
 *
 * Nothing here mutates its input: every operation returns a new history.
 */

export interface History<T> {
  past: T[]
  present: T
  future: T[]
}

/** How many steps back the editor remembers by default. */
export const HISTORY_LIMIT = 50

/** Structural equality; the editor replaces whole theme objects on every edit. */
function isSame<T>(a: T, b: T): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b)
}

export function initHistory<T>(present: T): History<T> {
  return { past: [], present, future: [] }
}

/**
 * Records `next` as the new present. A value equal to the current present is
 * ignored, so holding a slider does not fill the stack with identical frames,
 * and any redo branch is dropped because the timeline just forked.
 */
export function pushHistory<T>(
  history: History<T>,
  next: T,
  limit = HISTORY_LIMIT,
): History<T> {
  if (isSame(history.present, next)) return history
  const past = [...history.past, history.present]
  return {
    past: past.length > limit ? past.slice(past.length - limit) : past,
    present: next,
    future: [],
  }
}

export function canUndo<T>(history: History<T>): boolean {
  return history.past.length > 0
}

export function canRedo<T>(history: History<T>): boolean {
  return history.future.length > 0
}

export function undo<T>(history: History<T>): History<T> {
  if (!canUndo(history)) return history
  const past = [...history.past]
  const present = past.pop() as T
  return { past, present, future: [history.present, ...history.future] }
}

export function redo<T>(history: History<T>): History<T> {
  if (!canRedo(history)) return history
  const [present, ...future] = history.future
  return { past: [...history.past, history.present], present, future }
}

/** Starts over at `present`, forgetting both stacks (used after a save). */
export function resetHistory<T>(_history: History<T>, present: T): History<T> {
  return initHistory(present)
}
