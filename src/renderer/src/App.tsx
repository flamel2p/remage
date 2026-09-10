import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactElement } from 'react'
import {
  defaultSettings,
  OperationSettingsSchema,
  type AppSnapshot,
  type ImageFormat,
  type OperationSettings,
  type QueueItem,
  type Result
} from '../../shared/contracts'
import type { AppMetadata } from '../../shared/app-metadata'
import { formatBytes, formatDifference } from '../../shared/format'
import { planResize } from '../../shared/resize'

const emptySnapshot: AppSnapshot = {
  queue: [],
  results: [],
  capabilities: [],
  activeBatchId: null,
  activeMode: 'optimizer',
  progressLabel: null
}

const targets: ImageFormat[] = ['png', 'jpeg', 'webp']

const formatDimensions = (width: number, height: number): string => `${width} × ${height}`
const formatFileSize = formatBytes
const formatFormat = (format: ImageFormat): string => (format === 'jpeg' ? 'JPEG' : format.toUpperCase())

export function App(): ReactElement {
  const [snapshot, setSnapshot] = useState<AppSnapshot>(emptySnapshot)
  const [settings, setSettings] = useState<OperationSettings>(defaultSettings)
  const [notice, setNotice] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [appMetadata, setAppMetadata] = useState<AppMetadata | null>(null)
  const settingsDialog = useRef<HTMLDialogElement>(null)
  const settingsTrigger = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let active = true
    void Promise.all([window.remage.getSnapshot(), window.remage.getPreferences()])
      .then(([nextSnapshot, preferences]) => {
        if (!active) return
        setSnapshot(nextSnapshot)
        setSettings(preferences.settings)
      })
      .catch((error: unknown) => setNotice(error instanceof Error ? error.message : 'Unable to start Remage.'))

    return window.remage.onEvent((event) => {
      if (active) setSnapshot(event.snapshot)
    })
  }, [])

  useEffect(() => {
    void window.remage.getAppMetadata().then(setAppMetadata).catch(showError)
  }, [])

  useEffect(() => {
    const dialog = settingsDialog.current
    if (!dialog) return
    if (settingsOpen && !dialog.open) {
      dialog.showModal()
      requestAnimationFrame(() => dialog.querySelector<HTMLButtonElement>('[data-settings-close]')?.focus())
    }
    if (!settingsOpen && dialog.open) dialog.close()
  }, [settingsOpen])

  const queue = snapshot.queue
  const readyItems = queue.filter((item) => item.status === 'ready')
  const strictExcludedItems = settings.mode === 'optimizer' && !settings.resize.enabled
    ? readyItems.filter((item) => !snapshot.capabilities.find((capability) => capability.format === item.metadata?.format)?.canStrictOptimize)
    : []
  const eligibleReadyItems = readyItems.filter((item) => !strictExcludedItems.includes(item))
  const isRunning = snapshot.activeBatchId !== null
  const hasJpeg = eligibleReadyItems.some((item) => item.metadata?.format === 'jpeg')
  const hasAlpha = eligibleReadyItems.some((item) => item.metadata?.hasAlpha)
  const jpegAcknowledgementRequired =
    (settings.mode === 'converter' && settings.outputFormat === 'jpeg') ||
    (settings.mode === 'optimizer' && settings.resize.enabled && hasJpeg)
  const resizeError = settings.resize.enabled && !settings.resize.width && !settings.resize.height
    ? 'Enter a width, height, or both.'
    : settings.resize.enabled && !settings.resize.lockAspectRatio && (!settings.resize.width || !settings.resize.height)
      ? 'Exact dimensions require both width and height.'
      : null
  const settingsValid = OperationSettingsSchema.safeParse(settings).success
  const canSubmit = eligibleReadyItems.length > 0 && !isRunning && settingsValid && (!jpegAcknowledgementRequired || settings.jpegLossAcknowledged)
  const canExport = snapshot.results.some((result) => result.status === 'completed' || result.status === 'unchanged')
  const runLabel = settings.mode === 'optimizer' ? 'Optimize images' : 'Convert images'
  const resizePreview = useMemo(() => {
    const first = eligibleReadyItems.find((item) => item.metadata)
    if (!first?.metadata || resizeError) return null
    try {
      return planResize({ width: first.metadata.width, height: first.metadata.height }, settings.resize)
    } catch {
      return null
    }
  }, [eligibleReadyItems, settings.resize, resizeError])

  function persist(next: OperationSettings): void {
    void window.remage.savePreferences({ mode: next.mode, settings: next }).catch(showError)
  }

  function setAndPersist<K extends keyof OperationSettings>(key: K, value: OperationSettings[K]): void {
    setSettings((current) => {
      const next = { ...current, [key]: value }
      persist(next)
      return next
    })
  }

  function showError(error: unknown): void {
    setNotice(error instanceof Error ? error.message : 'Something went wrong.')
  }

  async function addFiles(files: File[]): Promise<void> {
    if (files.length === 0) return
    try {
      await window.remage.addDroppedFiles(files)
    } catch (error) {
      showError(error)
    }
  }

  async function chooseFolder(): Promise<void> {
    try {
      await window.remage.chooseFolder()
    } catch (error) {
      showError(error)
    }
  }

  async function chooseFiles(): Promise<void> {
    try {
      await window.remage.chooseFiles()
    } catch (error) {
      showError(error)
    }
  }

  async function chooseOutputDirectory(): Promise<void> {
    try {
      const outputDirectory = await window.remage.chooseOutputDirectory()
      if (outputDirectory === null) return
      setAndPersist('outputDirectory', outputDirectory)
    } catch (error) {
      showError(error)
    }
  }

  function openSettings(): void {
    setSettingsOpen(true)
  }

  function closeSettings(): void {
    settingsDialog.current?.close()
    setSettingsOpen(false)
    requestAnimationFrame(() => settingsTrigger.current?.focus())
  }

  function handleSettingsClosed(): void {
    setSettingsOpen(false)
    requestAnimationFrame(() => settingsTrigger.current?.focus())
  }

  async function openOutputDirectory(): Promise<void> {
    if (!settings.outputDirectory) {
      setNotice('Choose a save destination in Settings first.')
      return
    }
    try {
      await window.remage.openOutputDirectory()
    } catch (error) {
      showError(error)
    }
  }

  async function run(): Promise<void> {
    if (!canSubmit) return
    try {
      await window.remage.submitBatch({ sourceIds: eligibleReadyItems.map((item) => item.id), settings })
    } catch (error) {
      showError(error)
    }
  }

  async function exportResult(result: Result): Promise<void> {
    try {
      const destination = await window.remage.chooseExportDirectory()
      if (!destination) return
      await window.remage.exportResult(result.id, destination)
    } catch (error) {
      showError(error)
    }
  }

  async function exportAll(): Promise<void> {
    try {
      const destination = await window.remage.chooseExportDirectory()
      if (!destination) return
      await window.remage.exportAll(snapshot.results.filter((result) => result.status === 'completed' || result.status === 'unchanged').map((result) => result.id), destination)
    } catch (error) {
      showError(error)
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault()
    setDragging(false)
    void addFiles(Array.from(event.dataTransfer.files))
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand" aria-label="Remage">
          <div className="brand-mark" aria-hidden="true"><span /><span /><span /></div>
          <span>Remage</span>
        </div>
        <div className="mode-switch" aria-label="Operation mode">
          <button
            type="button"
            aria-pressed={settings.mode === 'optimizer'}
            className={settings.mode === 'optimizer' ? 'selected' : ''}
            onClick={() => setAndPersist('mode', 'optimizer')}
          >
            Optimizer
          </button>
          <button
            type="button"
            aria-pressed={settings.mode === 'converter'}
            className={settings.mode === 'converter' ? 'selected' : ''}
            onClick={() => setAndPersist('mode', 'converter')}
          >
            Converter
          </button>
        </div>
        <div className="header-actions">
          {!settings.outputDirectory && <span className="header-action-status" id="open-destination-guidance">Choose a destination in Settings</span>}
          <button
            type="button"
            className="icon-button"
            aria-label="Open save destination"
            aria-describedby={!settings.outputDirectory ? 'open-destination-guidance' : undefined}
            title={!settings.outputDirectory ? 'Choose a save destination in Settings first.' : 'Open save destination'}
            onClick={() => void openOutputDirectory()}
          >
            <FolderIcon />
          </button>
          <button ref={settingsTrigger} type="button" className="icon-button" aria-label="Open Settings" onClick={openSettings}>
            <SettingsIcon />
          </button>
        </div>
      </header>

      <section className="workspace" aria-label="Image workspace">
        <div
          className={`drop-zone ${dragging ? 'dragging' : ''}`}
          onDragEnter={(event) => { event.preventDefault(); setDragging(true) }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <div className="drop-icon" aria-hidden="true">↓</div>
          <h1>{settings.mode === 'optimizer' ? 'Make images smaller.' : 'Convert images simply.'}</h1>
          <p>Drop PNG, JPEG, or WebP files here. Processing stays on this Mac.</p>
          <div className="intake-actions">
            <button type="button" className="secondary-button" onClick={() => void chooseFiles()}>Choose images</button>
            <button type="button" className="secondary-button" onClick={() => void chooseFolder()}>Choose folder</button>
          </div>
        </div>

        <section className="settings-panel" aria-label="Output settings">
          <div className="setting-group">
            <div className="setting-label-row">
              <h2>Output</h2>
              {settings.mode === 'converter' && <span className="setting-note">Conversion may change image bytes.</span>}
            </div>
            <div className="format-options" aria-label="Output format">
              {targets.map((format) => {
                const available = snapshot.capabilities.some((capability) => capability.format === format && capability.canEncode)
                const active = settings.mode === 'converter' && settings.outputFormat === format
                return (
                  <button
                    type="button"
                    key={format}
                    aria-pressed={active}
                    disabled={settings.mode === 'optimizer' || !available}
                    className={active ? 'format-option active' : 'format-option'}
                    onClick={() => setAndPersist('outputFormat', format)}
                  >
                    {formatFormat(format)}
                  </button>
                )
              })}
            </div>
            {settings.mode === 'optimizer' && <p className="help-text">{settings.resize.enabled ? 'Resize re-encodes each image at the chosen dimensions; it is not a strict pixel-preserving operation.' : 'Optimizer keeps each file’s original PNG or JPEG format and accepts only a smaller pixel-identical result.'}</p>}
          </div>

          <div className="setting-group resize-group">
            <div className="setting-label-row">
              <h2>Resize</h2>
              <label className="toggle-control">
                <input
                  type="checkbox"
                  checked={settings.resize.enabled}
                  onChange={(event) => setAndPersist('resize', { ...settings.resize, enabled: event.target.checked })}
                />
                <span aria-hidden="true" />
                <b>{settings.resize.enabled ? 'On' : 'Off'}</b>
              </label>
            </div>
            {settings.resize.enabled && (
              <div className="resize-controls">
                <label>
                  <span>Width</span>
                  <input
                    type="number"
                    min="1"
                    max="16384"
                    inputMode="numeric"
                    aria-describedby={resizeError ? 'resize-error' : undefined}
                    value={settings.resize.width ?? ''}
                    onChange={(event) => setAndPersist('resize', { ...settings.resize, width: event.target.value ? Number(event.target.value) : null })}
                  />
                </label>
                <span className="dimension-separator" aria-hidden="true">×</span>
                <label>
                  <span>Height</span>
                  <input
                    type="number"
                    min="1"
                    max="16384"
                    inputMode="numeric"
                    aria-describedby={resizeError ? 'resize-error' : undefined}
                    value={settings.resize.height ?? ''}
                    onChange={(event) => setAndPersist('resize', { ...settings.resize, height: event.target.value ? Number(event.target.value) : null })}
                  />
                </label>
                <label className="check-control">
                  <input
                    type="checkbox"
                    checked={settings.resize.lockAspectRatio}
                    onChange={(event) => setAndPersist('resize', { ...settings.resize, lockAspectRatio: event.target.checked })}
                  />
                  Keep proportions
                </label>
                <label className="check-control">
                  <input
                    type="checkbox"
                    checked={settings.resize.allowEnlargement}
                    onChange={(event) => setAndPersist('resize', { ...settings.resize, allowEnlargement: event.target.checked })}
                  />
                  Allow enlargement
                </label>
              </div>
            )}
            {resizeError && <p className="field-error" id="resize-error" role="alert">{resizeError}</p>}
            {resizePreview && <p className="help-text">First queued image will be {formatDimensions(resizePreview.width, resizePreview.height)}.</p>}
          </div>

          {jpegAcknowledgementRequired && (
            <label className="warning-callout">
              <input
                type="checkbox"
                checked={settings.jpegLossAcknowledged}
                onChange={(event) => setAndPersist('jpegLossAcknowledged', event.target.checked)}
              />
              <span>JPEG re-encodes image data and does not support transparency. I understand this transformation is lossy and transparent pixels will use the selected background color.</span>
              <input
                type="color"
                aria-label="JPEG background color"
                value={settings.jpegBackground}
                disabled={!settings.jpegLossAcknowledged}
                onChange={(event) => setAndPersist('jpegBackground', event.target.value)}
              />
            </label>
          )}
          {strictExcludedItems.length > 0 && <p className="warning-text">{strictExcludedItems.length} WebP image{strictExcludedItems.length === 1 ? '' : 's'} will remain queued because strict optimization supports PNG and JPEG only.</p>}
          {settings.mode === 'converter' && settings.outputFormat === 'jpeg' && hasAlpha && !jpegAcknowledgementRequired && <p className="warning-text">Some queued images have transparency.</p>}
        </section>

        <section className="queue-section" aria-label="Queue">
          <div className="section-heading">
            <div>
              <h2>Queue</h2>
              <p>{queue.length === 0 ? 'No images selected' : `${queue.length} image${queue.length === 1 ? '' : 's'} selected`}</p>
            </div>
            {queue.length > 0 && <button type="button" className="quiet-button" disabled={isRunning} onClick={() => void window.remage.clearQueue().catch(showError)}>Clear queue</button>}
          </div>
          {queue.length === 0 ? (
            <div className="empty-queue">Add images above to begin.</div>
          ) : (
            <div className="queue-list">
              {queue.map((item) => <QueueRow item={item} key={item.id} running={isRunning} onRemove={() => void window.remage.removeSource(item.id).catch(showError)} onRequeue={() => void window.remage.requeueSource(item.id).catch(showError)} />)}
            </div>
          )}
        </section>

        {snapshot.results.length > 0 && (
          <section className="results-section" aria-label="Completed files">
            <div className="section-heading">
              <div>
                <h2>Completed</h2>
                <p>{snapshot.results.filter((result) => result.status === 'completed').length} processed, {snapshot.results.filter((result) => result.status === 'unchanged').length} unchanged, {queue.filter((item) => item.status === 'error').length} failed, {queue.filter((item) => item.status === 'cancelled').length} cancelled</p>
              </div>
              <button type="button" className="secondary-button" disabled={!canExport} onClick={() => void exportAll()}>Export all</button>
            </div>
            <div className="queue-list results-list">
              {snapshot.results.map((result) => <ResultRow result={result} key={result.id} onExport={() => void exportResult(result)} onRequeue={() => void window.remage.requeueSource(result.sourceId).catch(showError)} />)}
            </div>
          </section>
        )}
      </section>

      <footer className="action-bar">
        <div className="progress-copy" aria-live="polite">
          {isRunning ? snapshot.progressLabel ?? 'Processing images…' : <><span>Private, on-device image processing</span><span>Files never leave your Mac</span></>}
        </div>
        {isRunning ? (
          <button type="button" className="secondary-button" onClick={() => void window.remage.cancelBatch().catch(showError)}>Cancel batch</button>
        ) : (
          <button type="button" className="primary-button" disabled={!canSubmit} title={!canSubmit ? (resizeError ?? (eligibleReadyItems.length === 0 && readyItems.length > 0 ? 'Switch to Converter to process the remaining files.' : readyItems.length === 0 ? 'Add a valid image first.' : 'Complete the required output settings.')) : undefined} onClick={() => void run()}>{runLabel}</button>
        )}
      </footer>

      <dialog
        ref={settingsDialog}
        className="settings-dialog"
        aria-labelledby="settings-title"
        onCancel={(event) => { event.preventDefault(); closeSettings() }}
        onClose={handleSettingsClosed}
      >
        <div className="dialog-header">
          <div>
            <p className="dialog-eyebrow">Remage</p>
            <h2 id="settings-title">Settings</h2>
          </div>
          <button type="button" className="icon-button" data-settings-close aria-label="Close Settings" onClick={closeSettings}><CloseIcon /></button>
        </div>
        <section className="dialog-section" aria-labelledby="save-destination-title">
          <h3 id="save-destination-title">Save destination</h3>
          <p>{settings.outputDirectory ? 'A destination folder is selected for automatic export in this session.' : 'Choose a folder to export completed files automatically.'}</p>
          <button type="button" className="secondary-button" onClick={() => void chooseOutputDirectory()}>
            {settings.outputDirectory ? 'Change folder' : 'Choose folder'}
          </button>
          <p className="dialog-note">The destination is kept only for this session.</p>
        </section>
        <section className="dialog-section" aria-labelledby="about-title">
          <h3 id="about-title">About</h3>
          {appMetadata ? (
            <>
              <p>Remage {appMetadata.version}</p>
              <p>License: {appMetadata.license}</p>
              <h4>Bundled third-party notices</h4>
              <ul>{appMetadata.notices.map((notice) => <li key={notice}>{notice}</li>)}</ul>
            </>
          ) : <p>Loading local application information…</p>}
        </section>
      </dialog>

      {notice && <div className="notice" role="alert"><span>{notice}</span><button type="button" aria-label="Dismiss message" onClick={() => setNotice(null)}>×</button></div>}
    </main>
  )
}

function QueueRow({ item, running, onRemove, onRequeue }: { item: QueueItem; running: boolean; onRemove: () => void; onRequeue: () => void }): ReactElement {
  const metadata = item.metadata
  return (
    <article className="queue-row">
      {item.thumbnailDataUrl ? <img className="thumbnail" src={item.thumbnailDataUrl} alt="" /> : <div className="thumbnail placeholder" aria-hidden="true" />}
      <div className="file-copy">
        <strong title={item.sourceName} aria-label={item.sourceName}>{item.sourceName}</strong>
        <span>{metadata ? `${formatFormat(metadata.format)} · ${formatDimensions(metadata.width, metadata.height)} · ${formatFileSize(item.sourceBytes)}` : 'Inspecting image…'}</span>
        {item.error && <span className="item-error">{item.error}</span>}
      </div>
      <span className={`status status-${item.status}`}>{queueStatus(item.status)}</span>
      <div className="row-actions">
        {(item.status === 'cancelled' || (item.status === 'error' && item.metadata)) && <button type="button" className="quiet-button" disabled={running} onClick={onRequeue}>Requeue</button>}
        <button type="button" className="remove-button" aria-label={`Remove ${item.sourceName}`} disabled={running} onClick={onRemove}>Remove</button>
      </div>
    </article>
  )
}

function ResultRow({ result, onExport, onRequeue }: { result: Result; onExport: () => void; onRequeue: () => void }): ReactElement {
  const exportable = result.status === 'completed' || result.status === 'unchanged'
  const difference = formatDifference(result.sourceBytes, result.resultBytes)
  const exportDetail = result.exportStatus === 'exported' ? 'Exported' : result.exportStatus === 'exporting' ? 'Exporting…' : result.exportStatus === 'error' ? 'Export failed. Choose another folder and retry.' : 'Not exported'
  return (
    <article className="queue-row result-row">
      <div className="result-symbol" aria-hidden="true">{result.status === 'completed' ? '↓' : '•'}</div>
      <div className="file-copy">
        <strong title={result.sourceName} aria-label={result.sourceName}>{result.sourceName}</strong>
        <span>{result.status === 'completed' ? `${formatFormat(result.sourceFormat)} → ${formatFormat(result.resultFormat)} · ${formatDimensions(result.width, result.height)} · ${formatFileSize(result.sourceBytes)} → ${formatFileSize(result.resultBytes)} · ${difference}` : 'No smaller pixel-identical version was found.'}</span>
        <span className={result.exportStatus === 'error' ? 'item-error' : undefined}>{exportDetail}</span>
      </div>
      <span className={`status status-${result.status}`}>{resultStatus(result.status)}</span>
      <div className="row-actions">
        {exportable && <button type="button" className="quiet-button" onClick={onExport}>{result.exportStatus === 'error' ? 'Retry export' : 'Export'}</button>}
        <button type="button" className="quiet-button" onClick={onRequeue}>Requeue</button>
      </div>
    </article>
  )
}

function queueStatus(status: QueueItem['status']): string {
  return ({ inspecting: 'Inspecting', ready: 'Queued', queued: 'Queued', processing: 'Processing', cancelling: 'Cancelling', completed: 'Completed', unchanged: 'No size reduction', cancelled: 'Cancelled', error: 'Error' })[status]
}

function resultStatus(status: Result['status']): string {
  return ({ completed: 'Completed', unchanged: 'No size reduction' })[status]
}

function FolderIcon(): ReactElement {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6.5h6l1.8 2h9.2v9.8a2.2 2.2 0 0 1-2.2 2.2H5.7a2.2 2.2 0 0 1-2.2-2.2V6.5Z" /><path d="M3.5 8.5h17" /></svg>
}

function SettingsIcon(): ReactElement {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" /><path d="m19.1 13.5 1.4 1.1-2 3.4-1.7-.7a7.4 7.4 0 0 1-1.8 1l-.3 1.8h-4l-.3-1.8a7.4 7.4 0 0 1-1.8-1l-1.7.7-2-3.4 1.4-1.1a7.4 7.4 0 0 1 0-2.1L4.9 10l2-3.4 1.7.7a7.4 7.4 0 0 1 1.8-1l.3-1.8h4l.3 1.8a7.4 7.4 0 0 1 1.8 1l1.7-.7 2 3.4-1.4 1.1a7.4 7.4 0 0 1 0 2.1Z" /></svg>
}

function CloseIcon(): ReactElement {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
}
