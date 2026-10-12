import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'

const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.txt': 'text/plain', '.md': 'text/markdown' }
export async function webTestServer(initialDirectory, base = '/') {
  let directory = resolve(initialDirectory)
  let disconnected = false
  const faults = new Map(), requests = []
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost'), path = url.pathname
    requests.push({ method: request.method, path, query: url.search })
    if (disconnected) { request.socket.destroy(); return }
    try {
      if (!path.startsWith(base)) { response.writeHead(404).end(); return }
      const fault = faults.get(path)
      if (fault === 'unavailable') { response.writeHead(503).end('Temporarily unavailable'); return }
      if (fault === 'redirect') { response.writeHead(302, { Location: base }).end(); return }
      if (fault === 'html') { response.writeHead(200, { 'Content-Type': 'text/html' }).end('<!doctype html>Incorrect asset fallback'); return }
      const local = decodeURIComponent(path.slice(base.length)), target = resolve(directory, local || 'index.html')
      if (!target.startsWith(directory + sep)) { response.writeHead(403).end(); return }
      const bytes = await readFile(target)
      if (fault === 'corrupt') bytes[0] ^= 1
      response.setHeader('Content-Type', fault === 'mime' ? 'application/octet-stream' : mime[extname(target)] ?? 'application/octet-stream')
      response.setHeader('Cache-Control', 'no-store')
      response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'")
      response.setHeader('X-Content-Type-Options', 'nosniff'); response.setHeader('Referrer-Policy', 'no-referrer'); response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()')
      response.end(bytes)
    } catch { response.writeHead(404).end() }
  })
  await new Promise((ready, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', ready) })
  return { origin: `http://127.0.0.1:${server.address().port}`, base, faults, requests, setDisconnected: value => { disconnected = value }, publish: (next) => { directory = resolve(next) }, close: () => new Promise((done) => server.close(done)) }
}
