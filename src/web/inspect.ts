import type { ImageMetadata } from '../shared/contracts'
import { crc32 } from './crc32'

export type ImageHeader = {
  metadata: ImageMetadata
  hasRemovableMetadata: boolean
  encodedWidth: number
  encodedHeight: number
}

const ascii = (bytes: Uint8Array, offset: number, length: number): string =>
  String.fromCharCode(...bytes.subarray(offset, offset + length))

function fail(message = 'The image is truncated or has invalid headers.'): never {
  throw new Error(message)
}

function exifOrientation(bytes: Uint8Array): number | null {
  let start = 0
  if (ascii(bytes, 0, 6) === 'Exif\0\0') start = 6
  if (bytes.length < start + 8) return fail('EXIF metadata is truncated.')
  const little = ascii(bytes, start, 2) === 'II'
  if (!little && ascii(bytes, start, 2) !== 'MM') return fail('EXIF byte order is invalid.')
  const view = new DataView(bytes.buffer, bytes.byteOffset + start, bytes.byteLength - start)
  if (view.getUint16(2, little) !== 42) return fail('EXIF header is invalid.')
  const visited = new Set<number>()
  let totalEntries = 0, orientation: number | null = null
  const walk = (directory: number, kind: 'root' | 'exif' | 'interop'): void => {
    if (!directory) return
    if (directory < 8 || directory + 2 > view.byteLength || visited.has(directory) || visited.size >= 8) return fail('EXIF directory is invalid or exceeds the parser budget.')
    visited.add(directory)
    const count = view.getUint16(directory, little)
    totalEntries += count
    if (totalEntries > 4096 || directory + 2 + count * 12 + 4 > view.byteLength) return fail('EXIF directory exceeds its bounds.')
    const tags = new Set<number>()
    for (let index = 0; index < count; index++) {
      const offset = directory + 2 + index * 12, tag = view.getUint16(offset, little)
      const type = view.getUint16(offset + 2, little), length = view.getUint32(offset + 4, little)
      if (tags.has(tag)) return fail('Duplicate EXIF declarations are unsupported.')
      tags.add(tag)
      const scalar = (): number => {
        if (type !== 3 || length !== 1) return fail('EXIF color or orientation declaration is invalid.')
        return view.getUint16(offset + 8, little)
      }
      if (kind === 'root' && tag === 0x112) {
        orientation = scalar()
        if (orientation < 1 || orientation > 8) return fail('EXIF orientation is invalid.')
      }
      if (tag === 0xa001 && scalar() !== 1) return fail('EXIF declares unsupported or uncalibrated color. Only known sRGB is supported, even when metadata removal is selected.')
      if (tag === 0xa500) return fail('Explicit EXIF gamma is unsupported in the browser color adapter.')
      if ([0x13e, 0x13f, 0x211, 0x214, 0x12d].includes(tag)) return fail('EXIF contains explicit color calibration unsupported in the browser adapter. Normalize it in the desktop edition first.')
      if (tag === 0x106 && ![2, 6].includes(scalar())) return fail('EXIF declares an unsupported color interpretation.')
      if (kind === 'interop' && tag === 1) {
        if (type !== 2 || length !== 4 || ascii(bytes, start + offset + 8, 4) !== 'R98\0') return fail('EXIF interoperability declares unsupported color interpretation.')
      }
      if (tag === 0x8769 || tag === 0xa005) {
        if (type !== 4 || length !== 1) return fail('EXIF subdirectory is invalid.')
        walk(view.getUint32(offset + 8, little), tag === 0x8769 ? 'exif' : 'interop')
      }
    }
    const next = view.getUint32(directory + 2 + count * 12, little)
    if (next && (next < 8 || next + 2 > view.byteLength)) return fail('EXIF next directory is invalid.')
  }
  walk(view.getUint32(4, little), 'root')
  return orientation
}

