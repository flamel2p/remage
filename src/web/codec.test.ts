import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import sharp, { type OutputInfo } from 'sharp'
import { beforeAll, describe, expect, it } from 'vitest'
import { initializeImageMagick } from '@imagemagick/magick-wasm'
import { defaultSettings, type ImageFormat, type OperationSettings } from '../shared/contracts'
import { constrainCodec, transformImage, webpEncoder } from './codec'
import { inspectImage, jpegSegments } from './inspect'
import { decoderInput } from './sanitize'
import { crc32 } from './crc32'

const fixture = async (name: string): Promise<Uint8Array<ArrayBuffer>> => new Uint8Array(await readFile(resolve('test-fixtures/images', name)))
const settings = (format: ImageFormat, extra: Partial<OperationSettings> = {}): OperationSettings => ({ ...structuredClone(defaultSettings), mode: 'converter', outputFormat: format, jpegLossAcknowledged: format === 'jpeg', ...extra })
const pixels = async (bytes: Uint8Array): Promise<{ data: Buffer; info: OutputInfo }> => sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true })

function chunk(type: string, data: Uint8Array): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(data.length + 12), view = new DataView(bytes.buffer)
  view.setUint32(0, data.length); bytes.set(new TextEncoder().encode(type), 4); bytes.set(data, 8)
  view.setUint32(bytes.length - 4, crc32(bytes.subarray(4, bytes.length - 4)))
  return bytes
}
function insertPng(bytes: Uint8Array, type: string, data: Uint8Array): Uint8Array<ArrayBuffer> {
  const added = chunk(type, data), output = new Uint8Array(bytes.length + added.length)
  output.set(bytes.subarray(0, 33)); output.set(added, 33); output.set(bytes.subarray(33), 33 + added.length); return output
}
function changeOrientation(bytes: Uint8Array, orientation: number): Uint8Array<ArrayBuffer> {
  const copy = bytes.slice(), exif = [...jpegSegments(copy)].find((segment) => segment.marker === 0xe1)!.content
  const view = new DataView(exif.buffer, exif.byteOffset + 6, exif.byteLength - 6), directory = view.getUint32(4, true), count = view.getUint16(directory, true)
  for (let index = 0; index < count; index++) {
    const offset = directory + 2 + index * 12
    if (view.getUint16(offset, true) === 0x112) { view.setUint16(offset + 8, orientation, true); return copy }
  }
  throw new Error('Orientation fixture tag was absent.')
}
function webpExif(bytes: Uint8Array, tiff: Uint8Array): Uint8Array<ArrayBuffer> {
  const source = inspectImage(bytes), extended = new Uint8Array(18), extView = new DataView(extended.buffer)
  extended.set(new TextEncoder().encode('VP8X')); extView.setUint32(4, 10, true); extended[8] = 8 | (source.metadata.hasAlpha ? 16 : 0)
  const width = source.encodedWidth - 1, height = source.encodedHeight - 1
  extended[12] = width & 255; extended[13] = width >>> 8; extended[15] = height & 255; extended[16] = height >>> 8
  const exif = new Uint8Array(8 + tiff.length + tiff.length % 2)
  exif.set(new TextEncoder().encode('EXIF')); new DataView(exif.buffer).setUint32(4, tiff.length, true); exif.set(tiff, 8)
  const output = new Uint8Array(bytes.length + extended.length + exif.length)
  output.set(bytes.subarray(0, 12)); output.set(extended, 12); output.set(bytes.subarray(12), 30); output.set(exif, bytes.length + extended.length)
  new DataView(output.buffer).setUint32(4, output.length - 8, true); return output
}

beforeAll(async () => {
  await initializeImageMagick(new Uint8Array(await readFile(resolve('node_modules/@imagemagick/magick-wasm/dist/x86/magick.wasm'))))
  constrainCodec()
}, 120_000)

