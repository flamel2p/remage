import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const commit = '8f2c5b48a4e8a388591ce309ec5a350531d34178'
const paths = ['src', 'assets', 'scripts', 'test-fixtures', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml',
  '.npmrc', 'tsconfig.json', 'tsconfig.web.json', 'vite.web.config.ts', 'electron.vite.config.ts', 'vitest.config.ts',
  'eslint.config.mjs', 'components.json', 'LICENSE', 'NOTICE.md', 'README.md', 'docs/architecture.md',
  'docs/static-web-hosting.md', 'docs/pwa-cache-contract.md', 'docs/browser-codec-decision.md']
const directory = resolve('release/codec-source')
await mkdir(directory, { recursive: true })
const name = `remage-${commit}.tar`, path = resolve(directory, name)
const result = spawnSync('git', ['archive', '--format=tar', `--output=${path}`, commit, '--', ...paths], { stdio: 'inherit' })
if (result.status !== 0) throw new Error('Application source archive failed.')
const bytes = await readFile(path)
const evidence = { schema: 1, commit, file: name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), paths,
  exclusions: ['Git history', 'agent and private configuration directories', 'environment files', 'ignored results, release archives and installed dependencies'],
  projectNpmrc: 'Tracked public node-linker and strict-peer-dependencies settings only.' }
await writeFile(resolve(directory, 'application-source.json'), JSON.stringify(evidence, null, 2) + '\n')
process.stdout.write(JSON.stringify(evidence) + '\n')

if (process.argv.includes('--workingtree-patch')) {
  const changes = ['src/web/codec.ts', 'src/web/codec.test.ts']
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim()
  if (head !== commit) throw new Error('Working-tree layer requires the recorded parent commit; refusing a different HEAD.')
  const changed = spawnSync('git', ['diff', '--name-only', commit, '--', 'src', 'assets', 'scripts', 'package.json', 'pnpm-lock.yaml',
    'pnpm-workspace.yaml', 'vite.web.config.ts', 'tsconfig.json', 'tsconfig.web.json', 'LICENSE', 'NOTICE.md'], { encoding: 'utf8' })
  if (changed.status || JSON.stringify(changed.stdout.trim().split('\n').sort()) !== JSON.stringify([...changes].sort())) throw new Error('The current build-input change set exceeds the authorized two-file layer.')
  const patch = spawnSync('git', ['diff', '--binary', commit, '--', ...changes], { maxBuffer: 10 * 1024 * 1024 })
  if (patch.status) throw new Error('Working-tree patch failed.')
  await writeFile(resolve(directory, 'application-workingtree.patch'), patch.stdout)
  const temporary = await mkdtemp(resolve(directory, 'application-layer-'))
  const python = process.argv.find(argument => argument.startsWith('--python='))?.slice(9) ?? 'python3.14'
  try {
    const extraction = spawnSync(python, ['-c', 'import sys,tarfile; archive=tarfile.open(sys.argv[1]); archive.extractall(sys.argv[2],filter="data")', path, temporary], { stdio: 'inherit' })
    if (extraction.status) throw new Error('Frozen application extraction failed; Python with explicit data filter is required.')
    const files = []
    for (const name of changes) {
      const original = await readFile(resolve(temporary, name)), current = await readFile(resolve(name))
      await writeFile(resolve(temporary, name), current)
      files.push({ path: name, originalSha256: createHash('sha256').update(original).digest('hex'), currentSha256: createHash('sha256').update(current).digest('hex') })
    }
    const { build } = await import('vite')
    const helperDirectory = resolve(directory, 'build-id-helper')
    await build({ configFile: false, envDir: helperDirectory, publicDir: false, logLevel: 'warn', build: { ssr: resolve(temporary, 'scripts/pwa-build.ts'), outDir: helperDirectory,
      emptyOutDir: false, rollupOptions: { output: { entryFileNames: 'build-id.mjs' } } } })
    const { webBuildId } = await import(pathToFileURL(resolve(helperDirectory, 'build-id.mjs')))
    const canonical = JSON.parse(await readFile('dist/web/web-build.json', 'utf8'))
    const computedId = await webBuildId(temporary, '/', '')
    if (canonical.base !== '/' || computedId !== canonical.buildId) throw new Error('Layered application identity does not match the current canonical root artifact.')
    const layeredName = `remage-${commit}-workingtree.tar`, layeredPath = resolve(directory, layeredName)
    const packing = spawnSync(python, ['-c', 'import sys,tarfile, pathlib; root=pathlib.Path(sys.argv[1]); archive=tarfile.open(sys.argv[2],"w");\nfor path in sorted(root.rglob("*")):\n if path.is_file():\n  info=archive.gettarinfo(str(path),str(path.relative_to(root))); info.uid=info.gid=info.mtime=0; info.uname=info.gname=""; archive.addfile(info,path.open("rb"))\narchive.close()', temporary, layeredPath], { stdio: 'inherit' })
    if (packing.status) throw new Error('Layered application source archive failed.')
    const layeredBytes = await readFile(layeredPath)
    const layer = { schema: 1, parentCommit: commit, parentArchiveSha256: evidence.sha256, file: layeredName, bytes: layeredBytes.length,
      sha256: createHash('sha256').update(layeredBytes).digest('hex'), patch: 'application-workingtree.patch',
      patchSha256: createHash('sha256').update(patch.stdout).digest('hex'), files,
      canonical: { buildId: canonical.buildId, base: canonical.base, digest: canonical.digest,
        swSha256: createHash('sha256').update(await readFile('dist/web/sw.js')).digest('hex') },
      computedSnapshotBuildId: computedId, method: 'Frozen parent allowlist with only the two authorized working-tree files overlaid; actual archived webBuildId implementation recomputed.' }
    await writeFile(resolve(directory, 'application-workingtree-source.json'), JSON.stringify(layer, null, 2) + '\n')
    await writeFile(resolve(directory, 'application-workingtree-web-build.json'), JSON.stringify(canonical, null, 2) + '\n')
    process.stdout.write(JSON.stringify(layer) + '\n')
  } finally { await rm(temporary, { recursive: true, force: true }) }
}
