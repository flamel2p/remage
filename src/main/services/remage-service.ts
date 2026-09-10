import { randomUUID } from 'node:crypto'
import { copyFile, mkdir, realpath, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { app } from 'electron'
import {
  AppSnapshotSchema,
  OperationSettingsSchema,
  PreferencesSchema,
  SubmitBatchRequestSchema,
  type AppSnapshot,
  type Capability,
  type OperationSettings,
  type Preferences,
  type QueueItem,
  type RemageEvent,
  type Result,
  type SubmitBatchRequest
} from '../../shared/contracts'
import { detectCapabilities } from './capabilities'
import { ImageEngine, CancelledError } from './image-engine'
import { fingerprintSource, gatherFolderFiles, INTAKE_LIMITS, normalizeSourcePath } from './intake'
import { OutputPublisher } from './output-publisher'
import { PreferencesStore } from './preferences-store'

type SourceRecord = { id: string; path: string; queueId: string; fingerprint: string }
type ResultRecord = Result & { candidatePath: string | null; sourcePath: string }
type ActiveBatch = { id: string; controller: AbortController; tempDirectory: string; sourceIds: string[] }

export class RemageService {
  private readonly engine = new ImageEngine()
  private readonly publisher = new OutputPublisher()
  private readonly sourceRecords = new Map<string, SourceRecord>()
  private readonly destinationRecords = new Map<string, string>()
  private readonly results = new Map<string, ResultRecord>()
  private readonly subscribers = new Set<(event: RemageEvent) => void>()
  private readonly preferences = new PreferencesStore(join(app.getPath('userData'), 'preferences.json'))
  private capabilities: Capability[] = []
  private queue: QueueItem[] = []
  private activeBatch: ActiveBatch | null = null
  private preferenceState: Preferences = PreferencesSchema.parse({})

  async initialize(): Promise<void> {
    this.capabilities = await detectCapabilities()
    const stored = await this.preferences.read()
    this.preferenceState = { ...stored, settings: { ...stored.settings, outputDirectory: null } }
    if (stored.settings.outputDirectory !== null) await this.preferences.write(this.preferenceState)
  }

  snapshot(): AppSnapshot {
    const batchItems = this.activeBatch ? this.activeBatch.sourceIds.map((sourceId) => this.findQueueItem(sourceId)).filter((item): item is QueueItem => Boolean(item)) : []
    const settled = batchItems.filter((item) => ['completed', 'unchanged', 'error', 'cancelled'].includes(item.status)).length
    return AppSnapshotSchema.parse({
      queue: this.queue,
      results: [...this.results.values()].map((result) => ({
        id: result.id,
        sourceId: result.sourceId,
        sourceName: result.sourceName,
        sourceBytes: result.sourceBytes,
        resultBytes: result.resultBytes,
        sourceFormat: result.sourceFormat,
        resultFormat: result.resultFormat,
        width: result.width,
        height: result.height,
        operation: result.operation,
        status: result.status,
        exportStatus: result.exportStatus,
        exportPath: null,
        settings: { ...result.settings, outputDirectory: null },
        createdAt: result.createdAt
      })),
      capabilities: this.capabilities,
      activeBatchId: this.activeBatch?.id ?? null,
      activeMode: this.preferenceState.mode,
      progressLabel: this.activeBatch ? `${settled} of ${batchItems.length} tasks settled` : null
    })
  }

  subscribe(listener: (event: RemageEvent) => void): () => void {
    this.subscribers.add(listener)
    return () => this.subscribers.delete(listener)
  }

  private emit(): void {
    const event: RemageEvent = { type: 'snapshot', snapshot: this.snapshot() }
    for (const subscriber of this.subscribers) subscriber(event)
  }

  async getPreferences(): Promise<Preferences> {
    return this.preferenceState
  }

  async savePreferences(preferences: Preferences): Promise<void> {
    const parsed = PreferencesSchema.parse(preferences)
    this.preferenceState = { ...parsed, settings: { ...parsed.settings, outputDirectory: null } }
    await this.preferences.write(this.preferenceState)
    this.emit()
  }

  async addPaths(paths: string[], allowExisting = false): Promise<AppSnapshot> {
    const pendingPaths = new Set([...this.sourceRecords.values()].map((record) => record.path))
    let queuedBytes = this.queue.reduce((total, item) => total + item.sourceBytes, 0)

    for (const path of paths) {
      let inspectionId: string | null = null
      if (this.queue.length >= INTAKE_LIMITS.maxItems) {
        this.queue.push(this.errorItem(path, `The ${INTAKE_LIMITS.maxItems}-item queue limit was reached.`))
        continue
      }
      try {
        const source = await normalizeSourcePath(path)
        if (!allowExisting && pendingPaths.has(source.path)) continue
        if (queuedBytes + source.bytes > INTAKE_LIMITS.maxQueueSourceBytes) {
          this.queue.push(this.errorItem(source.name, 'This source exceeds the remaining queue-byte limit.'))
          continue
        }

        const itemId = randomUUID()
        inspectionId = itemId
        const queueItem: QueueItem = {
          id: itemId,
          sourceName: source.name,
          sourceBytes: source.bytes,
          metadata: null,
          thumbnailDataUrl: null,
          status: 'inspecting',
          error: null,
          previousResultId: null,
          createdAt: new Date().toISOString()
        }
        this.queue.push(queueItem)
        const fingerprint = await fingerprintSource(source.path)
        const metadata = await this.engine.inspect(source.path)
        const thumbnailDataUrl = await this.engine.createThumbnail(source.path)
        if ((await fingerprintSource(source.path)) !== fingerprint) throw new Error('The source file changed while it was being inspected. Add it again to continue.')
        this.replaceQueueItem(itemId, { ...queueItem, metadata, thumbnailDataUrl, status: 'ready' })
        this.sourceRecords.set(itemId, { id: itemId, path: source.path, queueId: itemId, fingerprint })
        pendingPaths.add(source.path)
        queuedBytes += source.bytes
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not inspect this file.'
        const inspecting = inspectionId ? this.findQueueItem(inspectionId) : undefined
        if (inspecting) this.replaceQueueItem(inspectionId!, { ...inspecting, status: 'error', error: message })
        else this.queue.push(this.errorItem(path, message))
      }
    }
    this.emit()
    return this.snapshot()
  }

  async addFolder(folderPath: string): Promise<AppSnapshot> {
    try {
      const paths = await gatherFolderFiles(folderPath, Math.max(0, INTAKE_LIMITS.maxItems - this.queue.length))
      return this.addPaths(paths)
    } catch (error) {
      this.queue.push(this.errorItem(folderPath, error instanceof Error ? error.message : 'Could not read this folder.'))
      this.emit()
      return this.snapshot()
    }
  }

  async selectDestination(folderPath: string): Promise<string> {
    const resolved = await realpath(folderPath)
    if (!(await stat(resolved)).isDirectory()) throw new Error('The selected output destination is not a folder.')
    const id = randomUUID()
    this.destinationRecords.set(id, resolved)
    return id
  }

  async removeSource(sourceId: string): Promise<AppSnapshot> {
    const item = this.findQueueItem(sourceId)
    if (item && ['queued', 'processing', 'cancelling'].includes(item.status)) throw new Error('Cancel the active batch before removing this item.')
    this.queue = this.queue.filter((entry) => entry.id !== sourceId)
    this.sourceRecords.delete(sourceId)
    this.emit()
    return this.snapshot()
  }

  async clearQueue(): Promise<AppSnapshot> {
    if (this.activeBatch) throw new Error('Cancel the active batch before clearing the queue.')
    this.queue = []
    this.sourceRecords.clear()
    this.emit()
    return this.snapshot()
  }

  async requeueSource(sourceId: string): Promise<AppSnapshot> {
    const source = this.sourceRecords.get(sourceId)
    if (!source) throw new Error('This source is no longer available in the current session.')
    const previousResult = [...this.results.values()].reverse().find((result) => result.sourceId === sourceId)
    const before = new Set(this.queue.map((item) => item.id))
    await this.addPaths([source.path], true)
    const newlyAdded = this.queue.find((item) => !before.has(item.id))
    if (newlyAdded && previousResult) this.replaceQueueItem(newlyAdded.id, { ...newlyAdded, previousResultId: previousResult.id })
    this.emit()
    return this.snapshot()
  }

  async submit(request: SubmitBatchRequest): Promise<void> {
    if (this.activeBatch) throw new Error('A batch is already processing.')
    const parsed = SubmitBatchRequestSchema.parse(request)
    const sourceItems = parsed.sourceIds.map((sourceId) => this.findQueueItem(sourceId)).filter((item): item is QueueItem => Boolean(item))
    if (sourceItems.length !== parsed.sourceIds.length || sourceItems.some((item) => item.status !== 'ready' || !item.metadata)) {
      throw new Error('Only ready, valid images can be submitted.')
    }
    const settings = OperationSettingsSchema.parse(parsed.settings)
    const jpegTransformation =
      (settings.mode === 'converter' && settings.outputFormat === 'jpeg') ||
      (settings.mode === 'optimizer' && settings.resize.enabled && sourceItems.some((item) => item.metadata?.format === 'jpeg'))
    if (jpegTransformation && !settings.jpegLossAcknowledged) throw new Error('Acknowledge JPEG re-encoding before continuing.')
    if (settings.mode === 'optimizer' && !settings.resize.enabled) {
      for (const item of sourceItems) {
        const capability = this.capabilities.find((entry) => entry.format === item.metadata!.format)
        if (!capability?.canStrictOptimize) throw new Error(`Strict ${item.metadata!.format.toUpperCase()} optimization is unavailable in this build.`)
      }
    }

    const batch: ActiveBatch = {
      id: randomUUID(),
      controller: new AbortController(),
      tempDirectory: join(app.getPath('temp'), 'remage', randomUUID()),
      sourceIds: sourceItems.map((item) => item.id)
    }
    await mkdir(batch.tempDirectory, { recursive: true })
    this.activeBatch = batch
    for (const item of sourceItems) this.replaceQueueItem(item.id, { ...item, status: 'queued', error: null })
    this.emit()
    void this.runBatch(batch, sourceItems.map((item) => item.id), settings)
  }

  async cancel(): Promise<void> {
    if (!this.activeBatch) return
    this.activeBatch.controller.abort()
    this.queue = this.queue.map((item) => {
      if (item.status === 'queued' || item.status === 'processing') return { ...item, status: 'cancelling' }
      return item
    })
    this.emit()
  }

  async exportResult(resultId: string, destination: string): Promise<AppSnapshot> {
    const result = this.results.get(resultId)
    if (!result) throw new Error('This result is no longer available.')
    this.results.set(resultId, { ...result, exportStatus: 'exporting' })
    this.emit()
    try {
      const exportPath = await this.publisher.publish({ sourcePath: result.sourcePath, candidatePath: result.candidatePath, result, destination: await this.resolveDestination(destination) })
      this.results.set(resultId, { ...result, exportStatus: 'exported', exportPath })
    } catch (error) {
      this.results.set(resultId, { ...result, exportStatus: 'error', exportPath: null })
      this.emit()
      throw error
    }
    this.emit()
    return this.snapshot()
  }

  async exportAll(resultIds: string[], destination: string): Promise<AppSnapshot> {
    for (const resultId of resultIds) await this.exportResult(resultId, destination)
    return this.snapshot()
  }

  async dispose(): Promise<void> {
    this.activeBatch?.controller.abort()
    const candidates = [...this.results.values()].map((result) => result.candidatePath).filter((path): path is string => Boolean(path))
    await Promise.all(candidates.map((path) => rm(path, { force: true })))
  }

  private async runBatch(batch: ActiveBatch, sourceIds: string[], settings: OperationSettings): Promise<void> {
    const concurrency = 2
    let nextIndex = 0
    const worker = async (): Promise<void> => {
      while (!batch.controller.signal.aborted) {
        const sourceId = sourceIds[nextIndex]
        nextIndex += 1
        if (!sourceId) return
        await this.processItem(batch, sourceId, settings)
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, sourceIds.length) }, worker))
    if (batch.controller.signal.aborted) {
      this.queue = this.queue.map((item) => (item.status === 'queued' || item.status === 'cancelling' ? { ...item, status: 'cancelled' } : item))
    }
    if (this.activeBatch?.id === batch.id) this.activeBatch = null
    this.emit()
  }

  private async processItem(batch: ActiveBatch, sourceId: string, settings: OperationSettings): Promise<void> {
    const source = this.sourceRecords.get(sourceId)
    const item = this.findQueueItem(sourceId)
    if (!source || !item || !item.metadata) return
    if (batch.controller.signal.aborted) {
      this.replaceQueueItem(sourceId, { ...item, status: 'cancelled' })
      this.emit()
      return
    }
    this.replaceQueueItem(sourceId, { ...item, status: 'processing' })
    this.emit()
    let inputSnapshot: string | null = null
    try {
      inputSnapshot = join(batch.tempDirectory, `${randomUUID()}.source`)
      await copyFile(source.path, inputSnapshot)
      if ((await fingerprintSource(inputSnapshot)) !== source.fingerprint) throw new Error('The source file changed after it was added. Remove it and add the current file again.')
      const engineResult = await this.engine.process({ sourcePath: inputSnapshot, metadata: item.metadata, settings, tempDirectory: batch.tempDirectory, signal: batch.controller.signal })
      if (batch.controller.signal.aborted) {
        if (engineResult.candidatePath) await rm(engineResult.candidatePath, { force: true })
        this.replaceQueueItem(sourceId, { ...item, status: 'cancelled' })
        return
      }
      const candidatePath = engineResult.candidatePath ?? inputSnapshot
      if (engineResult.candidatePath) {
        await rm(inputSnapshot, { force: true })
        inputSnapshot = null
      } else {
        inputSnapshot = null
      }
      const result: ResultRecord = {
        id: randomUUID(),
        sourceId,
        sourceName: item.sourceName,
        sourceBytes: item.sourceBytes,
        resultBytes: engineResult.resultBytes,
        sourceFormat: item.metadata.format,
        resultFormat: engineResult.resultFormat,
        width: engineResult.width,
        height: engineResult.height,
        operation: engineResult.operation,
        status: engineResult.status,
        exportStatus: 'not-exported',
        exportPath: null,
        settings,
        createdAt: new Date().toISOString(),
        candidatePath,
        sourcePath: source.path
      }
      this.results.set(result.id, result)
      if (settings.outputDirectory) {
        try {
          const exportPath = await this.publisher.publish({
            sourcePath: result.sourcePath,
            candidatePath: result.candidatePath,
            result,
            destination: await this.resolveDestination(settings.outputDirectory)
          })
          this.results.set(result.id, { ...result, exportStatus: 'exported', exportPath })
        } catch {
          this.results.set(result.id, { ...result, exportStatus: 'error', exportPath: null })
        }
      }
      this.replaceQueueItem(sourceId, { ...item, status: engineResult.status })
    } catch (error) {
      const status = error instanceof CancelledError || batch.controller.signal.aborted ? 'cancelled' : 'error'
      this.replaceQueueItem(sourceId, { ...item, status, error: status === 'error' ? this.messageFor(error) : null })
    } finally {
      if (inputSnapshot) await rm(inputSnapshot, { force: true }).catch(() => undefined)
      this.emit()
    }
  }

  private findQueueItem(sourceId: string): QueueItem | undefined {
    return this.queue.find((item) => item.id === sourceId)
  }

  private async resolveDestination(destinationId: string): Promise<string> {
    const path = this.destinationRecords.get(destinationId)
    if (!path) throw new Error('Choose an output folder again before exporting.')
    const resolved = await realpath(path)
    if (!(await stat(resolved)).isDirectory()) throw new Error('The selected output folder is no longer available.')
    return resolved
  }

  private replaceQueueItem(sourceId: string, next: QueueItem): void {
    this.queue = this.queue.map((item) => (item.id === sourceId ? next : item))
  }

  private errorItem(nameOrPath: string, error: string): QueueItem {
    return {
      id: randomUUID(),
      sourceName: nameOrPath.split('/').at(-1) || 'Unknown file',
      sourceBytes: 0,
      metadata: null,
      thumbnailDataUrl: null,
      status: 'error',
      error,
      previousResultId: null,
      createdAt: new Date().toISOString()
    }
  }

  private messageFor(error: unknown): string {
    return error instanceof Error ? error.message : 'An unexpected processing error occurred.'
  }
}
