import { copyFile, link, mkdir, rm, stat, unlink } from 'node:fs/promises'
import { basename, extname, join, relative, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { ImageFormat, Result } from '../../shared/contracts'

const extensions: Record<ImageFormat, string> = {
  jpeg: '.jpg',
  png: '.png',
  webp: '.webp'
}

export function safeOutputName(sourceName: string, result: Pick<Result, 'operation' | 'resultFormat'>): string {
  const extension = extensions[result.resultFormat]
  const base = basename(sourceName, extname(sourceName))
    .replace(/[\\/:*?"<>|\u0000-\u001F]/g, '-')
    .replace(/\.+$/g, '')
    .trim()
  const readableBase = base || 'image'
  const suffix =
    result.operation === 'strict-optimization'
      ? '-optimized'
      : result.operation === 'resize'
        ? '-resized'
        : '-converted'
  return `${readableBase}${suffix}${extension}`
}

function safeDestination(destination: string, fileName: string): string {
  const root = resolve(destination)
  const target = resolve(root, fileName)
  const pathFromRoot = relative(root, target)
  if (pathFromRoot.startsWith('..') || pathFromRoot.includes(`..${process.platform === 'win32' ? '\\' : '/'}`)) {
    throw new Error('The requested output name is outside the selected folder.')
  }
  return target
}

async function reserveName(destination: string, proposedName: string): Promise<string> {
  const extension = extname(proposedName)
  const base = basename(proposedName, extension)

  for (let index = 0; index < 10_000; index += 1) {
    const fileName = index === 0 ? proposedName : `${base}-${index + 1}${extension}`
    const target = safeDestination(destination, fileName)
    try {
      await stat(target)
    } catch {
      return target
    }
  }

  throw new Error('Could not create a unique output name.')
}

export class OutputPublisher {
  async publish({
    sourcePath,
    result,
    candidatePath,
    destination
  }: {
    sourcePath: string
    result: Pick<Result, 'operation' | 'resultFormat' | 'sourceName'>
    candidatePath: string | null
    destination: string
  }): Promise<string> {
    await mkdir(destination, { recursive: true })
    const inputPath = candidatePath ?? sourcePath
    const temporary = join(destination, `.${randomUUID()}.remage-tmp`)

    try {
      await copyFile(inputPath, temporary)
      for (let attempt = 0; attempt < 10_000; attempt += 1) {
        const target = await reserveName(destination, safeOutputName(result.sourceName, result))
        try {
          await link(temporary, target)
          await unlink(temporary)
          return target
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
        }
      }
      throw new Error('Could not reserve a unique output name.')
    } catch (error) {
      await rm(temporary, { force: true }).catch(() => undefined)
      throw error
    }
  }
}
