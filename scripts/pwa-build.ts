import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { extname, join, relative, resolve } from 'node:path'
import sharp from 'sharp'
import type { Plugin } from 'vite'
import { serviceWorkerSource } from './pwa-worker-source'

export type WebAsset = { path: string; sha256: string; bytes: number; mediaType: string }
export type WebBuild = { protocol: 1; buildId: string; base: string; digest: string; assets: WebAsset[] }
export function normalizeWebBase(value = '/'): string {
  if (!/^\/(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]*$/.test(value) || value.split('/').some((part) => part === '.' || part === '..')) throw new Error('REMAGE_WEB_BASE must be an absolute local path such as / or /remage/, without relative segments, queries or an external origin.')
  return value.endsWith('/') ? value : value + '/'
}
async function filesIn(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const groups = await Promise.all(entries.map((entry) => entry.isDirectory() ? filesIn(join(directory, entry.name)) : entry.isFile() ? [join(directory, entry.name)] : []))
  return groups.flat().sort()
}
const hash = (bytes: Uint8Array | string): string => createHash('sha256').update(bytes).digest('hex')
export async function webBuildId(root: string, base: string, qaTag = ''): Promise<string> {
  if (!/^[A-Za-z0-9._-]{0,64}$/.test(qaTag)) throw new Error('REMAGE_WEB_QA_TAG accepts at most 64 nonsecret letters, digits, dots, underscores or hyphens.')
  const paths = [...await filesIn(join(root, 'src')), ...await filesIn(join(root, 'assets')), ...await filesIn(join(root, 'scripts')),
    ...['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'vite.web.config.ts', 'tsconfig.json', 'tsconfig.web.json', 'LICENSE', 'NOTICE.md'].map((path) => join(root, path))].sort()
  const digest = createHash('sha256').update(JSON.stringify({ protocol: 1, base, qaTag }))
  for (const path of paths) { const bytes = await readFile(path); digest.update(JSON.stringify([relative(root, path), bytes.length])); digest.update(bytes) }
  return digest.digest('hex')
}
const mediaTypes: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.png': 'image/png', '.txt': 'text/plain', '.md': 'text/markdown' }

export function pwaBuild(root: string, base: string, buildId: string): Plugin {
  let outputDirectory: string
  return {
    name: 'remage-complete-pwa', apply: 'build', enforce: 'post',
    configResolved(config) { outputDirectory = resolve(config.root, config.build.outDir) },
    transformIndexHtml(html) {
      return html.replace('</head>', `<meta name="remage-build-id" content="${buildId}" /><link rel="manifest" href="${base}manifest.webmanifest" /><link rel="icon" type="image/png" href="${base}icons/remage-192.png" /><link rel="apple-touch-icon" href="${base}icons/remage-192.png" /></head>`)
    },
    async closeBundle() {
      await mkdir(join(outputDirectory, 'icons'), { recursive: true })
      for (const size of [192, 512]) await sharp(join(root, 'assets/remage-icon.svg')).resize(size, size).png().toFile(join(outputDirectory, `icons/remage-${size}.png`))
      const manifest = { id: base, name: 'Remage', short_name: 'Remage', description: 'Private image conversion and resizing on your device.', start_url: base, scope: base, display: 'standalone', background_color: '#FAF9FD', theme_color: '#5B4BDB', icons: [192, 512].map((size) => ({ src: `${base}icons/remage-${size}.png`, sizes: `${size}x${size}`, type: 'image/png', purpose: 'any' })) }
      await writeFile(join(outputDirectory, 'manifest.webmanifest'), JSON.stringify(manifest))
      await mkdir(join(outputDirectory, 'licenses'), { recursive: true })
      const notices = [...await filesIn(join(root, 'assets/licenses')), ...['atkinson-hyperlegible-next-OFL.txt', 'lilex-OFL.txt'].map((path) => join(root, 'assets/fonts/google', path)), join(root, 'LICENSE'), join(root, 'NOTICE.md')]
      for (const path of notices) await writeFile(join(outputDirectory, 'licenses', path.split('/').at(-1)!), await readFile(path))
      for (const name of ['react', 'react-dom', 'clsx', 'tailwind-merge', '@radix-ui/react-dialog', '@radix-ui/react-alert-dialog', '@radix-ui/react-slot', 'tailwindcss', 'zod']) {
        const directory = join(root, 'node_modules', name), license = (await readdir(directory)).find((file) => /^license(?:\.md|\.txt)?$/i.test(file))
        if (!license) throw new Error(`The selected runtime dependency ${name} has no distributable license file.`)
        await writeFile(join(outputDirectory, 'licenses', name.replaceAll('/', '-') + '-LICENSE.txt'), await readFile(join(directory, license)))
      }
      const assets: WebAsset[] = []
      for (const path of await filesIn(outputDirectory)) {
        const local = relative(outputDirectory, path).replaceAll('\\', '/')
        if (local === 'sw.js' || local === 'web-build.json') continue
        const bytes = await readFile(path)
        assets.push({ path: base + local, sha256: hash(bytes), bytes: bytes.length, mediaType: mediaTypes[extname(path)] ?? 'application/octet-stream' })
      }
      const build: WebBuild = { protocol: 1, buildId, base, digest: hash(JSON.stringify(assets)), assets }
      const json = JSON.stringify(build)
      await writeFile(join(outputDirectory, 'web-build.json'), json)
      await writeFile(join(outputDirectory, 'sw.js'), serviceWorkerSource(build, { path: base + 'web-build.json', bytes: Buffer.byteLength(json), sha256: hash(json), mediaType: 'application/json' }, json))
    }
  }
}
