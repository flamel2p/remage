import { afterEach, describe, expect, it, vi } from 'vitest'
import { BrowserService } from './browser-service'
import { PwaController } from './pwa'

afterEach(() => vi.unstubAllGlobals())
describe('ordinary browser fallback', () => {
  it('permits processing checks when no ServiceWorker API exists', async () => {
    const target = new EventTarget()
    vi.stubGlobal('window', Object.assign(target, { isSecureContext: false, matchMedia: () => ({ matches: false }) }))
    vi.stubGlobal('document', new EventTarget()); vi.stubGlobal('navigator', {})
    const api = new BrowserService({ storage: null, previews: false }), pwa = new PwaController(api, 'a'.repeat(64), '/')
    await pwa.start(); expect(pwa.getState().mode).toBe('unsupported')
    await expect(pwa.beforeProcess()).resolves.toBeUndefined()
    pwa.dispose(); api.dispose()
  })
  it('removes a prior ready claim synchronously while a fresh STATUS response is pending', async () => {
    vi.stubGlobal('window', Object.assign(new EventTarget(), { isSecureContext: true, matchMedia: () => ({ matches: false }) }))
    vi.stubGlobal('document', new EventTarget())
    const buildId = 'a'.repeat(64), assets = ['index.html', 'assets/image.worker-abcd1234.js', 'assets/zip.worker-abcd1234.js', 'assets/codec.wasm'].map(path => ({ path: '/' + path, sha256: 'b'.repeat(64), bytes: 1, mediaType: 'text/plain' }))
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(assets)))), byte => byte.toString(16).padStart(2, '0')).join('')
    const manifest = { protocol: 1, buildId, base: '/', digest, assets }
    let delayed = false, reply!: () => void
    const worker = { postMessage: (request: { requestId: string }, transfer: MessagePort[]) => {
      reply = () => transfer[0].postMessage({ protocol: 1, requestId: request.requestId, buildId, digest, state: 'complete', complete: true, required: 5, cached: 5, missing: [] })
      if (!delayed) reply()
    } }
    const registration = Object.assign(new EventTarget(), { active: worker, installing: null, waiting: null })
    vi.stubGlobal('navigator', { serviceWorker: Object.assign(new EventTarget(), { controller: worker, register: async () => registration }) })
    vi.stubGlobal('fetch', vi.fn(async (_url: string, options: RequestInit) => {
      if (options.cache === 'no-store') throw new Error('Offline no-store request bypassed the controlling cache.')
      return new Response(JSON.stringify(manifest))
    }))
    const api = new BrowserService({ storage: null, previews: false }), pwa = new PwaController(api, buildId, '/')
    await pwa.start(); expect(pwa.getState().mode).toBe('ready')
    delayed = true; const pending = pwa.check()
    expect(pwa.getState()).toMatchObject({ mode: 'checking', canReload: false })
    await expect(api.addDroppedFiles([])).rejects.toThrow(/update/)
    await Promise.resolve(); reply(); await pending; expect(pwa.getState().mode).toBe('ready')
    pwa.dispose(); api.dispose()
  })
})
