import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { builtinModules } from 'node:module'
import { resolve } from 'node:path'
import { normalizeWebBase, pwaBuild, webBuildId } from './scripts/pwa-build'

const forbidden = new Set([...builtinModules, ...builtinModules.map((name) => `node:${name}`), 'electron', 'sharp', 'electron-vite'])
export function browserBoundary(): Plugin {
  return {
    name: 'remage-browser-boundary',
    enforce: 'pre',
    resolveId(source, importer) {
      if (forbidden.has(source) || source.startsWith('node:') || /(?:^|\/)src\/(?:main|preload)\//.test(source) || (importer && /(?:^|\/)src\/(?:main|preload)\//.test(importer))) this.error(`Native dependency ${source} is forbidden in the browser build.`)
      return null
    },
    generateBundle() {
      for (const moduleId of this.getModuleIds()) {
        if (/__vite-browser-external|(?:^|\/)src\/(?:main|preload)\//.test(moduleId) || /node_modules\/(?:electron|sharp)\//.test(moduleId)) this.error(`Native dependency entered browser graph: ${moduleId}`)
      }
    }
  }
}

export default defineConfig(async () => {
  const project = import.meta.dirname, base = normalizeWebBase(process.env.REMAGE_WEB_BASE)
  const buildId = await webBuildId(project, base, process.env.REMAGE_WEB_QA_TAG)
  return {
  root: resolve(project, 'src/web'),
  base,
  define: { __REMAGE_BUILD_ID__: JSON.stringify(buildId) },
  resolve: { alias: { '@': resolve(import.meta.dirname, 'src/renderer/src') } },
  plugins: [browserBoundary(), react(), tailwindcss(), pwaBuild(project, base, buildId)],
  worker: { format: 'es' as const, plugins: () => [browserBoundary()] },
  build: { outDir: resolve(import.meta.dirname, 'dist/web'), emptyOutDir: true, manifest: true, assetsInlineLimit: 0 },
  server: { host: '127.0.0.1' },
  preview: { host: '127.0.0.1' }
  }
})
