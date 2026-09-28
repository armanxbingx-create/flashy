/*
  Generates the Flashy app icons from one drawing routine so the PNG home
  screen icons, the maskable manifest icon and the SVG favicon all share the
  same brand mark: a light "F" on dark glass with spectrum material behind it.

    node scripts/generate-icons.mjs
*/
import { deflateSync } from 'node:zlib'
import { writeFileSync, rmSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const MASTER = 2048

/* ---------------------------------------------------------------- brand mark */

// Rounded-rectangle half sizes / centres, in 0..1 icon units.
const MARK = [
  { cx: 0.3700, cy: 0.5000, hw: 0.0625, hh: 0.2500 }, // stem
  { cx: 0.5000, cy: 0.3125, hw: 0.1925, hh: 0.0625 }, // top arm
  { cx: 0.4675, cy: 0.5075, hw: 0.1600, hh: 0.0625 }, // middle arm
]
const MARK_RADIUS = 0.030
const PANEL = { cx: 0.5, cy: 0.5, hw: 0.26, hh: 0.31, r: 0.12 }
const PANEL_ALPHA = 0.45

// Spectrum material sitting behind the dark glass panel.
const GLOWS = [
  { x: 0.30, y: 0.24, r: 0.62, c: [255, 24, 127], a: 0.46 }, // pink
  { x: 0.74, y: 0.34, r: 0.58, c: [141, 34, 255], a: 0.44 }, // purple
  { x: 0.52, y: 0.80, r: 0.54, c: [255, 100, 21], a: 0.36 }, // orange
  { x: 0.84, y: 0.76, r: 0.34, c: [255, 197, 42], a: 0.26 }, // yellow
]

const BASE = [7, 9, 18]
const MARK_COLOR = [247, 247, 251]

function roundedRect(x, y, shape) {
  const { cx, cy, hw, hh, r } = { ...shape, r: shape.r ?? MARK_RADIUS }
  const qx = Math.abs(x - cx) - (hw - r)
  const qy = Math.abs(y - cy) - (hh - r)
  const ax = Math.max(qx, 0)
  const ay = Math.max(qy, 0)
  return Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - r
}

function renderMaster() {
  const pixels = Buffer.alloc(MASTER * MASTER * 4)
  const panelShapes = [PANEL]
  const markShapes = MARK.map((s) => ({ ...s, r: MARK_RADIUS }))

  for (let py = 0; py < MASTER; py++) {
    const y = (py + 0.5) / MASTER
    for (let px = 0; px < MASTER; px++) {
      const x = (px + 0.5) / MASTER

      let r = BASE[0]
      let g = BASE[1]
      let b = BASE[2]

      for (const glow of GLOWS) {
        const d = Math.hypot(x - glow.x, y - glow.y) / glow.r
        if (d >= 1) continue
        const t = 1 - d
        const f = t * t * (3 - 2 * t) * glow.a
        r += glow.c[0] * f
        g += glow.c[1] * f
        b += glow.c[2] * f
      }

      // Dark glass panel over the spectrum material.
      let panelSd = Infinity
      for (const shape of panelShapes) panelSd = Math.min(panelSd, roundedRect(x, y, shape))
      const panelCover = coverage(panelSd * MASTER)
      if (panelCover > 0) {
        r += (BASE[0] - r) * PANEL_ALPHA * panelCover
        g += (BASE[1] - g) * PANEL_ALPHA * panelCover
        b += (BASE[2] - b) * PANEL_ALPHA * panelCover
      }

      // Light mark on top of the glass.
      let markSd = Infinity
      for (const shape of markShapes) markSd = Math.min(markSd, roundedRect(x, y, shape))
      const markCover = coverage(markSd * MASTER)
      if (markCover > 0) {
        r += (MARK_COLOR[0] - r) * markCover
        g += (MARK_COLOR[1] - g) * markCover
        b += (MARK_COLOR[2] - b) * markCover
      }

      const o = (py * MASTER + px) * 4
      pixels[o] = clamp(r)
      pixels[o + 1] = clamp(g)
      pixels[o + 2] = clamp(b)
      pixels[o + 3] = 255
    }
  }
  return pixels
}

function coverage(sdPixels) {
  if (sdPixels <= -0.5) return 1
  if (sdPixels >= 0.5) return 0
  return 0.5 - sdPixels
}

function clamp(value) {
  return value < 0 ? 0 : value > 255 ? 255 : Math.round(value)
}

/* ------------------------------------------------------------------ resizing */

function boxDownsample(src, srcSize, dstSize) {
  const scale = srcSize / dstSize
  const out = Buffer.alloc(dstSize * dstSize * 4)
  for (let y = 0; y < dstSize; y++) {
    const y0 = y * scale
    const y1 = (y + 1) * scale
    for (let x = 0; x < dstSize; x++) {
      const x0 = x * scale
      const x1 = (x + 1) * scale
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      let weight = 0
      for (let sy = Math.floor(y0); sy < Math.min(Math.ceil(y1), srcSize); sy++) {
        const wy = Math.min(sy + 1, y1) - Math.max(sy, y0)
        for (let sx = Math.floor(x0); sx < Math.min(Math.ceil(x1), srcSize); sx++) {
          const wx = Math.min(sx + 1, x1) - Math.max(sx, x0)
          const w = wx * wy
          const i = (sy * srcSize + sx) * 4
          r += src[i] * w
          g += src[i + 1] * w
          b += src[i + 2] * w
          a += src[i + 3] * w
          weight += w
        }
      }
      const o = (y * dstSize + x) * 4
      out[o] = Math.round(r / weight)
      out[o + 1] = Math.round(g / weight)
      out[o + 2] = Math.round(b / weight)
      out[o + 3] = Math.round(a / weight)
    }
  }
  return out
}

/* ----------------------------------------------------------------- png codec */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buffer) {
  let c = 0xffffffff
  for (let i = 0; i < buffer.length; i++) c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([length, body, crc])
}

