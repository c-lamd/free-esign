/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Self-hosted pdf.js assets (worker, cmaps, standard_fonts) are copied into public/
// by scripts/copy-pdf-assets.mjs (wired to prepare/predev/prebuild). Vite serves
// public/ at the site root in both dev and build, so the runtime URLs
// /pdf.worker.min.mjs, /cmaps/ and /standard_fonts/ resolve to the app's own origin
// (PRV-02 — zero third-party network requests while signing).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