function finish(format: ImageMetadata['format'], width: number, height: number, alpha: boolean, orientation: number | null, removable: boolean): ImageHeader {
  if (!width || !height) return fail('Image dimensions are missing.')
  const swap = orientation !== null && orientation >= 5
  return {
    encodedWidth: width, encodedHeight: height, hasRemovableMetadata: removable,
    metadata: {
      format, width: swap ? height : width, height: swap ? width : height, hasAlpha: alpha,
      orientation, bitDepth: 'uchar', pages: 1, space: 'srgb', hasIccProfile: false, hasExif: orientation !== null
    }
  }
}

function png(bytes: Uint8Array): ImageHeader {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let width = 0, height = 0, alpha = false, orientation: number | null = null, removable = false, data = false, ended = false, palette = false
  let colorType = -1, chunks = 0, exif = false, transparency = false, dataEnded = false
  for (let offset = 8; offset < bytes.length;) {
    if (++chunks > 65536 || offset + 12 > bytes.length) return fail()
    const size = view.getUint32(offset)
    const end = offset + 12 + size
    if (end > bytes.length) return fail()
    const type = ascii(bytes, offset + 4, 4)
    if (!/^[A-Za-z]{4}$/.test(type)) return fail('PNG chunk type is invalid.')
    if (crc32(bytes.subarray(offset + 4, end - 4)) !== view.getUint32(end - 4)) return fail('PNG chunk checksum is invalid.')
    const content = bytes.subarray(offset + 8, end - 4)
    if (!width && type !== 'IHDR') return fail('PNG header must be the first chunk.')
    if (type === 'IHDR') {
      if (width || size !== 13) return fail()
      width = view.getUint32(offset + 8); height = view.getUint32(offset + 12)
      if (content[8] !== 8) return fail('Browser processing supports 8-bit PNG only.')
      colorType = content[9]
      if (![0, 2, 3, 4, 6].includes(colorType) || content[10] !== 0 || content[11] !== 0 || content[12] > 1) return fail('PNG color or compression mode is unsupported.')
      alpha = colorType === 4 || colorType === 6
    } else if (type === 'acTL' || type === 'fcTL' || type === 'fdAT') {
      return fail('Animated PNG is unsupported. Select a static image.')
    } else if (type === 'iCCP') {
      return fail('Embedded ICC profiles are not supported by the browser color adapter. Use the desktop edition.')
    } else if (type === 'cICP') {
      return fail('This PNG uses unsupported color interpretation.')
    } else if (type === 'orNT') {
      return fail('This PNG uses a nonstandard orientation declaration. Normalize it in the desktop edition first.')
    } else if (type === 'gAMA') {
      if (size !== 4 || view.getUint32(offset + 8) !== 45455) return fail('Only standard sRGB PNG gamma is supported.')
    } else if (type === 'cHRM') {
      const srgb = [31270, 32900, 64000, 33000, 30000, 60000, 15000, 6000]
      if (size !== 32 || srgb.some((value, index) => view.getUint32(offset + 8 + index * 4) !== value)) return fail('Only standard sRGB PNG chromaticity is supported.')
    } else if (type === 'sRGB') {
      if (size !== 1 || content[0] > 3) return fail()
    } else if (type === 'PLTE') {
      if (data || palette || !size || size > 768 || size % 3) return fail()
      palette = true
    } else if (type === 'tRNS') {
      if (transparency || data || (colorType === 3 && (!palette || !size || size > 256)) || (colorType === 0 && size !== 2) || (colorType === 2 && size !== 6) || [4, 6].includes(colorType)) return fail()
      alpha = true; transparency = true
    } else if (type === 'eXIf') {
      if (exif) return fail('Duplicate PNG EXIF metadata is unsupported.')
      exif = true; orientation = exifOrientation(content); removable = true
    } else if (type === 'IDAT') {
      if (dataEnded) return fail('PNG image data chunks must be consecutive.')
      if (colorType === 3 && !palette) return fail('Palette PNG has no palette.')
      data = true
    } else if (type === 'IEND') {
      if (!data || size !== 0 || end !== bytes.length) return fail()
      ended = true
    } else {
      if ((type.charCodeAt(0) & 32) === 0) return fail('Unsupported critical PNG chunk.')
      removable = true
    }
    if (data && type !== 'IDAT') dataEnded = true
    offset = end
  }
  if (!ended) return fail()
  const header = finish('png', width, height, alpha, orientation, removable)
  header.metadata.hasExif = exif
  return header
}

