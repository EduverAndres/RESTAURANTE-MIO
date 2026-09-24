import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_SOUND_PREFERENCES,
  SOUND_STORAGE_KEY,
  readSoundPreferences,
  useSoundPreferences,
} from '@/lib/sound/preferences'

describe('SOUND_STORAGE_KEY', () => {
  it('is its own localStorage entry', () => {
    expect(SOUND_STORAGE_KEY).toBe('tienda:sound')
  })
})

describe('readSoundPreferences', () => {
  it('defaults to sound on', () => {
    expect(DEFAULT_SOUND_PREFERENCES).toEqual({ enabled: true })
  })

  it('falls back to the defaults for missing or unreadable storage', () => {
    expect(readSoundPreferences(null)).toEqual(DEFAULT_SOUND_PREFERENCES)
    expect(readSoundPreferences('')).toEqual(DEFAULT_SOUND_PREFERENCES)
    expect(readSoundPreferences('not json')).toEqual(DEFAULT_SOUND_PREFERENCES)
    expect(readSoundPreferences('null')).toEqual(DEFAULT_SOUND_PREFERENCES)
    expect(readSoundPreferences('{"state":42}')).toEqual(
      DEFAULT_SOUND_PREFERENCES,
    )
  })

  it('reads the zustand persist envelope', () => {
    const raw = JSON.stringify({ state: { enabled: false }, version: 0 })
    expect(readSoundPreferences(raw)).toEqual({ enabled: false })
  })

  it('rejects a non-boolean toggle', () => {
    expect(readSoundPreferences('{"state":{"enabled":"no"}}')).toEqual({
      enabled: true,
    })
    expect(readSoundPreferences('{"state":{"enabled":0}}')).toEqual({
      enabled: true,
    })
  })

  it('ignores unrelated keys stored under the same name', () => {
    const raw = JSON.stringify({ state: { volume: 3 }, version: 0 })
    expect(readSoundPreferences(raw)).toEqual(DEFAULT_SOUND_PREFERENCES)
  })
})

describe('useSoundPreferences', () => {
  beforeEach(() => {
    localStorage.clear()
    useSoundPreferences.setState({ enabled: true })
  })

  it('starts enabled', () => {
    expect(useSoundPreferences.getState().enabled).toBe(true)
  })

  it('persists the toggle under the sound key', () => {
    useSoundPreferences.getState().setEnabled(false)
    expect(useSoundPreferences.getState().enabled).toBe(false)
    expect(
      readSoundPreferences(localStorage.getItem(SOUND_STORAGE_KEY)),
    ).toEqual({ enabled: false })
  })

  it('turns back on', () => {
    useSoundPreferences.getState().setEnabled(false)
    useSoundPreferences.getState().setEnabled(true)
    expect(useSoundPreferences.getState().enabled).toBe(true)
  })
})
