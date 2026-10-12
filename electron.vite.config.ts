import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    root: 'src/renderer',
    resolve: { alias: { '@': resolve(import.meta.dirname, 'src/renderer/src') } },
    plugins: [react(), tailwindcss()]
  }
})
