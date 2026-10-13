import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const directory = new URL('../../output/playwright/manual-qualification/fixtures/', import.meta.url)
const MiB = 1024 * 1024
const manifest = []
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? (value >>> 1) ^ 0xedb88320 : value >>> 1
  return value >>> 0
})

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data])
  let crc = 0xffffffff
  for (const byte of body) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff]
  const length = Buffer.alloc(4), checksum = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0)
  return Buffer.concat([length, body, checksum])
}

function png(width, height, seed = 0) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 2
  const stride = width * 3 + 1
  const raster = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const offset = y * stride + 1 + x * 3
    raster[offset] = x & 0xff
    raster[offset + 1] = y & 0xff
    raster[offset + 2] = (x ^ y ^ seed) & 0xff
  }
  return Buffer.concat([signature, chunk('IHDR', header), chunk('IDAT', deflateSync(raster, { level: 6 })), chunk('IEND', Buffer.alloc(0))])
}

function padTo(bytes, target) {
  const dataLength = target - bytes.length - 12
  if (dataLength < 8) throw new Error('Padding target is too small.')
  const data = Buffer.alloc(dataLength, 82)
  Buffer.from('Padding\0').copy(data)
  return Buffer.concat([bytes.subarray(0, 33), chunk('tEXt', data), bytes.subarray(33)])
}

async function save(name, bytes, width, height, purpose) {
  await writeFile(new URL(name, directory), bytes)
  manifest.push({ name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), width, height, pixels: width * height, purpose, license: 'MIT', origin: 'Synthetic deterministic RGB pixels; tools/web-qualification/generate-fixtures.mjs. No photographs or private inputs.' })
}

await mkdir(directory, { recursive: true })
for (const [name, width, height, purpose] of [
  ['rgb-1mp.png', 1000, 1000, 'Benchmark baseline: same-size PNG/JPEG/WebP transforms.'],
  ['rgb-12mp.png', 4000, 3000, 'Exact source pixel ceiling. Resize to 2000x1500 for an admitted transform; same-size transform must be rejected by the separate combined reservation.'],
  ['rgb-over-12mp.png', 4001, 3000, '12,003,000 pixels: reject intake before full decode.'],
  ['rgb-16mp.png', 4000, 4000, 'Proposed-profile comparison; current 12 MP profile must reject intake.'],
  ['side-8192.png', 8192, 1, 'Exact maximum source side; pixel count alone is small.'],
  ['side-8193.png', 8193, 1, 'Maximum source side plus one; reject intake.']
]) await save(name, png(width, height), width, height, purpose)

const tiny = png(64, 48)
for (const [name, bytes, purpose] of [
  ['bytes-20mib.png', 20 * MiB, 'Exact per-file byte ceiling; valid PNG with optional text metadata. Intake can accept; transformation requires explicit metadata removal and separate admission.'],
  ['bytes-over-20mib.png', 20 * MiB + 1, 'Per-file byte ceiling plus one; reject intake.'],
  ['bytes-10mib.png', 10 * MiB, 'Combine with two separately named 20 MiB fixtures for exactly 50 MiB aggregate sources.'],
  ['bytes-over-10mib.png', 10 * MiB + 1, 'Combine with two separately named 20 MiB fixtures for aggregate ceiling plus one.']
]) await save(name, padTo(tiny, bytes), 64, 48, purpose)

await save('bytes-20mib-second.png', padTo(png(64, 48, 1), 20 * MiB), 64, 48, 'Distinct content for exact 50 MiB aggregate intake; identical-content sources are rejected by the registry regardless of filename.')
for (let index = 1; index <= 11; index++) await save(`count-${String(index).padStart(2, '0')}.png`, png(64, 48, index + 1), 64, 48, 'Distinct content: select count-01 through count-10 for count ceiling; add count-11 for rejection without losing the first ten.')

const corpus = await readFile(new URL('../../test-fixtures/images/manifest.json', import.meta.url))
await writeFile(new URL('manifest.json', directory), JSON.stringify({ schemaVersion: 1, license: 'MIT', generator: 'tools/web-qualification/generate-fixtures.mjs', baseCorpusManifestSha256: createHash('sha256').update(corpus).digest('hex'), fixtures: manifest }, null, 2) + '\n')
console.log(JSON.stringify({ directory: fileURLToPath(directory), fixtures: manifest.length, totalBytes: manifest.reduce((sum, entry) => sum + entry.bytes, 0), qualification: 'Generated inputs only; no device benchmark or release gate has passed.' }))
