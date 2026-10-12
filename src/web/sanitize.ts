import { inspectImage, jfifHasMetadata, jpegSegments, type ImageHeader } from './inspect'

const ascii = (bytes: Uint8Array, offset: number, length: number): string => String.fromCharCode(...bytes.subarray(offset, offset + length))
const pngRequired = new Set(['IHDR', 'PLTE', 'tRNS', 'IDAT', 'IEND', 'sRGB', 'gAMA', 'cHRM'])
const webpRequired = new Set(['VP8X', 'VP8 ', 'VP8L', 'ALPH'])

function join(parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let offset = 0
  for (const part of parts) { bytes.set(part, offset); offset += part.length }
  return bytes
}

// Never pass optional compressed metadata to the decoder. Color declarations
// are inspected first and retained; the caller must explicitly allow removal.
export function decoderInput(bytes: Uint8Array, header: ImageHeader, allowRemoval: boolean): Uint8Array<ArrayBuffer> {
  if (header.hasRemovableMetadata && !allowRemoval) throw new Error('This source contains metadata the browser adapter cannot preserve. Explicitly turn off metadata preservation for this transformation, or use the desktop edition.')
  if (!header.hasRemovableMetadata) return bytes.slice()
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const parts: Uint8Array[] = []
  if (header.metadata.format === 'png') {
    parts.push(bytes.subarray(0, 8))
    for (let offset = 8; offset < bytes.length;) {
      const end = offset + 12 + view.getUint32(offset)
      if (pngRequired.has(ascii(bytes, offset + 4, 4))) parts.push(bytes.subarray(offset, end))
      offset = end
    }
  } else if (header.metadata.format === 'jpeg') {
    parts.push(bytes.subarray(0, 2))
    for (const { marker, start, end, content } of jpegSegments(bytes)) {
      if (marker === 0xfe || (marker >= 0xe1 && marker <= 0xef) || (marker === 0xe0 && ascii(content, 0, 5) !== 'JFIF\0')) continue
      if (marker === 0xe0 && jfifHasMetadata(content)) {
        const jfif = new Uint8Array(18)
        jfif.set([0xff, 0xe0, 0, 16]); jfif.set(content.subarray(0, 7), 4); jfif[13] = 1; jfif[15] = 1
        parts.push(jfif); continue
      }
      parts.push(bytes.subarray(start, end))
    }
  } else {
    parts.push(bytes.subarray(0, 12))
    for (let offset = 12; offset < bytes.length;) {
      const size = view.getUint32(offset + 4, true), end = offset + 8 + size + size % 2
      const type = ascii(bytes, offset, 4)
      if (webpRequired.has(type)) {
        const part = type === 'VP8X' ? bytes.slice(offset, end) : bytes.subarray(offset, end)
        if (type === 'VP8X') part[8] &= ~12 // EXIF and XMP were explicitly removed.
        parts.push(part)
      }
      offset = end
    }
  }
  const sanitized = join(parts)
  if (header.metadata.format === 'webp') new DataView(sanitized.buffer).setUint32(4, sanitized.length - 8, true)
  inspectImage(sanitized)
  return sanitized
}
