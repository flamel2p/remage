import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { normalizeWebBase, webBuildId } from '../../scripts/pwa-build'
import { cacheRequest, validateBuildManifest, validateCacheReply, type BuildManifest } from './pwa-protocol'

function manifest(): BuildManifest {
  const assets = ['index.html', 'assets/image.worker-12345678.js', 'assets/zip.worker-12345678.js', 'assets/magick-12345678.wasm'].map((path) => ({ path: '/remage/' + path, sha256: 'a'.repeat(64), bytes: 12, mediaType: 'application/octet-stream' }))
  return { protocol: 1, buildId: 'b'.repeat(64), base: '/remage/', digest: createHash('sha256').update(JSON.stringify(assets)).digest('hex'), assets }
}
describe('PWA identity and bounded messages', () => {
  it('normalizes only portable absolute local base paths', () => {
    expect(normalizeWebBase()).toBe('/'); expect(normalizeWebBase('/remage')).toBe('/remage/')
    for (const path of ['./', 'https://example.com/', '//other/', '/a/../b/', '/a/./b/', '/a//b/', '/%2e%2e/', '/a?query', 'remage/']) expect(() => normalizeWebBase(path)).toThrow()
  })
  it('keeps repeat builds deterministic and separates compiler configuration, base and QA tag', async () => {
    const root = await mkdtemp(join(tmpdir(), 'remage-build-identity-'))
    try {
      await Promise.all(['src', 'assets', 'scripts'].map(path => mkdir(join(root, path))))
      await Promise.all(['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'vite.web.config.ts', 'tsconfig.json', 'tsconfig.web.json', 'LICENSE', 'NOTICE.md'].map(path => writeFile(join(root, path), '{}')))
      const initial = await webBuildId(root, '/')
      expect(await webBuildId(root, '/')).toBe(initial)
      expect(await webBuildId(root, '/remage/')).not.toBe(initial)
      expect(await webBuildId(root, '/', 'candidate')).not.toBe(initial)
      await writeFile(join(root, 'tsconfig.json'), '{"compilerOptions":{"jsxImportSource":"different"}}')
      expect(await webBuildId(root, '/')).not.toBe(initial)
    } finally { await rm(root, { recursive: true, force: true }) }
  })
  it('accepts a matching complete inventory and rejects mixed identity, paths and digest', async () => {
    const build = manifest(); expect(await validateBuildManifest(build, build.buildId, build.base)).toEqual(build)
    await expect(validateBuildManifest(build, 'c'.repeat(64), build.base)).rejects.toThrow(/different versions/)
    await expect(validateBuildManifest({ ...build, digest: 'c'.repeat(64) }, build.buildId, build.base)).rejects.toThrow(/digest/)
    await expect(validateBuildManifest({ ...build, assets: [...build.assets, { ...build.assets[0], path: '/remage/../secret' }] }, build.buildId, build.base)).rejects.toThrow(/inventory/)
  })
  it('never treats malformed, inconsistent or wrong-controller replies as readiness', () => {
    const build = manifest(), complete = { protocol: 1, requestId: 'request', buildId: build.buildId, digest: build.digest, state: 'complete', complete: true, required: 5, cached: 5, missing: [] }
    expect(validateCacheReply(complete, build, 'request').complete).toBe(true)
    for (const patch of [{ requestId: 'wrong' }, { buildId: 'c'.repeat(64) }, { cached: 4 }, { state: 'partial' }, { missing: ['/private/image.png'] }, { extra: true }]) expect(() => validateCacheReply({ ...complete, ...patch }, build, 'request')).toThrow()
    expect(validateCacheReply({ ...complete, buildId: 'c'.repeat(64), state: 'mismatch', complete: false, required: 8, cached: 0 }, build, 'request').state).toBe('mismatch')
  })
  it('bounds an unresponsive channel and rejects a malformed transferred response', async () => {
    const build = manifest(), silent = { postMessage: () => {} } as unknown as ServiceWorker
    await expect(cacheRequest(silent, build, 'STATUS', 10)).rejects.toThrow(/did not respond/)
    const invalid = { postMessage: (_request: unknown, ports: MessagePort[]) => { ports[0].postMessage({ complete: true }) } } as unknown as ServiceWorker
    await expect(cacheRequest(invalid, build, 'STATUS', 100)).rejects.toThrow()
  })
})
