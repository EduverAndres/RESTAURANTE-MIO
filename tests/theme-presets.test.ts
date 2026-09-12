import { describe, expect, it } from 'vitest'
import { THEME_PRESETS, applyPreset, findPreset } from '@/lib/theme/presets'
import { auditTheme } from '@/lib/theme/score'
import { normalizeTheme } from '@/lib/theme'
import { storeThemeSchema } from '@/lib/validations/theme'
import { DEFAULT_STORE_THEME, THEME_CORE_SECTIONS } from '@/types/app'

describe('THEME_PRESETS', () => {
  it('ships the eight named looks', () => {
    expect(THEME_PRESETS.map((preset) => preset.name)).toEqual([
      'Elegante',
      'Callejero',
      'Fresco',
      'Nocturno',
      'Cafetería',
      'Mar',
      'Minimal',
      'Fiesta',
    ])
  })

  it('gives every preset a unique id and a Spanish description', () => {
    const ids = THEME_PRESETS.map((preset) => preset.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const preset of THEME_PRESETS) {
      expect(preset.description.length).toBeGreaterThan(10)
    }
  })

  it('holds a complete, already normalized StoreTheme', () => {
    for (const preset of THEME_PRESETS) {
      expect(normalizeTheme(preset.theme)).toEqual(preset.theme)
    }
  })

  it('passes the Phase 2 zod schema', () => {
    for (const preset of THEME_PRESETS) {
      const parsed = storeThemeSchema.safeParse(preset.theme)
      expect(parsed.success, `${preset.name}: ${parsed.error?.message}`).toBe(
        true,
      )
    }
  })

  it('always includes the core sections in the order', () => {
    for (const preset of THEME_PRESETS) {
      for (const section of THEME_CORE_SECTIONS) {
        expect(preset.theme.sectionOrder).toContain(section)
      }
    }
  })

  it('is accessible out of the box', () => {
    for (const preset of THEME_PRESETS) {
      const report = auditTheme(preset.theme)
      expect(report.score, `${preset.name} scored ${report.score}`).toBe(100)
    }
  })

  it('carries no merchant content', () => {
    for (const preset of THEME_PRESETS) {
      expect(preset.theme.logoUrl).toBeNull()
      expect(preset.theme.banner.imageUrl).toBeNull()
      expect(preset.theme.featured.productIds).toEqual([])
      expect(preset.theme.customCss).toBeNull()
    }
  })

  it('gives each preset a distinct primary colour', () => {
    const primaries = THEME_PRESETS.map((preset) => preset.theme.primary)
    expect(new Set(primaries).size).toBe(primaries.length)
  })
})

describe('findPreset', () => {
  it('finds a preset by id', () => {
    expect(findPreset(THEME_PRESETS[0].id)?.name).toBe('Elegante')
  })

  it('returns null for an unknown id', () => {
    expect(findPreset('nope')).toBeNull()
  })
})

describe('applyPreset', () => {
  const preset = THEME_PRESETS[3]
  const current = {
    ...DEFAULT_STORE_THEME,
    logoUrl: 'https://cdn.example.com/logo.png',
    banner: {
      ...DEFAULT_STORE_THEME.banner,
      imageUrl: 'https://cdn.example.com/cover.jpg',
    },
    featured: {
      ...DEFAULT_STORE_THEME.featured,
      productIds: ['p1', 'p2'],
      title: 'Los favoritos',
    },
    story: {
      enabled: true,
      title: 'Desde 1998',
      text: 'Abrimos en una esquina del barrio.',
      imageUrl: 'https://cdn.example.com/story.jpg',
    },
    social: {
      instagram: '@arepaandco',
      tiktok: null,
      facebook: null,
      whatsapp: true,
    },
    footer: { text: 'Gracias por pedir', showMap: true, showSchedule: true },
    hero: {
      ...DEFAULT_STORE_THEME.hero,
      tagline: 'Arepas de verdad',
      ctaLabel: 'Pedir ya',
    },
    customCss: '.foo { color: red }',
  }

  it('takes the look from the preset', () => {
    const applied = applyPreset(current, preset)
    expect(applied.primary).toBe(preset.theme.primary)
    expect(applied.fontDisplay).toBe(preset.theme.fontDisplay)
    expect(applied.cardStyle).toBe(preset.theme.cardStyle)
    expect(applied.menuLayout).toBe(preset.theme.menuLayout)
  })

  it('keeps the merchant images, copy and product picks', () => {
    const applied = applyPreset(current, preset)
    expect(applied.logoUrl).toBe(current.logoUrl)
    expect(applied.banner.imageUrl).toBe(current.banner.imageUrl)
    expect(applied.featured.productIds).toEqual(['p1', 'p2'])
    expect(applied.featured.title).toBe('Los favoritos')
    expect(applied.story.text).toBe(current.story.text)
    expect(applied.story.imageUrl).toBe(current.story.imageUrl)
    expect(applied.social.instagram).toBe('@arepaandco')
    expect(applied.footer.text).toBe('Gracias por pedir')
    expect(applied.hero.tagline).toBe('Arepas de verdad')
    expect(applied.hero.ctaLabel).toBe('Pedir ya')
    expect(applied.customCss).toBe(current.customCss)
  })

  it('keeps the sections the merchant turned on', () => {
    const withStory = {
      ...current,
      sectionOrder: [...current.sectionOrder, 'story' as const],
    }
    expect(applyPreset(withStory, preset).sectionOrder).toContain('story')
    expect(applyPreset(withStory, preset).story.enabled).toBe(true)
  })

  it('produces a theme that still passes the schema', () => {
    expect(
      storeThemeSchema.safeParse(applyPreset(current, preset)).success,
    ).toBe(true)
  })

  it('never mutates its inputs', () => {
    const snapshot = JSON.stringify(current)
    applyPreset(current, preset)
    expect(JSON.stringify(current)).toBe(snapshot)
  })
})
