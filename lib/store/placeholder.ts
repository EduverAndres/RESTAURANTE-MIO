// Deterministic geometric placeholders.
//
// A store or product without a photo never gets a grey icon: it gets a
// pattern built from its own identity. The same seed, brand colour and label
// always produce the exact same picture, so a card looks identical on every
// render, on the server and on the client, and across deployments.

import { initialsOf } from '@/lib/format'

export const PLACEHOLDER_VARIANTS = [
  'blocks',
  'arcs',
  'rings',
  'chevrons',
  'confetti',
] as const
export type PlaceholderVariant = (typeof PLACEHOLDER_VARIANTS)[number]

export interface PlaceholderShape {
  kind: 'rect' | 'circle' | 'arc' | 'chevron'
  /** Centre (or top-left for `rect`) in a 0..100 viewBox. */
  x: number
  y: number
  size: number
  opacity: number
  rotate: number
}

export interface StorePlaceholder {
  variant: PlaceholderVariant
  /** Flat wash behind the shapes. */
  background: string
  /** The shapes themselves. */
  foreground: string
  /** The initials drawn on top. */
  ink: string
  initial: string
  shapes: PlaceholderShape[]
}

// ---------------------------------------------------------------------------
// Seeded randomness
// ---------------------------------------------------------------------------

