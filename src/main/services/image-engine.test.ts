import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings, type OperationSettings } from '../../shared/contracts'

vi.mock('electron', () => ({ app: { isPackaged: false } }))

import { ImageEngine } from './image-engine'

const directories: string[] = []

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'remage-engine-'))
  directories.push(directory)
  return directory
}

async function pixels(path: string): Promise<Buffer> {
  return sharp(path).raw().toBuffer()
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('ImageEngine', () => {
  it('preserves transparent PNG samples during strict optimization and never mutates the source', async () => {
    const directory = await temporaryDirectory()
    const source = join(directory, 'transparent.png')
    await sharp(Buffer.from([255, 12, 34, 0, 17, 88, 211, 255]), { raw: { width: 2, height: 1, channels: 4 } }).png().toFile(source)
    const engine = new ImageEngine()
    const metadata = await engine.inspect(source)
    const original = await readFile(source)
    const result = await engine.process({ sourcePath: source, metadata, settings: defaultSettings, tempDirectory: directory, signal: new AbortController().signal })
    expect(await readFile(source)).toEqual(original)
    expect(['completed', 'unchanged']).toContain(result.status)
    if (result.candidatePath) expect(await pixels(result.candidatePath)).toEqual(await pixels(source))
  })

  it('uses coefficient-preserving JPEG optimization and validates the output', async () => {
    const directory = await temporaryDirectory()
    const source = join(directory, 'source.jpg')
    await sharp({ create: { width: 64, height: 48, channels: 3, background: '#ca7c36' } }).jpeg({ quality: 96, chromaSubsampling: '4:4:4' }).toFile(source)
    const engine = new ImageEngine()
    const metadata = await engine.inspect(source)
    const before = await stat(source)
    const result = await engine.process({ sourcePath: source, metadata, settings: defaultSettings, tempDirectory: directory, signal: new AbortController().signal })
    expect((await stat(source)).size).toBe(before.size)
    expect(['completed', 'unchanged']).toContain(result.status)
    if (result.candidatePath) expect(await pixels(result.candidatePath)).toEqual(await pixels(source))
  })

  it('keeps opaque PNG channel semantics strict by disabling OxiPNG transformations', async () => {
    const directory = await temporaryDirectory()
    const source = join(directory, 'opaque-rgba.png')
    await sharp({ create: { width: 256, height: 256, channels: 4, background: { r: 36, g: 80, b: 160, alpha: 1 } } }).png().toFile(source)
    const engine = new ImageEngine()
    const metadata = await engine.inspect(source)
    const result = await engine.process({ sourcePath: source, metadata, settings: defaultSettings, tempDirectory: directory, signal: new AbortController().signal })
    expect(['completed', 'unchanged']).toContain(result.status)
    if (result.candidatePath) expect((await sharp(result.candidatePath).metadata()).hasAlpha).toBe(true)
  })

  it('rejects an APNG control chunk before static-image decoding', async () => {
    const directory = await temporaryDirectory()
    const source = join(directory, 'animated.png')
    const basicPng = await sharp({ create: { width: 2, height: 2, channels: 4, background: '#ff0000' } }).png().toBuffer()
    const animationControl = Buffer.from([0, 0, 0, 8, 0x61, 0x63, 0x54, 0x4c, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0])
    await (await import('node:fs/promises')).writeFile(source, Buffer.concat([basicPng.subarray(0, 33), animationControl, basicPng.subarray(33)]))
    await expect(new ImageEngine().inspect(source)).rejects.toThrow('Animated PNG')
  })

  it('converts PNG to WebP and resizes transparent PNG to a JPEG background', async () => {
    const directory = await temporaryDirectory()
    const source = join(directory, 'source.png')
    await sharp({ create: { width: 80, height: 40, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 0.5 } } }).png().toFile(source)
    const engine = new ImageEngine()
    const metadata = await engine.inspect(source)
    const webp: OperationSettings = { ...defaultSettings, mode: 'converter', outputFormat: 'webp' }
    const webpResult = await engine.process({ sourcePath: source, metadata, settings: webp, tempDirectory: directory, signal: new AbortController().signal })
    expect(webpResult.resultFormat).toBe('webp')
    expect(webpResult.candidatePath).toMatch(/\.webp$/)

    const jpeg: OperationSettings = {
      ...defaultSettings,
      mode: 'converter',
      outputFormat: 'jpeg',
      jpegLossAcknowledged: true,
      jpegBackground: '#112233',
      resize: { enabled: true, width: 20, height: null, lockAspectRatio: true, allowEnlargement: false }
    }
    const jpegResult = await engine.process({ sourcePath: source, metadata, settings: jpeg, tempDirectory: directory, signal: new AbortController().signal })
    expect(jpegResult.resultFormat).toBe('jpeg')
    expect([jpegResult.width, jpegResult.height]).toEqual([20, 10])
    expect((await sharp(jpegResult.candidatePath!).metadata()).hasAlpha).toBe(false)
  })

  it('applies rounded resize dimensions once instead of fitting a second time', async () => {
    const directory = await temporaryDirectory()
    const source = join(directory, 'wide.png')
    await sharp({ create: { width: 1000, height: 333, channels: 3, background: '#58a2d2' } }).png().toFile(source)
    const engine = new ImageEngine()
    const metadata = await engine.inspect(source)
    const settings: OperationSettings = {
      ...defaultSettings,
      mode: 'converter',
      outputFormat: 'png',
      resize: { enabled: true, width: 100, height: null, lockAspectRatio: true, allowEnlargement: false }
    }
    const result = await engine.process({ sourcePath: source, metadata, settings, tempDirectory: directory, signal: new AbortController().signal })
    expect([result.width, result.height]).toEqual([100, 33])
  })
})
