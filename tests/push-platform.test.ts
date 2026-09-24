import { describe, expect, it } from 'vitest'
import { needsHomeScreenInstall } from '@/lib/push/platform'

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
const IPAD_SAFARI =
  'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
const IPHONE_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0.6367.88 Mobile/15E148 Safari/604.1'
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'
const MAC_SAFARI =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15'
const WINDOWS_CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

describe('needsHomeScreenInstall', () => {
  it('is true for an iPhone or iPad browsing in the browser', () => {
    expect(needsHomeScreenInstall(IPHONE_SAFARI, false)).toBe(true)
    expect(needsHomeScreenInstall(IPAD_SAFARI, false)).toBe(true)
    // Every iOS browser is WebKit underneath; the rule is the same.
    expect(needsHomeScreenInstall(IPHONE_CHROME, false)).toBe(true)
  })

  it('is false once the app runs from the home screen', () => {
    expect(needsHomeScreenInstall(IPHONE_SAFARI, true)).toBe(false)
    expect(needsHomeScreenInstall(IPAD_SAFARI, true)).toBe(false)
  })

  it('is false on every other platform', () => {
    expect(needsHomeScreenInstall(ANDROID_CHROME, false)).toBe(false)
    expect(needsHomeScreenInstall(MAC_SAFARI, false)).toBe(false)
    expect(needsHomeScreenInstall(WINDOWS_CHROME, false)).toBe(false)
    expect(needsHomeScreenInstall('', false)).toBe(false)
  })

  it('does not care about case', () => {
    expect(needsHomeScreenInstall(IPHONE_SAFARI.toUpperCase(), false)).toBe(
      true,
    )
  })
})
