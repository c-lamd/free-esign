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
  // react-draggable (via react-rnd) references `process.env.DRAGGABLE_DEBUG` in its
  // log() helper. The production Rollup build strips `process.env`, but Vite's dev
  // dep-optimizer keeps the raw reference — and `process` is undefined in the browser,
  // so placing/dragging a field throws "process is not defined" and blanks the page.
  // Statically replace the single offending reference (targeted, NOT a broad
  // `process.env: {}` which would override Vite's production NODE_ENV handling).
  define: {
    'process.env.DRAGGABLE_DEBUG': 'false',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Heavy integration tests (full-app router render + pdf.js work, e.g.
    // routing.test.tsx, uploadFlow.test.tsx) pass in ~1s in isolation but can
    // exceed the default 5s testTimeout under the full ~40-file parallel run on
    // a loaded machine — a CPU-contention flake, not a real hang. Give ample
    // headroom so the suite is deterministically green without masking true hangs.
    testTimeout: 20000,
    hookTimeout: 20000,
  },
})