export function* jpegSegments(bytes: Uint8Array): Generator<{ marker: number; start: number; end: number; content: Uint8Array }> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 2, segments = 0, headerBytes = 0
  while (offset < bytes.length) {
    const start = offset
    if (++segments > 65536 || bytes[offset++] !== 0xff) return fail('JPEG header is invalid or exceeds the parser budget.')
    while (bytes[offset] === 0xff) offset++
    const marker = bytes[offset++]
    if (marker === 0xd9) {
      if (offset !== bytes.length) return fail('JPEG has trailing content.')
      yield { marker, start, end: offset, content: bytes.subarray(offset, offset) }
      return
    }
    if (marker === undefined || marker === 0 || marker === 0xd8 || marker === 0xdc || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) return fail('Unsupported JPEG marker.')
    if (offset + 2 > bytes.length) return fail()
    const size = view.getUint16(offset)
    if (size < 2 || offset + size > bytes.length || (headerBytes += size + 2) > 4 * 1024 * 1024) return fail('JPEG header exceeds its bounds or parser budget.')
    const content = bytes.subarray(offset + 2, offset + size)
    offset += size
    if (marker === 0xda) {
      if (!content.length || content.length !== 1 + content[0] * 2 + 3) return fail('JPEG scan header is invalid.')
      while (offset < bytes.length) {
        if (bytes[offset] !== 0xff) { offset++; continue }
        let next = offset + 1
        while (bytes[next] === 0xff) next++
        if (bytes[next] === 0 || (bytes[next] >= 0xd0 && bytes[next] <= 0xd7)) { offset = next + 1; continue }
        break
      }
    }
    yield { marker, start, end: offset, content }
  }
  return fail('JPEG end marker is missing.')
}

export function jfifHasMetadata(content: Uint8Array): boolean {
  if (content.length < 14 || content.length !== 14 + content[12] * content[13] * 3) return fail('JPEG JFIF metadata is truncated or invalid.')
  return content[7] !== 0 || content[8] !== 0 || content[9] !== 1 || content[10] !== 0 || content[11] !== 1 || content[12] !== 0 || content[13] !== 0
}

function jpeg(bytes: Uint8Array): ImageHeader {
  let width = 0, height = 0, orientation: number | null = null, removable = false, scan = false, exif = false
  for (const { marker, content } of jpegSegments(bytes)) {
    if (marker === 0xda) scan = true
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      if (width || ![0xc0, 0xc2].includes(marker) || content.length < 6 || content[0] !== 8) return fail('Only 8-bit baseline or progressive JPEG is supported.')
      height = (content[1] << 8) | content[2]; width = (content[3] << 8) | content[4]
      const components = content[5]
      if (![1, 3].includes(components) || content.length !== 6 + components * 3) return fail('CMYK and other JPEG color models are unsupported.')
      if (components === 3 && [0, 1, 2].some((index) => content[6 + index * 3] !== index + 1)) return fail('Nonstandard JPEG component color interpretation is unsupported.')
    }
    if (marker === 0xe2 && ascii(content, 0, 12) === 'ICC_PROFILE\0') return fail('Embedded ICC profiles are not supported by the browser color adapter. Use the desktop edition.')
    if (marker === 0xee) return fail('Adobe-tagged JPEG color interpretation is unsupported in this browser build.')
    if (marker === 0xe1) {
      if (ascii(content, 0, 6) === 'Exif\0\0') {
        if (exif) return fail('Duplicate EXIF metadata is unsupported.')
        exif = true; orientation = exifOrientation(content)
      }
      removable = true
    } else if (marker === 0xfe || (marker >= 0xe1 && marker <= 0xef)) removable = true
    else if (marker === 0xe0) removable ||= ascii(content, 0, 5) !== 'JFIF\0' || jfifHasMetadata(content)
  }
  if (!scan) return fail('JPEG image scan is missing.')
  const header = finish('jpeg', width, height, false, orientation, removable)
  header.metadata.hasExif = exif
  return header
}

