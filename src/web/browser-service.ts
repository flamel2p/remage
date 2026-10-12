import {
  SubmitBatchRequestSchema, defaultSettings, type AppSnapshot, type Capability, type OperationSettings,
  type Preferences, type QueueItem, type RemageApi, type RemageEvent, type Result, type SubmitBatchRequest
} from '../shared/contracts'
import { browserPlatform } from '../shared/platform'
import { admitArchive, admitImage, assertDimensions, browserLimits, imageWorkingBytes } from './budgets'
import { Downloads } from './downloads'
import { inspectImage, type ImageHeader } from './inspect'
import { mimeFor, resultName, uniqueNames } from './names'
import { readPreferences, writePreferences } from './preferences'
import { protocolVersion, type ArchiveResponse, type ImageRequest, type ImageResponse, type WorkerPort } from './protocol'
import { validateStoreZip } from './zip'

type Source = { bytes: Uint8Array<ArrayBuffer>; header: ImageHeader; digest: string; thumbnailUrl: string | null; thumbnailBytes: number }
type Work = { sourceId: string; batchId: string; settings: OperationSettings; kind: 'transform' | 'preview' }
type ActiveWork = Work & { jobId: string; worker: WorkerPort; timer: ReturnType<typeof setTimeout> }
type Archive = { jobId: string; ids: string[]; names: string[]; excluded: number; size: number; validating?: boolean; worker?: WorkerPort; timer?: ReturnType<typeof setTimeout>; resolve: (snapshot: AppSnapshot) => void; reject: (error: Error) => void }
type ValidationLease = { jobId: string; bytes: number; cancelled: boolean }
export type BrowserDependencies = {
  createImageWorker?: () => WorkerPort
  createArchiveWorker?: () => WorkerPort
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null
  download?: (bytes: Uint8Array<ArrayBuffer>, mime: string, name: string) => void
  imageTimeoutMs?: number
  archiveTimeoutMs?: number
  previews?: boolean
  archiveValidationYield?: () => Promise<void>
}

export const browserCapabilities: Capability[] = ['png', 'jpeg', 'webp'].map((format) => ({
  format: format as Capability['format'], canInspect: true, canEncode: true, canStrictOptimize: false,
  detail: 'Static 8-bit sRGB transforms only. Strict optimization is unavailable: the evaluated decode/re-encode adapter does not prove source preservation. Optional metadata preservation, ICC/CMYK and nonstandard color declarations are unsupported.'
}))
const message = (error: unknown): string => error instanceof Error ? error.message : 'The operation failed. Retry or use a smaller selection.'
const now = (): string => new Date().toISOString()
const id = (): string => crypto.randomUUID()
function storageOrNull(): Storage | null { try { return window.localStorage } catch { return null } }

export class BrowserService implements RemageApi {
  readonly platform = browserPlatform
  private readonly dependencies: BrowserDependencies
  private readonly downloads = new Downloads()
  private readonly sources = new Map<string, Source>()
  private readonly resultData = new Map<string, Uint8Array<ArrayBuffer>>()
  private readonly listeners = new Set<(event: RemageEvent) => void>()
  private queue: QueueItem[] = []
  private results: Result[] = []
  private pending: Work[] = []
  private active: ActiveWork | null = null
  private batchId: string | null = null
  private activeMode: AppSnapshot['activeMode'] = 'converter'
  private archive: Archive | null = null
  private validationLease: ValidationLease | null = null
  private readyArchive: { bytes: Uint8Array<ArrayBuffer>; ids: string[]; excluded: number } | null = null
  private exportProgress: AppSnapshot['exportProgress']
  private intakeFeedback: AppSnapshot['intakeFeedback']
  private epoch = 0
  private disposed = false
  private suspended = false
  private updateLocked = false
  private intakeChain: Promise<void> = Promise.resolve()
  private pendingIntakes = 0
  private intakeReservation = 0
  private readonly pendingPickers = new Set<() => void>()
  private preferences: Preferences

  constructor(dependencies: BrowserDependencies = {}) {
    this.dependencies = { ...dependencies, storage: dependencies.storage === undefined ? storageOrNull() : dependencies.storage }
    this.preferences = readPreferences(this.dependencies.storage ?? null)
  }