/** FNV-1a, 32 bit, unsigned. Stable across runtimes and releases. */
export function hashSeed(seed: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/** Mulberry32: tiny, fast, and identical everywhere. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Rounds to two decimals so the output is byte-for-byte reproducible. */
function fixed(value: number): number {
  return Math.round(value * 100) / 100
}

// ---------------------------------------------------------------------------
// Colour
// ---------------------------------------------------------------------------

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i
const FALLBACK_RGB: [number, number, number] = [194, 65, 12]

function toRgb(hex: string): [number, number, number] {
  const match = HEX.exec(hex.trim())
  if (!match) return FALLBACK_RGB
  let digits = match[1]
  if (digits.length === 3) {
    digits = digits
      .split('')
      .map((char) => char + char)
      .join('')
  }
  return [
    parseInt(digits.slice(0, 2), 16),
    parseInt(digits.slice(2, 4), 16),
    parseInt(digits.slice(4, 6), 16),
  ]
}

function toHex(rgb: readonly [number, number, number]): string {
  return `#${rgb
    .map((channel) =>
      Math.max(0, Math.min(255, Math.round(channel)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`
}

/** Linear mix; `amount` 0 keeps `from`, 1 reaches `to`. */
function mix(
  from: readonly [number, number, number],
  to: readonly [number, number, number],
  amount: number,
): [number, number, number] {
  return [
    from[0] + (to[0] - from[0]) * amount,
    from[1] + (to[1] - from[1]) * amount,
    from[2] + (to[2] - from[2]) * amount,
  ]
}

const WHITE: [number, number, number] = [255, 255, 255]
const BLACK: [number, number, number] = [18, 16, 15]

/** Perceived brightness, 0..1. */
function luminance(rgb: readonly [number, number, number]): number {
  return (rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114) / 255
}

// ---------------------------------------------------------------------------
// Pattern
// ---------------------------------------------------------------------------

function buildShapes(
  variant: PlaceholderVariant,
  random: () => number,
): PlaceholderShape[] {
  const shapes: PlaceholderShape[] = []

  switch (variant) {
    case 'blocks': {
      // A 4x4 lattice where a seeded subset of the cells is filled.
      for (let row = 0; row < 4; row += 1) {
        for (let column = 0; column < 4; column += 1) {
          if (random() < 0.45) continue
          shapes.push({
            kind: 'rect',
            x: column * 25,
            y: row * 25,
            size: 25,
            opacity: fixed(0.12 + random() * 0.5),
            rotate: 0,
          })
        }
      }
      break
    }
    case 'arcs': {
      const count = 4 + Math.floor(random() * 3)
      for (let index = 0; index < count; index += 1) {
        shapes.push({
          kind: 'arc',
          x: fixed(random() * 100),
          y: fixed(random() * 100),
          size: fixed(24 + random() * 46),
          opacity: fixed(0.14 + random() * 0.4),
          rotate: Math.floor(random() * 4) * 90,
        })
      }
      break
    }
    case 'rings': {
      const count = 5 + Math.floor(random() * 4)
      const centreX = fixed(28 + random() * 44)
      const centreY = fixed(28 + random() * 44)
      for (let index = 0; index < count; index += 1) {
        shapes.push({
          kind: 'circle',
          x: centreX,
          y: centreY,
          size: fixed(10 + index * (7 + random() * 5)),
          opacity: fixed(0.1 + random() * 0.28),
          rotate: 0,
        })
      }
      break
    }
    case 'chevrons': {
      const count = 5 + Math.floor(random() * 4)
      const rotate = Math.floor(random() * 2) * 90
      for (let index = 0; index < count; index += 1) {
        shapes.push({
          kind: 'chevron',
          x: fixed(-10 + index * (100 / count)),
          y: fixed(random() * 70),
          size: fixed(18 + random() * 26),
          opacity: fixed(0.14 + random() * 0.38),
          rotate,
        })
      }
      break
    }
    default: {
      const count = 9 + Math.floor(random() * 8)
      for (let index = 0; index < count; index += 1) {
        shapes.push({
          kind: random() < 0.5 ? 'circle' : 'rect',
          x: fixed(random() * 92),
          y: fixed(random() * 92),
          size: fixed(5 + random() * 17),
          opacity: fixed(0.16 + random() * 0.44),
          rotate: Math.floor(random() * 8) * 45,
        })
      }
    }
  }

  // Every variant must draw something, even on an unlucky seed.
  if (shapes.length === 0) {
    shapes.push({
      kind: 'circle',
      x: 50,
      y: 50,
      size: 30,
      opacity: 0.3,
      rotate: 0,
    })
  }
  return shapes
}

/**
 * Builds the placeholder for `seed` (a store id/slug, or a product id) painted
 * in the tenant's `primary`, carrying the initials of `label`.
 *
 * Pure and total: an invalid colour falls back to the default brand orange and
 * an empty label to "?", so this can never throw during rendering.
 */
export function buildPlaceholder(
  seed: string,
  primary: string,
  label: string,
): StorePlaceholder {
  const hash = hashSeed(seed)
  const random = seededRandom(hash)
  const variant = PLACEHOLDER_VARIANTS[hash % PLACEHOLDER_VARIANTS.length]

  const base = toRgb(primary)
  const dark = luminance(base) < 0.42
  // A light brand gets a deeper wash and dark ink; a dark brand gets the
  // opposite, so the initials always read against the background.
  const background = dark
    ? mix(base, BLACK, 0.55 + random() * 0.1)
    : mix(base, WHITE, 0.78 + random() * 0.08)
  const foreground = dark ? mix(base, WHITE, 0.22) : base
  const ink = dark ? mix(base, WHITE, 0.72) : mix(base, BLACK, 0.42)

  return {
    variant,
    background: toHex(background),
    foreground: toHex(foreground),
    ink: toHex(ink),
    initial: initialsOf(label),
    shapes: buildShapes(variant, random),
  }
}

// ---------------------------------------------------------------------------
// SVG serialisation
// ---------------------------------------------------------------------------

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** The `d`/geometry of one shape, as SVG markup. */
export function shapeMarkup(shape: PlaceholderShape, fill: string): string {
  const transform =
    shape.rotate === 0
      ? ''
      : ` transform="rotate(${shape.rotate} ${shape.x} ${shape.y})"`
  switch (shape.kind) {
    case 'rect':
      return `<rect x="${shape.x}" y="${shape.y}" width="${shape.size}" height="${shape.size}" fill="${fill}" opacity="${shape.opacity}"${transform}/>`
    case 'circle':
      return `<circle cx="${shape.x}" cy="${shape.y}" r="${shape.size}" fill="${fill}" opacity="${shape.opacity}"${transform}/>`
    case 'arc':
      return `<path d="M ${shape.x} ${shape.y} a ${shape.size} ${shape.size} 0 0 1 ${shape.size} ${shape.size} L ${shape.x} ${shape.y} Z" fill="${fill}" opacity="${shape.opacity}"${transform}/>`
    default:
      return `<path d="M ${shape.x} ${shape.y} l ${shape.size / 2} ${shape.size} l ${shape.size / 2} ${-shape.size}" fill="none" stroke="${fill}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" opacity="${shape.opacity}"${transform}/>`
  }
}

/** Standalone `<svg>` markup; used by the OG image and by `placeholderDataUri`. */
export function placeholderSvg(placeholder: StorePlaceholder): string {
  const shapes = placeholder.shapes
    .map((shape) => shapeMarkup(shape, placeholder.foreground))
    .join('')
  const initial = escapeXml(placeholder.initial)
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">` +
    `<rect width="100" height="100" fill="${placeholder.background}"/>` +
    `<g clip-path="url(#c)">${shapes}</g>` +
    `<clipPath id="c"><rect width="100" height="100"/></clipPath>` +
    `<text x="50" y="50" text-anchor="middle" dominant-baseline="central" ` +
    `font-family="ui-serif, Georgia, serif" font-size="34" font-weight="700" ` +
    `fill="${placeholder.ink}">${initial}</text>` +
    `</svg>`
  )
}

/** The same picture as a `data:` URI, for `<img src>` and CSS backgrounds. */
export function placeholderDataUri(
  seed: string,
  primary: string,
  label: string,
): string {
  const svg = placeholderSvg(buildPlaceholder(seed, primary, label))
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
