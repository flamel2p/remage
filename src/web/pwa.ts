import type { BrowserService } from './browser-service'
import { cacheRequest, validateBuildManifest, type BuildManifest } from './pwa-protocol'

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
export type PwaState = { mode: 'checking' | 'unsupported' | 'setup' | 'ready' | 'partial' | 'blocked' | 'error'; label: string; recoveryError: string | null; required: number; cached: number; waiting: boolean; busy: boolean; operation: boolean; canReload: boolean; hasSession: boolean; installed: boolean; installAvailable: boolean }
const errorText = (error: unknown): string => error instanceof Error ? error.message : 'Application setup could not be checked. Reconnect and retry.'

export class PwaController {
  private manifest: BuildManifest | null = null
  private registration: ServiceWorkerRegistration | null = null
  private promptEvent: InstallPrompt | null = null
  private readonly listeners = new Set<() => void>()
  private revision = 0
  private disposed = false
  private unsubscribe: () => void
  private state: PwaState = { mode: 'checking', label: 'Checking local application files…', recoveryError: null, required: 0, cached: 0, waiting: false, busy: false, operation: false, canReload: false, hasSession: false, installed: false, installAvailable: false }
  constructor(private readonly api: BrowserService, private readonly buildId: string, private readonly base: string, private readonly development = false) {
    if (!development && 'serviceWorker' in navigator && navigator.serviceWorker.controller) api.setUpdateLocked(true)
    this.unsubscribe = api.onEvent(() => this.set({}))
    if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('controllerchange', this.controllerChanged)
    document.addEventListener('visibilitychange', this.visible)
    window.addEventListener('beforeinstallprompt', this.installPrompt)
    window.addEventListener('appinstalled', this.installed)
    this.set({})
  }
  readonly subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener) }
  readonly getState = (): PwaState => this.state
  private set(patch: Partial<PwaState>): void {
    if (this.disposed) return
    const session = this.api.getSessionStatus()
    this.state = { ...this.state, ...patch, busy: session.busy, hasSession: this.api.hasSessionWork(), installed: window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone) }
    if (this.state.canReload && (session.busy || this.api.hasSessionWork())) this.state.canReload = false
    for (const listener of this.listeners) listener()
  }
  private readonly visible = (): void => { if (document.visibilityState === 'visible') void this.check() }
  private readonly controllerChanged = (): void => { this.api.setUpdateLocked(true); void this.check() }
  private readonly installPrompt = (event: Event): void => { event.preventDefault(); this.promptEvent = event as InstallPrompt; this.set({ installAvailable: true }) }
  private readonly installed = (): void => { this.promptEvent = null; this.set({ installAvailable: false }) }
  async start(): Promise<void> {
    if (this.development || !('serviceWorker' in navigator) || !window.isSecureContext) { this.api.setUpdateLocked(false); this.set({ mode: 'unsupported', label: 'Use Remage in this browser. Offline setup requires a production build on HTTPS or localhost.' }); return }
    try {
      this.registration = await navigator.serviceWorker.register(this.base + 'sw.js', { scope: this.base, updateViaCache: 'none' })
      const watch = (): void => { const worker = this.registration?.installing; worker?.addEventListener('statechange', () => { this.set({ waiting: Boolean(this.registration?.waiting), ...(worker.state === 'redundant' ? { recoveryError: 'New application setup did not complete. Existing validated files remain available; reconnect and check again.' } : worker.state === 'installed' ? { recoveryError: null } : {}) }); if (worker.state === 'activated' || worker.state === 'installed' || worker.state === 'redundant') void this.check() }) }
      this.registration.addEventListener('updatefound', watch); watch()
      await this.check()
    } catch (error) { if (navigator.serviceWorker.controller) this.api.setUpdateLocked(true); this.set({ mode: 'error', label: errorText(error) }) }
  }
  private async loadManifest(): Promise<BuildManifest> {
    if (this.manifest) return this.manifest
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 10_000)
    try {
      // Firefox bypasses the controlling worker for no-store requests while offline.
      // A controlled response is still checked against this page's exact build/digest.
      const response = await fetch(this.base + 'web-build.json', { cache: navigator.serviceWorker.controller ? 'default' : 'no-store', redirect: 'error', signal: controller.signal })
      if (!response.ok) throw new Error('The application inventory is unavailable. Reconnect and retry setup.')
      const text = await response.text(); if (text.length > 1024 * 1024) throw new Error('The application inventory is too large.')
      const manifest = await validateBuildManifest(JSON.parse(text), this.buildId, this.base)
      this.manifest = manifest; return manifest
    } finally { clearTimeout(timer) }
  }
  async check(): Promise<void> {
    if (this.disposed || this.development || !('serviceWorker' in navigator) || this.state.mode === 'unsupported') return
    const revision = ++this.revision, controller = navigator.serviceWorker.controller
    if (controller) this.api.setUpdateLocked(true)
    this.set({ mode: 'checking', label: 'Checking compatible application files…', canReload: false, waiting: Boolean(this.registration?.waiting) })
    try {
      const manifest = await this.loadManifest(), worker = controller ?? this.registration?.active
      if (!worker) { if (revision === this.revision) { if (!controller && !this.state.operation) this.api.setUpdateLocked(false); this.set({ mode: 'checking', label: 'Downloading application files for offline setup…' }) } return }
      const reply = await cacheRequest(worker, manifest, 'STATUS')
      if (revision !== this.revision || controller !== navigator.serviceWorker.controller || this.disposed) return
      if (reply.state === 'mismatch') throw new Error('This page and its controller belong to different versions. Download retained results, close every Remage window, then reopen online.')
      if (reply.state === 'error') throw new Error(reply.message ?? 'The application cache could not be checked.')
      if (!this.state.operation) this.api.setUpdateLocked(Boolean(controller && !reply.complete))
      this.set({ mode: reply.complete ? controller ? 'ready' : 'setup' : 'partial', required: reply.required, cached: reply.cached, canReload: reply.complete && !controller && !this.api.hasSessionWork() && !this.api.getSessionStatus().busy,
        label: reply.complete ? controller ? 'Offline ready for this version. All application and codec files are cached.' : 'Offline setup complete. This first visit is not yet controlled; enable offline use when this session is empty, or close all Remage windows and reopen.' : `Offline files are incomplete (${reply.cached} of ${reply.required}). Reconnect and restore the missing files before processing.` })
    } catch (error) { if (revision === this.revision && !this.disposed) { if (!this.state.operation) this.api.setUpdateLocked(Boolean(controller)); this.set({ mode: controller ? 'blocked' : 'error', canReload: false, label: errorText(error) }) } }
  }
  readonly beforeProcess = async (): Promise<void> => {
    await this.check()
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller && this.state.mode !== 'ready') throw new Error(this.state.label)
  }
  private async operation(action: 'RESTORE' | 'UPDATE'): Promise<void> {
    if (this.api.getSessionStatus().busy || this.state.operation) { this.set({ label: 'Finish or cancel active image, selection or ZIP work before checking updates or restoring application files.' }); return }
    this.api.setUpdateLocked(true); this.set({ operation: true })
    try {
      if (action === 'UPDATE') { if (!this.registration) await this.start(); else await this.registration.update() }
      else { const manifest = await this.loadManifest(), worker = navigator.serviceWorker.controller ?? this.registration?.active; if (!worker) throw new Error('Setup has no active worker yet. Reconnect and retry the version check.'); const reply = await cacheRequest(worker, manifest, 'RESTORE'); if (!reply.complete) throw new Error(reply.message ?? 'Compatible application files could not be restored. Reconnect and retry.'); this.set({ recoveryError: null }) }
    } catch (error) { this.set({ mode: 'error', label: errorText(error), recoveryError: errorText(error) }) }
    finally { this.set({ operation: false }); await this.check() }
  }
  readonly restore = (): Promise<void> => this.operation('RESTORE')
  readonly update = (): Promise<void> => this.operation('UPDATE')
  async enableOffline(clear: boolean): Promise<void> {
    if (this.api.getSessionStatus().busy || this.state.operation) return
    if (clear) await this.api.clearQueue()
    await this.check()
    if (this.state.canReload && !this.api.hasSessionWork() && !this.api.getSessionStatus().busy) window.location.reload()
  }
  async clearForUpdate(): Promise<void> { if (this.api.getSessionStatus().busy || this.state.operation) return; await this.api.clearQueue(); this.set({ label: 'Session discarded by your request. Close every Remage tab and installed window, then reopen to use the waiting update.' }) }
  async install(): Promise<void> {
    const prompt = this.promptEvent; if (!prompt) return
    this.promptEvent = null; this.set({ installAvailable: false })
    try { await prompt.prompt(); await prompt.userChoice } catch { this.set({ label: 'Installation was not offered. Remage remains usable in this browser.' }) }
  }
  dispose(): void { this.disposed = true; this.revision++; this.unsubscribe(); this.listeners.clear(); if ('serviceWorker' in navigator) navigator.serviceWorker.removeEventListener('controllerchange', this.controllerChanged); document.removeEventListener('visibilitychange', this.visible); window.removeEventListener('beforeinstallprompt', this.installPrompt); window.removeEventListener('appinstalled', this.installed) }
}
