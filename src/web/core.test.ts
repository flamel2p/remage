import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings, type OperationSettings, type Preferences } from '../shared/contracts'
import { BrowserService } from './browser-service'
import { admitArchive, admitImage, assertDimensions, browserLimits, imageWorkingBytes } from './budgets'
import { inspectImage } from './inspect'
import { decoderInput } from './sanitize'
import { resultName, uniqueNames } from './names'
import { preferencesKey, readPreferences, writePreferences } from './preferences'
import { protocolVersion, type ArchiveRequest, type ImageRequest, type WorkerPort } from './protocol'
import { createStoreZip, validateStoreZip } from './zip'
import { crc32 } from './crc32'

const fixture = async (name: string): Promise<Uint8Array<ArrayBuffer>> => new Uint8Array(await readFile(resolve('test-fixtures/images', name)))
const clean = async (name = 'rgb.png'): Promise<Uint8Array<ArrayBuffer>> => { const bytes = await fixture(name); return decoderInput(bytes, inspectImage(bytes), true) }
const operation = (extra: Partial<OperationSettings> = {}): OperationSettings => ({ ...structuredClone(defaultSettings), mode: 'converter', outputFormat: 'png', ...extra })
const file = (bytes: Uint8Array<ArrayBuffer>, name: string): File => new File([bytes], name, { type: 'application/octet-stream' })
const services: BrowserService[] = []

