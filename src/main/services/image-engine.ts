import { randomUUID } from 'node:crypto'
import { open, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import sharp, { type Metadata } from 'sharp'
import type { ImageFormat, ImageMetadata, OperationSettings } from '../../shared/contracts'
import { planResize } from '../../shared/resize'
import { codecPaths } from './capabilities'
import { INTAKE_LIMITS } from './intake'

export class CancelledError extends Error {
  constructor() {
    super('Processing was cancelled.')
  }
}

export type EngineResult = {
  candidatePath: string | null
  resultBytes: number
  resultFormat: ImageFormat
  width: number
  height: number
  operation: 'strict-optimization' | 'resize' | 'conversion'
  status: 'completed' | 'unchanged'
}

function normalizeFormat(value: string | undefined): ImageFormat {
  if (value === 'jpeg' || value === 'png' || value === 'webp') return value
  throw new Error('This image format is not supported.')
}

async function detectSignature(filePath: string): Promise<ImageFormat> {
  const handle = await open(filePath, 'r')
  try {
    const buffer = Buffer.alloc(16)
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
    const head = buffer.subarray(0, bytesRead)
    if (head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png'
    if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'jpeg'
    if (head.length >= 12 && head.subarray(0, 4).toString('ascii') === 'RIFF' && head.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp'
    throw new Error('The file contents are not a supported PNG, JPEG, or WebP image.')
  } finally {
    await handle.close()
  }
}

async function isAnimatedPng(filePath: string): Promise<boolean> {
  const handle = await open(filePath, 'r')
  try {
    let position = 8
    const header = Buffer.alloc(8)
    while (true) {
      const { bytesRead } = await handle.read(header, 0, header.length, position)
      if (bytesRead !== header.length) return false
      const length = header.readUInt32BE(0)
      const type = header.subarray(4, 8).toString('ascii')
      if (type === 'acTL') return true
      if (type === 'IDAT' || type === 'IEND') return false
      position += length + 12
    }
  } finally {
    await handle.close()
  }
}

function metadataFromSharp(metadata: Metadata): ImageMetadata {
  const format = normalizeFormat(metadata.format)
  const width = metadata.autoOrient.width ?? metadata.width
  const height = metadata.autoOrient.height ?? metadata.height
  if (!width || !height) throw new Error('The image has no readable dimensions.')
  if (width > INTAKE_LIMITS.maxDimension || height > INTAKE_LIMITS.maxDimension || width * height > INTAKE_LIMITS.maxPixels) {
    throw new Error('The image exceeds Remage’s supported decoded-image limit.')
  }

  return {
    format,
    width,
    height,
    hasAlpha: metadata.hasAlpha === true,
    orientation: metadata.orientation ?? null,
    bitDepth: metadata.depth ?? null,
    pages: metadata.pages ?? 1,
    space: metadata.space ?? null,
    hasIccProfile: Boolean(metadata.icc),
    hasExif: Boolean(metadata.exif)
  }
}

function assertStaticSupported(metadata: ImageMetadata): void {
  if (metadata.pages !== 1) throw new Error('Animated or multi-page images are not supported in this release.')
  if (metadata.bitDepth && metadata.bitDepth !== 'uchar') throw new Error('This image bit depth is not supported in this release.')
}

async function runBinary(command: string, args: string[], signal: AbortSignal): Promise<void> {
  if (signal.aborted) throw new CancelledError()
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    const onAbort = () => child.kill('SIGTERM')
    signal.addEventListener('abort', onAbort, { once: true })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    child.on('error', reject)
    child.on('close', (code) => {
      signal.removeEventListener('abort', onAbort)
      if (signal.aborted) return reject(new CancelledError())
      if (code === 0) return resolve()
      return reject(new Error(stderr.trim() || `Image adapter exited with code ${code}.`))
    })
  })
}

async function readPixels(filePath: string): Promise<{ data: Buffer; width: number; height: number; channels: number }> {
  const { data, info } = await sharp(filePath, { animated: false, limitInputPixels: INTAKE_LIMITS.maxPixels })
    .raw()
    .toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height, channels: info.channels }
}

function sameBuffer(a: Buffer | undefined, b: Buffer | undefined): boolean {
  if (!a && !b) return true
  if (!a || !b) return false
  return a.equals(b)
}

async function assertStrictPreservation(sourcePath: string, candidatePath: string, expected: ImageMetadata): Promise<void> {
  const [candidateSignature, candidateSharp, sourceSharp, sourcePixels, candidatePixels] = await Promise.all([
    detectSignature(candidatePath),
    sharp(candidatePath, { animated: false }).metadata(),
    sharp(sourcePath, { animated: false }).metadata(),
    readPixels(sourcePath),
    readPixels(candidatePath)
  ])
  const candidate = metadataFromSharp(candidateSharp)
  if (candidateSignature !== expected.format || candidate.format !== expected.format) throw new Error('The optimized candidate format changed.')
  if (candidate.width !== expected.width || candidate.height !== expected.height) throw new Error('The optimized candidate dimensions changed.')
  if (candidate.hasAlpha !== expected.hasAlpha) throw new Error('The optimized candidate transparency changed.')
  if (candidate.orientation !== expected.orientation) throw new Error('The optimized candidate orientation changed.')
  if (sourcePixels.width !== candidatePixels.width || sourcePixels.height !== candidatePixels.height || sourcePixels.channels !== candidatePixels.channels || !sourcePixels.data.equals(candidatePixels.data)) {
    throw new Error('The optimized candidate changed decoded image samples.')
  }
  if (!sameBuffer(sourceSharp.icc, candidateSharp.icc) || !sameBuffer(sourceSharp.exif, candidateSharp.exif)) {
    throw new Error('The optimized candidate did not preserve required metadata.')
  }
}

