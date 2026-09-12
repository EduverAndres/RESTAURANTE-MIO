import { quantizeColors } from '@/lib/theme/extract'

/**
 * The browser half of image handling for the editor: cropping to an aspect
 * ratio and reading the dominant colours out of a logo.
 *
 * The maths that decides *which* colours lives in `lib/theme/extract` and is
 * unit tested there; everything in this file is the part that needs a real
 * canvas, kept as thin as possible.
 */

/** Longest edge of an uploaded crop. Bigger is wasted on a phone screen. */
const MAX_OUTPUT_WIDTH = 1600

/** The extractor downsamples first: 96px is plenty to find four colours. */
const SAMPLE_SIZE = 96

export interface CropGeometry {
  /** Top-left of the scaled image relative to the crop box, in box pixels. */
  offsetX: number
  offsetY: number
  /** Size of the scaled image, in box pixels. */
  drawWidth: number
  drawHeight: number
  /** The crop box itself, in box pixels. */
  boxWidth: number
  boxHeight: number
}

/** Loads a URL (or object URL) into an image element. */
export function loadImage(
  src: string,
  crossOrigin?: 'anonymous',
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    if (crossOrigin) image.crossOrigin = crossOrigin
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('No pudimos cargar la imagen.'))
    image.src = src
  })
}

/**
 * Renders the visible part of the crop box into a canvas at the same aspect
 * ratio. The geometry is expressed in box pixels and scaled up by one factor,
 * so what the merchant sees is exactly what gets uploaded.
 */
export function cropToCanvas(
  image: HTMLImageElement,
  geometry: CropGeometry,
): HTMLCanvasElement {
  const scale = Math.min(1, MAX_OUTPUT_WIDTH / geometry.boxWidth)
  const width = Math.max(1, Math.round(geometry.boxWidth * scale))
  const height = Math.max(1, Math.round(geometry.boxHeight * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (context) {
    context.imageSmoothingQuality = 'high'
    context.drawImage(
      image,
      geometry.offsetX * scale,
      geometry.offsetY * scale,
      geometry.drawWidth * scale,
      geometry.drawHeight * scale,
    )
  }
  return canvas
}

/** Canvas to a File the upload action will accept. */
export function canvasToFile(
  canvas: HTMLCanvasElement,
  name: string,
  type: string,
): Promise<File> {
  const outputType = type === 'image/png' ? 'image/png' : 'image/jpeg'
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('No pudimos preparar la imagen.'))
          return
        }
        resolve(new File([blob], name, { type: outputType }))
      },
      outputType,
      0.92,
    )
  })
}

export type ExtractResult =
  { ok: true; colors: string[] } | { ok: false; error: string }

const TAINTED =
  'No pudimos leer los colores de esta imagen. Elige los colores a mano.'

/** The four dominant colours of an already loaded image. */
export function extractColorsFromImage(image: HTMLImageElement): ExtractResult {
  const width = image.naturalWidth || image.width
  const height = image.naturalHeight || image.height
  if (width === 0 || height === 0) return { ok: false, error: TAINTED }

  const scale = Math.min(1, SAMPLE_SIZE / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))

  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return { ok: false, error: TAINTED }
  context.drawImage(image, 0, 0, canvas.width, canvas.height)

  try {
    // Throws a SecurityError when the canvas was tainted by a cross-origin
    // image the server did not allow us to read.
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
    const colors = quantizeColors(data, 4)
    return colors.length > 0
      ? { ok: true, colors }
      : { ok: false, error: TAINTED }
  } catch {
    return { ok: false, error: TAINTED }
  }
}

/** Same, starting from a URL. Remote images need permissive CORS headers. */
export async function extractColorsFromUrl(
  url: string,
): Promise<ExtractResult> {
  try {
    const image = await loadImage(url, 'anonymous')
    return extractColorsFromImage(image)
  } catch {
    return { ok: false, error: TAINTED }
  }
}
