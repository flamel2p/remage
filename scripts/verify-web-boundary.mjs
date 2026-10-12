import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { build, loadConfigFromFile } from 'vite'

const loaded = await loadConfigFromFile({ command: 'build', mode: 'production' }, resolve('vite.web.config.ts'))
const boundary = loaded?.config.plugins?.find(plugin => plugin && !Array.isArray(plugin) && plugin.name === 'remage-browser-boundary')
assert(boundary, 'The production browser boundary plugin is present.')

const directory = await mkdtemp(resolve(tmpdir(), 'remage-browser-boundary-'))
try {
  await writeFile(resolve(directory, 'index.html'), '<script type="module" src="/entry.ts"></script>')
  const modules = ['sharp', 'electron', 'node:fs', resolve('src/main/services/image-engine.ts')]
  for (const moduleName of modules) {
    await writeFile(resolve(directory, 'entry.ts'), `import * as forbidden from ${JSON.stringify(moduleName)}; console.log(forbidden)`)
    await assert.rejects(() => build({ configFile: false, root: directory, plugins: [boundary], logLevel: 'silent', build: { outDir: resolve(directory, 'out'), emptyOutDir: true } }), /Native dependency.*forbidden/)
  }
  console.log('Browser graph rejected Sharp, Electron, Node filesystem and native source imports.')
} finally { await rm(directory, { recursive: true, force: true }) }
