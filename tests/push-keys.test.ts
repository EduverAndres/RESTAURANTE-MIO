import { describe, expect, it } from 'vitest'
import { urlBase64ToUint8Array } from '@/lib/push/keys'

describe('urlBase64ToUint8Array', () => {
  it('decodes a plain base64 string into raw bytes', () => {
    // "hello" in base64 without padding.
    const result = urlBase64ToUint8Array('aGVsbG8')
    expect(Array.from(result)).toEqual([104, 101, 108, 108, 111])
  })

  it('replaces URL-safe characters (- and _) before decoding', () => {
    const result = urlBase64ToUint8Array('-_8')
    expect(Array.from(result)).toEqual([251, 255])
  })

  it('decodes a real VAPID public key into a 65-byte uncompressed P-256 point', () => {
    const key =
      'BEl62iUYgUivxIkv69yViEuiBIa40HI0DLLuxazjqAKIiTkA9RGRk1zRczOnv09VHz2fCwm9K2fGm4KzZUgw_XA'
    const result = urlBase64ToUint8Array(key)
    expect(result).toBeInstanceOf(Uint8Array)
    expect(result.length).toBe(65)
    expect(result[0]).toBe(4)
  })
})
