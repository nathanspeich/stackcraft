// Generates PWA PNG icons without any image library: a dark tile with three
// stacked bars in the track colors (Linux green, Python blue, SQL pink).
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

const crcTable = new Int32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c
})
const crc32 = (buf) => {
  let c = -1
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))

function png(size, draw) {
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = draw(x, y)
      const o = y * (size * 4 + 1) + 1 + x * 4
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ])
}

const inRounded = (x, y, x0, y0, w, h, r) => {
  if (x < x0 || y < y0 || x >= x0 + w || y >= y0 + h) return false
  const cx = Math.max(x0 + r, Math.min(x, x0 + w - r - 1))
  const cy = Math.max(y0 + r, Math.min(y, y0 + h - r - 1))
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
}

const BG = hex('#0b1020')
const BARS = [hex('#34d399'), hex('#60a5fa'), hex('#f472b6')]

function icon(size, { maskable }) {
  const pad = maskable ? size * 0.2 : size * 0.12
  const inner = size - pad * 2
  const barH = inner * 0.2
  const gap = inner * 0.06
  const bars = BARS.map((c, i) => {
    const w = inner * (1 - i * 0.2)
    const x0 = (size - w) / 2
    const y0 = size - pad - (i + 1) * barH - i * gap
    return { c, x0, y0, w, h: barH }
  })
  return png(size, (x, y) => {
    const tile = maskable ? true : inRounded(x, y, 0, 0, size, size, size * 0.22)
    if (!tile) return [0, 0, 0, 0]
    for (const b of bars) if (inRounded(x, y, b.x0, b.y0, b.w, b.h, barH * 0.3)) return [...b.c, 255]
    return [...BG, 255]
  })
}

writeFileSync('public/pwa-192.png', icon(192, { maskable: false }))
writeFileSync('public/pwa-512.png', icon(512, { maskable: false }))
writeFileSync('public/pwa-maskable-512.png', icon(512, { maskable: true }))
writeFileSync('public/apple-touch-icon.png', icon(180, { maskable: true }))
console.log('icons written')
