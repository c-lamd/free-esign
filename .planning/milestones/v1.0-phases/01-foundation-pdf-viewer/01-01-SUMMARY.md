---
phase: 01-foundation-pdf-viewer
plan: "01"
subsystem: ui
tags: [vite, react, typescript, tailwind, react-pdf, pdfjs, zustand, vitest]

requires: []

provides:
  - "Vite 8 + React 19 + TypeScript SPA scaffold with static dist/ output"
  - "Tailwind v4 via @tailwindcss/vite; 8 UI-SPEC CSS custom property tokens + .sr-only"
  - "Self-hosted pdf.js pipeline: worker (public/pdf.worker.min.mjs), cmaps/, standard_fonts/ via viteStaticCopy"
  - "Zustand view state machine (empty|loading|error|loaded) with full DocumentStore interface"
  - "src/lib/pdfWorker.ts — sets GlobalWorkerOptions.workerSrc + exports pdfOptions (PRV-02)"
  - "DocumentViewer skeleton: react-pdf Document+Page, page 1, renderTextLayer/renderAnnotationLayer false"
  - "TopBar + LoadingSpinner + EmptyState + ErrorState hand-crafted Tailwind components"
  - "App view-router wired to Zustand state machine with temporary file input"
  - "Vitest 4.1.9 jsdom test suite + 6 documentStore state machine tests passing"
  - "vercel.json outputDirectory: dist for static Vercel deployment"

affects:
  - "01-02 (UploadZone drag-drop replaces EmptyState temporary input)"
  - "01-03 (image wrapping via pdf-lib; imageWrapper.ts into existing Blob URL pipeline)"
  - "01-04 (multi-page DocumentViewer replaces skeleton Page-1-only component)"
  - "Phase 2 (DocumentStore interface is the contract for overlay/export state)"

tech-stack:
  added:
    - vite@8.0.16
    - react@19.2.x + react-dom@19.2.x
    - typescript@~5.8.3
    - tailwindcss@4.3.x + @tailwindcss/vite@4.3.x
    - react-pdf@10.4.1 (pins pdfjs-dist@5.4.296)
    - pdf-lib@1.17.1
    - zustand@5.0.x
    - vitest@4.1.9 + jsdom@29.1.x + @testing-library/react@16.3.x + @testing-library/jest-dom@6.6.x
    - vite-plugin-static-copy@4.1.x
    - "@vitejs/plugin-react@6.0.x"
    - "@types/node@25.x"
  patterns:
    - "Zustand view state machine (empty|loading|error|loaded) as the single source of truth"
    - "pdfWorker.ts imported first in DocumentViewer.tsx to set workerSrc before react-pdf loads (Pitfall 3 mitigation)"
    - "viteStaticCopy targets cmaps + standard_fonts from pdfjs-dist for self-hosting (PRV-02)"
    - "Blob URL stored in Zustand (never the raw File object)"
    - "All components hand-crafted with CSS custom properties; no shadcn, no tailwind.config.js"

key-files:
  created:
    - src/store/documentStore.ts
    - src/lib/pdfWorker.ts
    - src/components/DocumentViewer.tsx
    - src/components/TopBar.tsx
    - src/components/LoadingSpinner.tsx
    - src/test/documentStore.test.ts
    - src/test/setup.ts
    - src/vite-env.d.ts
    - src/index.css
    - src/main.tsx
    - src/App.tsx
    - vite.config.ts
    - tsconfig.json
    - tsconfig.app.json
    - tsconfig.node.json
    - vercel.json
    - index.html
    - eslint.config.js
    - public/pdf.worker.min.mjs
    - .gitignore
    - package.json
    - package-lock.json
  modified: []

key-decisions:
  - "pdfjs-dist 5.4.296 (not 4.x): react-pdf 10.4.1 pins this version; worker filename is pdf.worker.min.mjs (.mjs not .js)"
  - "public/ static copy for worker (not ?url import): deterministic path, avoids Vite content-hash 404s on redeploy"
  - "pdfWorker.ts imported first in DocumentViewer.tsx: prevents react-pdf internals from overwriting workerSrc"
  - "composite: true on tsconfig.node.json required for tsc -b project references with @types/node"
  - "Zustand store holds Blob URL strings; raw File objects never stored"
  - "renderTextLayer=false + renderAnnotationLayer=false in Phase 1: performance + removes annotation injection surface (T-01-03)"

patterns-established:
  - "Pattern: viteStaticCopy for pdfjs-dist cmaps + standard_fonts asset pipeline"
  - "Pattern: Zustand view state machine as SPA navigation layer (no router)"
  - "Pattern: pdfWorker module import order guard against CDN workerSrc fallback"

