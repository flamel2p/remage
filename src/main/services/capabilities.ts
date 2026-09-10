import { access, constants } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { app } from 'electron'
import type { Capability } from '../../shared/contracts'

export type CodecPaths = {
  jpegtran: string
  oxipng: string
}

export function codecPaths(): CodecPaths {
  const root = app.isPackaged ? join(process.resourcesPath, 'codecs', 'darwin') : join(process.cwd(), 'resources', 'codecs', 'darwin')
  return { jpegtran: join(root, 'bin', 'jpegtran'), oxipng: join(root, 'bin', 'oxipng') }
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.X_OK)
    return true
  } catch {
    return false
  }
}

const execFileAsync = promisify(execFile)

async function probe(path: string, versionFlag: string): Promise<boolean> {
  if (!(await exists(path))) return false
  try {
    await execFileAsync(path, [versionFlag], { timeout: 5_000, windowsHide: true })
    return true
  } catch {
    return false
  }
}

export async function detectCapabilities(): Promise<Capability[]> {
  const paths = codecPaths()
  const [jpegtranAvailable, oxipngAvailable] = await Promise.all([probe(paths.jpegtran, '-version'), probe(paths.oxipng, '--version')])

  return [
    {
      format: 'png',
      canInspect: true,
      canStrictOptimize: oxipngAvailable,
      canEncode: true,
      detail: oxipngAvailable ? null : 'The bundled OxiPNG adapter is unavailable.'
    },
    {
      format: 'jpeg',
      canInspect: true,
      canStrictOptimize: jpegtranAvailable,
      canEncode: true,
      detail: jpegtranAvailable ? null : 'The bundled JPEG optimizer is unavailable.'
    },
    {
      format: 'webp',
      canInspect: true,
      canStrictOptimize: false,
      canEncode: true,
      detail: 'WebP is available for conversion and resize, not strict optimization.'
    }
  ]
}