describe('real browser codec candidate against independent native Sharp', () => {
  for (const name of ['rgb.png', 'rgba-hidden-rgb.png', 'gray.png', 'palette.png', 'baseline.jpg', 'progressive.jpg', 'lossless.webp', 'lossy.webp']) {
    for (const format of ['png', 'jpeg', 'webp'] as const) {
      it(`${name} → ${format} agrees on signature and visible dimensions`, async () => {
        const source = await fixture(name), input = inspectImage(source)
        const result = transformImage(source, settings(format, { preserveMetadata: !input.hasRemovableMetadata }), source.length)
        const metadata = await sharp(result.bytes).metadata()
        expect(metadata.format).toBe(format)
        expect([metadata.width, metadata.height]).toEqual([input.metadata.width, input.metadata.height])
        expect(inspectImage(result.bytes).hasRemovableMetadata).toBe(false)
        if (format === 'jpeg') expect(metadata.hasAlpha).toBe(false)
        if (format !== 'jpeg') {
          const actual = (await pixels(result.bytes)).data, expected = (await pixels(source)).data
          if (name.endsWith('.jpg')) expect(Math.max(...actual.map((value, index) => Math.abs(value - expected[index])))).toBeLessThanOrEqual(4)
          else expect(actual).toEqual(expected)
        }
      })
    }
  }

  it('uses exact lossless WebP and retains hidden transparent RGB', async () => {
    expect(webpEncoder).toEqual({ quality: 100, lossless: true, exact: true, alphaQuality: 100, threadLevel: 0, method: 5 })
    const source = await fixture('rgba-hidden-rgb.png')
    const output = transformImage(source, settings('webp', { preserveMetadata: false }), 0)
    expect((await pixels(output.bytes)).data).toEqual((await pixels(source)).data)
  })

  it('blocks default metadata preservation, applies orientation after explicit removal, and plans visible dimensions', async () => {
    const source = await fixture('oriented.jpg'), header = inspectImage(source)
    expect(header.metadata.orientation).toBe(6)
    expect(() => transformImage(source, settings('png'), 0)).toThrow(/metadata/i)
    const result = transformImage(source, settings('png', { preserveMetadata: false }), 0)
    const independent = await sharp(source).autoOrient().ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const actual = await pixels(result.bytes)
    expect([actual.info.width, actual.info.height]).toEqual([independent.info.width, independent.info.height])
    // Different JPEG IDCT implementations can differ by a few sample levels.
    expect(Math.max(...actual.data.map((value, index) => Math.abs(value - independent.data[index])))).toBeLessThanOrEqual(4)
    const resized = transformImage(source, settings('png', { preserveMetadata: false, resize: { enabled: true, width: 24, height: 24, lockAspectRatio: true, allowEnlargement: false } }), 0)
    expect([resized.width, resized.height]).toEqual([18, 24])
  })
  for (const orientation of [1, 2, 3, 4, 5, 6, 7, 8]) {
    it(`normalizes EXIF orientation ${orientation} before PNG/WebP encoding with independent samples`, async () => {
      const source = changeOrientation(await fixture('oriented.jpg'), orientation)
      const independent = await sharp(source).autoOrient().ensureAlpha().raw().toBuffer({ resolveWithObject: true })
      for (const format of ['png', 'webp'] as const) {
        const result = transformImage(source, settings(format, { preserveMetadata: false }), 0), actual = await pixels(result.bytes)
        expect([actual.info.width, actual.info.height]).toEqual([independent.info.width, independent.info.height])
        expect(Math.max(...actual.data.map((value, index) => Math.abs(value - independent.data[index])))).toBeLessThanOrEqual(4)
        expect(inspectImage(result.bytes).metadata.orientation).toBeNull()
      }
    })
  }
  it('normalizes PNG and WebP EXIF orientation6 and retains alpha while removing only selected metadata', async () => {
    const oriented = await fixture('oriented.jpg'), tiff = [...jpegSegments(oriented)].find((segment) => segment.marker === 0xe1)!.content.subarray(6)
    const png = insertPng(await fixture('rgba-hidden-rgb.png'), 'eXIf', tiff), webp = webpExif(await fixture('lossless.webp'), tiff)
    for (const source of [png, webp]) {
      expect(inspectImage(source).metadata).toMatchObject({ orientation: 6, hasExif: true, width: 48, height: 64, hasAlpha: true })
      const independent = await sharp(source).autoOrient().ensureAlpha().raw().toBuffer({ resolveWithObject: true })
      const result = transformImage(source, settings('png', { preserveMetadata: false }), 0), actual = await pixels(result.bytes)
      expect(actual.data).toEqual(independent.data)
      expect([actual.info.width, actual.info.height]).toEqual([48, 64])
      const stripped = decoderInput(source, inspectImage(source), true)
      expect(inspectImage(stripped).metadata.hasAlpha).toBe(true)
    }
  })

  it('composites transparent samples onto the chosen JPEG background and requires acknowledgement', async () => {
    const source = await fixture('rgba-hidden-rgb.png')
    expect(() => transformImage(source, settings('jpeg', { jpegLossAcknowledged: false }), 0)).toThrow(/acknowledge/i)
    const result = transformImage(source, settings('jpeg', { jpegBackground: '#E05020', preserveMetadata: false }), 0)
    const actual = await sharp(result.bytes).raw().toBuffer(), input = (await pixels(source)).data
    const expected = await sharp(source).flatten({ background: '#E05020' }).jpeg({ quality: 90 }).raw().toBuffer()
    const transparent = Array.from({ length: input.length / 4 }, (_, i) => i).filter((i) => input[i * 4 + 3] === 0)
    expect(transparent.length).toBeGreaterThan(0)
    const meanDifference = transparent.reduce((sum, i) => sum + [0, 1, 2].reduce((acc, channel) => acc + Math.abs(actual[i * 3 + channel] - expected[i * 3 + channel]), 0), 0) / (transparent.length * 3)
    expect(meanDifference).toBeLessThan(20)
  })

  it('handles containing/exact plans, rejects oversized enlargement and records larger valid outputs', async () => {
    const source = await fixture('baseline.jpg')
    const exact = transformImage(source, settings('png', { resize: { enabled: true, width: 25, height: 17, lockAspectRatio: false, allowEnlargement: false } }), 0)
    expect([exact.width, exact.height]).toEqual([25, 17])
    expect(() => transformImage(source, settings('png', { resize: { enabled: true, width: 8192, height: 8192, lockAspectRatio: false, allowEnlargement: true } }), 0)).toThrow(/dimensions/)
    expect(transformImage(source, settings('png'), 0).bytes.length).toBeGreaterThan(source.length)
    expect(() => transformImage(source, { ...defaultSettings }, 0)).toThrow(/Strict browser optimization/)
  })

  it('processes admitted exact 12 MP source and output boundaries with the real codec', async () => {
    for (const [sourceWidth, sourceHeight, width, height] of [[4000, 3000, 2000, 1500], [2000, 1500, 4000, 3000]]) {
      const source = new Uint8Array(await sharp({ create: { width: sourceWidth, height: sourceHeight, channels: 3, background: '#336699' } }).png().toBuffer())
      const result = transformImage(source, settings('png', { preserveMetadata: false, resize: { enabled: true, width, height, lockAspectRatio: true, allowEnlargement: true } }), source.length)
      const actual = await sharp(result.bytes).raw().toBuffer({ resolveWithObject: true })
      expect([result.width, result.height, actual.info.width, actual.info.height, actual.info.channels]).toEqual([width, height, width, height, 3])
      expect(actual.data.equals(Buffer.alloc(width * height * 3, Buffer.from([0x33, 0x66, 0x99])))).toBe(true)
    }
  }, 15_000)
})

