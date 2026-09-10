import { mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { gatherFolderFiles, normalizeSourcePath } from './intake'

const directories: string[] = []

async function temporaryDirectory(): Promise<string> {
  const directory = await (await import('node:fs/promises')).mkdtemp(join(tmpdir(), 'remage-intake-'))
  directories.push(directory)
  return directory
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('intake', () => {
  it('skips hidden files and symlinks while preserving regular-file source bytes', async () => {
    const directory = await temporaryDirectory()
    const nested = join(directory, 'nested')
    const source = join(directory, 'source.png')
    await mkdir(nested)
    await writeFile(source, 'image-content')
    await writeFile(join(directory, '.hidden.png'), 'hidden')
    await writeFile(join(nested, 'second.jpg'), 'second')
    await symlink(source, join(directory, 'linked.png'))

    const files = await gatherFolderFiles(directory, 10)
    expect(files.map((file) => file.replace(directory, '')).sort()).toEqual(['/nested/second.jpg', '/source.png'])
    await expect(normalizeSourcePath(source)).resolves.toMatchObject({ name: 'source.png', bytes: 13 })
  })

  it('rejects directories as source files', async () => {
    const directory = await temporaryDirectory()
    await expect(normalizeSourcePath(directory)).rejects.toThrow('not a regular file')
  })
})