requirements-completed: [PRV-01, PRV-02]

duration: 16min
completed: "2026-06-16"
---

# Phase 01 Plan 01: Walking Skeleton Summary

**Vite 8 + React 19 SPA scaffold with self-hosted pdf.js pipeline; picking a PDF renders page 1 via react-pdf with the worker, CMaps, and standard fonts all served from the app's own origin.**

## Performance

- **Duration:** ~16 min
- **Started:** 2026-06-16T21:51:00Z
- **Completed:** 2026-06-16T21:56:00Z
- **Tasks:** 3 automated (Task 4 deferred — see below)
- **Files modified:** 22 files created

## Accomplishments

- Scaffolded Vite 8 + React 19 + TypeScript SPA with Tailwind v4 (@tailwindcss/vite plugin, CSS-native config, 8 design tokens)
- Wired self-hosted pdf.js pipeline: worker copied to public/, cmaps + standard_fonts bundled via viteStaticCopy — PRV-02 enforced at build time
- Implemented Zustand view state machine (empty|loading|error|loaded) matching the downstream plans' interface contract exactly
- Created DocumentViewer skeleton (react-pdf Document+Page, page 1, no text/annotation layers) with correct pdfWorker import order guard
- App view-router with TopBar, LoadingSpinner, EmptyState (temporary file input), ErrorState — full UI frame for Plans 02-04 to extend
- 6 Vitest unit tests for documentStore state machine transitions all pass; `tsc --noEmit` clean; `npm run build` succeeds

## Task Commits

1. **Task 1: Scaffold Vite + React 19 + TS + Tailwind v4 + Vitest** - `7268a73` (chore)
2. **Task 2: Zustand state machine, App view-router, and PDF render slice** - `59e387e` (feat)
3. **Task 3: SKELETON.md** - no new commit required (draft already existed from planning, verified accurate against built artifacts with zero drift)

## Files Created/Modified

- `package.json` — project manifest with all pinned deps; `prepare` script copies pdf.worker.min.mjs
- `vite.config.ts` — @vitejs/plugin-react, @tailwindcss/vite, viteStaticCopy (cmaps + standard_fonts), Vitest jsdom test block
- `tsconfig.json` / `tsconfig.app.json` / `tsconfig.node.json` — composite project references; @types/node for vite.config
- `vercel.json` — outputDirectory: dist
- `index.html` — SPA entry with FreeESign title
- `eslint.config.js` — standard Vite react-ts ESLint config
- `.gitignore` — node_modules/, dist/, *.tsbuildinfo, research cache
- `src/vite-env.d.ts` — `/// <reference types="vite/client" />` for CSS module type resolution
- `src/index.css` — `@import "tailwindcss"` + 8 UI-SPEC :root tokens + .sr-only
- `src/main.tsx` — StrictMode ReactDOM.createRoot entry
- `src/App.tsx` — view-router (empty/loading/error/loaded branches); EmptyState + ErrorState inline
- `src/store/documentStore.ts` — Zustand useDocumentStore with ViewState, DocumentStore interface
- `src/lib/pdfWorker.ts` — sets GlobalWorkerOptions.workerSrc + exports pdfOptions
- `src/components/DocumentViewer.tsx` — react-pdf Document+Page skeleton (page 1 only)
- `src/components/TopBar.tsx` — 56px sticky header, wordmark, Open another button
- `src/components/LoadingSpinner.tsx` — 32px accent-stroke SVG spinner
- `src/test/setup.ts` — @testing-library/jest-dom import
- `src/test/documentStore.test.ts` — 6 state machine transition tests
- `public/pdf.worker.min.mjs` — self-hosted pdfjs-dist 5.4.296 worker

## Decisions Made

1. **pdfjs-dist 5.4.296 not 4.x:** RESEARCH correctly identified react-pdf 10.4.1 pins pdfjs-dist 5.4.296. Worker filename is `pdf.worker.min.mjs` (.mjs extension). CLAUDE.md stack doc was slightly stale on the version number.
2. **public/ copy pattern for worker:** Deterministic `/pdf.worker.min.mjs` path avoids Vite content-hash 404s on redeployment. Added as `prepare` npm script for fresh-clone reliability.
3. **composite tsconfig:** `tsconfig.node.json` needs `composite: true` for `tsc -b` project references to work with `@types/node`. Standard Vite react-ts template pattern.
4. **No create-vite scaffold:** `npm create vite@latest` cancelled on a non-empty directory. All scaffold files written manually — this produced identical output to the template.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `npm create vite@latest` cancelled on non-empty repo directory**
- **Found during:** Task 1 (scaffold step)
- **Issue:** `npm create vite@latest . -- --template react-ts` cancelled with "Operation cancelled" because `.planning/`, `CLAUDE.md`, and `.git/` existed in the directory
- **Fix:** Created all scaffold files manually (package.json, tsconfig variants, vite.config.ts, index.html, src/main.tsx, src/vite-env.d.ts, eslint.config.js, .gitignore) to match the react-ts template output exactly
- **Files modified:** All scaffold files
- **Verification:** `npm run build` succeeded, `tsc --noEmit` clean

