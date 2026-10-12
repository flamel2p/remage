import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile, readdir, rm } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { chromium, firefox, webkit } from '@playwright/test'
import sharp from 'sharp'

// This harness exercises emitted production Workers/WASM and browser download
// bytes. It deliberately does not claim shared UI, PWA or deployed verification.
const directory = resolve('dist/web'), assets = await readdir(resolve(directory, 'assets'))
const imageWorker = '/assets/' + assets.find((name) => /^image\.worker-.*\.js$/.test(name))
const zipWorker = '/assets/' + assets.find((name) => /^zip\.worker-.*\.js$/.test(name))
assert(!imageWorker.endsWith('undefined') && !zipWorker.endsWith('undefined'), 'Build the web artifact first.')
const types = { '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.html': 'text/html' }
const server = createServer(async (request, response) => {
  try {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname
    if (path === '/core-harness.html') {
      response.setHeader('Content-Type', 'text/html')
      response.end('<!doctype html><html lang="en"><title>Remage emitted Worker test</title><button id="download">Download verified result</button><script>document.querySelector("button").addEventListener("click",()=>{const a=document.createElement("a");a.href=URL.createObjectURL(window.downloadBlob);a.download=window.downloadName;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),60000)})</script>')
      return
    }
    const target = resolve(directory, '.' + path)
    if (!target.startsWith(directory + sep)) { response.writeHead(403).end(); return }
    response.setHeader('Content-Type', types[extname(target)] ?? 'application/octet-stream')
    response.end(await readFile(target))
  } catch { response.writeHead(404).end() }
})
await new Promise((resolveReady, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolveReady) })
const base = `http://127.0.0.1:${server.address().port}`
const source = new Uint8Array(await readFile('test-fixtures/images/rgba-hidden-rgb.png'))
const oriented = new Uint8Array(await readFile('test-fixtures/images/oriented.jpg'))
const independent = await sharp(source).ensureAlpha().raw().toBuffer()
const engines = process.argv.slice(2).length ? process.argv.slice(2) : ['chromium', 'firefox', 'webkit']
const tools = { chromium, firefox, webkit }
const outputPaths = []
try {
  for (const engine of engines) {
    assert(tools[engine], `Unknown browser engine ${engine}`)
    const browser = await tools[engine].launch({ headless: true })
    try {
      const context = await browser.newContext({ acceptDownloads: true }), page = await context.newPage(), requests = [], errors = []
      page.on('request', (request) => requests.push({ method: request.method(), url: request.url() }))
      page.on('pageerror', (error) => errors.push(error.message))
      await page.goto(base + '/core-harness.html')
      const runImage = async (input, format, resize = null) => page.evaluate(async ({ input, format, resize, imageWorker }) => {
        const worker = new Worker(imageWorker, { type: 'module' }), bytes = new Uint8Array(input)
        const settings = { mode: 'converter', outputFormat: format, preserveMetadata: false, resize: resize ?? { enabled: false, width: null, height: null, lockAspectRatio: true, allowEnlargement: false }, jpegBackground: '#E05020', jpegLossAcknowledged: format === 'jpeg', outputDirectory: null }
        return new Promise((resolveOutput, reject) => {
          const timer = setTimeout(() => { worker.terminate(); reject(new Error('Emitted Worker timed out')) }, 60_000)
          const end = () => { clearTimeout(timer); worker.terminate() }
          worker.onerror = (event) => { end(); reject(new Error(event.message)) }
          worker.onmessage = (event) => {
            end()
            if (event.data.type === 'error') { reject(new Error(event.data.message)); return }
            resolveOutput({ ...event.data, bytes: Array.from(new Uint8Array(event.data.bytes)), thumbnail: Array.from(new Uint8Array(event.data.thumbnail)) })
          }
          worker.postMessage({ version: 1, type: 'image', kind: 'transform', jobId: crypto.randomUUID(), batchId: crypto.randomUUID(), sourceId: crypto.randomUUID(), bytes: bytes.buffer, settings, retainedBytes: bytes.length, maxOutputBytes: 50 * 1024 * 1024 }, [bytes.buffer])
        })
      }, { input: Array.from(input), format, resize, imageWorker })
      const results = []
      for (const format of ['png', 'jpeg', 'webp']) {
        const result = await runImage(source, format), bytes = new Uint8Array(result.bytes), metadata = await sharp(bytes).metadata()
        assert.equal(metadata.format, format); assert.deepEqual([metadata.width, metadata.height], [64, 48])
        if (format !== 'jpeg') assert.deepEqual(await sharp(bytes).ensureAlpha().raw().toBuffer(), independent)
        else assert.equal(metadata.hasAlpha, false)
        results.push({ name: format === 'jpeg' ? '圖像.jpg' : `圖像.${format}`, bytes: result.bytes })
      }
      const rotated = await runImage(oriented, 'png', { enabled: true, width: 24, height: 24, lockAspectRatio: true, allowEnlargement: false })
      assert.deepEqual([rotated.width, rotated.height], [18, 24])
      const zip = await page.evaluate(async ({ entries, zipWorker }) => {
        const worker = new Worker(zipWorker, { type: 'module' })
        const prepared = entries.map((entry) => ({ name: entry.name, bytes: new Uint8Array(entry.bytes).buffer }))
        return new Promise((resolveOutput, reject) => {
          const timer = setTimeout(() => { worker.terminate(); reject(new Error('ZIP Worker timeout')) }, 30_000)
          worker.onerror = (event) => { clearTimeout(timer); worker.terminate(); reject(new Error(event.message)) }
          worker.onmessage = (event) => {
            if (event.data.type === 'progress') return
            clearTimeout(timer); worker.terminate()
            if (event.data.type === 'error') { reject(new Error(event.data.message)); return }
            resolveOutput(Array.from(new Uint8Array(event.data.bytes)))
          }
          worker.postMessage({ version: 1, type: 'archive', jobId: crypto.randomUUID(), retainedBytes: 0, entries: prepared }, prepared.map((entry) => entry.bytes))
        })
      }, { entries: results, zipWorker })
      const zipBytes = Buffer.from(zip)
      let cursor = 0
      for (const expected of results) {
        assert.equal(zipBytes.readUInt32LE(cursor), 0x04034b50); assert.equal(zipBytes.readUInt16LE(cursor + 8), 0)
        const nameLength = zipBytes.readUInt16LE(cursor + 26), length = zipBytes.readUInt32LE(cursor + 18)
        assert.equal(zipBytes.subarray(cursor + 30, cursor + 30 + nameLength).toString('utf8'), expected.name)
        assert.deepEqual(zipBytes.subarray(cursor + 30 + nameLength, cursor + 30 + nameLength + length), Buffer.from(expected.bytes))
        cursor += 30 + nameLength + length
      }
      for (const download of [results[2], { name: 'remage-results.zip', bytes: zip }]) {
        await page.evaluate(({ bytes, name }) => { window.downloadBlob = new Blob([new Uint8Array(bytes)]); window.downloadName = name }, download)
        const event = page.waitForEvent('download'); await page.locator('#download').click(); const actual = await event
        assert.equal(actual.suggestedFilename(), download.name)
        const target = resolve(tmpdir(), `remage-core-${engine}-${Date.now()}-${download.name}`); outputPaths.push(target)
        await actual.saveAs(target); assert.deepEqual(await readFile(target), Buffer.from(download.bytes))
        if (download.name.endsWith('.zip')) await promisify(execFile)('unzip', ['-t', target])
      }
      assert.deepEqual(errors, [])
      assert(requests.every((request) => request.method === 'GET' && request.url.startsWith(base) && !new URL(request.url).search), 'Only same-origin application asset GETs are allowed')
      console.log(JSON.stringify({ engine, version: browser.version(), imageTransforms: 4, emittedWorkerZipEntries: 3, verifiedDownloads: 2, requests: requests.length, wasmSha256: createHash('sha256').update(await readFile(resolve(directory, 'assets', assets.find((name) => name.endsWith('.wasm'))))).digest('hex'), pageErrors: errors.length }))
      await context.close()
    } finally { await browser.close() }
  }
} finally {
  await new Promise((resolveClosed) => server.close(resolveClosed))
  await Promise.all(outputPaths.map((path) => rm(path, { force: true })))
}