class FakeWorker implements WorkerPort {
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null = null
  request!: ImageRequest | ArchiveRequest
  terminated = false
  postMessage(request: ImageRequest | ArchiveRequest, transfer: Transferable[]): void { this.request = structuredClone(request, { transfer }) }
  terminate(): void { this.terminated = true }
  send(data: unknown): void { this.onmessage?.({ data } as MessageEvent<unknown>) }
  complete(bytes: Uint8Array<ArrayBuffer>, extra: object = {}): void {
    const request = this.request as ImageRequest, header = inspectImage(bytes)
    this.send({ version: protocolVersion, jobId: request.jobId, batchId: request.batchId, sourceId: request.sourceId, type: 'complete', bytes: bytes.slice().buffer,
      thumbnail: new ArrayBuffer(0), width: header.metadata.width, height: header.metadata.height, format: header.metadata.format, ...extra })
  }
  fail(value: unknown): void {
    const request = this.request as ImageRequest
    this.send({ version: protocolVersion, jobId: request.jobId, batchId: request.batchId, sourceId: request.sourceId, type: 'error', message: value })
  }
  async archiveComplete(): Promise<void> {
    const request = this.request as ArchiveRequest
    const bytes = await createStoreZip(request.entries.map((entry) => ({ name: entry.name, bytes: new Uint8Array(entry.bytes) })), request.retainedBytes, undefined, async () => {})
    this.send({ version: protocolVersion, jobId: request.jobId, type: 'complete', bytes: bytes.buffer })
  }
}
function setup(extra: ConstructorParameters<typeof BrowserService>[0] = {}): { api: BrowserService; images: FakeWorker[]; archives: FakeWorker[]; downloads: { bytes: Uint8Array; mime: string; name: string }[] } {
  const images: FakeWorker[] = [], archives: FakeWorker[] = [], downloads: { bytes: Uint8Array; mime: string; name: string }[] = []
  const api = new BrowserService({ storage: null, previews: false, createImageWorker: () => { const worker = new FakeWorker(); images.push(worker); return worker }, createArchiveWorker: () => { const worker = new FakeWorker(); archives.push(worker); return worker }, download: (bytes, mime, name) => { downloads.push({ bytes: bytes.slice(), mime, name }) }, ...extra })
  services.push(api); return { api, images, archives, downloads }
}
afterEach(() => { services.splice(0).forEach((api) => api.dispose()); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('resource admission and safe names/preferences', () => {
  it('checks exact and one-over source/output pixel, dimension and combined byte boundaries', async () => {
    assertDimensions(8192, 1); expect(() => assertDimensions(8193, 1)).toThrow()
    assertDimensions(4000, 3000); expect(() => assertDimensions(4001, 3000)).toThrow()
    const bytes = await clean(), header = inspectImage(bytes), settings = operation()
    const exactRetained = browserLimits.workingBytes - imageWorkingBytes(header, settings, bytes.length)
    expect(admitImage(header, settings, exactRetained, bytes.length)).toMatchObject({ width: 64, height: 48 })
    expect(() => admitImage(header, settings, exactRetained + 1, bytes.length)).toThrow(/working-memory/)
    expect(() => admitImage(header, operation({ resize: { enabled: true, width: 8192, height: 8192, lockAspectRatio: false, allowEnlargement: true } }), 0, bytes.length)).toThrow(/dimensions/)
    for (const invalid of [NaN, Infinity, -1, 1.1]) expect(() => admitImage(header, settings, invalid, bytes.length)).toThrow(/byte count/)
    const overhead = 22 + 76 + 2, entry = { name: 'a', bytes: browserLimits.archiveBytes - overhead }
    expect(admitArchive(0, [entry])).toBe(browserLimits.archiveBytes)
    expect(() => admitArchive(0, [{ ...entry, bytes: entry.bytes + 1 }])).toThrow(/50 MiB/)
    expect(() => admitArchive(browserLimits.workingBytes - browserLimits.archiveBytes * 3 - browserLimits.archiveScratchBytes + 1, [entry])).toThrow(/combined/)
    expect(() => admitArchive(0, [])).toThrow(/Select/)
    expect(() => admitArchive(0, [{ name: 'a', bytes: NaN }])).toThrow(/byte count/)
  })
  it('uses safe format-correct Unicode names and deterministic case-insensitive collision suffixes', () => {
    expect(resultName('../../CON\u202e.jpg', 'webp')).toBe('_.._CON_.webp')
    expect(resultName('..', 'png')).toBe('image.png')
    expect(resultName('CON.jpg', 'jpeg')).toBe('_CON.jpg')
    expect(resultName('圖像-こんにちは.original.jpg', 'png')).toBe('圖像-こんにちは.original.png')
    const names = uniqueNames([{ sourceName: 'A.jpg', resultFormat: 'png' }, { sourceName: 'a.webp', resultFormat: 'png' }, { sourceName: 'A (2).png', resultFormat: 'png' }])
    expect(names).toEqual(['A.png', 'a (2).png', 'A (2) (2).png'])
    expect(new TextEncoder().encode(resultName('😃'.repeat(1000) + '.png', 'webp')).length).toBeLessThan(180)
  })
  it('persists only validated settings drafts and restores Converter/null/metadata-on defaults', () => {
    const store = new Map<string, string>(), storage = { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => { store.set(key, value) } }
    expect(readPreferences(storage).settings).toMatchObject({ mode: 'converter', outputFormat: null, preserveMetadata: true, resize: { enabled: false, lockAspectRatio: true, allowEnlargement: false } })
    writePreferences(storage, { appearance: 'dark', mode: 'converter', settings: { ...operation(), outputFormat: null, outputDirectory: '/private/secret', ...{ filename: 'secret.png', handle: 'x', credentials: 'x' } } })
    const saved = store.get(preferencesKey)!
    expect(saved).not.toMatch(/private|secret|filename|handle|credentials|outputDirectory/)
    expect(readPreferences(storage).settings.outputFormat).toBeNull()
    expect(readPreferences(storage).appearance).toBe('dark')
    expect(() => writePreferences(storage, { mode: 'converter', settings: operation(), appearance: 'invalid' as Preferences['appearance'] })).toThrow()
    store.set(preferencesKey, '{bad json'); expect(readPreferences(storage).mode).toBe('converter')
    expect(() => writePreferences(storage, { mode: 'converter', settings: operation({ jpegBackground: 'red' }) })).toThrow()
  })
})

describe('independent STORE archive validation', () => {
  it('matches selected Unicode names, exact bytes, CRC and directories; rejects same-length corrupt archives', async () => {
    const entries = [{ name: '圖像.png', bytes: await clean() }, { name: '圖像 (2).webp', bytes: await fixture('lossless.webp') }]
    const progress: number[] = [], zip = await createStoreZip(entries, 0, (completed) => progress.push(completed), async () => {})
    await validateStoreZip(zip, entries, async () => {})
    expect(progress).toEqual([1, 2])
    const view = new DataView(zip.buffer), firstNameLength = view.getUint16(26, true)
    expect(view.getUint16(8, true)).toBe(0); expect(view.getUint16(6, true)).toBe(0x800)
    expect(view.getUint32(14, true)).toBe(crc32(entries[0].bytes))
    expect(zip.subarray(30 + firstNameLength, 30 + firstNameLength + entries[0].bytes.length)).toEqual(entries[0].bytes)
    const corrupt = zip.slice(); corrupt[30 + firstNameLength + 10] ^= 1
    await expect(validateStoreZip(corrupt, entries, async () => {})).rejects.toThrow(/validation/)
    const badDirectory = zip.slice(); badDirectory[badDirectory.length - 6] ^= 1
    await expect(validateStoreZip(badDirectory, entries, async () => {})).rejects.toThrow(/validation/)
    await expect(createStoreZip([{ name: '../x', bytes: entries[0].bytes }], 0)).rejects.toThrow(/safe basenames/)
    await expect(createStoreZip([{ name: 'x', bytes: entries[0].bytes }, { name: 'x', bytes: entries[0].bytes }], 0)).rejects.toThrow(/distinct/)
  })
})

describe('browser session scheduling with transfer ownership', () => {
  it('cleans a pending picker and ignores late selection after session clear', async () => {
    const listeners = new Map<string, () => void>(), remove = vi.fn()
    const input = { type: '', multiple: false, accept: '', hidden: false, files: [] as File[], click: vi.fn(), remove,
      addEventListener: (type: string, callback: () => void) => { listeners.set(type, callback) } }
    vi.stubGlobal('document', { createElement: () => input, body: { append: vi.fn() } })
    const { api } = setup(), pending = api.chooseFiles()
    expect(api.hasSessionWork()).toBe(true)
    await api.clearQueue(); await pending
    input.files = [file(await clean(), 'late.png')]; listeners.get('change')?.()
    expect(remove).toHaveBeenCalledTimes(1); expect(api.hasSessionWork()).toBe(false); expect((await api.getSnapshot()).queue).toHaveLength(0)
  })
  it('rejects header dimension bombs before creating a decode Worker', async () => {
    const { api, images } = setup({ previews: true })
    const snapshot = await api.addDroppedFiles([file(await fixture('oversized.png'), 'large.png')])
    expect(snapshot.queue[0].status).toBe('error'); expect(snapshot.queue[0].error).toMatch(/dimensions/); expect(images).toHaveLength(0)
  })
  it('uses content identity instead of MIME/name/size; mixed errors preserve valid sources', async () => {
    const { api } = setup(), rgb = await clean(), gray = await clean('gray.png')
    await api.addDroppedFiles([file(rgb, 'wrong.exe'), file(await fixture('unsupported.gif'), 'pretend.png'), file(rgb, 'different-name.webp'), file(gray, 'wrong.exe')])
    const snapshot = await api.getSnapshot()
    expect(snapshot.queue.map((row) => row.status)).toEqual(['ready', 'error', 'error', 'ready'])
    expect(snapshot.queue[2].error).toMatch(/exact image content/)
    expect(snapshot.queue[0].metadata?.format).toBe('png')
    expect(JSON.stringify(snapshot)).not.toContain('ArrayBuffer')
  })
  it('accepts distinct encoded content with the same filename and byte length', async () => {
    const { api } = setup(), source = await fixture('rgb.png'), changed = source.slice(), view = new DataView(changed.buffer)
    let offset = 8
    while (offset < changed.length) {
      const length = view.getUint32(offset), type = new TextDecoder().decode(changed.subarray(offset + 4, offset + 8))
      if (type === 'pHYs') { changed[offset + 8] ^= 1; view.setUint32(offset + 8 + length, crc32(changed.subarray(offset + 4, offset + 8 + length))); break }
      offset += length + 12
    }
    expect(changed.length).toBe(source.length)
    const snapshot = await api.addDroppedFiles([file(source, 'same.png'), file(changed, 'same.png')])
    expect(snapshot.queue.map((row) => row.status)).toEqual(['ready', 'ready'])
  })
  it('bounds huge selections/error rows/source names without reading omitted files', async () => {
    const { api } = setup(), invalid = file(await fixture('unsupported.gif'), 'x'.repeat(10000)), read = vi.spyOn(invalid, 'arrayBuffer')
    const snapshot = await api.addDroppedFiles(Array.from({ length: 10000 }, () => invalid))
    expect(snapshot.queue).toHaveLength(browserLimits.rejectedRows)
    expect(snapshot.intakeFeedback?.excluded).toBe(9990)
    expect(read).toHaveBeenCalledTimes(100)
    expect(snapshot.queue[0].sourceName.length).toBe(255)
    await api.addDroppedFiles([file(await clean(), 'valid.png')])
    expect((await api.getSnapshot()).queue.filter((row) => row.status === 'ready')).toHaveLength(1)
  })
  it('captures settings, preserves originals through transfer, requeues originals, and ignores stale cancellation outputs', async () => {
    const { api, images, downloads } = setup(), rgb = await clean(), gray = await clean('gray.png')
    const intake = await api.addDroppedFiles([file(rgb, 'first.png'), file(gray, 'second.png')]), settings = operation()
    await api.submitBatch({ sourceIds: intake.queue.map((row) => row.id), settings })
    expect(images).toHaveLength(1); settings.jpegBackground = '#000000'; settings.resize.width = 1
    const request = images[0].request as ImageRequest
    expect(new Uint8Array(request.bytes)).toEqual(rgb)
    expect(request.settings.jpegBackground).toBe('#FFFFFF')
    images[0].complete(rgb)
    expect(images[0].terminated).toBe(true); expect(images).toHaveLength(2)
    await api.cancelBatch(); images[1].complete(gray)
    const snapshot = await api.getSnapshot()
    expect(snapshot.results).toHaveLength(1); expect(snapshot.queue[1].status).toBe('cancelled')
    expect(snapshot.results[0].settings.jpegBackground).toBe('#FFFFFF')
    await api.exportResult(snapshot.results[0].id, '')
    expect(downloads[0].bytes).toEqual(rgb)
    expect((await api.getSnapshot()).results[0]).toMatchObject({ exportStatus: 'download-requested', exportPath: null, exportReceipt: { kind: 'download-requested', suggestedName: 'first.png' } })
    const requeued = await api.requeueSource(intake.queue[0].id), row = requeued.queue[0]
    expect(row.previousResultId).toBe(snapshot.results[0].id)
    await api.submitBatch({ sourceIds: [row.id], settings: operation() })
    expect(new Uint8Array((images[2].request as ImageRequest).bytes)).toEqual(rgb)
  })
  it('handles mixed metadata/strict/admission failures without dropping completed work', async () => {
    const { api, images } = setup(), cleanBytes = await clean()
    const intake = await api.addDroppedFiles([file(await fixture('metadata.png'), 'metadata.png'), file(cleanBytes, 'clean.png')])
    await api.submitBatch({ sourceIds: intake.queue.map((row) => row.id), settings: operation() })
    expect((await api.getSnapshot()).queue[0].error).toMatch(/Metadata preservation/)
    images[0].complete(cleanBytes)
    const previous = (await api.getSnapshot()).results[0]
    await expect(api.submitBatch({ sourceIds: [intake.queue[0].id], settings: { ...defaultSettings } })).rejects.toThrow(/Strict/)
    await api.submitBatch({ sourceIds: [intake.queue[0].id], settings: operation({ preserveMetadata: false }) })
    images[1].send(null)
    expect((await api.getSnapshot()).results[0].id).toBe(previous.id)
    expect((await api.getSnapshot()).queue[0].status).toBe('error')
  })
  it('fails malformed current-job messages promptly, ignores old-worker malformed messages, resets after timeout/crash', async () => {
    const { api, images } = setup({ imageTimeoutMs: 5 }), bytes = await clean()
    const intake = await api.addDroppedFiles([file(bytes, 'source.png')]), sourceId = intake.queue[0].id
    await api.submitBatch({ sourceIds: [sourceId], settings: operation() }); images[0].fail({ unsafe: 'object' })
    expect((await api.getSnapshot()).queue[0].error).toMatch(/invalid error/)
    await api.submitBatch({ sourceIds: [sourceId], settings: operation() }); images[0].send(null)
    expect((await api.getSnapshot()).queue[0].status).toBe('processing')
    await new Promise((resolve) => setTimeout(resolve, 15))
    expect(images[1].terminated).toBe(true); expect((await api.getSnapshot()).queue[0].error).toMatch(/exceeded/)
    await api.submitBatch({ sourceIds: [sourceId], settings: operation() }); images[2].onerror?.({} as ErrorEvent)
    expect((await api.getSnapshot()).queue[0].error).toMatch(/stopped unexpectedly/)
    await api.submitBatch({ sourceIds: [sourceId], settings: operation() }); images[3].complete(bytes, { width: 500 })
    expect((await api.getSnapshot()).results).toHaveLength(0)
    expect((await api.getSnapshot()).queue[0].error).toMatch(/validation/)
  })
  it('invalidates async intake on clear without releasing its reservation until the read finishes', async () => {
    const { api } = setup(), bytes = await clean(), incoming = file(bytes, 'delayed.png')
    let resolveRead!: (bytes: ArrayBuffer) => void
    vi.spyOn(incoming, 'arrayBuffer').mockImplementation(() => new Promise((resolve) => { resolveRead = resolve }))
    const pending = api.addDroppedFiles([incoming]); await Promise.resolve(); await Promise.resolve()
    expect(api.hasSessionWork()).toBe(true)
    await api.clearQueue(); expect(api.getSessionStatus().busy).toBe(true)
    resolveRead(bytes.slice().buffer); await pending
    expect((await api.getSnapshot()).queue).toHaveLength(0); expect(api.hasSessionWork()).toBe(false)
  })
  it('blocks new work synchronously during update coordination and does not clear the session', async () => {
    const { api } = setup(), bytes = await clean(), intake = await api.addDroppedFiles([file(bytes, 'source.png')])
    api.setUpdateLocked(true)
    await expect(api.addDroppedFiles([file(bytes, 'other.png')])).rejects.toThrow(/update/)
    await expect(api.submitBatch({ sourceIds: [intake.queue[0].id], settings: operation() })).rejects.toThrow(/update/)
    await expect(api.requeueSource(intake.queue[0].id)).rejects.toThrow(/update/)
    await expect(api.exportAll([], '')).rejects.toThrow(/update/)
    expect((await api.getSnapshot()).queue).toHaveLength(1)
  })
  it('rejects an in-flight intake after a controller lock and releases its read reservation', async () => {
    const state = setup({ previews: true }), bytes = await clean(), incoming = file(bytes, 'pending.png')
    let resolveRead!: (bytes: ArrayBuffer) => void
    vi.spyOn(incoming, 'arrayBuffer').mockImplementation(() => new Promise((resolve) => { resolveRead = resolve }))
    const intake = state.api.addDroppedFiles([incoming]); await Promise.resolve(); await Promise.resolve()
    state.api.setUpdateLocked(true); expect(state.api.getSessionStatus().busy).toBe(true)
    resolveRead(bytes.slice().buffer); await intake
    expect((await state.api.getSnapshot()).queue[0]).toMatchObject({ status: 'error', metadata: null })
    expect(state.images).toHaveLength(0); expect(state.api.getSessionStatus().busy).toBe(false)
    state.api.setUpdateLocked(false); await state.api.addDroppedFiles([file(bytes, 'retry.png')])
    expect(state.images).toHaveLength(1)
  })
  it('defers pending previews while locked and resumes them only after compatibility is verified', async () => {
    const state = setup({ previews: true }), first = await clean(), second = await clean('gray.png')
    await state.api.addDroppedFiles([file(first, 'first.png'), file(second, 'second.png')]); expect(state.images).toHaveLength(1)
    state.api.setUpdateLocked(true); state.images[0].complete(first)
    expect(state.images).toHaveLength(1)
    state.api.setUpdateLocked(false); expect(state.images).toHaveLength(2)
  })
  it('allows an already submitted batch to finish across a controller compatibility check', async () => {
    const state = setup(), first = await clean(), second = await clean('gray.png')
    const intake = await state.api.addDroppedFiles([file(first, 'first.png'), file(second, 'second.png')])
    await state.api.submitBatch({ sourceIds: intake.queue.map(row => row.id), settings: operation() })
    state.api.setUpdateLocked(true); state.images[0].complete(first); expect(state.images).toHaveLength(2)
    state.images[1].complete(second); expect((await state.api.getSnapshot()).results).toHaveLength(2)
  })
  it('bounds result history even when tiny outputs remain below the encoded-byte ceiling', async () => {
    const { api, images } = setup(), bytes = await clean()
    for (let index = 0; index < browserLimits.retainedResults; index++) {
      const intake = await api.addDroppedFiles([file(bytes, 'same.png')]), row = intake.queue[0]
      await api.submitBatch({ sourceIds: [row.id], settings: operation() }); images[index].complete(bytes)
      await api.removeSource(row.id)
    }
    const intake = await api.addDroppedFiles([file(bytes, 'last.png')])
    await expect(api.submitBatch({ sourceIds: [intake.queue[0].id], settings: operation() })).rejects.toThrow(/100 results/)
    expect(images).toHaveLength(100); expect((await api.getSnapshot()).results).toHaveLength(100)
  })
  it('requeues original bytes at the full10-source limit without allocating an alias row', async () => {
    const state = setup(), source = await fixture('rgb.png'), output = await clean(), files: File[] = []
    let physicalOffset = 8
    while (new TextDecoder().decode(source.subarray(physicalOffset + 4, physicalOffset + 8)) !== 'pHYs') physicalOffset += new DataView(source.buffer).getUint32(physicalOffset) + 12
    for (let index = 0; index < 10; index++) {
      const bytes = source.slice(), view = new DataView(bytes.buffer), length = view.getUint32(physicalOffset)
      view.setUint32(physicalOffset + 8, index + 1); view.setUint32(physicalOffset + 8 + length, crc32(bytes.subarray(physicalOffset + 4, physicalOffset + 8 + length)))
      files.push(file(bytes, `source-${index}.png`))
    }
    const intake = await state.api.addDroppedFiles(files), settings = operation({ preserveMetadata: false })
    await state.api.submitBatch({ sourceIds: intake.queue.map((row) => row.id), settings })
    for (let index = 0; index < 10; index++) state.images[index].complete(output)
    const resultId = (await state.api.getSnapshot()).results[0].id, originalId = intake.queue[0].id
    const requeued = await state.api.requeueSource(originalId)
    expect(requeued.queue).toHaveLength(10); expect(requeued.queue[0]).toMatchObject({ id: originalId, status: 'ready', previousResultId: resultId })
    await state.api.submitBatch({ sourceIds: [originalId], settings })
    expect(new Uint8Array((state.images[10].request as ImageRequest).bytes)).toEqual(new Uint8Array(await files[0].arrayBuffer()))
  })
  it('releases workers and retained state over20 sessions including5 active cancellations', async () => {
    const { api, images } = setup(), bytes = await clean()
    for (let index = 0; index < 20; index++) {
      const intake = await api.addDroppedFiles([file(bytes, 'image.png')])
      await api.submitBatch({ sourceIds: [intake.queue[0].id], settings: operation() })
      if (index % 4 === 0) await api.cancelBatch()
      else images[index].complete(bytes)
      await api.clearQueue()
      images[index].send(null)
      expect(api.hasSessionWork()).toBe(false); expect((await api.getSnapshot()).results).toHaveLength(0)
    }
    expect(images.every((worker) => worker.terminated)).toBe(true)
  })
})

describe('BFCache suspension', () => {
  it('stops active and queued previews without scheduling replacements on resume', async () => {
    const state = setup({ previews: true }), first = await clean(), second = await clean('gray.png')
    await state.api.addDroppedFiles([file(first, 'one.png'), file(second, 'two.png')])
    expect(state.images).toHaveLength(1); expect(state.api.getSessionStatus().busy).toBe(true)
    state.api.suspend(); expect(state.images[0].terminated).toBe(true)
    await expect(state.api.addDroppedFiles([file(first, 'new.png')])).rejects.toThrow(/suspended/)
    state.images[0].complete(first); expect((await state.api.getSnapshot()).results).toHaveLength(0)
    state.api.resume(); expect(state.images).toHaveLength(1)
    expect((await state.api.getSnapshot()).queue.map((row) => row.status)).toEqual(['ready', 'ready'])
    expect(state.api.getSessionStatus()).toEqual({ busy: false, hasRetainedData: true })
  })
  it('preserves completed results and prepared ZIP while cancelling a new transform', async () => {
    const state = setup(), bytes = await clean(), intake = await state.api.addDroppedFiles([file(bytes, 'source.png')]), sourceId = intake.queue[0].id
    await state.api.submitBatch({ sourceIds: [sourceId], settings: operation() }); state.images[0].complete(bytes)
    const resultId = (await state.api.getSnapshot()).results[0].id, archive = state.api.exportAll([resultId], '')
    await state.archives[0].archiveComplete(); await archive
    await state.api.requeueSource(sourceId); await state.api.submitBatch({ sourceIds: [sourceId], settings: operation() })
    state.api.suspend(); state.images[1].complete(bytes)
    expect((await state.api.getSnapshot()).queue[0].status).toBe('cancelled')
    expect((await state.api.getSnapshot()).results).toHaveLength(1)
    state.api.resume(); await state.api.downloadArchive(); await state.api.exportResult(resultId, '')
    expect(state.downloads.map((item) => item.mime)).toEqual(['application/zip', 'image/png'])
    expect(state.images).toHaveLength(2)
  })
  it('invalidates a pending read and remains busy until its reservation exits', async () => {
    const state = setup(), bytes = await clean(), incoming = file(bytes, 'slow.png')
    let finish!: (value: ArrayBuffer) => void
    vi.spyOn(incoming, 'arrayBuffer').mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    const pending = state.api.addDroppedFiles([incoming]); await Promise.resolve(); await Promise.resolve()
    state.api.suspend(); state.api.resume(); expect(state.api.getSessionStatus().busy).toBe(true)
    finish(bytes.slice().buffer); await pending
    expect(state.api.getSessionStatus()).toEqual({ busy: false, hasRetainedData: false })
    expect((await state.api.getSnapshot()).queue[0].status).toBe('cancelled'); expect(state.images).toHaveLength(0)
  })
})

describe('archive coordination and download retries', () => {
  async function completedPlusBatch(): Promise<ReturnType<typeof setup> & { bytes: Uint8Array<ArrayBuffer>; resultId: string }> {
    const state = setup(), bytes = await clean(), gray = await clean('gray.png')
    const intake = await state.api.addDroppedFiles([file(bytes, 'same.jpg'), file(gray, 'same.webp')])
    await state.api.submitBatch({ sourceIds: intake.queue.map((row) => row.id), settings: operation() })
    state.images[0].complete(bytes)
    return { ...state, bytes, resultId: (await state.api.getSnapshot()).results[0].id }
  }
  it('waits for active image, pauses subsequent scheduling, validates selected ZIP, and downloads only on separate explicit action', async () => {
    const state = await completedPlusBatch()
    const promise = state.api.exportAll([state.resultId, crypto.randomUUID()], '')
    expect((await state.api.getSnapshot()).exportProgress?.status).toBe('waiting'); expect(state.archives).toHaveLength(0)
    state.images[1].complete(state.bytes)
    expect(state.images.every((worker) => worker.terminated)).toBe(true); expect(state.archives).toHaveLength(1)
    await state.archives[0].archiveComplete(); await promise
    expect(state.downloads).toHaveLength(0)
    expect((await state.api.getSnapshot()).exportProgress).toMatchObject({ status: 'ready', excluded: 1 })
    await state.api.downloadArchive(); expect(state.downloads[0].mime).toBe('application/zip')
    await expect(state.api.exportAll([], '')).rejects.toThrow(/Select/)
    await state.api.downloadArchive(); expect(state.downloads).toHaveLength(2)
    await state.api.cancelExport()
    expect((await state.api.getSnapshot()).results[0].exportStatus).toBe('download-requested')
    await expect(state.api.downloadArchive()).rejects.toThrow(/Prepare/)
  })
  it('pauses a queued third image while ZIP owns resources, then resumes without reprocessing completed sources', async () => {
    const state = setup(), bytes = await clean()
    const intake = await state.api.addDroppedFiles([file(bytes, 'one.png'), file(await clean('gray.png'), 'two.png'), file(await clean('rgba-hidden-rgb.png'), 'three.png')])
    await state.api.submitBatch({ sourceIds: intake.queue.map((row) => row.id), settings: operation() })
    state.images[0].complete(bytes)
    const resultId = (await state.api.getSnapshot()).results[0].id, archive = state.api.exportAll([resultId], '')
    state.images[1].complete(bytes)
    expect(state.images).toHaveLength(2); expect((await state.api.getSnapshot()).queue[2].status).toBe('queued')
    await state.archives[0].archiveComplete(); await archive
    expect(state.images).toHaveLength(3); expect((await state.api.getSnapshot()).queue[2].status).toBe('processing')
    expect((await state.api.getSnapshot()).results).toHaveLength(2)
  })
  it('writes deterministic collision suffixes for actual selected result entries', async () => {
    const state = await completedPlusBatch(); state.images[1].complete(state.bytes)
    const ids = (await state.api.getSnapshot()).results.map((result) => result.id), archive = state.api.exportAll(ids, '')
    const request = state.archives[0].request as ArchiveRequest
    expect(request.entries.map((entry) => entry.name)).toEqual(['same.png', 'same (2).png'])
    expect(new Uint8Array(request.entries[0].bytes)).toEqual(state.bytes)
    await state.archives[0].archiveComplete(); await archive
  })
  it('cancels waiting/preparing ZIP, resumes image scheduling, retains results and invalidates old readiness correctly', async () => {
    const state = await completedPlusBatch(), pending = state.api.exportAll([state.resultId], '')
    const rejection = expect(pending).rejects.toThrow(/cancelled/)
    await state.api.cancelExport(); await rejection
    expect((await state.api.getSnapshot()).queue[1].status).toBe('processing')
    state.images[1].complete(state.bytes)
    const retry = state.api.exportAll([state.resultId], ''); await state.archives[0].archiveComplete(); await retry
    expect((await state.api.getSnapshot()).results[0].exportStatus).toBe('archive-ready')
    await state.api.cancelExport(); expect((await state.api.getSnapshot()).results[0].exportStatus).toBe('not-exported')
    const next = state.api.exportAll([state.resultId], ''), nextRejected = expect(next).rejects.toThrow(/cancelled/)
    await state.api.cancelExport(); await nextRejected
    expect(state.archives[1].terminated).toBe(true)
    expect((await state.api.getSnapshot()).results).toHaveLength(2)
  })
  it('rejects malformed progress, same-length corrupt archives, archive crash/timeout, then permits retry', async () => {
    const state = await completedPlusBatch(); await state.api.cancelBatch()
    const invalid = state.api.exportAll([state.resultId], ''), rejected = expect(invalid).rejects.toThrow(/invalid progress/)
    const request = state.archives[0].request as ArchiveRequest
    state.archives[0].send({ version: protocolVersion, jobId: request.jobId, type: 'progress', completed: NaN, total: 1 }); await rejected
    const corrupt = state.api.exportAll([state.resultId], ''), corruptRejected = expect(corrupt).rejects.toThrow(/validation/)
    const request2 = state.archives[1].request as ArchiveRequest
    const size = admitArchive(request2.retainedBytes, request2.entries.map((entry) => ({ name: entry.name, bytes: entry.bytes.byteLength })))
    state.archives[1].send({ version: protocolVersion, jobId: request2.jobId, type: 'complete', bytes: new ArrayBuffer(size) }); await corruptRejected
    const retry = state.api.exportAll([state.resultId], ''); await state.archives[2].archiveComplete(); await retry
    expect((await state.api.getSnapshot()).results).toHaveLength(1)
  })
  it('rejects ZIP crash/timeout and malformed current responses, ignores terminated worker responses', async () => {
    const state = setup({ archiveTimeoutMs: 5 }), bytes = await clean()
    const intake = await state.api.addDroppedFiles([file(bytes, 'image.png')])
    await state.api.submitBatch({ sourceIds: [intake.queue[0].id], settings: operation() }); state.images[0].complete(bytes)
    const resultId = (await state.api.getSnapshot()).results[0].id
    const crash = state.api.exportAll([resultId], ''), crashed = expect(crash).rejects.toThrow(/stopped/)
    state.archives[0].onerror?.({} as ErrorEvent); await crashed
    const timeout = state.api.exportAll([resultId], ''), timedOut = expect(timeout).rejects.toThrow(/timed out/)
    state.archives[0].send(null); await timedOut
    expect(state.archives[1].terminated).toBe(true)
    const malformed = state.api.exportAll([resultId], ''), invalid = expect(malformed).rejects.toThrow(/invalid response/)
    state.archives[2].send(null); await invalid
    const retry = state.api.exportAll([resultId], ''); await state.archives[3].archiveComplete(); await retry
    expect((await state.api.getSnapshot()).results).toHaveLength(1)
  })
  it.each(['cancel', 'clear', 'timeout', 'suspend'] as const)('holds the validation lease after %s, ignores duplicate completion, and resumes only after validation exits', async (action) => {
    let releaseValidation!: () => void
    const paused = new Promise<void>((resolve) => { releaseValidation = resolve })
    const yieldValidation = vi.fn(() => paused)
    const state = setup({ archiveValidationYield: yieldValidation, archiveTimeoutMs: action === 'timeout' ? 5 : 1000 }), bytes = await clean()
    const intake = await state.api.addDroppedFiles([file(bytes, 'source.png')]), sourceId = intake.queue[0].id
    await state.api.submitBatch({ sourceIds: [sourceId], settings: operation() }); state.images[0].complete(bytes)
    const resultId = (await state.api.getSnapshot()).results[0].id
    const pending = state.api.exportAll([resultId], ''), rejected = expect(pending).rejects.toThrow(action === 'timeout' ? /timed out/ : /cancelled/)
    await state.archives[0].archiveComplete()
    expect(yieldValidation).toHaveBeenCalledTimes(1); expect(state.archives[0].terminated).toBe(true)
    await state.archives[0].archiveComplete()
    expect(yieldValidation).toHaveBeenCalledTimes(1)
    if (action === 'clear') await state.api.clearQueue()
    else if (action === 'cancel') await state.api.cancelExport()
    else if (action === 'suspend') { state.api.suspend(); state.api.resume() }
    await rejected
    expect(state.api.getSessionStatus().busy).toBe(true)
    expect(state.api.hasSessionWork()).toBe(true)
    await expect(state.api.downloadArchive()).rejects.toThrow(/Prepare/)
    const nextSource = action === 'clear'
      ? (await state.api.addDroppedFiles([file(bytes, 'new-session.png')])).queue[0].id
      : (await state.api.requeueSource(sourceId)).queue[0].id
    await state.api.submitBatch({ sourceIds: [nextSource], settings: operation() })
    expect(state.images).toHaveLength(1); expect((await state.api.getSnapshot()).queue[0].status).toBe('queued')
    releaseValidation()
    await vi.waitFor(() => expect(state.images).toHaveLength(2))
    expect((await state.api.getSnapshot()).exportProgress?.status).not.toBe('ready')
    await expect(state.api.downloadArchive()).rejects.toThrow(/Prepare/)
    state.images[1].complete(bytes)
    expect(state.api.getSessionStatus().busy).toBe(false)
    expect((await state.api.getSnapshot()).results).toHaveLength(action === 'clear' ? 1 : 2)
  })
  it('keeps validated results and prepared archives after download initiation fails', async () => {
    const state = setup({ download: () => { throw new Error('blocked by browser') } }), bytes = await clean()
    const intake = await state.api.addDroppedFiles([file(bytes, 'source.png')])
    await state.api.submitBatch({ sourceIds: [intake.queue[0].id], settings: operation() }); state.images[0].complete(bytes)
    const resultId = (await state.api.getSnapshot()).results[0].id
    await expect(state.api.exportResult(resultId, '')).rejects.toThrow(/still available/)
    const archive = state.api.exportAll([resultId], ''); await state.archives[0].archiveComplete(); await archive
    await expect(state.api.downloadArchive()).rejects.toThrow(/blocked/)
    await expect(state.api.downloadArchive()).rejects.toThrow(/blocked/)
    expect((await state.api.getSnapshot()).results).toHaveLength(1)
  })
})
