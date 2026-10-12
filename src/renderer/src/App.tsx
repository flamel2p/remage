import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { defaultSettings, OperationSettingsSchema, type AppSnapshot, type ImageFormat, type OperationSettings, type Preferences, type QueueItem, type Result, type RemageApi } from '../../shared/contracts'
import type { AppMetadata } from '../../shared/app-metadata'
import { formatBytes, formatDifference } from '../../shared/format'
import { planResize } from '../../shared/resize'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge, type BadgeProps } from '@/components/reui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/reui/alert'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { useFileUpload } from '@/hooks/use-file-upload'

const emptySnapshot: AppSnapshot = { queue: [], results: [], capabilities: [], activeBatchId: null, activeMode: 'optimizer', progressLabel: null }
const targets: ImageFormat[] = ['png', 'jpeg', 'webp']
type Appearance = NonNullable<Preferences['appearance']>
type Notice = { text: string; severity: 'info' | 'warning' | 'destructive' }
const formatFormat = (format: ImageFormat): string => format === 'jpeg' ? 'JPEG' : format.toUpperCase()
const dimensions = (width: number, height: number): string => `${width} × ${height} px`
const exportable = (result: Result): boolean => result.status === 'completed' || result.status === 'unchanged'

export function App({ api, statusPanel, beforeProcess }: { api: RemageApi; statusPanel?: ReactNode; beforeProcess?: () => Promise<void> }): ReactElement {
  const browser = api.platform.runtime === 'browser'
  const [snapshot, setSnapshot] = useState<AppSnapshot>(emptySnapshot)
  const [settings, setSettings] = useState<OperationSettings>(() => ({ ...structuredClone(defaultSettings), mode: browser ? 'converter' : 'optimizer' }))
  const [appearance, setAppearance] = useState<Appearance>('system')
  const [notice, setNotice] = useState<Notice | null>(null)
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)
  const [starting, setStarting] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [appMetadata, setAppMetadata] = useState<AppMetadata | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [announcedStatus, setAnnouncedStatus] = useState('Ready to select images.')
  const header = useRef<HTMLElement>(null), footer = useRef<HTMLElement>(null), workspace = useRef<HTMLElement>(null)
  const settingsClose = useRef<HTMLButtonElement>(null)
  const preferences = useRef<Preferences>({ mode: settings.mode, settings, appearance: 'system' })

  const showError = useCallback((error: unknown): void => {
    const text = error instanceof Error ? error.message : 'The operation failed. Retry or choose a smaller selection.'
    setNotice({ text, severity: /cancelled/i.test(text) ? 'info' : 'destructive' })
  }, [])
  const initialize = useCallback(async (): Promise<void> => {
    try {
      const [next, saved, metadata] = await Promise.all([api.getSnapshot(), api.getPreferences(), api.getAppMetadata()])
      preferences.current = saved; setSettings(saved.settings); setAppearance(saved.appearance ?? 'system')
      setSnapshot(next); setAppMetadata(metadata); setInitialized(true); setNotice(null)
    } catch (error) { showError(error) } finally { setLoading(false) }
  }, [api, showError])
  useEffect(() => {
    let active = true
    void Promise.resolve().then(() => { if (active) void initialize() })
    const unsubscribe = api.onEvent((event) => { if (active) setSnapshot(event.snapshot) })
    return () => { active = false; unsubscribe() }
  }, [api, initialize])
  useEffect(() => {
    const root = document.documentElement, query = window.matchMedia('(prefers-color-scheme: dark)')
    const sync = (): void => { root.classList.toggle('dark', appearance === 'dark' || (appearance === 'system' && query.matches)); if (appearance === 'system') delete root.dataset.theme; else root.dataset.theme = appearance }
    sync(); query.addEventListener('change', sync); return () => query.removeEventListener('change', sync)
  }, [appearance])
  useEffect(() => {
    const measure = (): void => { document.documentElement.style.setProperty('--header-height', `${header.current?.getBoundingClientRect().height ?? 0}px`); document.documentElement.style.setProperty('--action-bar-height', `${footer.current?.getBoundingClientRect().height ?? 0}px`) }
    const observer = new ResizeObserver(measure)
    if (header.current) observer.observe(header.current)
    if (footer.current) observer.observe(footer.current)
    measure(); return () => observer.disconnect()
  }, [])

  const queue = snapshot.queue
  const availableItems = queue.filter((item) => item.metadata && (browser ? ['ready', 'error', 'cancelled'].includes(item.status) : item.status === 'ready'))
  const strictMode = settings.mode === 'optimizer' && !settings.resize.enabled
  const strictUnavailable = strictMode && !snapshot.capabilities.some((capability) => capability.canStrictOptimize)
  const strictExcluded = strictMode ? availableItems.filter((item) => !snapshot.capabilities.find((capability) => capability.format === item.metadata?.format)?.canStrictOptimize) : []
  const eligibleItems = availableItems.filter((item) => !strictExcluded.includes(item))
  const isRunning = snapshot.activeBatchId !== null
  const jpegRequired = (settings.mode === 'converter' && settings.outputFormat === 'jpeg') || (settings.mode === 'optimizer' && settings.resize.enabled && eligibleItems.some((item) => item.metadata?.format === 'jpeg'))
  const resizeError = !settings.resize.enabled ? null
    : [settings.resize.width, settings.resize.height].some((value) => value !== null && (!Number.isInteger(value) || value < 1 || value > (browser ? 8192 : 16384))) ? `Dimensions must be whole pixels from 1 to ${browser ? '8,192' : '16,384'}.`
      : !settings.resize.width && !settings.resize.height ? 'Enter a width, height, or both.'
        : !settings.resize.lockAspectRatio && (!settings.resize.width || !settings.resize.height) ? 'Exact dimensions require both width and height.' : null
  const canSubmit = initialized && !starting && !isRunning && eligibleItems.length > 0 && !resizeError && OperationSettingsSchema.safeParse(settings).success && (!jpegRequired || settings.jpegLossAcknowledged)
  const eligibleResults = snapshot.results.filter(exportable)
  const selected = eligibleResults.filter((result) => selectedIds.has(result.id))
  const excluded = snapshot.results.length - eligibleResults.length
  const zipBusy = snapshot.exportProgress?.status === 'waiting' || snapshot.exportProgress?.status === 'preparing'
  const status = isRunning ? snapshot.progressLabel ?? 'Processing images on this device…' : zipBusy ? snapshot.exportProgress!.label : `${eligibleItems.length} available to process; ${snapshot.results.length} results retained in this session.`
  useEffect(() => { const timer = setTimeout(() => setAnnouncedStatus(status), 350); return () => clearTimeout(timer) }, [status])
  const resizePreview = useMemo(() => {
    const first = eligibleItems.find((item) => item.metadata)
    if (!first?.metadata || resizeError || !settings.resize.enabled) return null
    try { return planResize(first.metadata, settings.resize) } catch { return null }
  }, [eligibleItems, resizeError, settings.resize])

  function persist(next: OperationSettings, nextAppearance = appearance): void {
    // Native validation still owns complete operations; browser accepts safe settings drafts.
    const savedSettings = !browser && !OperationSettingsSchema.safeParse(next).success ? preferences.current.settings : next
    const saved = { mode: savedSettings.mode, settings: savedSettings, appearance: nextAppearance }
    preferences.current = saved; void api.savePreferences(saved).catch(showError)
  }
  function update<K extends keyof OperationSettings>(key: K, value: OperationSettings[K]): void { const next = { ...settings, [key]: value }; setSettings(next); persist(next) }
  const addFiles = useCallback((files: File[]): void => { if (files.length) void api.addDroppedFiles(files).catch(showError) }, [api, showError])
  const [upload, intake] = useFileUpload({ onFilesAdded: addFiles, disabled: !initialized || clearing })
  function focusWorkspace(): void { requestAnimationFrame(() => workspace.current?.focus()) }
  async function removeSource(item: QueueItem): Promise<void> {
    try { const next = queue.find((row) => row.id !== item.id)?.id; await api.removeSource(item.id); requestAnimationFrame(() => (next ? document.getElementById(`source-${next}`) : workspace.current)?.focus()) } catch (error) { showError(error) }
  }
  async function requeue(sourceId: string): Promise<void> { try { const next = await api.requeueSource(sourceId), focusId = browser ? sourceId : next.queue.find((row) => !queue.some((old) => old.id === row.id))?.id; requestAnimationFrame(() => (focusId ? document.getElementById(`source-${focusId}`) : workspace.current)?.focus()) } catch (error) { showError(error) } }
  async function run(): Promise<void> {
    if (!canSubmit) return
    setStarting(true)
    try { await beforeProcess?.(); await api.submitBatch({ sourceIds: eligibleItems.map((item) => item.id), settings: structuredClone(settings) }); setNotice(null) } catch (error) { showError(error) } finally { setStarting(false) }
  }
  function downloadResult(result: Result): void {
    if (api.platform.downloads) { void api.exportResult(result.id, '').catch(showError); return }
    void (async () => { const destination = await api.chooseExportDirectory(); if (destination) await api.exportResult(result.id, destination) })().catch(showError)
  }
  function exportSelection(): void {
    const ids = browser ? selected.map((result) => result.id) : eligibleResults.map((result) => result.id)
    if (api.platform.archiveExport) { void api.exportAll(ids, '').catch(showError); return }
    void (async () => { const destination = await api.chooseExportDirectory(); if (destination) await api.exportAll(ids, destination) })().catch(showError)
  }
  async function clearSession(): Promise<void> {
    setClearing(true)
    try { await api.clearQueue(); setSelectedIds(new Set()); setClearOpen(false); setNotice({ text: browser ? 'Session cleared. Your original files were not modified.' : 'Queue cleared.', severity: 'info' }); focusWorkspace() } catch (error) { showError(error) } finally { setClearing(false) }
  }
  function selectResult(resultId: string, checked: boolean): void { setSelectedIds((current) => { const next = new Set(current); if (checked) next.add(resultId); else next.delete(resultId); return next }) }

  return <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
    <div className="app-shell" data-platform={api.platform.runtime}>
      <header className="app-header" ref={header}><div className="header-inner">
        <div className="brand" aria-label="Remage"><div className="brand-mark" aria-hidden="true"><span /><span /><span /></div><span>Remage</span></div>
        <div className="mode-switch" role="group" aria-label="Operation mode">{(['optimizer', 'converter'] as const).map((mode) => <Button key={mode} variant="ghost" aria-pressed={settings.mode === mode} className={settings.mode === mode ? 'selected' : ''} onClick={() => update('mode', mode)}>{mode === 'optimizer' ? 'Optimizer' : 'Converter'}</Button>)}</div>
        <div className="header-actions">{api.platform.openDestination && <Button variant="ghost" size="icon" aria-label="Open save destination" onClick={() => { if (!settings.outputDirectory) setNotice({ text: 'Choose a save destination in Settings first.', severity: 'info' }); else void api.openOutputDirectory().catch(showError) }}><FolderIcon /></Button>}<DialogTrigger asChild><Button variant="ghost" size="icon" aria-label="Open Settings"><SettingsIcon /></Button></DialogTrigger></div>
      </div></header>
      <main className="workspace" ref={workspace} tabIndex={-1} aria-label="Image workspace">
        {statusPanel}
        {notice && <Alert variant={notice.severity} className="notice"><div><AlertTitle>{notice.severity === 'destructive' ? 'Action needed' : notice.severity === 'warning' ? 'Before continuing' : 'Session update'}</AlertTitle><AlertDescription>{notice.text}</AlertDescription>{!initialized && <Button variant="outline" onClick={() => { setLoading(true); void initialize() }} disabled={loading}>{loading ? 'Retrying…' : 'Retry initialization'}</Button>}</div><Button variant="ghost" size="icon" aria-label="Dismiss message" onClick={() => setNotice(null)}><CloseIcon /></Button></Alert>}
        <Card className={`drop-zone ${upload.isDragging ? 'dragging' : ''}`} onDragEnter={intake.handleDragEnter} onDragOver={intake.handleDragOver} onDragLeave={intake.handleDragLeave} onDrop={intake.handleDrop}>
          <div className="drop-icon" aria-hidden="true">↓</div><h1>{settings.mode === 'optimizer' ? 'Optimize or resize images.' : 'Convert images simply.'}</h1>
          <p>Choose PNG, JPEG, or WebP images. Processing stays on {browser ? 'this device' : 'this Mac'}.</p>
          <div className="intake-actions"><Button variant="secondary" disabled={!initialized || clearing} onClick={() => { if (browser) intake.openFileDialog(); else void api.chooseFiles().catch(showError) }}>{loading ? 'Starting Remage…' : 'Choose images'}</Button>{api.platform.folderIntake && <Button variant="outline" disabled={!initialized} onClick={() => void api.chooseFolder().catch(showError)}>Choose folder</Button>}</div>
          {browser && <input {...intake.getInputProps({ hidden: true, 'aria-label': 'Choose local images' })} />}
          {browser && <p className="help-text">Session data is temporary. Download your results before closing or reloading. Keep this tab open while processing.</p>}
        </Card>
        <Card className="settings-panel" aria-label="Output settings"><CardContent>
          <div className="setting-group"><h2>Output format</h2><div className="format-options" role="group" aria-label="Output format">{targets.map((format) => <Button key={format} variant="outline" className={settings.mode === 'converter' && settings.outputFormat === format ? 'active' : ''} aria-pressed={settings.mode === 'converter' && settings.outputFormat === format} disabled={settings.mode !== 'converter' || !snapshot.capabilities.some((capability) => capability.format === format && capability.canEncode)} onClick={() => update('outputFormat', format)}>{formatFormat(format)}</Button>)}</div>
            {settings.mode === 'converter' && <p className="help-text">{settings.outputFormat ? 'Conversion re-encodes images. A valid result can be larger than its source.' : 'Choose an output format to continue.'}</p>}
            {strictUnavailable && <Alert variant="warning" className="setting-alert"><AlertTitle>{browser ? 'Strict optimization is unavailable in this browser build.' : 'Native strict codecs are unavailable.'}</AlertTitle><AlertDescription>{browser ? 'The evaluated adapter cannot prove source preservation. Choose Converter or explicitly enable resize to transform your images.' : 'Fetch the pinned local adapters and restart Remage. Converter and resize remain available.'}</AlertDescription><Button variant="outline" onClick={() => update('mode', 'converter')}>Use Converter</Button></Alert>}
            {strictMode && !strictUnavailable && <p className="help-text">Keep the source format and accept only a smaller, pixel-identical result. Unsupported formats stay available for Converter.</p>}
            {settings.mode === 'optimizer' && settings.resize.enabled && <Alert variant="warning" className="setting-alert"><AlertDescription>Resize re-encodes pixels in the source format. It is a transformation and can increase file size.</AlertDescription></Alert>}
            {strictExcluded.length > 0 && !strictUnavailable && <p className="help-text">{strictExcluded.length} source{strictExcluded.length === 1 ? '' : 's'} excluded by strict codec capabilities. Use Converter to process them.</p>}
          </div>
          <div className="setting-group"><h2>Metadata</h2><label className="check-control"><input type="checkbox" checked={settings.preserveMetadata} onChange={(event) => update('preserveMetadata', event.target.checked)} />Preserve metadata</label><p className="help-text">{api.platform.metadata === 'restricted' ? 'Preservation is on by default. Sources with optional metadata are blocked unless you explicitly turn it off. ICC, CMYK and unsupported color declarations remain unsupported even when metadata removal is selected.' : 'Keep supported metadata during processing. Turn this off only when you want removable metadata stripped.'}</p></div>
          <div className="setting-group"><h2>Resize</h2><label className="check-control"><input type="checkbox" checked={settings.resize.enabled} onChange={(event) => update('resize', { ...settings.resize, enabled: event.target.checked })} />Resize images</label>
            {settings.resize.enabled && <div className="resize-controls">{(['width', 'height'] as const).map((axis) => <label className="field" key={axis}><span>{axis === 'width' ? 'Width' : 'Height'} <span className="field-unit">(px)</span></span><input type="number" min={1} max={browser ? 8192 : 16384} step={1} inputMode="numeric" value={settings.resize[axis] ?? ''} aria-invalid={Boolean(resizeError)} aria-describedby={resizeError ? 'resize-error' : 'resize-help'} onChange={(event) => update('resize', { ...settings.resize, [axis]: event.target.value ? Number(event.target.value) : null })} /></label>)}<div className="resize-options"><label className="check-control"><input type="checkbox" checked={settings.resize.lockAspectRatio} onChange={(event) => update('resize', { ...settings.resize, lockAspectRatio: event.target.checked })} />Keep proportions</label><label className="check-control"><input type="checkbox" checked={settings.resize.allowEnlargement} onChange={(event) => update('resize', { ...settings.resize, allowEnlargement: event.target.checked })} />Allow enlargement</label></div></div>}
            {resizeError && <p className="field-error" id="resize-error" role="alert">{resizeError}</p>}{settings.resize.enabled && <p className="help-text" id="resize-help">{resizePreview ? <>First available source: <span className="data-text">{dimensions(resizePreview.width, resizePreview.height)}</span>. </> : null}Proportions fit within requested bounds; turning them off uses exact dimensions.{browser ? ' Browser output is limited to 12 million pixels and 8,192 pixels per side.' : ''}</p>}
          </div>
          {jpegRequired && <Alert variant="warning"><AlertTitle>JPEG is a lossy transformation.</AlertTitle><AlertDescription>Re-encoding can change pixels. JPEG does not support transparency; alpha is composited onto the selected background.</AlertDescription><label className="check-control"><input type="checkbox" checked={settings.jpegLossAcknowledged} onChange={(event) => update('jpegLossAcknowledged', event.target.checked)} />I understand JPEG re-encoding is lossy</label><label className="color-control"><span>JPEG background color</span><input type="color" value={settings.jpegBackground} onChange={(event) => update('jpegBackground', event.target.value)} /><span className="data-text">{settings.jpegBackground}</span></label></Alert>}
        </CardContent></Card>
        <Card className="queue-section" aria-label="Queue"><CardHeader className="section-heading"><div><CardTitle>Queue</CardTitle><p className="help-text">{queue.length ? `${queue.length} source ${queue.length === 1 ? 'entry' : 'entries'} · ${availableItems.length} available` : 'No images selected'}</p></div>
          {(queue.length > 0 || snapshot.results.length > 0) && (browser ? <AlertDialog open={clearOpen} onOpenChange={(open) => { if (!clearing) setClearOpen(open) }}><AlertDialogTrigger asChild><Button variant="ghost">Clear session</Button></AlertDialogTrigger><AlertDialogContent onEscapeKeyDown={(event) => { if (clearing) event.preventDefault() }} onCloseAutoFocus={(event) => { if (!queue.length) { event.preventDefault(); focusWorkspace() } }}><AlertDialogTitle>Clear this session?</AlertDialogTitle><AlertDialogDescription>Retained originals, results, prepared ZIP files and active work will be discarded from Remage. Download anything you need first. Files on your device will not be modified.</AlertDialogDescription><div className="dialog-actions"><AlertDialogCancel asChild><Button variant="outline" disabled={clearing}>Keep session</Button></AlertDialogCancel><AlertDialogAction asChild><Button variant="destructive" disabled={clearing} onClick={(event) => { event.preventDefault(); void clearSession() }}>{clearing ? 'Clearing…' : 'Clear session'}</Button></AlertDialogAction></div></AlertDialogContent></AlertDialog> : <Button variant="ghost" disabled={isRunning} onClick={() => void clearSession()}>Clear queue</Button>)}
        </CardHeader><CardContent>{snapshot.intakeFeedback && <Alert variant="warning"><AlertDescription>{snapshot.intakeFeedback.label}</AlertDescription></Alert>}{!queue.length ? <p className="empty-queue">Choose images above to begin.</p> : <div className="queue-list">{queue.map((item) => <QueueRow key={item.id} item={item} running={isRunning} onRemove={() => void removeSource(item)} onRequeue={() => void requeue(item.id)} />)}</div>}</CardContent></Card>
        {snapshot.results.length > 0 && <Card className="results-section" aria-label="Completed files"><CardHeader className="section-heading"><div><CardTitle>Results</CardTitle><p className="help-text">{snapshot.results.filter((result) => result.status === 'completed').length} completed · {snapshot.results.filter((result) => result.status === 'unchanged').length} unchanged · {queue.filter((item) => item.status === 'error').length} failed · {queue.filter((item) => item.status === 'cancelled').length} cancelled</p></div>{!browser && <Button variant="secondary" disabled={!eligibleResults.length} onClick={exportSelection}>Export all</Button>}</CardHeader><CardContent>
          {api.platform.archiveExport && <div className="archive-controls"><label className="check-control"><input type="checkbox" checked={eligibleResults.length > 0 && selected.length === eligibleResults.length} onChange={(event) => setSelectedIds(event.target.checked ? new Set(eligibleResults.map((result) => result.id)) : new Set())} disabled={!eligibleResults.length || zipBusy} />Select all eligible results</label><p className="help-text"><span className="data-text">{selected.length}</span> selected · <span className="data-text">{excluded}</span> ineligible results excluded. Unselected results are not included.</p><div className="archive-actions"><Button variant="secondary" disabled={!selected.length || zipBusy} onClick={exportSelection}>Prepare ZIP</Button>{zipBusy && <Button variant="outline" onClick={() => void api.cancelExport?.().catch(showError)}>Cancel ZIP</Button>}{snapshot.exportProgress?.status === 'ready' && <Button onClick={() => void api.downloadArchive?.().catch(showError)}>Download ZIP</Button>}</div>{snapshot.exportProgress && <Alert variant={snapshot.exportProgress.status === 'error' ? 'destructive' : snapshot.exportProgress.status === 'ready' ? 'success' : 'info'}><AlertDescription>{snapshot.exportProgress.label}</AlertDescription></Alert>}</div>}
          <div className="queue-list results-list">{snapshot.results.map((result) => <ResultRow key={result.id} result={result} browser={browser} selectable={api.platform.archiveExport && exportable(result)} selected={selectedIds.has(result.id)} selectionDisabled={zipBusy} canRequeue={!isRunning && queue.some((item) => item.id === result.sourceId)} onSelect={(checked) => selectResult(result.id, checked)} onExport={() => downloadResult(result)} onRequeue={() => void requeue(result.sourceId)} />)}</div>
        </CardContent></Card>}
      </main>
      <footer className="action-bar" ref={footer}><div className="action-inner"><div className="progress-copy"><strong>{isRunning || zipBusy ? status : 'Private, on-device processing'}</strong><span>{isRunning || zipBusy ? 'Keep Remage open. Completed results remain available.' : canSubmit ? `${eligibleItems.length} ${eligibleItems.length === 1 ? 'image' : 'images'} ready with current settings` : !eligibleItems.length ? 'Choose a valid image to begin.' : resizeError ?? (settings.mode === 'converter' && !settings.outputFormat ? 'Choose an output format.' : jpegRequired && !settings.jpegLossAcknowledged ? 'Acknowledge JPEG re-encoding above.' : strictUnavailable ? 'Choose Converter or enable resize.' : 'Complete the output settings above.')}</span></div>{isRunning ? <Button variant="secondary" onClick={() => void api.cancelBatch().then(() => setNotice({ text: 'Batch cancelled. Completed results remain available.', severity: 'info' })).catch(showError)}>Cancel batch</Button> : <Button disabled={!canSubmit} onClick={() => void run()}>{starting ? 'Preparing…' : settings.resize.enabled ? 'Process images' : settings.mode === 'converter' ? 'Convert images' : 'Optimize images'}</Button>}</div></footer>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcedStatus}</div>
    </div>
    <DialogContent onOpenAutoFocus={(event) => { event.preventDefault(); settingsClose.current?.focus() }}>
      <div className="dialog-header"><div><DialogTitle>Settings</DialogTitle><DialogDescription>Appearance and application information</DialogDescription></div><DialogClose asChild><Button ref={settingsClose} variant="ghost" size="icon" aria-label="Close Settings"><CloseIcon /></Button></DialogClose></div>
      <section className="dialog-section" aria-labelledby="appearance-title"><h3 id="appearance-title">Appearance</h3><div className="format-options" role="group" aria-label="Appearance">{(['system', 'light', 'dark'] as const).map((choice) => <Button key={choice} variant="outline" aria-pressed={appearance === choice} className={appearance === choice ? 'active' : ''} onClick={() => { setAppearance(choice); persist(settings, choice) }}>{choice[0].toUpperCase() + choice.slice(1)}</Button>)}</div><p className="help-text">System follows your device. Only settings are saved.</p></section>
      {api.platform.destinationWriting && <section className="dialog-section" aria-labelledby="destination-title"><h3 id="destination-title">Save destination</h3><p className="help-text">{settings.outputDirectory ? 'A folder is selected for automatic export in this session.' : 'Choose a folder to export completed files automatically.'}</p><Button variant="secondary" onClick={() => void api.chooseOutputDirectory().then((destination) => { if (destination) update('outputDirectory', destination) }).catch(showError)}>{settings.outputDirectory ? 'Change folder' : 'Choose folder'}</Button><p className="help-text">The destination is kept only for this session.</p></section>}
      {browser && <section className="dialog-section"><h3>Local browser session</h3><p className="help-text">No accounts, uploads or telemetry. Original files are never overwritten. Your browser chooses download locations; Remage cannot confirm that a requested download was saved.</p><p className="help-text">Provisional limits: 10 sources, 20 MiB per file, 50 MiB source/result pools, 12 million decoded pixels, 8,192 pixels per side, 100 retained results and 50 MiB ZIP. Use smaller selections when admission fails.</p></section>}
      <section className="dialog-section" aria-labelledby="about-title"><h3 id="about-title">About</h3>{appMetadata ? <><p className="help-text">Remage <span className="data-text">{appMetadata.version}</span> · {appMetadata.license}</p><h4>Bundled third-party notices</h4><ul>{appMetadata.notices.map((text) => <li key={text}>{text}</li>)}</ul></> : <p className="help-text">Application information is unavailable. Retry initialization.</p>}</section>
    </DialogContent>
  </Dialog>
}

