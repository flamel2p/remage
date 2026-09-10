import { open, lstat, readdir, realpath, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { basename, join } from 'node:path'

export const INTAKE_LIMITS = {
  maxItems: 200,
  maxSourceBytes: 100 * 1024 * 1024,
  maxQueueSourceBytes: 512 * 1024 * 1024,
  maxPixels: 40_000_000,
  maxDimension: 16_384
} as const

export async function gatherFolderFiles(folderPath: string, remainingCount: number): Promise<string[]> {
  const files: string[] = []

  async function visit(currentPath: string): Promise<void> {
    if (files.length >= remainingCount) return
    for (const entry of await readdir(currentPath, { withFileTypes: true })) {
      if (files.length >= remainingCount) return
      if (entry.name.startsWith('.')) continue
      const entryPath = join(currentPath, entry.name)
      const details = await lstat(entryPath)
      if (details.isSymbolicLink()) continue
      if (details.isDirectory()) {
        await visit(entryPath)
      } else if (details.isFile()) {
        files.push(entryPath)
      }
    }
  }

  await visit(folderPath)
  return files
}

export async function normalizeSourcePath(filePath: string): Promise<{ path: string; name: string; bytes: number }> {
  const resolvedPath = await realpath(filePath)
  const details = await stat(resolvedPath)
  if (!details.isFile()) throw new Error('The selected item is not a regular file.')
  if (details.size > INTAKE_LIMITS.maxSourceBytes) {
    throw new Error(`This file exceeds the ${INTAKE_LIMITS.maxSourceBytes / 1024 / 1024} MiB source limit.`)
  }
  return { path: resolvedPath, name: basename(resolvedPath), bytes: details.size }
}

export async function fingerprintSource(filePath: string): Promise<string> {
  const handle = await open(filePath, 'r')
  const digest = createHash('sha256')
  const buffer = Buffer.alloc(1024 * 1024)
  try {
    let position = 0
    while (true) {
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, position)
      if (bytesRead === 0) break
      digest.update(buffer.subarray(0, bytesRead))
      position += bytesRead
    }
    return digest.digest('hex')
  } finally {
    await handle.close()
  }
}
