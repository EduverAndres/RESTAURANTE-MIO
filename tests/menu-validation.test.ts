import { describe, expect, it } from 'vitest'
import {
  categorySchema,
  optionGroupSchema,
  productImageObjectPath,
  productSchema,
} from '@/lib/validations/menu'

const STORE_ID = '11111111-1111-4111-8111-111111111111'
const CATEGORY_ID = '22222222-2222-4222-8222-222222222222'

describe('categorySchema', () => {
  it('trims the name and enforces a sensible length', () => {
    const result = categorySchema.safeParse({ name: '  Entradas ' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.name).toBe('Entradas')
    expect(categorySchema.safeParse({ name: 'E' }).success).toBe(false)
    expect(categorySchema.safeParse({ name: 'x'.repeat(41) }).success).toBe(
      false,
    )
  })
})

describe('productSchema', () => {
  const valid = {
    name: 'Bandeja paisa',
    description: '',
    price: 32000,
    is_available: true,
    tags: 'típico, grande',
    category_id: CATEGORY_ID,
  }

  it('accepts a valid product and normalises description and tags', () => {
    const result = productSchema.safeParse(valid)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.description).toBeNull()
    expect(result.data.tags).toEqual(['típico', 'grande'])
    expect(result.data.category_id).toBe(CATEGORY_ID)
  })

  it('allows a product without category', () => {
    const result = productSchema.safeParse({ ...valid, category_id: null })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.category_id).toBeNull()
  })

  it('rejects negative prices, non-numeric prices and bad category ids', () => {
    expect(productSchema.safeParse({ ...valid, price: -1 }).success).toBe(false)
    expect(
      productSchema.safeParse({ ...valid, price: Number.NaN }).success,
    ).toBe(false)
    expect(
      productSchema.safeParse({ ...valid, category_id: 'nope' }).success,
    ).toBe(false)
  })

  it('requires a name', () => {
    expect(productSchema.safeParse({ ...valid, name: ' ' }).success).toBe(false)
  })
})

describe('optionGroupSchema', () => {
  const valid = {
    name: 'Tamaño',
    required: true,
    min: 1,
    max: 1,
    values: [
      { name: 'Personal', price_delta: 0 },
      { name: 'Grande', price_delta: 5000 },
    ],
  }

  it('accepts a consistent group', () => {
    expect(optionGroupSchema.safeParse(valid).success).toBe(true)
  })

  it('surfaces the min/max issue on the max field', () => {
    const result = optionGroupSchema.safeParse({ ...valid, min: 2, max: 1 })
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.issues[0]?.path).toEqual(['max'])
  })

  it('requires at least one value with a name', () => {
    expect(optionGroupSchema.safeParse({ ...valid, values: [] }).success).toBe(
      false,
    )
    expect(
      optionGroupSchema.safeParse({
        ...valid,
        values: [{ name: '', price_delta: 0 }],
      }).success,
    ).toBe(false)
  })

  it('rejects a non-integer min', () => {
    expect(optionGroupSchema.safeParse({ ...valid, min: 0.5 }).success).toBe(
      false,
    )
  })
})

describe('productImageObjectPath', () => {
  it('keys the object by store id and rejects unknown types', () => {
    expect(productImageObjectPath(STORE_ID, 'image/webp', 42)).toBe(
      `${STORE_ID}/product-42.webp`,
    )
    expect(productImageObjectPath(STORE_ID, 'image/gif', 42)).toBeNull()
  })
})