function QueueRow({ item, running, onRemove, onRequeue }: { item: QueueItem; running: boolean; onRemove: () => void; onRequeue: () => void }): ReactElement {
  const metadata = item.metadata
  return <article className="queue-row" id={`source-${item.id}`} tabIndex={-1} aria-label={item.sourceName}>
    {item.thumbnailDataUrl ? <img className="thumbnail" src={item.thumbnailDataUrl} alt="" /> : <div className="thumbnail placeholder" aria-hidden="true" />}
    <div className="file-copy"><strong><bdi>{item.sourceName}</bdi></strong><p className="file-data">{metadata ? <><span>{formatFormat(metadata.format)}</span><span className="data-text">{dimensions(metadata.width, metadata.height)} · {formatBytes(item.sourceBytes)}</span></> : item.status === 'inspecting' ? 'Inspecting image…' : 'Source not accepted'}</p>{item.error && <p className="item-error">{item.error}</p>}</div>
    <Badge variant={statusVariant(item.status)}>{queueStatus(item.status)}</Badge><div className="row-actions">{(item.status === 'cancelled' || (item.status === 'error' && metadata)) && <Button variant="ghost" disabled={running} onClick={onRequeue}>Retry</Button>}<Button variant="ghost" aria-label={`Remove ${item.sourceName}`} disabled={running} onClick={onRemove}>Remove</Button></div>
  </article>
}
function ResultRow({ result, browser, selectable, selected, selectionDisabled, canRequeue, onSelect, onExport, onRequeue }: { result: Result; browser: boolean; selectable: boolean; selected: boolean; selectionDisabled: boolean; canRequeue: boolean; onSelect: (checked: boolean) => void; onExport: () => void; onRequeue: () => void }): ReactElement {
  const signed = result.resultBytes - result.sourceBytes
  const detail = result.exportStatus === 'download-requested' ? 'Download requested; saving is managed by your browser.' : result.exportStatus === 'archive-ready' ? 'Included in prepared ZIP; download it to request saving.' : result.exportStatus === 'exported' ? 'Published to the selected folder.' : result.exportStatus === 'exporting' ? browser ? 'Requesting download…' : 'Publishing…' : result.exportStatus === 'error' ? browser ? 'Download failed. Result retained; retry.' : 'Export failed. Result retained; choose another folder and retry.' : browser ? 'Available in this session; download before closing.' : 'Not exported'
  return <article className="queue-row result-row" aria-label={`Result for ${result.sourceName}`}>
    {selectable && <label className="result-select"><input type="checkbox" checked={selected} disabled={selectionDisabled} onChange={(event) => onSelect(event.target.checked)} /><span className="sr-only">Include {result.sourceName} in ZIP</span></label>}
    <div className="file-copy"><strong><bdi>{result.sourceName}</bdi></strong><p className="file-data"><span>{formatFormat(result.sourceFormat)} → {formatFormat(result.resultFormat)}</span><span className="data-text">{dimensions(result.width, result.height)} · {formatBytes(result.sourceBytes)} → {formatBytes(result.resultBytes)}</span></p><p className="file-data"><span className="data-text">{signed > 0 ? '+' : signed < 0 ? '−' : ''}{formatBytes(Math.abs(signed))}</span><span>{formatDifference(result.sourceBytes, result.resultBytes)}</span></p><p className={result.exportStatus === 'error' ? 'item-error' : 'help-text'}>{detail}</p></div>
    <Badge variant={statusVariant(result.status)}>{result.status === 'completed' ? 'Completed' : 'Unchanged'}</Badge><div className="row-actions">{exportable(result) && <Button variant="ghost" onClick={onExport}>{result.exportStatus === 'error' ? browser ? 'Retry download' : 'Retry export' : browser ? 'Download' : 'Export'}</Button>}<Button variant="ghost" disabled={!canRequeue} onClick={onRequeue}>Requeue</Button></div>
  </article>
}
function queueStatus(status: QueueItem['status']): string { return ({ inspecting: 'Inspecting', ready: 'Ready', queued: 'Queued', processing: 'Processing', cancelling: 'Cancelling', completed: 'Completed', unchanged: 'Unchanged', cancelled: 'Cancelled', error: 'Error' })[status] }
function statusVariant(status: QueueItem['status'] | Result['status']): BadgeProps['variant'] { return status === 'error' ? 'destructive-light' : status === 'completed' ? 'success-light' : ['inspecting', 'queued', 'processing', 'cancelling'].includes(status) ? 'primary-light' : 'secondary' }
function FolderIcon(): ReactElement { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6.5h6l1.8 2h9.2v9.8a2.2 2.2 0 0 1-2.2 2.2H5.7a2.2 2.2 0 0 1-2.2-2.2V6.5Z" /><path d="M3.5 8.5h17" /></svg> }
function SettingsIcon(): ReactElement { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" /><path d="m19.1 13.5 1.4 1.1-2 3.4-1.7-.7a7.4 7.4 0 0 1-1.8 1l-.3 1.8h-4l-.3-1.8a7.4 7.4 0 0 1-1.8-1l-1.7.7-2-3.4 1.4-1.1a7.4 7.4 0 0 1 0-2.1L4.9 10l2-3.4 1.7.7a7.4 7.4 0 0 1 1.8-1l.3-1.8h4l.3 1.8a7.4 7.4 0 0 1 1.8 1l1.7-.7 2 3.4-1.4 1.1a7.4 7.4 0 0 1 0 2.1Z" /></svg> }
function CloseIcon(): ReactElement { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg> }