**2. [Rule 2 - Missing critical functionality] Added @types/node**
- **Found during:** Task 1 (first build attempt)
- **Issue:** `vite.config.ts` uses `node:path` and `node:module` which require `@types/node`; TypeScript reported TS2307 errors
- **Fix:** Added `@types/node` as devDependency; added `"types": ["node"]` to tsconfig.node.json
- **Files modified:** package.json, tsconfig.node.json

**3. [Rule 2 - Missing critical functionality] Added `composite: true` to tsconfig.node.json**
- **Found during:** Task 1 (second build attempt)
- **Issue:** `tsc -b` with project references requires `composite: true` in referenced projects; TS6306/TS6310 errors
- **Fix:** Added `composite: true` to tsconfig.node.json
- **Files modified:** tsconfig.node.json

**4. [Rule 1 - Bug] Changed `/// <reference types="vitest" />` to `/// <reference types="vitest/config" />`**
- **Found during:** Task 1 (first build attempt)
- **Issue:** The `test` block in `vite.config.ts` with `defineConfig` was not recognized — TS2769 "no overload matches" error; `vitest` top-level reference does not expose config types
- **Fix:** Changed the triple-slash reference to `vitest/config` which provides the correct `UserConfig` extension including `test` field
- **Files modified:** vite.config.ts

**5. [Rule 2 - Missing functionality] Added documentStore.test.ts Vitest tests**
- **Found during:** Task 2 verification
- **Issue:** `npx vitest run` exited with code 1 ("No test files found") — plan acceptance criterion requires `vitest run` to execute, even with a trivial test
- **Fix:** Added 6 state machine transition tests for documentStore covering all action/state transitions
- **Files modified:** src/test/documentStore.test.ts (created)

## Deferred Human Verification (end-of-phase)

Task 4 was a `checkpoint:human-verify` with `gate="blocking"`. Per `workflow.human_verify_mode: end-of-phase`, this is deferred and recorded here for execution at end of Phase 1.

**What to verify:**
1. Run `npm run dev` and open the printed localhost URL
2. Open DevTools → Network tab; check "Disable cache" and clear the request log
3. Use the file picker to open any multi-page PDF. Confirm page 1 renders on screen
4. In the Network tab, sort/scan by Domain. Confirm EVERY request origin is localhost — specifically:
   - Worker loads from `/pdf.worker.min.mjs` (not a CDN URL)
   - No requests to cdnjs.cloudflare.com, unpkg.com, cdn.mozilla.net, fonts.gstatic.com, or any non-localhost host
5. (Optional) Run `npm run build && npx vite preview` and repeat the audit against the production build

**Resume signal:** "approved" if page 1 renders and Network tab shows zero third-party origins.

## Known Stubs

- `src/components/DocumentViewer.tsx` renders only page 1 (no multi-page navigation). This is an intentional skeleton stub. Plan 01-04 replaces it with the full multi-page viewer with lazy rendering and PageNavigation.
- `src/App.tsx` `EmptyState` uses a minimal `<input type="file">` instead of the full UploadZone drag-drop component. Plan 01-02 replaces it with the full UploadZone.

## Threat Flags

None. No new network endpoints, auth paths, or external data flows introduced. All network surface is static asset serving from own origin — enforced by PRV-02 architecture.

## Self-Check: PASSED

- `public/pdf.worker.min.mjs` exists: FOUND
- `src/store/documentStore.ts` exists: FOUND
- `src/lib/pdfWorker.ts` exists: FOUND
- `src/components/DocumentViewer.tsx` exists: FOUND
- `vite.config.ts` contains viteStaticCopy: CONFIRMED
- `src/index.css` starts with `@import "tailwindcss"`: CONFIRMED
- `npx tsc --noEmit`: CLEAN (0 errors)
- `npx vitest run`: PASSED (6/6 tests)
- `npm run build`: SUCCEEDED
- Commits 7268a73 and 59e387e: PRESENT in git log
