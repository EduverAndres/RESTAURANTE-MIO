// Generates the PWA icon set from public/icon.svg (a flat paprika rounded
// square with a cream shop awning and the wordmark's dot, drawn with plain
// paths, so it renders identically regardless of installed system fonts).
// Run once with `npm run icons` and commit the resulting PNGs; sharp is a
// dev-only
// dependency needed just for this script.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
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

  // The browser tab icon. An .ico is a small directory of images; every
  // current browser accepts PNG-encoded entries, so sharp's PNGs are packed
  // as they are instead of being converted to bitmaps.
  const favicons = await Promise.all(
    [16, 32, 48].map(async (size) => ({
      size,
      data: await sharp(svg, { density: 384 }).resize(size, size).png().toBuffer(),
    })),
  )
  writeFileSync(resolve(projectRoot, 'app/favicon.ico'), packIco(favicons))
  console.log('Wrote app/favicon.ico')
}

/** ICONDIR header, one ICONDIRENTRY per image, then the PNG bytes. */
function packIco(images) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(images.length, 4)

  let offset = 6 + images.length * 16
  const entries = images.map(({ size, data }) => {
    const entry = Buffer.alloc(16)
    entry.writeUInt8(size, 0) // width
    entry.writeUInt8(size, 1) // height
    entry.writeUInt8(0, 2) // no palette
    entry.writeUInt8(0, 3) // reserved
    entry.writeUInt16LE(1, 4) // colour planes
    entry.writeUInt16LE(32, 6) // bits per pixel
    entry.writeUInt32LE(data.length, 8)
    entry.writeUInt32LE(offset, 12)
    offset += data.length
    return entry
  })

  return Buffer.concat([header, ...entries, ...images.map(({ data }) => data)])
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
