import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings } from '../../shared/contracts'

const applicationDirectory = join(tmpdir(), `remage-service-test-${process.pid}`)
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: (name: string) => (name === 'userData' ? applicationDirectory : applicationDirectory)
  }
}))

import { RemageService } from './remage-service'

const directories: string[] = []

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'remage-service-source-'))
  directories.push(directory)
  return directory
}

async function waitForIdle(service: RemageService): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (service.snapshot().activeBatchId === null) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error('The batch did not settle.')
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
  await rm(applicationDirectory, { recursive: true, force: true })
})

describe('RemageService', () => {
  it('keeps source paths opaque, deduplicates intake, processes a strict batch, and exports through a selected destination token', async () => {
    const directory = await temporaryDirectory()
    const source = join(directory, 'source.png')
    const destination = join(directory, 'output')
    await sharp({ create: { width: 48, height: 32, channels: 4, background: { r: 10, g: 20, b: 30, alpha: 0.5 } } }).png().toFile(source)
    await (await import('node:fs/promises')).mkdir(destination)

    const service = new RemageService()
    await service.initialize()
    await service.addPaths([source, source])
    expect(service.snapshot().queue).toHaveLength(1)
    expect(JSON.stringify(service.snapshot())).not.toContain(source)

    const sourceId = service.snapshot().queue[0].id
    await service.submit({ sourceIds: [sourceId], settings: defaultSettings })
    await waitForIdle(service)
    const result = service.snapshot().results[0]
    expect(result.status).toMatch(/completed|unchanged/)

    const destinationId = await service.selectDestination(destination)
    await writeFile(source, 'a changed source must not be exported')
    await service.exportResult(result.id, destinationId)
    expect(service.snapshot().results[0].exportStatus).toBe('exported')
    expect(JSON.stringify(service.snapshot())).not.toContain(destination)
    const [exported] = await readdir(destination)
    expect((await (await import('node:fs/promises')).readFile(join(destination, exported))).subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    await service.dispose()
  })

  it('does not persist a selected output destination', async () => {
    const service = new RemageService()
    await service.initialize()
    await service.savePreferences({ mode: 'optimizer', settings: { ...defaultSettings, outputDirectory: 'opaque-session-destination' } })
    expect((await service.getPreferences()).settings.outputDirectory).toBeNull()
  })

  it('turns corrupt inspection into one actionable error row', async () => {
    const directory = await temporaryDirectory()
    const corrupt = join(directory, 'corrupt.png')
    await writeFile(corrupt, 'not an image')
    const service = new RemageService()
    await service.initialize()
    await service.addPaths([corrupt])
    expect(service.snapshot().queue).toHaveLength(1)
    expect(service.snapshot().queue[0]).toMatchObject({ status: 'error' })
  })
})