async function assertTransformOutput(candidatePath: string, target: ImageFormat, width: number, height: number): Promise<void> {
  const [signature, metadata] = await Promise.all([detectSignature(candidatePath), sharp(candidatePath, { animated: false }).metadata()])
  const actual = metadataFromSharp(metadata)
  if (signature !== target || actual.format !== target) throw new Error('The output format does not match the selected format.')
  if (actual.width !== width || actual.height !== height) throw new Error('The output dimensions do not match the requested dimensions.')
}

export class ImageEngine {
  async inspect(filePath: string): Promise<ImageMetadata> {
    const signature = await detectSignature(filePath)
    if (signature === 'png' && (await isAnimatedPng(filePath))) throw new Error('Animated PNG images are not supported in this release.')
    const metadata = metadataFromSharp(await sharp(filePath, { animated: false, limitInputPixels: INTAKE_LIMITS.maxPixels }).metadata())
    if (metadata.format !== signature) throw new Error('The file extension or decoded format does not match its contents.')
    assertStaticSupported(metadata)
    return metadata
  }

  async createThumbnail(filePath: string): Promise<string> {
    const data = await sharp(filePath, { animated: false, limitInputPixels: INTAKE_LIMITS.maxPixels })
      .rotate()
      .resize({ width: 160, height: 112, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer()
    return `data:image/jpeg;base64,${data.toString('base64')}`
  }

  async process({
    sourcePath,
    metadata,
    settings,
    tempDirectory,
    signal
  }: {
    sourcePath: string
    metadata: ImageMetadata
    settings: OperationSettings
    tempDirectory: string
    signal: AbortSignal
  }): Promise<EngineResult> {
    if (settings.mode === 'optimizer' && !settings.resize.enabled) {
      return this.optimizeStrict({ sourcePath, metadata, tempDirectory, signal })
    }
    return this.transform({ sourcePath, metadata, settings, tempDirectory, signal })
  }

  private async optimizeStrict({
    sourcePath,
    metadata,
    tempDirectory,
    signal
  }: {
    sourcePath: string
    metadata: ImageMetadata
    tempDirectory: string
    signal: AbortSignal
  }): Promise<EngineResult> {
    const paths = codecPaths()
    const candidatePath = join(tempDirectory, `${randomUUID()}.${metadata.format === 'jpeg' ? 'jpg' : 'png'}`)
    const command = metadata.format === 'jpeg' ? paths.jpegtran : paths.oxipng
    const argumentsList =
      metadata.format === 'jpeg'
        ? ['-copy', 'all', '-optimize', '-outfile', candidatePath, sourcePath]
        : ['--opt', '4', '--nx', '--out', candidatePath, sourcePath]

    try {
      await runBinary(command, argumentsList, signal)
      await assertStrictPreservation(sourcePath, candidatePath, metadata)
      const [sourceDetails, candidateDetails] = await Promise.all([stat(sourcePath), stat(candidatePath)])
      if (candidateDetails.size >= sourceDetails.size) {
        await rm(candidatePath, { force: true })
        return {
          candidatePath: null,
          resultBytes: sourceDetails.size,
          resultFormat: metadata.format,
          width: metadata.width,
          height: metadata.height,
          operation: 'strict-optimization',
          status: 'unchanged'
        }
      }
      return {
        candidatePath,
        resultBytes: candidateDetails.size,
        resultFormat: metadata.format,
        width: metadata.width,
        height: metadata.height,
        operation: 'strict-optimization',
        status: 'completed'
      }
    } catch (error) {
      await rm(candidatePath, { force: true }).catch(() => undefined)
      throw error
    }
  }

  private async transform({
    sourcePath,
    metadata,
    settings,
    tempDirectory,
    signal
  }: {
    sourcePath: string
    metadata: ImageMetadata
    settings: OperationSettings
    tempDirectory: string
    signal: AbortSignal
  }): Promise<EngineResult> {
    if (signal.aborted) throw new CancelledError()
    const target = settings.mode === 'converter' ? settings.outputFormat : metadata.format
    if (!target) throw new Error('Choose an output format.')
    const dimensions = planResize({ width: metadata.width, height: metadata.height }, settings.resize)
    const candidatePath = join(tempDirectory, `${randomUUID()}.${target === 'jpeg' ? 'jpg' : target}`)
    let pipeline = sharp(sourcePath, { animated: false, limitInputPixels: INTAKE_LIMITS.maxPixels }).rotate()

    if (settings.resize.enabled) {
      pipeline = pipeline.resize({
        width: dimensions.width,
        height: dimensions.height,
        fit: 'fill'
      })
    }

    if (settings.preserveMetadata) pipeline = pipeline.withMetadata({ orientation: 1 })
    if (target === 'png') pipeline = pipeline.png({ compressionLevel: 9, palette: false })
    if (target === 'jpeg') pipeline = pipeline.flatten({ background: settings.jpegBackground }).jpeg({ quality: 90, chromaSubsampling: '4:4:4' })
    if (target === 'webp') pipeline = pipeline.webp({ lossless: true, exact: true, effort: 5 })

    try {
      await pipeline.toFile(candidatePath)
      if (signal.aborted) throw new CancelledError()
      await assertTransformOutput(candidatePath, target, dimensions.width, dimensions.height)
      const details = await stat(candidatePath)
      return {
        candidatePath,
        resultBytes: details.size,
        resultFormat: target,
        width: dimensions.width,
        height: dimensions.height,
        operation: settings.mode === 'converter' ? 'conversion' : 'resize',
        status: 'completed'
      }
    } catch (error) {
      await rm(candidatePath, { force: true }).catch(() => undefined)
      throw error
    }
  }
}
