import { describe, expect, it } from 'vitest'
import {
  canRedo,
  canUndo,
  initHistory,
  pushHistory,
  redo,
  resetHistory,
  undo,
} from '@/lib/theme/history'

describe('theme history', () => {
  it('starts with a present and nothing to undo or redo', () => {
    const history = initHistory('a')
    expect(history.present).toBe('a')
    expect(canUndo(history)).toBe(false)
    expect(canRedo(history)).toBe(false)
  })

  it('pushes a new present and remembers the previous one', () => {
    const history = pushHistory(initHistory('a'), 'b')
    expect(history.present).toBe('b')
    expect(history.past).toEqual(['a'])
    expect(canUndo(history)).toBe(true)
  })

  it('ignores a push that does not change anything', () => {
    const history = pushHistory(initHistory('a'), 'a')
    expect(history.past).toEqual([])
    expect(canUndo(history)).toBe(false)
  })

  it('compares by value, not by reference', () => {
    const history = pushHistory(initHistory({ x: 1 }), { x: 1 })
    expect(history.past).toEqual([])
  })

  it('undoes back to the previous present', () => {
    const history = undo(pushHistory(initHistory('a'), 'b'))
    expect(history.present).toBe('a')
    expect(history.future).toEqual(['b'])
    expect(canRedo(history)).toBe(true)
  })

  it('redoes what was undone', () => {
    const history = redo(undo(pushHistory(initHistory('a'), 'b')))
    expect(history.present).toBe('b')
    expect(canRedo(history)).toBe(false)
  })

  it('undoing at the beginning is a no-op', () => {
    const history = initHistory('a')
    expect(undo(history)).toEqual(history)
  })

  it('redoing at the end is a no-op', () => {
    const history = pushHistory(initHistory('a'), 'b')
    expect(redo(history)).toEqual(history)
  })

  it('drops the redo branch once a new change is pushed', () => {
    const history = pushHistory(undo(pushHistory(initHistory('a'), 'b')), 'c')
    expect(history.present).toBe('c')
    expect(history.future).toEqual([])
    expect(history.past).toEqual(['a'])
  })

  it('caps the past at the given limit, dropping the oldest entries', () => {
    let history = initHistory(0)
    for (let step = 1; step <= 10; step += 1) {
      history = pushHistory(history, step, 3)
    }
    expect(history.past).toHaveLength(3)
    expect(history.past).toEqual([7, 8, 9])
    expect(history.present).toBe(10)
  })

  it('walks a full undo/redo sequence', () => {
    let history = initHistory('a')
    history = pushHistory(history, 'b')
    history = pushHistory(history, 'c')
    history = undo(undo(history))
    expect(history.present).toBe('a')
    history = redo(redo(history))
    expect(history.present).toBe('c')
  })

  it('resetHistory forgets both stacks', () => {
    const history = resetHistory(pushHistory(initHistory('a'), 'b'), 'z')
    expect(history.present).toBe('z')
    expect(history.past).toEqual([])
    expect(history.future).toEqual([])
  })

  it('never mutates the history it is given', () => {
    const history = initHistory('a')
    pushHistory(history, 'b')
    expect(history).toEqual({ past: [], present: 'a', future: [] })
  })
})
