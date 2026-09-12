// Generates the PWA icon set from public/icon.svg (a flat paprika rounded
// square with a cream "T" made of plain rectangles, so it renders
// identically regardless of installed system fonts). Run once with
// `npm run icons` and commit the resulting PNGs; sharp is a dev-only
// dependency needed just for this script.
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const svgPath = resolve(projectRoot, 'public/icon.svg')
const outDir = resolve(projectRoot, 'public/icons')

const BACKGROUND = '#C2410C'

const targets = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'badge-96.png', size: 96 },
]

async function main() {
  mkdirSync(outDir, { recursive: true })
  const svg = readFileSync(svgPath)

  for (const { file, size } of targets) {
    await sharp(svg, { density: 384 }).resize(size, size).png().toFile(
      resolve(outDir, file),
    )
    console.log(`Wrote public/icons/${file}`)
  }

  // Maskable icons are cropped to a circle by the OS, so the glyph must sit
  // inside the ~80% safe zone: shrink it and pad with the same background
  // colour to fill the full canvas.
  const maskableSize = 512
  const contentSize = Math.round(maskableSize * 0.7)
  const content = await sharp(svg, { density: 384 })
    .resize(contentSize, contentSize)
    .png()
    .toBuffer()
  await sharp({
    create: {
      width: maskableSize,
      height: maskableSize,
      channels: 4,
      background: BACKGROUND,
    },
  })
    .composite([{ input: content, gravity: 'center' }])
    .png()
    .toFile(resolve(outDir, 'icon-maskable-512.png'))
  console.log('Wrote public/icons/icon-maskable-512.png')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
