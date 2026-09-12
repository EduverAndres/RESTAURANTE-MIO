import { describe, expect, it } from 'vitest'
import {
  ACCEPTED_IMAGE_TYPES,
  EXTENSION_BY_TYPE,
  MAX_IMAGE_BYTES,
  imageObjectPath,
  validateImageFile,
} from '@/lib/uploads/image'

const STORE_ID = '11111111-1111-4111-8111-111111111111'

function fakeFile(type: string, size: number): File {
  return new File([new Uint8Array(size)], 'photo', { type })
}

describe('image upload constants', () => {
  it('caps images at 3 MB', () => {
    expect(MAX_IMAGE_BYTES).toBe(3 * 1024 * 1024)
  })

  it('accepts exactly png, jpeg and webp with their extensions', () => {
    expect(EXTENSION_BY_TYPE).toEqual({
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/webp': 'webp',
    })
    expect([...ACCEPTED_IMAGE_TYPES].sort()).toEqual([
      'image/jpeg',
      'image/png',
      'image/webp',
    ])
  })
})

describe('imageObjectPath', () => {
  it('keys the object under the store folder with prefix and timestamp', () => {
    expect(imageObjectPath(STORE_ID, 'logo', 'image/png', 1700000000000)).toBe(
      `${STORE_ID}/logo-1700000000000.png`,
    )
    expect(imageObjectPath(STORE_ID, 'product', 'image/jpeg', 42)).toBe(
      `${STORE_ID}/product-42.jpg`,
    )
    expect(imageObjectPath(STORE_ID, 'cover', 'image/webp', 5)).toBe(
      `${STORE_ID}/cover-5.webp`,
    )
  })

  it('returns null for unsupported content types', () => {
    expect(imageObjectPath(STORE_ID, 'logo', 'image/gif', 1)).toBeNull()
    expect(imageObjectPath(STORE_ID, 'logo', 'text/html', 1)).toBeNull()
  })
})

describe('validateImageFile', () => {
  it('accepts a small image of an allowed type', () => {
    expect(validateImageFile(fakeFile('image/png', 1024))).toEqual({ ok: true })
    expect(validateImageFile(fakeFile('image/webp', MAX_IMAGE_BYTES))).toEqual({
      ok: true,
    })
  })

  it('rejects unsupported types with the Spanish message', () => {
    expect(validateImageFile(fakeFile('image/gif', 10))).toEqual({
      ok: false,
      error: 'Usa una imagen PNG, JPG o WebP.',
    })
  })

  it('rejects files over 3 MB with the Spanish message', () => {
    expect(
      validateImageFile(fakeFile('image/jpeg', MAX_IMAGE_BYTES + 1)),
    ).toEqual({
      ok: false,
      error: 'La imagen no puede superar 3 MB.',
    })
  })

  it('checks the type before the size', () => {
    expect(
      validateImageFile(fakeFile('image/gif', MAX_IMAGE_BYTES + 1)),
    ).toEqual({
      ok: false,
      error: 'Usa una imagen PNG, JPG o WebP.',
    })
  })
})
