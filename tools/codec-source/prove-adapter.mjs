import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'vite'
import sharp from 'sharp'
import { initializeImageMagick, Magick } from '@imagemagick/magick-wasm'

const wasmPath = resolve(process.argv[2] ?? 'node_modules/@imagemagick/magick-wasm/dist/x86/magick.wasm')
const directory = resolve(process.argv[3] ?? 'release/codec-source/adapter-proof')
const applicationRoot = resolve(process.argv[4] ?? '.')
const expectedMarker = process.argv[5]
const wrapperRoot = resolve('node_modules/@imagemagick/magick-wasm')
const wrapperPackage = JSON.parse(await readFile(resolve(wrapperRoot, 'package.json'), 'utf8'))
assert.equal(wrapperPackage.name, '@imagemagick/magick-wasm')
assert.equal(wrapperPackage.version, '0.0.44')
const wrapperBundle = await readFile(resolve(wrapperRoot, 'dist/index.js'))
await mkdir(directory, { recursive: true })
const codecPath = resolve(directory, 'codec.mjs'), contractsPath = resolve(directory, 'contracts.mjs')
await build({ configFile: false, envDir: directory, publicDir: false, logLevel: 'warn', build: { outDir: directory, emptyOutDir: false,
  lib: { entry: { codec: resolve(applicationRoot, 'src/web/codec.ts'), contracts: resolve(applicationRoot, 'src/shared/contracts.ts') }, formats: ['es'], fileName: (_format, name) => name + '.mjs' },
  rollupOptions: { external: ['@imagemagick/magick-wasm', 'zod'] } } })
const { constrainCodec, transformImage } = await import(pathToFileURL(codecPath))
const { defaultSettings } = await import(pathToFileURL(contractsPath))
const wasm = new Uint8Array(await readFile(wasmPath))
await initializeImageMagick(wasm)
constrainCodec()
if (expectedMarker) assert.ok(Magick.supportedFormats.some(format => format.version?.includes(expectedMarker)), 'Expected relink version marker was not exposed by the actual adapter.')
const cases = []
for (const [input, name] of [['png', 'rgba-hidden-rgb.png'], ['jpeg', 'baseline.jpg'], ['webp', 'lossless.webp']]) {
  const source = new Uint8Array(await readFile(resolve(applicationRoot, 'test-fixtures/images', name)))
  const original = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  for (const output of ['png', 'jpeg', 'webp']) {
    const settings = { ...structuredClone(defaultSettings), mode: 'converter', outputFormat: output, preserveMetadata: false, jpegLossAcknowledged: output === 'jpeg' }
    const result = transformImage(source, settings, source.length)
    const actual = await sharp(result.bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const metadata = await sharp(result.bytes).metadata()
    assert.equal(metadata.format, output)
    assert.deepEqual([actual.info.width, actual.info.height], [original.info.width, original.info.height])
    if (output === 'jpeg') assert.equal(metadata.hasAlpha, false)
    let maxPixelDelta = null
    if (output !== 'jpeg') {
      maxPixelDelta = actual.data.reduce((maximum, value, index) => Math.max(maximum, Math.abs(value - original.data[index])), 0)
      assert.ok(maxPixelDelta <= (input === 'jpeg' ? 4 : 0), `${input}->${output} unexpected pixel delta ${maxPixelDelta}`)
    }
    cases.push({ input, output, bytes: result.bytes.length, width: result.width, height: result.height, maxPixelDelta,
      sha256: createHash('sha256').update(result.bytes).digest('hex') })
  }
}
const evidence = { schema: 1, kind: 'Node actual-adapter supplied-byte proof; source-build provenance is recorded separately',
  runtime: { node: process.version, platform: process.platform, arch: process.arch, independentDecoder: sharp.versions },
  applicationRoot, sourceFiles: Object.fromEntries(await Promise.all(['src/web/codec.ts', 'src/web/budgets.ts', 'src/web/inspect.ts', 'src/web/sanitize.ts', 'src/shared/contracts.ts'].map(async (name) => [name, createHash('sha256').update(await readFile(resolve(applicationRoot, name))).digest('hex')]))),
  wasm: { path: wasmPath, bytes: wasm.length, sha256: createHash('sha256').update(wasm).digest('hex') },
  wrapper: { name: wrapperPackage.name, version: wrapperPackage.version,
    nativeGlueDeclaredVersion: wrapperPackage.devDependencies['@dlemstra/magick-native'],
    installedEsmBundle: 'dist/index.js', bytes: wrapperBundle.length,
    sha256: createHash('sha256').update(wrapperBundle).digest('hex'),
    method: 'Installed published ESM bundle embeds Native glue; no separate generated glue substituted.' },
  expectedMarker: expectedMarker ?? null, supportedFormats: Magick.supportedFormats, cases,
  restrictions: 'Explicit supplied WASM bytes; no signing, account, download or canonical artifact replacement.' }
await writeFile(resolve(directory, 'evidence.json'), JSON.stringify(evidence, null, 2) + '\n')
process.stdout.write(JSON.stringify({ wasm: evidence.wasm, cases: cases.length, evidence: resolve(directory, 'evidence.json') }) + '\n')
