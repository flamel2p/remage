import type { OperationSettings } from '../shared/contracts'
import { planResize } from '../shared/resize'
import type { ImageHeader } from './inspect'

const MiB = 1024 * 1024
export const browserLimits = Object.freeze({
  sourceCount: 10, sourceFileBytes: 20 * MiB, sourceBytes: 50 * MiB,
  intakeFiles: 100, rejectedRows: 10, retainedResults: 100, sourceNameCharacters: 255,
  resultBytes: 50 * MiB, pixels: 12_000_000, dimension: 8192,
  archiveBytes: 50 * MiB, workingBytes: 256 * MiB,
  codecScratchBytes: 64 * MiB, archiveScratchBytes: 8 * MiB,
  imageTimeoutMs: 60_000, archiveTimeoutMs: 30_000
})

export function assertDimensions(width: number, height: number): void {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 ||
      width > browserLimits.dimension || height > browserLimits.dimension || width * height > browserLimits.pixels) {
    throw new Error('Image dimensions exceed the browser limit (8,192 px per side and 12 megapixels). Reduce the size or use the desktop edition.')
  }
}

export function admitImage(header: ImageHeader, settings: OperationSettings, retainedBytes: number, sourceBytes: number): { width: number; height: number } {
  assertByteCount(retainedBytes); assertByteCount(sourceBytes)
  assertDimensions(header.metadata.width, header.metadata.height)
  const output = planResize(header.metadata, settings.resize)
  assertDimensions(output.width, output.height)
  const rasterBytes = (header.metadata.width * header.metadata.height + output.width * output.height) * 4
  const reservation = retainedBytes + sourceBytes * 2 + rasterBytes * 3 + browserLimits.codecScratchBytes
  if (reservation > browserLimits.workingBytes) {
    throw new Error('This operation exceeds the browser working-memory budget. Remove retained images/results, request a smaller output, or use the desktop edition.')
  }
  return output
}

export function admitArchive(retainedBytes: number, entries: readonly { bytes: number; name: string }[]): number {
  assertByteCount(retainedBytes)
  if (!entries.length) throw new Error('Select at least one available completed result.')
  if (entries.length > 65535) throw new Error('This archive contains too many entries.')
  for (const entry of entries) assertByteCount(entry.bytes)
  const size = entries.reduce((total, entry) => total + entry.bytes + 76 + new TextEncoder().encode(entry.name).length * 2, 22)
  if (size > browserLimits.archiveBytes) throw new Error('The ZIP exceeds 50 MiB. Select fewer results or download individual files.')
  if (retainedBytes + size * 3 + browserLimits.archiveScratchBytes > browserLimits.workingBytes) {
    throw new Error('This ZIP exceeds the combined working-memory budget. Select fewer results or download individual files.')
  }
  return size
}

export function assertByteCount(bytes: number): void {
  if (!Number.isSafeInteger(bytes) || bytes < 0) throw new Error('Invalid byte count in the browser resource reservation.')
}

export function imageWorkingBytes(header: ImageHeader, settings: OperationSettings, sourceBytes: number): number {
  const output = planResize(header.metadata, settings.resize)
  return sourceBytes * 2 + (header.metadata.width * header.metadata.height + output.width * output.height) * 12 + browserLimits.codecScratchBytes
}