describe('bounded content headers and explicit sanitization', () => {
  for (const name of ['icc.png', 'cmyk.jpg', 'animated.png', 'depth16.png', 'corrupt.png', 'unsupported.gif']) {
    it(`rejects ${name} before decode regardless of optional metadata selection`, async () => {
      const source = await fixture(name)
      expect(() => inspectImage(source)).toThrow()
      expect(() => transformImage(source, settings('png', { preserveMetadata: false }), 0)).toThrow()
    })
  }
  it('validates CRC and strips compressed/text metadata before any decode only when removal is allowed', async () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
    const source = await fixture('metadata.png'), header = inspectImage(source)
    expect(header.hasRemovableMetadata).toBe(true)
    expect(() => decoderInput(source, header, false)).toThrow(/metadata/i)
    const clean = decoderInput(source, header, true)
    expect(inspectImage(clean).hasRemovableMetadata).toBe(false)
    const corrupt = source.slice(); corrupt[20] ^= 1
    expect(() => inspectImage(corrupt)).toThrow(/checksum/)
    const bomb = insertPng(await fixture('rgb.png'), 'zTXt', new Uint8Array([97, 0, 0, 120, 156, 255]))
    expect(inspectImage(bomb).hasRemovableMetadata).toBe(true)
    expect(inspectImage(decoderInput(bomb, inspectImage(bomb), true)).hasRemovableMetadata).toBe(false)
    const gamma = new Uint8Array(4); new DataView(gamma.buffer).setUint32(0, 100000)
    const nonstandard = insertPng(await fixture('rgb.png'), 'gAMA', gamma)
    expect(() => inspectImage(nonstandard)).toThrow(/gamma/)
  })
  it('rejects truncated JPEG entropy even when the header and end marker appear intact', async () => {
    const source = await fixture('baseline.jpg'), scan = [...jpegSegments(source)].find((segment) => segment.marker === 0xda)!
    const entropy = scan.start + 4 + scan.content.length, corrupt = new Uint8Array(entropy + 12)
    corrupt.set(source.subarray(0, entropy + 10)); corrupt.set([0xff, 0xd9], entropy + 10)
    expect(inspectImage(corrupt).metadata.width).toBe(64)
    expect(() => transformImage(corrupt, settings('png'), 0)).toThrow(/warning|corrupt|premature|insufficient|improper/i)
  })
  it('requires explicit density-metadata removal while preserving the JPEG color marker', async () => {
    const source = await fixture('baseline.jpg'), output = new Uint8Array(source.length + 18)
    output.set(source.subarray(0, 2)); output.set([0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 1, 1, 44, 1, 44, 0, 0], 2); output.set(source.subarray(2), 20)
    expect(inspectImage(output).hasRemovableMetadata).toBe(true)
    expect(() => transformImage(output, settings('png'), 0)).toThrow(/metadata/)
    const stripped = decoderInput(output, inspectImage(output), true)
    expect(inspectImage(stripped).hasRemovableMetadata).toBe(false)
    expect([...jpegSegments(stripped)].some((part) => part.marker === 0xe0)).toBe(true)
    expect(transformImage(output, settings('png', { preserveMetadata: false }), 0).width).toBe(64)
  })
  it('walks progressive scans to detect and remove late metadata, rejects late ICC/Adobe and malformed lengths', async () => {
    const source = await fixture('progressive.jpg'), segments = [...jpegSegments(source)]
    const scan = segments.find((segment) => segment.marker === 0xda)!
    const insert = (marker: number, data: Uint8Array): Uint8Array<ArrayBuffer> => {
      const output = new Uint8Array(source.length + data.length + 4), view = new DataView(output.buffer)
      output.set(source.subarray(0, scan.end)); output[scan.end] = 0xff; output[scan.end + 1] = marker
      view.setUint16(scan.end + 2, data.length + 2); output.set(data, scan.end + 4); output.set(source.subarray(scan.end), scan.end + data.length + 4); return output
    }
    expect(segments.filter((segment) => segment.marker === 0xda).length).toBeGreaterThan(1)
    const lateComment = insert(0xfe, new TextEncoder().encode('private comment'))
    expect(inspectImage(lateComment).hasRemovableMetadata).toBe(true)
    expect(inspectImage(decoderInput(lateComment, inspectImage(lateComment), true)).hasRemovableMetadata).toBe(false)
    expect(() => inspectImage(insert(0xe2, new TextEncoder().encode('ICC_PROFILE\0bad')))).toThrow(/ICC/)
    expect(() => inspectImage(insert(0xee, new TextEncoder().encode('Adobe')))).toThrow(/Adobe/)
    const bad = insert(0xfe, new Uint8Array(0)); bad[scan.end + 2] = 0xff
    expect(() => inspectImage(bad)).toThrow(/bounds/)
    const oriented = await fixture('oriented.jpg'), exif = [...jpegSegments(oriented)].find((segment) => segment.marker === 0xe1)!
    const lateExif = insert(0xe1, exif.content)
    expect(inspectImage(lateExif).metadata.orientation).toBe(6)
    expect(inspectImage(lateExif).metadata.hasExif).toBe(true)
  })
  it('rejects duplicate EXIF containers/tags and unsupported EXIF color even with removal selected', async () => {
    const oriented = await fixture('oriented.jpg'), tiff = [...jpegSegments(oriented)].find((segment) => segment.marker === 0xe1)!.content.subarray(6)
    const png = insertPng(insertPng(await fixture('rgb.png'), 'eXIf', tiff), 'eXIf', tiff)
    expect(() => inspectImage(png)).toThrow(/Duplicate PNG/)
    const webp = webpExif(await fixture('lossless.webp'), tiff), duplicate = new Uint8Array(webp.length + tiff.length + 8)
    duplicate.set(webp); duplicate.set(new TextEncoder().encode('EXIF'), webp.length); new DataView(duplicate.buffer).setUint32(webp.length + 4, tiff.length, true); duplicate.set(tiff, webp.length + 8); new DataView(duplicate.buffer).setUint32(4, duplicate.length - 8, true)
    expect(() => inspectImage(duplicate)).toThrow(/Duplicate WebP/)
    const exif = tiff.slice(), view = new DataView(exif.buffer), directory = view.getUint32(4, true), count = view.getUint16(directory, true)
    let subdirectory = 0
    for (let index = 0; index < count; index++) { const offset = directory + 2 + index * 12; if (view.getUint16(offset, true) === 0x8769) subdirectory = view.getUint32(offset + 8, true) }
    for (let index = 0; index < view.getUint16(subdirectory, true); index++) { const offset = subdirectory + 2 + index * 12; if (view.getUint16(offset, true) === 0xa001) view.setUint16(offset + 8, 65535, true) }
    const uncalibrated = insertPng(await fixture('rgb.png'), 'eXIf', exif)
    expect(() => inspectImage(uncalibrated)).toThrow(/uncalibrated color/)
    expect(() => transformImage(uncalibrated, settings('png', { preserveMetadata: false }), 0)).toThrow(/uncalibrated color/)
    const calibrated = new Uint8Array(tiff.length + 48); calibrated.set(tiff)
    const calibration = new DataView(calibrated.buffer), tag = directory + 2
    calibration.setUint16(tag, 0x214, true); calibration.setUint16(tag + 2, 5, true); calibration.setUint32(tag + 4, 6, true); calibration.setUint32(tag + 8, tiff.length, true)
    for (let index = 0; index < 6; index++) { calibration.setUint32(tiff.length + index * 8, index % 2 ? 255 : 0, true); calibration.setUint32(tiff.length + index * 8 + 4, 1, true) }
    const referenceBlackWhite = insertPng(await fixture('rgb.png'), 'eXIf', calibrated)
    expect(() => inspectImage(referenceBlackWhite)).toThrow(/color calibration/)
    expect(() => transformImage(referenceBlackWhite, settings('png', { preserveMetadata: false }), 0)).toThrow(/color calibration/)
    const duplicateTag = tiff.slice(), duplicateView = new DataView(duplicateTag.buffer)
    duplicateView.setUint16(directory + 2 + 12, duplicateView.getUint16(directory + 2, true), true)
    const repeated = insertPng(await fixture('rgb.png'), 'eXIf', duplicateTag)
    expect(() => inspectImage(repeated)).toThrow(/Duplicate EXIF/)
    const withoutOrientation = tiff.slice(), noOri = new DataView(withoutOrientation.buffer)
    for (let index = 0; index < count; index++) { const offset = directory + 2 + index * 12; if (noOri.getUint16(offset, true) === 0x112) noOri.setUint16(offset, 0x110, true) }
    expect(inspectImage(insertPng(await fixture('rgb.png'), 'eXIf', withoutOrientation)).metadata).toMatchObject({ hasExif: true, orientation: null })
  })
})
