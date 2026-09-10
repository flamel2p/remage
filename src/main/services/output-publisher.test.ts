import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { OutputPublisher, safeOutputName } from './output-publisher'

const directories: string[] = []

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'remage-publisher-'))
  directories.push(directory)
  return directory
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map(async (directory) => (await import('node:fs/promises')).rm(directory, { recursive: true, force: true })))
})

describe('OutputPublisher', () => {
  it('derives safe names and avoids overwriting collisions', async () => {
    expect(safeOutputName('unsafe:name?.jpeg', { operation: 'strict-optimization', resultFormat: 'jpeg' })).toBe('unsafe-name--optimized.jpg')
    const directory = await temporaryDirectory()
    const source = join(directory, 'source.png')
    const destination = join(directory, 'destination')
    await writeFile(source, 'source-bytes')
    const publisher = new OutputPublisher()
    const result = { operation: 'strict-optimization' as const, resultFormat: 'png' as const, sourceName: 'photo.png' }
    const first = await publisher.publish({ sourcePath: source, candidatePath: null, result, destination })
    const second = await publisher.publish({ sourcePath: source, candidatePath: null, result, destination })
    expect(first).not.toBe(second)
    await expect(readFile(first, 'utf8')).resolves.toBe('source-bytes')
    await expect(readFile(second, 'utf8')).resolves.toBe('source-bytes')
  })
})
