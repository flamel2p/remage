import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import { chromium, firefox, webkit, expect } from '@playwright/test'
import sharp from 'sharp'
import { webTestServer } from './web-test-server.mjs'

// Actual production App, service worker and emitted codec/archive workers.
// Worker delivery instrumentation makes cancellation deterministic; it does not replace codecs.
const temporary = await mkdtemp(join(tmpdir(), 'remage-pwa-')), output = resolve('output/playwright/web-pwa')
await mkdir(output, { recursive: true })
const run = promisify(execFile), sha = bytes => createHash('sha256').update(bytes).digest('hex')
const argumentsList = process.argv.slice(2), recoveryOnly = argumentsList.includes('--recovery-only')
const requestedEngines = argumentsList.filter(argument => argument !== '--recovery-only')
const engines = requestedEngines.length ? requestedEngines : ['chromium', 'firefox', 'webkit']
const launchers = { chromium, firefox, webkit }, evidence = []
const artifacts = new Map(), servers = []
async function artifact(base, tag) {
  const directory = join(temporary, `${base === '/' ? 'root' : 'sub'}-${tag}`)
  await run(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--config', 'vite.web.config.ts', '--outDir', directory, '--emptyOutDir'], { env: { ...process.env, REMAGE_WEB_BASE: base, REMAGE_WEB_QA_TAG: tag }, maxBuffer: 2 * 1024 * 1024 })
  const build = JSON.parse(await readFile(join(directory, 'web-build.json')))
  for (const entry of build.assets) { const bytes = await readFile(join(directory, entry.path.slice(base.length))); assert.equal(bytes.length, entry.bytes); assert.equal(sha(bytes), entry.sha256) }
  assert.equal(sha(JSON.stringify(build.assets)), build.digest)
  assert(build.assets.some(entry => entry.path.includes('image.worker-')) && build.assets.some(entry => entry.path.includes('zip.worker-')) && build.assets.some(entry => entry.path.endsWith('.wasm')))
  assert.equal(build.assets.filter(entry => entry.path.endsWith('.woff2')).length, 4)
  const manifest = JSON.parse(await readFile(join(directory, 'manifest.webmanifest')))
  assert.equal(manifest.scope, base); assert.equal(manifest.start_url, base); assert.equal(manifest.theme_color, '#5B4BDB')
  for (const size of [192, 512]) { const meta = await sharp(join(directory, `icons/remage-${size}.png`)).metadata(); assert.deepEqual([meta.width, meta.height], [size, size]) }
  const all = async directory => (await Promise.all((await readdir(directory, { withFileTypes: true })).map(entry => entry.isDirectory() ? all(join(directory, entry.name)) : [join(directory, entry.name)]))).flat()
  assert.equal((await all(directory)).length, build.assets.length + 2)
  const value = { directory, build, serviceWorkerSha256: sha(await readFile(join(directory, 'sw.js'))) }; artifacts.set(base + tag, value); return value
}
async function instrumentation(context) {
  await context.addInitScript(() => {
    const NativeWorker = window.Worker
    window.__workerEvidence = { created: 0, terminated: 0, active: 0, held: 0, jobs: [] }; window.__holdTransforms = false; window.__holdArchives = false; window.__heldOutputs = []; window.__heldArchives = []
    window.Worker = class extends NativeWorker {
      constructor(url, options) {
        super(url, options); const evidence = window.__workerEvidence; evidence.created++; evidence.active++
        let stopped = false, callback = null, kind = null
        Object.defineProperty(this, 'onmessage', { get: () => callback, set: value => { callback = value } })
        this.addEventListener('message', event => {
          const deliver = () => callback?.(event)
          if (window.__holdTransforms && kind === 'transform' && event.data.type === 'complete') { window.__heldOutputs.push(deliver); evidence.held++ }
          else if (window.__holdArchives && kind === 'archive' && event.data.type === 'complete') window.__heldArchives.push(deliver)
          else deliver()
        })
        const send = this.postMessage.bind(this), terminate = this.terminate.bind(this)
        this.postMessage = (value, transfer) => { kind = value.kind ?? value.type; evidence.jobs.push({ type: value.type, kind: value.kind }); send(value, transfer) }
        this.terminate = () => { if (!stopped) { evidence.terminated++; evidence.active--; stopped = true } terminate() }
      }
    }
  })
}
async function browserFallback(browser, server, engine) {
  const context = await browser.newContext({ acceptDownloads: true })
  try {
    await context.addInitScript(() => { const original = navigator; Object.defineProperty(window, 'navigator', { value: new Proxy(original, { has: (target, key) => key !== 'serviceWorker' && Reflect.has(target, key), get: (target, key) => { if (key === 'serviceWorker') return undefined; const value = Reflect.get(target, key, target); return typeof value === 'function' ? value.bind(target) : value } }) }) })
    const page = await context.newPage(); await page.goto(server.origin + server.base)
    await expect(page.locator('[data-pwa-state]')).toHaveAttribute('data-pwa-state', 'unsupported')
    await page.getByRole('checkbox', { name: 'Preserve metadata', exact: true }).uncheck(); await page.getByRole('button', { name: 'PNG', exact: true }).click()
    await page.locator('input[type=file]').setInputFiles('test-fixtures/images/rgb.png'); await page.getByRole('button', { name: 'Convert images', exact: true }).click()
    await expect(page.locator('.result-row')).toHaveCount(1, { timeout: 60_000 })
    const result = await download(page, page.locator('.result-row').getByRole('button', { name: 'Download', exact: true }), engine + '-fallback.png')
    assert.equal((await sharp(result.bytes).metadata()).format, 'png')
    return 'actual-App-and-codec-with-synthetic-ServiceWorker-capability-disabled'
  } finally { await context.close() }
}
async function ready(page, url) {
  await page.goto(url); await page.getByRole('button', { name: 'Choose images', exact: true }).waitFor()
  await expect(page.locator('[data-pwa-state]')).toHaveAttribute('data-pwa-state', 'setup', { timeout: 60_000 })
  assert.equal(await page.evaluate(() => navigator.serviceWorker.controller), null)
  await page.getByRole('button', { name: 'Enable offline use', exact: true }).click()
  await expect(page.locator('[data-pwa-state]')).toHaveAttribute('data-pwa-state', 'ready', { timeout: 60_000 })
}
async function clear(page) {
  if (!await page.getByRole('button', { name: 'Clear session', exact: true }).count()) return
  await page.getByRole('button', { name: 'Clear session', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Clear session', exact: true }).click()
  await expect(page.locator('.queue-row')).toHaveCount(0)
}
async function download(page, button, name) {
  const event = page.waitForEvent('download'); await button.click(); const file = await event
  const path = join(temporary, name); await file.saveAs(path); assert.equal(await file.failure(), null)
  return { bytes: await readFile(path), path, suggestedName: file.suggestedFilename() }
}
async function cacheSnapshot(page) {
  return page.evaluate(async () => { const output = []; for (const name of await caches.keys()) { const cache = await caches.open(name); const records = []; for (const request of await cache.keys()) { const bytes = await (await cache.match(request)).arrayBuffer(), hash = await crypto.subtle.digest('SHA-256', bytes); records.push({ url: request.url, bytes: bytes.byteLength, sha256: Array.from(new Uint8Array(hash), value => value.toString(16).padStart(2, '0')).join('') }) } output.push({ name, records }) } return output })
}
async function evict(page, build, paths) {
  return page.evaluate(async ({ build, paths }) => { const name = 'remage-app:' + build.base + ':' + build.buildId + ':' + build.digest, cache = await caches.open(name); for (const path of paths) await cache.delete(location.origin + path) }, { build, paths })
}
async function networkOffline(context, server, engine, offline) {
  // WebKit's automation offline override rejects even SW-created responses.
  // Drop every origin connection instead; a fresh no-SW browser is the negative control.
  if (engine === 'webkit') server.setDisconnected(offline)
  else await context.setOffline(offline)
}
async function matrix(page, context, engine, build, server) {
  const inputs = await Promise.all(['rgba-hidden-rgb.png', 'baseline.jpg', 'lossless.webp'].map(name => readFile(join('test-fixtures/images', name))))
  const formats = ['png', 'jpeg', 'webp'], results = []
  await networkOffline(context, server, engine, true)
  if (engine === 'webkit') {
    const negative = await context.browser().newContext({ serviceWorkers: 'block' })
    try { const uncached = await negative.newPage(); await assert.rejects(uncached.goto(server.origin + server.base), /Load failed|ERR|Could not|connection|socket|network/i) }
    finally { await negative.close() }
  }
  await page.reload(); await expect(page.locator('[data-pwa-state]')).toHaveAttribute('data-pwa-state', 'ready')
  assert.equal(await page.getByRole('checkbox', { name: 'Preserve metadata', exact: true }).isChecked(), true)
  assert.equal(await page.locator('.format-options [aria-pressed=true]').count(), 0)
  await page.getByRole('checkbox', { name: 'Preserve metadata', exact: true }).uncheck()
  await page.locator('input[type=file]').setInputFiles(inputs.map((buffer, index) => ({ name: index === 0 ? '../../CANARY-private-圖像.png' : `CANARY-private-圖像.${index === 1 ? 'jpg' : 'webp'}`, mimeType: 'application/octet-stream', buffer })))
  await expect(page.locator('.queue-section .queue-row')).toHaveCount(3)
  await expect(page.locator('.queue-section .queue-row [data-slot=badge]').filter({ hasText: 'Ready' })).toHaveCount(3)
  for (const format of formats) {
    if (results.length) for (let index = 0; index < 3; index++) await page.locator('.result-row').nth(index).getByRole('button', { name: 'Requeue', exact: true }).click()
    await page.getByRole('button', { name: format === 'jpeg' ? 'JPEG' : format.toUpperCase(), exact: true }).click()
    if (format === 'jpeg') await page.getByRole('checkbox', { name: 'I understand JPEG re-encoding is lossy' }).check()
    await page.getByRole('button', { name: 'Convert images', exact: true }).click()
    const previous = results.length; await expect(page.locator('.result-row')).toHaveCount(previous + 3, { timeout: 60_000 })
    for (let index = 0; index < 3; index++) {
      const result = await download(page, page.locator('.result-row').nth(previous + index).getByRole('button', { name: 'Download', exact: true }), `${engine}-matrix-${previous + index}.${format}`)
      const actual = await sharp(result.bytes).metadata(), original = await sharp(inputs[index]).metadata()
      assert.equal(actual.format, format); assert.deepEqual([actual.width, actual.height], [original.width, original.height]); assert.equal(actual.orientation, undefined)
      if (format === 'jpeg') assert.equal(actual.hasAlpha, false)
      else {
        const decoded = await sharp(result.bytes).ensureAlpha().raw().toBuffer(), expected = await sharp(inputs[index]).ensureAlpha().raw().toBuffer()
        if (index === 1) assert(Math.max(...decoded.map((value, at) => Math.abs(value - expected[at]))) <= 4, 'Independent JPEG decode agreement')
        else assert.deepEqual(decoded, expected, 'Lossless samples including hidden transparent RGB')
      }
      assert.equal(/[\\/]/.test(result.suggestedName), false); assert(!['.', '..'].includes(result.suggestedName)); results.push(result)
    }
  }
  await page.getByRole('checkbox', { name: 'Select all eligible results' }).check(); await page.getByRole('button', { name: 'Prepare ZIP', exact: true }).click()
  await page.getByRole('button', { name: 'Download ZIP', exact: true }).waitFor()
  const archive = await download(page, page.getByRole('button', { name: 'Download ZIP', exact: true }), `${engine}-matrix.zip`)
  const unzipOptions = { env: { ...process.env, ...(process.platform === 'darwin' ? { LC_ALL: 'en_US.UTF-8', LANG: 'en_US.UTF-8' } : {}) } }
  await run('unzip', ['-t', archive.path], unzipOptions)
  const extracted = join(temporary, `${engine}-unzip`); await mkdir(extracted)
  // Apple's older Info-ZIP converts UTF-8 names incorrectly; libarchive extracts them faithfully.
  await run(process.platform === 'darwin' ? 'bsdtar' : 'unzip', process.platform === 'darwin' ? ['-xf', archive.path, '-C', extracted] : ['-q', archive.path, '-d', extracted], unzipOptions)
  const entries = await readdir(extracted); assert.equal(entries.length, 9)
  assert(entries.every(name => name.includes('圖像')))
  const actualHashes = await Promise.all(entries.map(async name => sha(await readFile(join(extracted, name)))))
  assert.deepEqual(actualHashes.sort(), results.map(result => sha(result.bytes)).sort())
  assert.equal(await page.getByText('Download requested; saving is managed by your browser.', { exact: true }).count(), 9)
  const cached = await cacheSnapshot(page); assert(!JSON.stringify(cached).includes('CANARY')); assert(cached.every(cache => cache.records.every(record => !record.url.startsWith('blob:'))))
  const origin = new URL(page.url()).origin, allowed = new Map(build.assets.map(asset => [origin + asset.path, asset]))
  allowed.set(origin + build.base + 'web-build.json', { bytes: Buffer.byteLength(JSON.stringify(build)), sha256: sha(JSON.stringify(build)) })
  for (const cache of cached) for (const record of cache.records) {
    if (record.url === origin + build.base + '__remage_complete__') { assert.equal(record.sha256, sha(JSON.stringify({ protocol: 1, buildId: build.buildId, digest: build.digest }))); continue }
    const expected = allowed.get(record.url); assert(expected, 'Application cache contains only exact inventoried assets')
    assert.equal(record.bytes, expected.bytes); assert.equal(record.sha256, expected.sha256)
  }
  const storage = await page.evaluate(async () => ({ local: Object.fromEntries(Object.keys(localStorage).map(key => [key, localStorage.getItem(key)])), session: Object.fromEntries(Object.keys(sessionStorage).map(key => [key, sessionStorage.getItem(key)])), databases: typeof indexedDB.databases === 'function' ? await indexedDB.databases() : 'inspection-unsupported' }))
  assert(!JSON.stringify(storage).match(/CANARY|sourceName|filename|resultId|handle|outputDirectory/))
  assert.deepEqual(storage.session, {}); if (Array.isArray(storage.databases)) assert.deepEqual(storage.databases, [])
  await networkOffline(context, server, engine, false)
  return { offlineMode: engine === 'webkit' ? 'all-origin-sockets-dropped; fresh-no-ServiceWorker-negative-control-fails' : 'Playwright-BrowserContext-offline', transforms: 9, verifiedIndividualDownloads: 9, verifiedZipEntries: 9, privacyCaches: cached.length, cacheAllowlistAndAssetHashes: true, settingsOnlyStorage: true, sessionStorageEmpty: true, indexedDB: Array.isArray(storage.databases) ? 'fresh-context-empty' : storage.databases }
}
async function metadataAndCycles(page, engine) {
  await clear(page)
  await page.getByRole('checkbox', { name: 'Preserve metadata', exact: true }).check()
  await page.locator('input[type=file]').setInputFiles(['test-fixtures/images/metadata.png', 'test-fixtures/images/icc.png'])
  await expect(page.locator('.queue-section .queue-row [data-slot=badge]').filter({ hasText: 'Error' })).toHaveCount(1)
  await page.getByRole('button', { name: 'PNG', exact: true }).click(); await page.getByRole('button', { name: 'Convert images', exact: true }).click()
  await page.getByText('Metadata preservation is unavailable for this source. Explicitly disable it for this transformation, or use the desktop edition.', { exact: true }).first().waitFor()
  assert.equal(await page.locator('.result-row').count(), 0)
  await clear(page); await page.getByRole('checkbox', { name: 'Preserve metadata', exact: true }).uncheck()
  await page.locator('input[type=file]').setInputFiles('test-fixtures/images/oriented.jpg')
  await page.getByRole('button', { name: 'Convert images', exact: true }).click(); await expect(page.locator('.result-row')).toHaveCount(1, { timeout: 60_000 })
  const oriented = await download(page, page.locator('.result-row').getByRole('button', { name: 'Download', exact: true }), `${engine}-oriented.png`)
  const orientedMeta = await sharp(oriented.bytes).metadata(); assert.deepEqual([orientedMeta.width, orientedMeta.height], [48, 64]); assert.equal(orientedMeta.orientation, undefined)
  await clear(page)
  const transparent = await sharp({ create: { width: 8, height: 8, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer()
  await page.locator('input[type=file]').setInputFiles({ name: 'alpha.png', mimeType: 'image/png', buffer: transparent }); await page.getByRole('button', { name: 'JPEG', exact: true }).click()
  await page.getByRole('checkbox', { name: 'I understand JPEG re-encoding is lossy' }).uncheck(); await expect(page.getByRole('button', { name: 'Convert images', exact: true })).toBeDisabled()
  await page.getByRole('checkbox', { name: 'I understand JPEG re-encoding is lossy' }).check(); await page.getByLabel('JPEG background color').fill('#e05020')
  await page.getByRole('button', { name: 'Convert images', exact: true }).click(); await expect(page.locator('.result-row')).toHaveCount(1, { timeout: 60_000 })
  const alpha = await download(page, page.locator('.result-row').getByRole('button', { name: 'Download', exact: true }), `${engine}-alpha.jpg`), raw = await sharp(alpha.bytes).raw().toBuffer()
  assert([224, 80, 32].every((value, at) => Math.abs(raw[at] - value) <= 3))
  await clear(page); await page.getByRole('button', { name: 'PNG', exact: true }).click()
  for (let cycle = 0; cycle < 20; cycle++) {
    const cancelled = cycle % 4 === 0
    await page.evaluate(hold => { window.__holdTransforms = hold; window.__heldOutputs = [] }, cancelled)
    await page.locator('input[type=file]').setInputFiles(['test-fixtures/images/rgb.png', 'test-fixtures/images/unsupported.gif'])
    await expect(page.locator('.queue-section .queue-row [data-slot=badge]').filter({ hasText: 'Ready' })).toHaveCount(1)
    await page.getByRole('button', { name: 'Convert images', exact: true }).click()
    if (cancelled) {
      await page.waitForFunction(() => window.__heldOutputs.length > 0, { timeout: 60_000 })
      await page.getByRole('button', { name: 'Cancel batch', exact: true }).click()
      await page.evaluate(() => { window.__holdTransforms = false; window.__heldOutputs.splice(0).forEach(deliver => deliver()) })
      await expect(page.locator('.queue-section .queue-row [data-slot=badge]').filter({ hasText: 'Cancelled' })).toHaveCount(1)
      assert.equal(await page.locator('.result-row').count(), 0)
    } else await expect(page.locator('.result-row')).toHaveCount(1, { timeout: 60_000 })
    await clear(page)
    assert.equal(await page.evaluate(() => window.__workerEvidence.active), 0)
  }
  return { optionalMetadataDefaultBlocked: true, iccRejected: true, visibleOrientation: [48, 64], jpegAcknowledgementAndBackground: true, mixedCycles: 20, activeCancellations: 5, workerEvidence: await page.evaluate(() => ({ created: window.__workerEvidence.created, terminated: window.__workerEvidence.terminated, active: window.__workerEvidence.active })) }
}
async function stability(page, server, build, engine) {
  await clear(page); await page.getByRole('button', { name: 'PNG', exact: true }).click(); await page.getByRole('checkbox', { name: 'Preserve metadata', exact: true }).uncheck()
  await page.evaluate(() => { window.__holdTransforms = true; window.__heldOutputs = [] })
  await page.locator('input[type=file]').setInputFiles('test-fixtures/images/rgb.png'); await page.getByRole('button', { name: 'Convert images', exact: true }).click()
  await page.waitForFunction(() => window.__heldOutputs.length > 0, { timeout: 60_000 })
  await page.getByRole('button', { name: 'WEBP', exact: true }).click(); await page.getByRole('checkbox', { name: 'Resize images', exact: true }).check(); await page.getByLabel('Width (px)').fill('16')
  await page.evaluate(() => { window.__holdTransforms = false; window.__heldOutputs.splice(0).forEach(deliver => deliver()) })
  await expect(page.locator('.result-row')).toHaveCount(1)
  const captured = await download(page, page.locator('.result-row').getByRole('button', { name: 'Download', exact: true }), engine + '-captured.png'), capturedMeta = await sharp(captured.bytes).metadata()
  assert.deepEqual([capturedMeta.format, capturedMeta.width, capturedMeta.height], ['png', 64, 48])
  await page.getByRole('checkbox', { name: 'Resize images', exact: true }).uncheck(); await page.getByRole('button', { name: 'PNG', exact: true }).click()
  await page.locator('.result-row').getByRole('button', { name: 'Requeue', exact: true }).click(); await page.evaluate(() => { window.__holdTransforms = true; window.__heldOutputs = [] })
  const started = Date.now(); await page.getByRole('button', { name: 'Convert images', exact: true }).click(); await page.waitForFunction(() => window.__heldOutputs.length > 0, { timeout: 60_000 })
  console.log(JSON.stringify({ engine, phase: 'production-60-second-transform-timeout' }))
  await page.getByText('Processing exceeded 60 seconds. Retry a smaller image or use the desktop edition.', { exact: true }).waitFor({ timeout: 70_000 })
  const timeoutMs = Date.now() - started; assert(timeoutMs >= 59_000)
  await page.evaluate(() => { window.__holdTransforms = false; window.__heldOutputs.splice(0).forEach(deliver => deliver()) }); assert.equal(await page.locator('.result-row').count(), 1)
  await page.locator('.result-row').getByRole('button', { name: 'Requeue', exact: true }).click(); await page.getByRole('button', { name: 'Convert images', exact: true }).click(); await expect(page.locator('.result-row')).toHaveCount(2, { timeout: 60_000 })
  await page.getByRole('checkbox', { name: 'Select all eligible results' }).check(); await page.evaluate(() => { window.__holdArchives = true; window.__heldArchives = [] })
  await page.getByRole('button', { name: 'Prepare ZIP', exact: true }).click(); await page.waitForFunction(() => window.__heldArchives.length > 0)
  await page.getByRole('button', { name: 'Cancel ZIP', exact: true }).click(); await page.evaluate(() => { window.__holdArchives = false; window.__heldArchives.splice(0).forEach(deliver => deliver()) }); assert.equal(await page.locator('.result-row').count(), 2)
  const archivePath = build.assets.find(asset => /zip\.worker-/.test(asset.path)).path
  await evict(page, build, [archivePath]); server.faults.set(archivePath, 'unavailable')
  await page.getByRole('button', { name: 'Prepare ZIP', exact: true }).click(); await page.getByText('The ZIP Worker stopped. Retry a smaller selection.', { exact: true }).first().waitFor({ timeout: 30_000 }); assert.equal(await page.locator('.result-row').count(), 2)
  server.faults.delete(archivePath); await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await expect(page.locator('[data-pwa-state]')).toHaveAttribute('data-pwa-state', 'partial')
  await page.getByRole('button', { name: 'Restore offline files', exact: true }).click(); await expect(page.locator('[data-pwa-state]')).toHaveAttribute('data-pwa-state', 'ready')
  await page.getByRole('button', { name: 'Prepare ZIP', exact: true }).click(); await page.getByRole('button', { name: 'Download ZIP', exact: true }).waitFor()
  const archive = await download(page, page.getByRole('button', { name: 'Download ZIP', exact: true }), engine + '-retry.zip'); await run('unzip', ['-t', archive.path])
  await page.locator('.result-row').first().getByRole('button', { name: 'Requeue', exact: true }).click(); await page.evaluate(() => { window.__holdTransforms = true; window.__heldOutputs = [] }); await page.getByRole('button', { name: 'Convert images', exact: true }).click(); await page.waitForFunction(() => window.__heldOutputs.length > 0)
  await page.evaluate(() => { window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })); window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })); window.__holdTransforms = false; window.__heldOutputs.splice(0).forEach(deliver => deliver()) })
  await expect(page.locator('[data-pwa-state]')).toHaveAttribute('data-pwa-state', 'ready'); assert.equal(await page.locator('.result-row').count(), 2)
  const retained = await download(page, page.getByRole('button', { name: 'Download ZIP', exact: true }), engine + '-retained.zip'); assert.equal(sha(retained.bytes), sha(archive.bytes)); assert.equal(await page.evaluate(() => window.__workerEvidence.active), 0)
  await clear(page)
  return { submittedSettingsCaptured: ['png', 64, 48], productionTransformTimeoutMs: timeoutMs, timeoutRetry: true, archiveCancelLateDeliveryIgnored: true, archiveActualWorkerNetworkFailureRetry: true, simulatedPersistedPageTransitionRetainsResultsAndPreparedZip: true }
}
async function recoveryAndUpdates(page, context, server, first, second, engine) {
  const phase = value => console.log(JSON.stringify({ engine, base: server.base, phase: value }))
  const build = first.build, wasm = build.assets.find(asset => asset.path.endsWith('.wasm')).path, font = build.assets.find(asset => asset.path.endsWith('.woff2')).path, worker = build.assets.find(asset => /image\.worker-/.test(asset.path)).path, css = build.assets.find(asset => asset.path.endsWith('.css')).path
  for (const [path, fault] of [[wasm, 'corrupt'], [font, 'redirect'], [worker, 'html'], [css, 'mime']]) {
    phase('restore-' + fault)
    await evict(page, build, [path]); await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
    await expect(page.locator('[data-pwa-state]')).toHaveAttribute('data-pwa-state', 'partial')
    server.faults.set(path, fault); await page.getByRole('button', { name: 'Restore offline files', exact: true }).click()
    await page.locator('.pwa-panel [role=alert]').waitFor({ timeout: 30_000 }); await expect(page.locator('[data-pwa-state]')).not.toHaveAttribute('data-pwa-state', 'ready')
    server.faults.delete(path); await page.getByRole('button', { name: 'Restore offline files', exact: true }).click()
    await expect(page.locator('[data-pwa-state]')).toHaveAttribute('data-pwa-state', 'ready', { timeout: 60_000 })
  }
  const entryJs = build.assets.find(asset => /\/assets\/index-.*\.js$/.test(asset.path)).path
  phase('selective-entry-navigation')
  await evict(page, build, [entryJs]); const repaired = await page.reload(); assert.equal(repaired.status(), 200)
  await expect(page.locator('[data-pwa-state]')).toHaveAttribute('data-pwa-state', 'ready', { timeout: 60_000 })
  assert.equal(await page.locator('[data-build-id]').getAttribute('data-build-id'), build.buildId)
  await page.getByRole('checkbox', { name: 'Preserve metadata', exact: true }).uncheck(); await page.getByRole('button', { name: 'PNG', exact: true }).click()
  // Retain a compatible source before publishing, so asynchronous update checks
  // cannot race a new file-picker admission during the failed-install scenario.
  await page.locator('input[type=file]').setInputFiles('test-fixtures/images/rgb.png')
  await expect(page.locator('.queue-section .queue-row [data-slot=badge]').filter({ hasText: 'Ready' })).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Check for update', exact: true })).toBeEnabled()
  const oldCache = (await cacheSnapshot(page))[0].name
  const another = await context.newPage(); await another.goto(server.origin + server.base); await expect(another.locator('[data-pwa-state]')).toHaveAttribute('data-pwa-state', 'ready')
  let frozenSession
  if (engine === 'chromium') { frozenSession = await context.newCDPSession(another); await frozenSession.send('Page.setWebLifecycleState', { state: 'frozen' }) }
  server.publish(second.directory)
  phase('failed-new-precache')
  const newIndexJs = second.build.assets.find(asset => /\/assets\/index-.*\.js$/.test(asset.path)).path
  server.faults.set(newIndexJs, 'corrupt'); await page.getByRole('button', { name: 'Check for update', exact: true }).click()
  await expect.poll(() => server.requests.some(request => request.path === newIndexJs), { timeout: 30_000 }).toBe(true)
  await page.getByText('New application setup did not complete. Existing validated files remain available; reconnect and check again.', { exact: true }).waitFor({ timeout: 30_000 })
  await expect.poll(async () => page.evaluate(async () => { const reg = await navigator.serviceWorker.getRegistration(); return !reg.installing }), { timeout: 30_000 }).toBe(true)
  assert.equal(await page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration()).waiting)), false)
  assert((await page.evaluate(() => caches.keys())).includes(oldCache))
  await expect.poll(async () => (await page.evaluate(() => caches.keys())).includes('remage-app:' + second.build.base + ':' + second.build.buildId + ':' + second.build.digest), { timeout: 30_000 }).toBe(false)
  assert(server.requests.some(request => request.path === newIndexJs), 'Failed new install actually reached the faulting server asset')
  await expect(page.locator('[data-pwa-state]')).toHaveAttribute('data-pwa-state', 'ready', { timeout: 60_000 })
  await expect(page.getByRole('button', { name: 'Check for update', exact: true })).toBeEnabled()
  await page.evaluate(() => { window.__holdTransforms = true; window.__heldOutputs = [] })
  await expect(page.locator('.queue-section .queue-row [data-slot=badge]').filter({ hasText: 'Ready' })).toHaveCount(1)
  await page.getByRole('button', { name: 'Convert images', exact: true }).click()
  phase('busy-waiting-update')
  await page.waitForFunction(() => window.__heldOutputs.length > 0, { timeout: 60_000 }); await expect(page.getByRole('button', { name: 'Check for update', exact: true })).toBeDisabled()
  server.faults.delete(newIndexJs)
  // Normal browser update discovery may run independently of an explicitly deferred UI check.
  await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration()).update() })
  await page.locator('[data-pwa-waiting=true]').waitFor({ timeout: 60_000 })
  assert.equal(await page.locator('[data-build-id]').getAttribute('data-build-id'), build.buildId)
  await page.evaluate(() => { window.__holdTransforms = false; window.__heldOutputs.splice(0).forEach(deliver => deliver()) })
  await expect(page.locator('.result-row')).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Clear session for update', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Clear session for update', exact: true }).click(); await page.getByRole('button', { name: 'Keep session', exact: true }).click()
  assert.equal(await page.locator('.result-row').count(), 1)
  await page.getByRole('button', { name: 'Clear session for update', exact: true }).click(); await page.getByRole('button', { name: 'Discard session', exact: true }).click(); await expect(page.locator('.result-row')).toHaveCount(0)
  const controllerBuild = await page.locator('[data-build-id]').getAttribute('data-build-id'); assert.equal(controllerBuild, build.buildId)
  // Even a full shell eviction cannot silently serve stable N+1 HTML under N.
  await page.evaluate(async () => { for (const name of await caches.keys()) if (name.startsWith('remage-app:')) await caches.delete(name) })
  phase('whole-cache-eviction')
  const navigation = await page.reload(); assert.equal(navigation.status(), 503); await page.getByRole('heading', { name: 'Reconnect to recover Remage' }).waitFor()
  assert.equal(await page.locator('script').count(), 0)
  if (frozenSession) { await frozenSession.send('Page.setWebLifecycleState', { state: 'active' }); await frozenSession.detach() }
  await another.close(); await page.close()
  // Model closing windows and later reopening, allowing normal asynchronous client release.
  await new Promise(resolve => setTimeout(resolve, 1000))
  const reopened = await context.newPage(); await reopened.goto(server.origin + server.base)
  phase('normal-close-all-activation')
  await expect(reopened.locator('[data-build-id]')).toHaveAttribute('data-build-id', second.build.buildId, { timeout: 60_000 })
  await expect(reopened.locator('[data-pwa-state]')).toHaveAttribute('data-pwa-state', 'ready', { timeout: 60_000 })
  // Republish the complete prior artifact and follow the ordinary waiting lifecycle for rollback.
  server.publish(first.directory); await reopened.getByRole('button', { name: 'Check for update', exact: true }).click(); await reopened.locator('[data-pwa-waiting=true]').waitFor({ timeout: 60_000 })
  phase('rollback')
  await reopened.close(); await new Promise(resolve => setTimeout(resolve, 1000)); const rolledBack = await context.newPage(); await rolledBack.goto(server.origin + server.base)
  await expect(rolledBack.locator('[data-build-id]')).toHaveAttribute('data-build-id', build.buildId, { timeout: 60_000 })
  await expect(rolledBack.locator('[data-pwa-state]')).toHaveAttribute('data-pwa-state', 'ready', { timeout: 60_000 }); await networkOffline(context, server, engine, true); await rolledBack.reload(); await expect(rolledBack.locator('[data-pwa-state]')).toHaveAttribute('data-pwa-state', 'ready'); await networkOffline(context, server, engine, false)
  return { page: rolledBack, facts: { selectiveEvictionRestoration: 4, corruptionRedirectHtmlMimeRestorationRejected: 4, selectiveEntryJsNavigationRepair: true, failedNewPrecachePreservesOld: true, multipleClients: 2, chromiumFrozenClient: Boolean(frozenSession), waitingDuringActiveTransform: true, explicitDiscardOnly: true, wholeShellEvictionRecovery503: true, closeAllActivation: true, coherentRollbackAndOfflineReload: true } }
}
try {
  for (const base of ['/', '/remage/']) { await artifact(base, 'a'); await artifact(base, 'b') }
  for (const engine of engines) {
    assert(launchers[engine], `Unknown engine ${engine}`)
    const browser = await launchers[engine].launch({ headless: true })
    try {
      for (const base of ['/', '/remage/']) {
        const first = artifacts.get(base + 'a'), second = artifacts.get(base + 'b'), server = await webTestServer(first.directory, base); servers.push(server)
        const context = await browser.newContext({ acceptDownloads: true }), page = await context.newPage(), errors = []
        await instrumentation(context); context.on('page', next => { next.on('pageerror', error => errors.push(error.message)); next.on('dialog', dialog => void dialog.accept()) }); page.on('pageerror', error => errors.push(error.message)); page.on('dialog', dialog => void dialog.accept())
        console.log(JSON.stringify({ engine, base, phase: 'first-install', buildId: first.build.buildId, digest: first.build.digest }))
        try {
          const fallback = base === '/' && !recoveryOnly ? await browserFallback(browser, server, engine) : undefined
          await ready(page, server.origin + base)
          let flows = {}, cycles = {}, stabilityEvidence = {}
          if (base === '/' && !recoveryOnly) { console.log(JSON.stringify({ engine, base, phase: 'offline-matrix' })); flows = await matrix(page, context, engine, first.build, server); cycles = await metadataAndCycles(page, engine); stabilityEvidence = await stability(page, server, first.build, engine) }
          const recovery = await recoveryAndUpdates(page, context, server, first, second, engine)
          assert.deepEqual(errors, []); assert(server.requests.every(request => request.method === 'GET' && !request.query && !request.path.includes('CANARY')))
          assert.equal(await recovery.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
          await recovery.page.screenshot({ path: join(output, `${engine}-${base === '/' ? 'root' : 'sub'}-rollback.png`), fullPage: true })
          const record = { verificationScope: recoveryOnly ? 'recovery-only' : 'full', engine, version: browser.version(), base, buildId: first.build.buildId, digest: first.build.digest, serviceWorkerSha256: first.serviceWorkerSha256, nextBuildId: second.build.buildId, nextDigest: second.build.digest, nextServiceWorkerSha256: second.serviceWorkerSha256, assets: first.build.assets.length, wasmSha256: first.build.assets.find(asset => asset.path.endsWith('.wasm')).sha256, headers: 'candidate-CSP-wasm-unsafe-eval; nosniff; no-referrer; restricted-Permissions-Policy; HTTP-no-store', offlineMode: engine === 'webkit' ? 'all-origin-sockets-dropped' : 'Playwright-BrowserContext-offline', fallback, ...flows, ...cycles, ...stabilityEvidence, ...recovery.facts, requests: server.requests.length, pageErrors: errors }
          evidence.push(record); console.log(JSON.stringify(record)); await writeFile(join(output, recoveryOnly ? 'recovery-evidence.json' : 'evidence.json'), JSON.stringify(evidence, null, 2))
        } catch (error) {
          const clients = await Promise.all(context.pages().map(async client => ({ url: client.url(), setup: await client.locator('[data-pwa-state]').textContent().catch(() => null), rows: await client.locator('.queue-row').allTextContents().catch(() => []), heading: await client.locator('h1').allTextContents().catch(() => []), registration: await client.evaluate(async () => { const reg = await navigator.serviceWorker?.getRegistration(); return { active: reg?.active?.state, waiting: reg?.waiting?.state, installing: reg?.installing?.state, controller: navigator.serviceWorker?.controller?.state, caches: await caches.keys() } }).catch(() => null) })))
          await writeFile(join(output, `${engine}-${base === '/' ? 'root' : 'sub'}-failure.json`), JSON.stringify({ error: String(error), clients, serverRequests: server.requests, faults: [...server.faults], nextBuildId: second.build.buildId }, null, 2))
          throw error
        } finally { await context.close(); await server.close(); servers.splice(servers.indexOf(server), 1) }
      }
    } finally { await browser.close() }
  }
} finally { await Promise.all(servers.map(server => server.close())); await rm(temporary, { recursive: true, force: true }) }