  private snapshot(): AppSnapshot {
    return structuredClone({ queue: this.queue, results: this.results, capabilities: browserCapabilities, activeBatchId: this.batchId,
      activeMode: this.activeMode, progressLabel: this.active ? this.active.kind === 'transform' ? 'Processing one image on this device…' : 'Checking an image preview on this device…' : this.batchId ? 'Waiting to process queued images…' : null,
      ...(this.exportProgress ? { exportProgress: this.exportProgress } : {}), ...(this.intakeFeedback ? { intakeFeedback: this.intakeFeedback } : {}) })
  }
  private emit(): void { const event: RemageEvent = { type: 'snapshot', snapshot: this.snapshot() }; for (const listener of this.listeners) listener(event) }
  private ensureAlive(): void { if (this.disposed) throw new Error('This browser session has closed. Reload Remage to start again.') }
  private ensureUnlocked(): void { this.ensureAlive(); if (this.suspended) throw new Error('This page is suspended. Return to Remage before adding or processing images.'); if (this.updateLocked) throw new Error('The application update/version is being checked. Reconnect or close all Remage windows and reopen before adding or processing images.') }
  setUpdateLocked(locked: boolean): void { const previous = this.updateLocked; this.updateLocked = locked; if (previous && !locked) this.schedule() }
  hasSessionWork(): boolean { return Boolean(this.queue.length || this.sources.size || this.resultData.size || this.pending.length || this.active || this.archive || this.validationLease || this.readyArchive || this.pendingIntakes || this.pendingPickers.size) }
  private uniqueSources(): Source[] { return [...new Set(this.sources.values())] }
  private sourceBytes(): number { return this.uniqueSources().reduce((sum, source) => sum + source.bytes.length, 0) }
  private resultBytes(): number { return [...this.resultData.values()].reduce((sum, bytes) => sum + bytes.length, 0) }
  private retainedBytes(): number { return this.sourceBytes() + this.resultBytes() + this.uniqueSources().reduce((sum, source) => sum + source.thumbnailBytes, 0) + (this.readyArchive?.bytes.length ?? 0) + this.intakeReservation + this.downloads.retainedBytes + (this.validationLease?.bytes ?? 0) }
  private workingBytes(): number {
    const source = this.active ? this.sources.get(this.active.sourceId) : undefined
    return this.retainedBytes() + (source && this.active ? imageWorkingBytes(source.header, this.active.settings, source.bytes.length) : 0) + (this.archive?.worker && !this.archive.validating ? this.archive.size * 3 + browserLimits.archiveScratchBytes : 0)
  }
  getSessionStatus(): { busy: boolean; hasRetainedData: boolean } { return { busy: Boolean(this.active || this.batchId || this.archive || this.validationLease || this.pendingIntakes || this.pendingPickers.size), hasRetainedData: Boolean(this.sources.size || this.resultData.size || this.readyArchive) } }
  suspend(): void {
    if (this.disposed || this.suspended) return
    this.suspended = true; this.epoch++
    for (const cancel of this.pendingPickers) cancel()
    if (this.active?.kind === 'transform') { const row = this.queue.find((item) => item.id === this.active!.sourceId); if (row) row.status = 'cancelled' }
    for (const work of this.pending) if (work.kind === 'transform') { const row = this.queue.find((item) => item.id === work.sourceId); if (row) row.status = 'cancelled' }
    for (const row of this.queue) if (row.status === 'inspecting') { row.status = 'cancelled'; row.error = 'Selection was interrupted when this page was suspended. Select this file again.' }
    this.stopActive(); this.pending = []; this.batchId = null
    const archive = this.archive
    this.stopArchive()
    if (archive) { this.exportProgress = { status: 'error', label: 'ZIP preparation was cancelled when this page was suspended. Retained results remain available.', excluded: archive.excluded }; archive.reject(new Error(this.exportProgress.label)) }
    this.emit()
  }
  resume(): void { if (this.disposed || !this.suspended) return; this.suspended = false; this.emit(); this.schedule() }
  async getSnapshot(): Promise<AppSnapshot> { return this.snapshot() }
  async getPreferences(): Promise<Preferences> { return structuredClone(this.preferences) }
  async savePreferences(preferences: Preferences): Promise<void> { this.ensureAlive(); this.preferences = writePreferences(this.dependencies.storage ?? null, preferences) }
  onEvent(listener: (event: RemageEvent) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener) }

  async chooseFiles(): Promise<AppSnapshot> {
    this.ensureUnlocked()
    const generation = this.epoch
    const files = await new Promise<File[]>((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'; input.multiple = true; input.accept = '.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp'; input.hidden = true
      let settled = false
      const cancel = (): void => finish([])
      const finish = (files: File[]): void => { if (settled) return; settled = true; this.pendingPickers.delete(cancel); input.remove(); resolve(files) }
      input.addEventListener('change', () => finish(Array.from(input.files ?? [])), { once: true })
      input.addEventListener('cancel', () => finish([]), { once: true })
      this.pendingPickers.add(cancel); document.body.append(input)
      try { input.click() } catch { finish([]) }
    })
    if (this.disposed || generation !== this.epoch) return this.snapshot()
    return this.addDroppedFiles(files)
  }
  async chooseFolder(): Promise<AppSnapshot> { throw new Error('Folder intake is unavailable in browser v1. Select individual PNG, JPEG or WebP files.') }
  async chooseOutputDirectory(): Promise<null> { return null }
  async chooseExportDirectory(): Promise<null> { return null }
  async openOutputDirectory(): Promise<void> { throw new Error('Browsers choose download destinations. Remage cannot open a saved folder.') }
  async getAppMetadata(): Promise<{ version: string; license: string; notices: string[] }> {
    return { version: '1.0.0-dev', license: 'MIT License', notices: ['ImageMagick magick-wasm 0.0.44 uses an Apache-2.0 wrapper and a combined WASM containing LGPL and other licensed dependencies. Complete notices and corresponding-source/rebuild information accompany the project; public binary distribution requires the recorded licensing gate.', 'Atkinson Hyperlegible Next and Lilex are locally bundled under their upstream font licenses.'] }
  }

  async addDroppedFiles(files: File[]): Promise<AppSnapshot> {
    this.ensureUnlocked()
    const generation = this.epoch
    this.pendingIntakes++
    const intake = this.intakeChain.then(async () => {
      let excluded = Math.max(0, files.length - browserLimits.intakeFiles)
      for (const file of files.slice(0, browserLimits.intakeFiles)) {
        if (generation !== this.epoch || this.disposed) return
        this.ensureUnlocked()
        if (this.sources.size >= browserLimits.sourceCount && this.queue.filter((row) => row.status === 'error' && !this.sources.has(row.id)).length >= browserLimits.rejectedRows) { excluded++; continue }
        const sourceName = Array.from(file.name || 'image').slice(0, browserLimits.sourceNameCharacters).join('')
        const row: QueueItem = { id: id(), sourceName, sourceBytes: file.size, metadata: null, thumbnailDataUrl: null, status: 'inspecting', error: null, previousResultId: null, createdAt: now() }
        const retainRow = this.queue.filter((item) => item.status === 'error' && !this.sources.has(item.id)).length < browserLimits.rejectedRows
        if (retainRow) { this.queue.push(row); this.emit() }
        let reservation = 0
        try {
          if (this.sources.size >= browserLimits.sourceCount) throw new Error('The browser queue allows 10 sources. Remove a source before adding another.')
          if (!file.size || file.size > browserLimits.sourceFileBytes) throw new Error('Select a nonempty file no larger than 20 MiB.')
          if (this.sourceBytes() + file.size > browserLimits.sourceBytes) throw new Error('Selected source bytes exceed 50 MiB. Remove sources or choose a smaller batch.')
          if (this.workingBytes() + file.size * 2 > browserLimits.workingBytes) throw new Error('Intake exceeds the working-memory budget. Wait for active work or clear retained results, then select a smaller file.')
          reservation = file.size * 2; this.intakeReservation += reservation
          const bytes = new Uint8Array(await file.arrayBuffer())
          if (generation !== this.epoch || this.disposed || (retainRow && !this.queue.includes(row))) continue
          this.ensureUnlocked()
          if (bytes.length !== file.size) throw new Error('The selected file changed while it was being read. Select it again.')
          const header = inspectImage(bytes)
          assertDimensions(header.metadata.width, header.metadata.height)
          const digestBytes = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
          if (generation !== this.epoch || this.disposed || (retainRow && !this.queue.includes(row))) continue
          this.ensureUnlocked()
          const digest = Array.from(digestBytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
          if (this.uniqueSources().some((source) => source.digest === digest)) throw new Error('This exact image content is already in the queue. Requeue the original source to process it again.')
          this.sources.set(row.id, { bytes, header, digest, thumbnailUrl: null, thumbnailBytes: 0 })
          if (!retainRow) this.queue.push(row)
          row.metadata = header.metadata; row.status = 'ready'
          if (this.dependencies.previews !== false) this.pending.push({ sourceId: row.id, batchId: id(), kind: 'preview', settings: { ...structuredClone(defaultSettings), preserveMetadata: false } })
        } catch (error) {
          if (generation !== this.epoch || this.disposed || (retainRow && !this.queue.includes(row))) continue
          if (retainRow) { row.status = 'error'; row.error = message(error) } else excluded++
        } finally {
          this.intakeReservation -= reservation
        }
        this.emit(); this.schedule()
      }
      this.intakeFeedback = excluded ? { excluded, label: `${excluded} additional files were excluded. Intake checks at most 100 files per selection and retains at most 10 rejection details; use a smaller selection.` } : undefined
      this.emit(); this.schedule()
    })
    this.intakeChain = intake.catch(() => {})
    try { await intake } finally { this.pendingIntakes--; this.emit() }
    return this.snapshot()
  }

  async removeSource(sourceId: string): Promise<AppSnapshot> {
    this.ensureAlive()
    this.pending = this.pending.filter((work) => work.sourceId !== sourceId)
    if (this.active?.sourceId === sourceId) this.stopActive()
    const source = this.sources.get(sourceId)
    this.sources.delete(sourceId); this.queue = this.queue.filter((row) => row.id !== sourceId)
    if (source && ![...this.sources.values()].includes(source) && source.thumbnailUrl) URL.revokeObjectURL(source.thumbnailUrl)
    this.finishBatch(); this.schedule(); this.emit(); return this.snapshot()
  }
  async requeueSource(sourceId: string): Promise<AppSnapshot> {
    this.ensureUnlocked()
    const source = this.sources.get(sourceId), original = this.queue.find((row) => row.id === sourceId)
    if (!source || !original) throw new Error('The original source is no longer in this session. Select the file again.')
    if (['queued', 'processing', 'cancelling'].includes(original.status)) throw new Error('This source is already queued or processing. Wait for it to finish or cancel the batch.')
    const previousResult = [...this.results].reverse().find((result) => result.sourceId === sourceId)
    original.status = 'ready'; original.error = null; original.previousResultId = previousResult?.id ?? null; original.createdAt = now()
    this.emit(); return this.snapshot()
  }

  async submitBatch(rawRequest: SubmitBatchRequest): Promise<void> {
    this.ensureUnlocked()
    if (this.batchId) throw new Error('A batch is already active. Cancel it or wait for completion.')
    const request = SubmitBatchRequestSchema.parse(rawRequest)
    if (request.settings.outputDirectory !== null) throw new Error('Browser operations do not accept filesystem destinations.')
    const settings = structuredClone(request.settings), sourceIds = [...new Set(request.sourceIds)]
    if (this.results.length + sourceIds.length > browserLimits.retainedResults) throw new Error('The browser retains at most 100 results. Download and clear this session before processing more images.')
    const jobs: Work[] = [], failures: { row: QueueItem; error: string }[] = [], batchId = id()
    for (const sourceId of sourceIds) {
      const source = this.sources.get(sourceId), row = this.queue.find((item) => item.id === sourceId)
      if (!source || !row || !['ready', 'error', 'cancelled'].includes(row.status)) continue
      try {
        if (settings.mode === 'optimizer' && !settings.resize.enabled) throw new Error('Strict optimization is unavailable in this browser build. Choose Converter or enable resize.')
        if (source.header.hasRemovableMetadata && settings.preserveMetadata) throw new Error('Metadata preservation is unavailable for this source. Explicitly disable it for this transformation, or use the desktop edition.')
        if ((settings.mode === 'converter' ? settings.outputFormat : source.header.metadata.format) === 'jpeg' && !settings.jpegLossAcknowledged) throw new Error('Acknowledge JPEG re-encoding before continuing.')
        admitImage(source.header, settings, this.retainedBytes(), source.bytes.length)
        jobs.push({ sourceId, batchId, kind: 'transform', settings: structuredClone(settings) })
      } catch (error) { failures.push({ row, error: message(error) }) }
    }
    for (const failure of failures) { failure.row.status = 'error'; failure.row.error = failure.error }
    if (!jobs.length) { this.emit(); throw new Error(failures[0]?.error ?? 'Choose at least one available source.') }
    this.pending = this.pending.filter((job) => !sourceIds.includes(job.sourceId))
    this.pending.unshift(...jobs)
    this.batchId = batchId; this.activeMode = settings.mode
    jobs.forEach((job) => { const row = this.queue.find((item) => item.id === job.sourceId)!; row.status = 'queued'; row.error = null })
    this.emit(); this.schedule()
  }

  private schedule(): void {
    if (this.disposed || this.suspended || this.active || this.validationLease) return
    if (this.archive) { this.startArchive(); return }
    if (this.updateLocked && this.pending[0]?.kind === 'preview') return
    const work = this.pending.shift()
    if (!work) { this.finishBatch(); this.emit(); return }
    const source = this.sources.get(work.sourceId), row = this.queue.find((item) => item.id === work.sourceId)
    if (!source || !row) { this.schedule(); return }
    let worker: WorkerPort | undefined
    try {
      admitImage(source.header, work.settings, this.retainedBytes(), source.bytes.length)
      worker = this.dependencies.createImageWorker?.() ?? new Worker(new URL('./image.worker.ts', import.meta.url), { type: 'module' })
      const jobId = id()
      const timer = setTimeout(() => this.imageFailure(jobId, 'Processing exceeded 60 seconds. Retry a smaller image or use the desktop edition.'), this.dependencies.imageTimeoutMs ?? browserLimits.imageTimeoutMs)
      this.active = { ...work, jobId, worker, timer }
      worker.onmessage = (event) => this.imageMessage(jobId, event.data)
      worker.onerror = () => this.imageFailure(jobId, 'The image Worker stopped unexpectedly. Retry this source or use a smaller image.')
      worker.onmessageerror = () => this.imageFailure(jobId, 'The image Worker returned an unreadable response. Retry this source.')
      const transfer = source.bytes.slice().buffer
      const request: ImageRequest = { version: protocolVersion, type: 'image', jobId, batchId: work.batchId, sourceId: work.sourceId, kind: work.kind, settings: structuredClone(work.settings), bytes: transfer, retainedBytes: this.retainedBytes(), maxOutputBytes: browserLimits.resultBytes - this.resultBytes() }
      if (work.kind === 'transform') row.status = 'processing'
      worker.postMessage(request, [transfer]); this.emit()
    } catch (error) {
      worker?.terminate()
      if (this.active?.sourceId === work.sourceId) this.stopActive()
      if (work.kind === 'transform' || row.status === 'ready') { row.status = 'error'; row.error = message(error) }
      this.finishBatch(); this.emit(); this.schedule()
    }
  }

  private imageMessage(originJobId: string, raw: unknown): void {
    if (this.active?.jobId !== originJobId) return
    if (!raw || typeof raw !== 'object') { this.imageFailure(originJobId, 'The image Worker returned an invalid response. Retry this source.'); return }
    const response = raw as ImageResponse, active = this.active
    if (!active || response.version !== protocolVersion || response.jobId !== active.jobId || response.batchId !== active.batchId || response.sourceId !== active.sourceId) { this.imageFailure(originJobId, 'The image Worker response identity is invalid. Retry this source.'); return }
    if (response.type === 'error') { this.imageFailure(active.jobId, typeof response.message === 'string' ? response.message.slice(0, 1000) : 'The image Worker returned an invalid error. Retry this source.'); return }
    if (response.type !== 'complete') { this.imageFailure(active.jobId, 'Invalid Worker response. Retry this source.'); return }
    const row = this.queue.find((item) => item.id === active.sourceId)!, source = this.sources.get(active.sourceId)!
    try {
      if (!(response.bytes instanceof ArrayBuffer) || !(response.thumbnail instanceof ArrayBuffer)) throw new Error('Invalid Worker byte response.')
      if (response.bytes.byteLength > browserLimits.resultBytes || response.thumbnail.byteLength > 128 * 128 * 5 || !Number.isSafeInteger(response.width) || !Number.isSafeInteger(response.height)) throw new Error('The image Worker exceeded its response bounds.')
      const bytes = new Uint8Array(response.bytes), header = inspectImage(bytes)
      if (response.format !== header.metadata.format || response.width !== header.metadata.width || response.height !== header.metadata.height) throw new Error('The Worker output failed its response/header validation.')
      if (active.kind === 'preview') {
        if (header.metadata.format !== 'png' || header.metadata.width > 128 || header.metadata.height > 128 || bytes.length > 128 * 128 * 5) throw new Error('Invalid preview output.')
        this.setThumbnail(source, bytes)
      } else {
        const planned = admitImage(source.header, active.settings, this.retainedBytes(), source.bytes.length)
        const expectedFormat = active.settings.mode === 'converter' ? active.settings.outputFormat! : source.header.metadata.format
        if (header.metadata.format !== expectedFormat || header.metadata.width !== planned.width || header.metadata.height !== planned.height || response.format !== expectedFormat || response.width !== planned.width || response.height !== planned.height || header.hasRemovableMetadata || header.metadata.orientation || (expectedFormat === 'jpeg' && header.metadata.hasAlpha)) throw new Error('The Worker output failed format, dimension or metadata validation. No result was retained.')
        if (this.results.length >= browserLimits.retainedResults || this.resultBytes() + bytes.length > browserLimits.resultBytes) throw new Error('Completed results exceed the 100-result or 50 MiB limit. Download and clear retained results before retrying.')
        if (this.retainedBytes() + bytes.length + response.thumbnail.byteLength > browserLimits.workingBytes) throw new Error('Retaining this output exceeds the working-memory budget. Clear retained results before retrying.')
        if (response.thumbnail.byteLength) this.setThumbnail(source, new Uint8Array(response.thumbnail))
        const result: Result = { id: id(), sourceId: active.sourceId, sourceName: row.sourceName, sourceBytes: source.bytes.length, resultBytes: bytes.length,
          sourceFormat: source.header.metadata.format, resultFormat: expectedFormat, width: planned.width, height: planned.height,
          operation: active.settings.mode === 'converter' ? 'conversion' : 'resize', status: 'completed', exportStatus: 'not-exported', exportPath: null, settings: structuredClone(active.settings), createdAt: now() }
        this.resultData.set(result.id, bytes); this.results.push(result); row.status = 'completed'; row.error = null
      }
    } catch (error) { if (active.kind === 'transform' || row.status === 'ready') { row.status = 'error'; row.error = message(error) } }
    this.stopActive(); this.finishBatch(); this.emit(); this.schedule()
  }

  private setThumbnail(source: Source, bytes: Uint8Array<ArrayBuffer>): void {
    const header = inspectImage(bytes)
    if (header.metadata.format !== 'png' || header.metadata.width > 128 || header.metadata.height > 128 || bytes.length > 128 * 128 * 5) throw new Error('Invalid preview output.')
    if (source.thumbnailUrl) URL.revokeObjectURL(source.thumbnailUrl)
    source.thumbnailUrl = URL.createObjectURL(new Blob([bytes], { type: 'image/png' })); source.thumbnailBytes = bytes.length
    for (const [sourceId, entry] of this.sources) if (entry === source) { const row = this.queue.find((item) => item.id === sourceId); if (row) row.thumbnailDataUrl = source.thumbnailUrl }
  }
  private imageFailure(jobId: string, error: string): void {
    if (this.active?.jobId !== jobId) return
    const active = this.active, row = this.queue.find((item) => item.id === active.sourceId)
    if (row && (active.kind === 'transform' || row.status === 'ready')) { row.status = 'error'; row.error = error }
    this.stopActive(); this.finishBatch(); this.emit(); this.schedule()
  }
  private stopActive(): void { if (this.active) { clearTimeout(this.active.timer); this.active.worker.terminate(); this.active = null } }
  private finishBatch(): void { if (this.batchId && this.active?.batchId !== this.batchId && !this.pending.some((work) => work.batchId === this.batchId)) this.batchId = null }
  async cancelBatch(): Promise<void> {
    const batchId = this.batchId
    if (!batchId) return
    if (this.active?.batchId === batchId) { const row = this.queue.find((item) => item.id === this.active!.sourceId); if (row) row.status = 'cancelling'; this.emit(); this.stopActive(); if (row) row.status = 'cancelled' }
    for (const work of this.pending) if (work.batchId === batchId) { const row = this.queue.find((item) => item.id === work.sourceId); if (row) row.status = 'cancelled' }
    this.pending = this.pending.filter((work) => work.batchId !== batchId); this.batchId = null
    this.emit(); this.schedule()
  }

  async exportResult(resultId: string, _destination: string): Promise<AppSnapshot> {
    void _destination
    this.ensureAlive()
    const result = this.results.find((item) => item.id === resultId), bytes = this.resultData.get(resultId)
    if (!result || !bytes) throw new Error('This result is no longer available. Process the original source again.')
    const suggestedName = resultName(result.sourceName, result.resultFormat)
    result.exportStatus = 'exporting'; this.emit()
    try {
      this.requestDownload(bytes, mimeFor(result.resultFormat), suggestedName)
      result.exportStatus = 'download-requested'; result.exportReceipt = { kind: 'download-requested', suggestedName }; result.exportPath = null
    } catch (error) { result.exportStatus = 'error'; this.emit(); throw new Error(`Download could not be requested: ${message(error)}. Your result is still available.`) }
    this.emit(); return this.snapshot()
  }
  private requestDownload(bytes: Uint8Array<ArrayBuffer>, mime: string, name: string): void {
    if (this.workingBytes() + bytes.length * 2 > browserLimits.workingBytes) throw new Error('Preparing this download exceeds the combined working-memory budget. Wait for active work or clear retained data, then retry.')
    if (this.dependencies.download) this.dependencies.download(bytes, mime, name)
    else this.downloads.request(bytes, mime, name)
  }

  async exportAll(resultIds: string[], _destination: string): Promise<AppSnapshot> {
    void _destination
    this.ensureUnlocked()
    if (this.archive) throw new Error('An archive is already being prepared. Cancel it or wait.')
    const requested = [...new Set(resultIds)], eligible = requested.map((resultId) => this.results.find((result) => result.id === resultId)).filter((result): result is Result => Boolean(result && this.resultData.has(result.id) && ['completed', 'unchanged'].includes(result.status)))
    const excluded = requested.length - eligible.length, names = uniqueNames(eligible)
    const size = admitArchive(this.retainedBytes(), eligible.map((result, index) => ({ bytes: this.resultData.get(result.id)!.length, name: names[index] })))
    this.invalidateReadyArchive()
    this.exportProgress = { status: this.active || this.validationLease ? 'waiting' : 'preparing', label: this.active || this.validationLease ? 'Waiting for active work to release its resources before preparing ZIP…' : 'Preparing ZIP on this device…', excluded }
    const promise = new Promise<AppSnapshot>((resolve, reject) => { this.archive = { jobId: id(), ids: eligible.map((result) => result.id), names, excluded, size, resolve, reject } })
    this.emit(); this.schedule(); return promise
  }

  private startArchive(): void {
    const archive = this.archive
    if (!archive || archive.worker || this.active || this.validationLease) return
    try {
      this.ensureAlive()
      archive.size = admitArchive(this.retainedBytes(), archive.ids.map((resultId, index) => ({ bytes: this.resultData.get(resultId)!.length, name: archive.names[index] })))
      const worker = this.dependencies.createArchiveWorker?.() ?? new Worker(new URL('./zip.worker.ts', import.meta.url), { type: 'module' })
      archive.worker = worker
      archive.timer = setTimeout(() => this.archiveFailure(archive.jobId, 'ZIP preparation timed out. Select fewer results or download individually.'), this.dependencies.archiveTimeoutMs ?? browserLimits.archiveTimeoutMs)
      worker.onmessage = (event) => { void this.archiveMessage(archive.jobId, event.data) }
      worker.onerror = () => this.archiveFailure(archive.jobId, 'The ZIP Worker stopped. Retry a smaller selection.')
      worker.onmessageerror = () => this.archiveFailure(archive.jobId, 'The ZIP Worker returned an unreadable response. Retry preparation.')
      const entries = archive.ids.map((resultId, index) => ({ name: archive.names[index], bytes: this.resultData.get(resultId)!.slice().buffer }))
      this.exportProgress = { status: 'preparing', label: `Preparing ZIP: 0 of ${entries.length} results…`, excluded: archive.excluded }
      worker.postMessage({ version: protocolVersion, type: 'archive', jobId: archive.jobId, retainedBytes: this.retainedBytes(), entries }, entries.map((entry) => entry.bytes)); this.emit()
    } catch (error) { this.archiveFailure(archive.jobId, message(error)) }
  }
  private async archiveMessage(originJobId: string, raw: unknown): Promise<void> {
    if (this.archive?.jobId !== originJobId) return
    if (this.archive.validating) return
    if (!raw || typeof raw !== 'object') { this.archiveFailure(originJobId, 'The ZIP Worker returned an invalid response. Retry preparation.'); return }
    const response = raw as ArchiveResponse, archive = this.archive
    if (!archive || response.version !== protocolVersion || response.jobId !== archive.jobId) { this.archiveFailure(originJobId, 'The ZIP Worker response identity is invalid. Retry preparation.'); return }
    if (response.type === 'error') { this.archiveFailure(archive.jobId, typeof response.message === 'string' ? response.message.slice(0, 1000) : 'The ZIP Worker returned an invalid error. Retry preparation.'); return }
    if (response.type === 'progress') {
      if (!Number.isSafeInteger(response.completed) || response.completed < 0 || response.completed > archive.ids.length || response.total !== archive.ids.length) { this.archiveFailure(archive.jobId, 'The ZIP Worker returned invalid progress. Retry preparation.'); return }
      this.exportProgress = { status: 'preparing', label: `Preparing ZIP: ${response.completed} of ${archive.ids.length} results…`, excluded: archive.excluded }; this.emit(); return
    }
    if (response.type !== 'complete' || !(response.bytes instanceof ArrayBuffer) || response.bytes.byteLength !== archive.size) { this.archiveFailure(archive.jobId, 'The archive failed its byte-length validation. Retry preparation.'); return }
    archive.worker?.terminate()
    archive.validating = true
    const entries = archive.ids.map((resultId, index) => ({ name: archive.names[index], bytes: this.resultData.get(resultId)! }))
    const lease: ValidationLease = { jobId: archive.jobId, bytes: response.bytes.byteLength + entries.reduce((sum, entry) => sum + entry.bytes.length, 0) + browserLimits.archiveScratchBytes, cancelled: false }
    this.validationLease = lease
    try {
      await validateStoreZip(new Uint8Array(response.bytes), entries, this.dependencies.archiveValidationYield, () => lease.cancelled || this.archive !== archive || this.disposed)
      if (this.archive !== archive) return
    } catch (error) { if (this.archive === archive) this.archiveFailure(archive.jobId, message(error)); return }
    finally {
      if (this.validationLease === lease) this.validationLease = null
      queueMicrotask(() => this.schedule())
    }
    this.readyArchive = { bytes: new Uint8Array(response.bytes), ids: archive.ids, excluded: archive.excluded }
    for (const result of this.results) if (archive.ids.includes(result.id)) { result.exportStatus = 'archive-ready'; result.exportReceipt = { kind: 'archive-ready', entries: archive.ids.length, excluded: archive.excluded } }
    this.exportProgress = { status: 'ready', label: `ZIP ready: ${archive.ids.length} results. Download ZIP to request a save.`, excluded: archive.excluded }
    this.stopArchive(); this.emit(); archive.resolve(this.snapshot()); this.schedule()
  }
  private stopArchive(): void {
    if (this.archive) {
      if (this.validationLease?.jobId === this.archive.jobId) this.validationLease.cancelled = true
      clearTimeout(this.archive.timer); this.archive.worker?.terminate(); this.archive = null
    }
  }
  private invalidateReadyArchive(): void {
    if (this.readyArchive) for (const result of this.results) if (this.readyArchive.ids.includes(result.id) && result.exportStatus === 'archive-ready') { result.exportStatus = 'not-exported'; delete result.exportReceipt }
    this.readyArchive = null
  }
  private archiveFailure(jobId: string, error: string): void {
    const archive = this.archive
    if (archive?.jobId !== jobId) return
    this.stopArchive(); this.readyArchive = null; this.exportProgress = { status: 'error', label: error, excluded: archive.excluded }
    this.emit(); archive.reject(new Error(error)); this.schedule()
  }
  async cancelExport(): Promise<void> {
    const archive = this.archive
    if (archive) { this.stopArchive(); archive.reject(new Error('ZIP preparation cancelled. Retained results remain available.')) }
    this.invalidateReadyArchive(); this.exportProgress = undefined; this.emit(); this.schedule()
  }
  async downloadArchive(): Promise<AppSnapshot> {
    this.ensureAlive()
    const archive = this.readyArchive
    if (!archive) throw new Error('Prepare a ZIP before requesting its download.')
    try {
      this.requestDownload(archive.bytes, 'application/zip', 'remage-results.zip')
      for (const result of this.results) if (archive.ids.includes(result.id)) { result.exportStatus = 'download-requested'; result.exportReceipt = { kind: 'download-requested', suggestedName: 'remage-results.zip' } }
      this.exportProgress = { status: 'ready', label: 'ZIP download requested. The browser chooses where to save it.', excluded: archive.excluded }
    } catch (error) { this.exportProgress = { status: 'error', label: `ZIP download could not be requested: ${message(error)}. Retry without reprocessing.`, excluded: archive.excluded }; this.emit(); throw error }
    this.emit(); return this.snapshot()
  }

  async clearQueue(): Promise<AppSnapshot> {
    this.epoch++
    for (const cancel of this.pendingPickers) cancel()
    this.stopActive(); this.pending = []; this.batchId = null
    const archive = this.archive; this.stopArchive(); archive?.reject(new Error('The session was cleared. ZIP preparation was cancelled.'))
    for (const source of this.uniqueSources()) if (source.thumbnailUrl) URL.revokeObjectURL(source.thumbnailUrl)
    this.sources.clear(); this.resultData.clear(); this.readyArchive = null; this.queue = []; this.results = []; this.exportProgress = undefined; this.intakeFeedback = undefined
    this.downloads.dispose(); this.emit(); return this.snapshot()
  }
  dispose(): void { if (this.disposed) return; for (const cancel of this.pendingPickers) cancel(); void this.clearQueue(); this.disposed = true; this.listeners.clear() }
}
