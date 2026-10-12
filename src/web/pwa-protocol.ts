import { z } from 'zod'

const digest = z.string().regex(/^[a-f0-9]{64}$/)
const asset = z.object({ path: z.string().max(512), sha256: digest, bytes: z.number().int().nonnegative().max(64 * 1024 * 1024), mediaType: z.string().max(100) }).strict()
export const buildManifestSchema = z.object({ protocol: z.literal(1), buildId: digest, base: z.string().max(200), digest, assets: z.array(asset).min(1).max(512) }).strict()
export type BuildManifest = z.infer<typeof buildManifestSchema>
const replySchema = z.object({ protocol: z.literal(1), requestId: z.string().max(80), buildId: digest, digest, state: z.enum(['complete', 'partial', 'mismatch', 'error']), complete: z.boolean(), required: z.number().int().min(1).max(513), cached: z.number().int().nonnegative().max(513), missing: z.array(z.string().max(512)).max(513), message: z.string().max(500).optional() }).strict()
export type CacheReply = z.infer<typeof replySchema>

export function validateCacheReply(raw: unknown, manifest: BuildManifest, requestId: string): CacheReply {
  const reply = replySchema.parse(raw), paths = new Set([...manifest.assets.map((entry) => entry.path), manifest.base + 'web-build.json'])
  if (reply.requestId !== requestId || reply.cached > reply.required || (reply.state !== 'mismatch' && reply.required !== paths.size) || new Set(reply.missing).size !== reply.missing.length || reply.missing.some((path) => !paths.has(path))) throw new Error('The application cache returned an invalid response.')
  if (reply.state !== 'mismatch' && (reply.buildId !== manifest.buildId || reply.digest !== manifest.digest)) throw new Error('The controller belongs to another application version.')
  if (reply.complete !== (reply.state === 'complete') || (reply.complete && (reply.cached !== reply.required || reply.missing.length))) throw new Error('The application cache reported inconsistent readiness.')
  if (reply.state === 'partial' && reply.cached + reply.missing.length !== reply.required) throw new Error('The application cache reported inconsistent asset counts.')
  return reply
}
export async function validateBuildManifest(raw: unknown, buildId: string, base: string): Promise<BuildManifest> {
  const manifest = buildManifestSchema.parse(raw)
  if (manifest.buildId !== buildId || manifest.base !== base) throw new Error('The page and application files belong to different versions. Close every Remage window and reopen online.')
  const paths = new Set<string>()
  for (const entry of manifest.assets) {
    if (!entry.path.startsWith(base) || entry.path.includes('..') || /[?#%\\]/.test(entry.path) || paths.has(entry.path) || ['sw.js', 'web-build.json'].includes(entry.path.slice(base.length))) throw new Error('The application asset inventory is invalid.')
    paths.add(entry.path)
  }
  if (!paths.has(base + 'index.html') || !manifest.assets.some((entry) => entry.path.endsWith('.wasm')) || !manifest.assets.some((entry) => /image\.worker-.*\.js$/.test(entry.path)) || !manifest.assets.some((entry) => /zip\.worker-.*\.js$/.test(entry.path))) throw new Error('The application inventory is missing required processing assets.')
  const actual = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(manifest.assets)))
  if (Array.from(new Uint8Array(actual), (byte) => byte.toString(16).padStart(2, '0')).join('') !== manifest.digest) throw new Error('The application inventory digest is invalid.')
  return manifest
}
export function cacheRequest(worker: ServiceWorker, manifest: BuildManifest, action: 'STATUS' | 'RESTORE', timeoutMs = 60_000): Promise<CacheReply> {
  const requestId = crypto.randomUUID(), channel = new MessageChannel()
  return new Promise((resolve, reject) => {
    const finish = (): void => { clearTimeout(timer); channel.port1.close(); channel.port2.close() }
    const timer = setTimeout(() => { finish(); reject(new Error('The application cache did not respond. Reconnect and retry the version check; new processing stays blocked until the controller is verified.')) }, timeoutMs)
    channel.port1.onmessageerror = () => { finish(); reject(new Error('The application cache returned an unreadable response.')) }
    channel.port1.onmessage = (event) => { finish(); try { resolve(validateCacheReply(event.data, manifest, requestId)) } catch (error) { reject(error) } }
    try { worker.postMessage({ protocol: 1, requestId, action, expectedBuildId: manifest.buildId, expectedDigest: manifest.digest }, [channel.port2]) } catch (error) { finish(); reject(error) }
  })
}