function webp(bytes: Uint8Array): ImageHeader {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (bytes.length < 20 || view.getUint32(4, true) + 8 !== bytes.length) return fail('WebP container length is invalid.')
  let width = 0, height = 0, alpha = false, orientation: number | null = null, removable = false, image = false, chunks = 0, exif = false
  for (let offset = 12; offset < bytes.length;) {
    if (++chunks > 65536 || offset + 8 > bytes.length) return fail()
    const type = ascii(bytes, offset, 4), size = view.getUint32(offset + 4, true)
    const start = offset + 8, end = start + size
    if (end + size % 2 > bytes.length) return fail()
    const content = bytes.subarray(start, end)
    if (type === 'VP8X') {
      if (offset !== 12 || size !== 10 || (content[0] & 0xc1) || content[1] || content[2] || content[3]) return fail('WebP extended header is invalid.')
      if (content[0] & 2) return fail('Animated WebP is unsupported. Select a static image.')
      if (content[0] & 32) return fail('Embedded ICC profiles are unsupported in the browser color adapter.')
      alpha = Boolean(content[0] & 16)
      width = 1 + content[4] + (content[5] << 8) + (content[6] << 16)
      height = 1 + content[7] + (content[8] << 8) + (content[9] << 16)
    } else if (type === 'VP8L') {
      if (image || size < 5 || content[0] !== 0x2f) return fail()
      const bits = view.getUint32(start + 1, true)
      if (bits >>> 29) return fail('WebP lossless version is unsupported.')
      const w = 1 + (bits & 0x3fff), h = 1 + ((bits >>> 14) & 0x3fff)
      if (width && (width !== w || height !== h)) return fail('WebP dimensions disagree.')
      width = w; height = h; alpha ||= Boolean(bits & 0x10000000); image = true
    } else if (type === 'VP8 ') {
      if (image || size < 10 || (content[0] & 1) || ascii(content, 3, 3) !== '\x9d\x01\x2a') return fail()
      const w = view.getUint16(start + 6, true) & 0x3fff, h = view.getUint16(start + 8, true) & 0x3fff
      if (width && (width !== w || height !== h)) return fail('WebP dimensions disagree.')
      width = w; height = h; image = true
    } else if (type === 'ALPH') alpha = true
    else if (type === 'ICCP') return fail('Embedded ICC profiles are unsupported in the browser color adapter.')
    else if (type === 'ANIM' || type === 'ANMF') return fail('Animated WebP is unsupported. Select a static image.')
    else if (type === 'EXIF') {
      if (exif) return fail('Duplicate WebP EXIF metadata is unsupported.')
      exif = true; orientation = exifOrientation(content); removable = true
    }
    else removable = true
    offset = end + size % 2
  }
  if (!image) return fail('WebP image data is missing.')
  const header = finish('webp', width, height, alpha, orientation, removable)
  header.metadata.hasExif = exif
  return header
}

export function inspectImage(bytes: Uint8Array): ImageHeader {
  if (bytes.length >= 8 && ascii(bytes, 0, 8) === '\x89PNG\r\n\x1a\n') return png(bytes)
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) return jpeg(bytes)
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return webp(bytes)
  return fail('Unsupported image content. Select a static PNG, JPEG or WebP file.')
}