function encodePng(width, height, rgba) {
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // colour type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

/* ---------------------------------------------------------------------- main */

const master = renderMaster()

const targets = [
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
]

for (const [name, size] of targets) {
  const scaled = size === MASTER ? master : boxDownsample(master, MASTER, size)
  writeFileSync(resolve(ROOT, 'public', name), encodePng(size, size, scaled))
  console.log(`public/${name}  ${size}x${size}`)
}

// Replace any superseded SVG app icons.
for (const stale of ['icon-192.svg', 'icon-512.svg', 'icons.svg']) {
  rmSync(resolve(ROOT, 'public', stale), { force: true })
}

/* -------------------------------------------------------------------- favicon */

const U = 64
const rect = (x, y, w, h, r) =>
  `<rect x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}" rx="${round(r)}"/>`

const glow = (id, g) =>
  `<radialGradient id="${id}" cx="${g.x}" cy="${g.y}" r="${g.r}">` +
  `<stop offset="0" stop-color="rgb(${g.c.join(',')})" stop-opacity="${g.a}"/>` +
  `<stop offset="0.55" stop-color="rgb(${g.c.join(',')})" stop-opacity="${round(g.a * 0.42)}"/>` +
  `<stop offset="1" stop-color="rgb(${g.c.join(',')})" stop-opacity="0"/>` +
  `</radialGradient>`

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" width="${U}" height="${U}" viewBox="0 0 ${U} ${U}">
  <defs>${GLOWS.map((g, i) => glow(`g${i}`, g)).join('')}</defs>
  <rect width="${U}" height="${U}" fill="rgb(${BASE.join(',')})"/>
  ${GLOWS.map((_, i) => `<rect width="${U}" height="${U}" fill="url(#g${i})"/>`).join('\n  ')}
  <g fill="rgb(${BASE.join(',')})" fill-opacity="${PANEL_ALPHA}">
    ${rect((PANEL.cx - PANEL.hw) * U, (PANEL.cy - PANEL.hh) * U, PANEL.hw * 2 * U, PANEL.hh * 2 * U, PANEL.r * U)}
  </g>
  <g fill="rgb(${MARK_COLOR.join(',')})">
    ${rect(0.3075 * U, 0.25 * U, 0.125 * U, 0.5 * U, MARK_RADIUS * U)}
    ${rect(0.3075 * U, 0.25 * U, 0.385 * U, 0.125 * U, MARK_RADIUS * U)}
    ${rect(0.3075 * U, 0.445 * U, 0.32 * U, 0.125 * U, MARK_RADIUS * U)}
  </g>
</svg>
`

writeFileSync(resolve(ROOT, 'public', 'favicon.svg'), favicon)
console.log('public/favicon.svg')

function round(value) {
  return Math.round(value * 100) / 100
}
