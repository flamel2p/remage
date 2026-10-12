import type { WebAsset, WebBuild } from './pwa-build'

export function serviceWorkerSource(build: WebBuild, manifestAsset: WebAsset, manifestJson: string): string {
  return `/* Remage application assets only. Normal waiting lifecycle; old complete caches retained. */\nconst BUILD = ${JSON.stringify(build)};\nconst MANIFEST_ASSET = ${JSON.stringify(manifestAsset)};\nconst MANIFEST_JSON = ${JSON.stringify(manifestJson)};\n` + String.raw`
const REQUIRED = [...BUILD.assets, MANIFEST_ASSET];
const ORIGIN = self.location.origin;
const PREFIX = 'remage-app:' + BUILD.base + ':';
const CACHE = PREFIX + BUILD.buildId + ':' + BUILD.digest;
const MARKER = ORIGIN + BUILD.base + '__remage_complete__';
const ASSETS = new Map(REQUIRED.map(asset => [ORIGIN + asset.path, asset]));
let restoration = null;
const identity = { protocol: 1, buildId: BUILD.buildId, digest: BUILD.digest };
const hex = buffer => Array.from(new Uint8Array(buffer), byte => byte.toString(16).padStart(2, '0')).join('');
const failure = text => new Error(text);
async function validatedResponse(asset) {
  if (asset === MANIFEST_ASSET) return new Response(MANIFEST_JSON, { headers: { 'Content-Type': 'application/json' } });
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(ORIGIN + asset.path, { cache: 'no-store', credentials: 'same-origin', redirect: 'error', signal: controller.signal });
    if (!response.ok || response.type === 'opaque' || response.redirected) throw failure('The host did not provide an application asset.');
    const type = (response.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
    if (type === 'text/html' && asset.mediaType !== 'text/html') throw failure('The host returned HTML instead of an application asset.');
    if (['application/wasm', 'text/javascript', 'text/html', 'text/css'].includes(asset.mediaType) && type !== asset.mediaType && !(asset.mediaType === 'text/javascript' && type === 'application/javascript')) throw failure('An application asset has an incompatible MIME type.');
    if (Number(response.headers.get('Content-Length')) > asset.bytes && !response.headers.has('Content-Encoding')) throw failure('An application asset exceeds its expected length.');
    if (!response.body) throw failure('An application asset has no response body.');
    const bytes = new Uint8Array(asset.bytes), reader = response.body.getReader();
    let offset = 0;
    try {
      while (true) { const part = await reader.read(); if (part.done) break; if (offset + part.value.byteLength > bytes.length) throw failure('An application asset exceeds its expected length.'); bytes.set(part.value, offset); offset += part.value.byteLength; }
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
    if (offset !== asset.bytes || hex(await crypto.subtle.digest('SHA-256', bytes)) !== asset.sha256) throw failure('The deployed application assets are incomplete or belong to another build.');
    const headers = new Headers(response.headers); headers.delete('Content-Encoding'); headers.set('Content-Length', String(bytes.length));
    return new Response(bytes, { headers });
  } finally { clearTimeout(timer); }
}
async function status() {
  const cache = await caches.open(CACHE), missing = [];
  for (const asset of REQUIRED) if (!await cache.match(ORIGIN + asset.path)) missing.push(asset.path);
  let marked = false;
  try { const marker = await cache.match(MARKER), value = marker && await marker.json(); marked = value && value.buildId === BUILD.buildId && value.digest === BUILD.digest; } catch {}
  return { complete: missing.length === 0 && Boolean(marked), required: REQUIRED.length, cached: REQUIRED.length - missing.length, missing };
}
async function restore() {
  const cache = await caches.open(CACHE);
  for (const asset of REQUIRED) if (!await cache.match(ORIGIN + asset.path)) await cache.put(ORIGIN + asset.path, await validatedResponse(asset));
  await cache.put(MARKER, new Response(JSON.stringify(identity), { headers: { 'Content-Type': 'application/json' } }));
  return status();
}
function restoreOnce() { if (!restoration) restoration = restore().finally(() => { restoration = null; }); return restoration; }
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const existed = await caches.has(CACHE);
    try { const result = await restoreOnce(); if (!result.complete) throw failure('Application setup is incomplete.'); }
    catch (error) { if (!existed) await caches.delete(CACHE); throw error; }
  })());
});
// Deliberately no activation claim, forced waiting-worker activation or cache deletion.
self.addEventListener('message', event => {
  const request = event.data, port = event.ports[0], source = event.source;
  if (!port || !source || !source.url || !source.url.startsWith(ORIGIN + BUILD.base) || !request || request.protocol !== 1 || !/^[A-Za-z0-9-]{1,80}$/.test(request.requestId) || !['STATUS', 'RESTORE'].includes(request.action) || !/^[a-f0-9]{64}$/.test(request.expectedBuildId) || !/^[a-f0-9]{64}$/.test(request.expectedDigest)) return;
  event.waitUntil((async () => {
    try {
      let result;
      if (request.expectedBuildId !== BUILD.buildId || request.expectedDigest !== BUILD.digest) result = { state: 'mismatch', complete: false, required: REQUIRED.length, cached: 0, missing: [] };
      else { if (request.action === 'RESTORE') await restoreOnce(); const current = await status(); result = { ...current, state: current.complete ? 'complete' : 'partial' }; }
      port.postMessage({ ...identity, requestId: request.requestId, ...result });
    } catch (error) { const current = await status().catch(() => ({ required: REQUIRED.length, cached: 0, missing: [] })); port.postMessage({ ...identity, requestId: request.requestId, ...current, complete: false, state: 'error', message: String(error.message || 'Application cache could not be restored.').slice(0, 500) }); }
    finally { port.close(); }
  })());
});
function unavailable(message, html = false) { return new Response(html ? '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Remage recovery</title><body><h1>Reconnect to recover Remage</h1><p>' + message + '</p><p>Close every Remage tab and installed window, then reopen online and retry setup. A frozen window can delay an update. Complete cache eviction can prevent offline launching. No image data is stored in this application cache.</p></body></html>' : message, { status: 503, headers: { 'Content-Type': html ? 'text/html' : 'text/plain', 'Cache-Control': 'no-store' } }); }
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== ORIGIN || !url.pathname.startsWith(BUILD.base)) return;
  if (request.mode === 'navigate') {
    // Keep the controlling version coherent, including after stable HTML changes.
    event.respondWith((async () => {
      const shell = BUILD.assets.find(asset => asset.path === BUILD.base + 'index.html');
      try {
        const cache = await caches.open(CACHE), response = shell && await cache.match(ORIGIN + shell.path);
        if (response && (await status()).complete) return response;
        // When any required entry was evicted, repair the whole compatible version
        // before returning HTML whose scripts would otherwise remain unavailable.
        const repaired = await restoreOnce();
        if (repaired.complete) { const html = shell && await cache.match(ORIGIN + shell.path); if (html) return html; }
      } catch {}
      event.waitUntil(self.registration.update().catch(() => {}));
      return unavailable('This controlling version is missing its compatible page. An update check was requested; that does not mean setup is complete.', true);
    })()); return;
  }
  const asset = !url.search && ASSETS.get(url.href);
  if (!asset) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE), cached = await cache.match(url.href); if (cached) return cached;
    if (/\/assets\/[^/]+-[A-Za-z0-9_-]{8,}\.[A-Za-z0-9]+$/.test(url.pathname)) {
      for (const name of await caches.keys()) if (name.startsWith(PREFIX) && name !== CACHE) { const old = await caches.open(name); if (await old.match(MARKER)) { const previous = await old.match(url.href); if (previous) return previous; } }
    }
    if (asset === MANIFEST_ASSET) return validatedResponse(asset);
    return unavailable('A compatible application asset is missing. Reconnect and use Restore offline files before processing.');
  })());
});
`
}
