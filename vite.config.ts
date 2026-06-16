/// <reference types="vitest/config" />
import path from 'node:path'
import { createRequire } from 'node:module'
import { defineConfig, normalizePath } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'

const require = createRequire(import.meta.url)
const pdfjsDistPath = path.dirname(require.resolve('pdfjs-dist/package.json'))
const cMapsDir = normalizePath(path.join(pdfjsDistPath, 'cmaps'))
const standardFontsDir = normalizePath(path.join(pdfjsDistPath, 'standard_fonts'))
// Auto-copy the worker so it stays in sync with the installed pdfjs-dist version.
// Do NOT commit public/pdf.worker.min.mjs — the build populates it from node_modules.
const workerFile = normalizePath(path.join(pdfjsDistPath, 'build', 'pdf.worker.min.mjs'))

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    viteStaticCopy({
      targets: [
        { src: cMapsDir, dest: '' },
        { src: standardFontsDir, dest: '' },
        { src: workerFile, dest: '' },
      ],
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
