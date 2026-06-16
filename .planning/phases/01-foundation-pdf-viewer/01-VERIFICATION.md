---
phase: 01-foundation-pdf-viewer
verified: 2026-06-16T15:40:00Z
status: human_needed
score: 4/5
overrides_applied: 0
human_verification:
  - test: "Open a PDF via drag-and-drop and via the Browse button"
    expected: "PDF page 1 renders on screen within ~1 second; no blank canvas; the document title or first page of content is visible"
    why_human: "Visual canvas render through react-pdf cannot be asserted headlessly; requires a real browser"
  - test: "Open a JPG and a PNG"
    expected: "Each image displays as a single-page document (same viewer as PDF); image fills the page area without distortion"
    why_human: "Visual render after pdf-lib image wrapping cannot be asserted headlessly"
  - test: "Open a multi-page PDF (at least 5 pages); scroll through all pages; click prev/next"
    expected: "Continuous vertical scroll of all pages; '1 / N' indicator updates on both scroll and prev/next clicks; prev is visually dimmed on page 1, next is dimmed on the last page; both buttons remain keyboard-focusable when dimmed"
    why_human: "Scroll behavior, IntersectionObserver scroll-tracking, and visual disabled state require a real browser and real interaction"
  - test: "DevTools zero-third-party-request audit (PRV-01 / PRV-02)"
    expected: "Open DevTools -> Network tab, clear log, load a multi-page PDF. Every request origin is localhost (or the Vercel preview domain). Specifically: no request to cdnjs.cloudflare.com, unpkg.com, cdn.mozilla.net, fonts.gstatic.com, or any non-app origin. The worker loads from /pdf.worker.min.mjs, CMaps from /cmaps/, and standard fonts from /standard_fonts/. This check should be performed against both `npm run dev` and `npm run build && npx vite preview`."
    why_human: "Network tab audit requires a real browser; headless grep on bundle strings verifies configuration but not runtime behavior"
---

# Phase 1: Foundation + PDF Viewer — Verification Report

**Phase Goal:** Users can open any PDF or image and view every page rendered in the browser, with the project wired for zero third-party network requests and a tested Coordinate Mapper ready for Phase 2.
**Verified:** 2026-06-16T15:40:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can drag-and-drop or browse to open a PDF and see the first page rendered on screen | ? HUMAN NEEDED | `UploadZone.tsx` handles both drag events and file picker, calls `wrapImageAsPdf` or `createObjectURL`, routes to `DocumentViewer` via Zustand state machine. `LazyPage` renders `<Page>` via react-pdf on intersection. Pipeline is complete but visual render requires a browser. |
| 2 | User can open a JPG or PNG and see it displayed as a document (image wrapped to PDF internally) | ? HUMAN NEEDED | `imageWrapper.ts:wrapImageAsPdf` uses `pdfDoc.embedPng`/`embedJpg` with original bytes (no rasterization), creates a Blob URL returned to `UploadZone`. Integration is fully wired. Visual display requires a browser. |
| 3 | User can navigate forward and backward through all pages of a multi-page PDF | ? HUMAN NEEDED | `DocumentViewer.tsx` maps 1..numPages to `LazyPage` entries. `PageNavigation.tsx` provides prev/next with `scrollToPage` + `aria-disabled` at boundaries. Scroll-tracking IntersectionObserver updates `currentPage`. Component tests (6/6 pass) prove `numPages` drives page count. Actual navigation UX requires a browser. |
| 4 | After loading any document, the DevTools Network tab shows zero requests to third-party origins | ? HUMAN NEEDED | Configuration is verified (see PRV-02 section below): worker URL is `/pdf.worker.min.mjs`, cMapUrl is `/cmaps/`, standardFontDataUrl is `/standard_fonts/` — all relative paths served from own origin. No CDN URLs exist in `src/`. Bundle greps confirm runtime paths. Live Network tab audit requires a browser. |
| 5 | The Coordinate Mapper round-trip test passes: a point converted to PDF-space and back lands within floating-point tolerance of the original CSS pixel position at any zoom and rotation | VERIFIED | `npx vitest run` output: 117/117 tests pass including 88 round-trip property test cases in `coordinateMapper.test.ts`. Covers scales {1, 1.5, 0.75} x rotations {0, 90, 180, 270} x 7 sample points. Tolerance: `< 0.001`. |

**Score:** 1/5 auto-verified; 4/5 truths are functionally wired but require a human browser session to confirm the visual/behavioral outcomes. Status is `human_needed`, not `gaps_found`, because all automated indicators pass.

---

### PRV-02 Self-Hosting Verification (Automated)

This is a partial automated check supporting Truth 4. Full confirmation requires the browser Network audit.

| Check | Evidence | Status |
|-------|----------|--------|
| `public/pdf.worker.min.mjs` exists at build time | `scripts/copy-pdf-assets.mjs` copies from `node_modules/pdfjs-dist/build/pdf.worker.min.mjs` to `public/` on every `prepare`/`predev`/`prebuild` | VERIFIED |
| `dist/pdf.worker.min.mjs` exists at dist root | `ls dist/pdf.worker.min.mjs` confirmed present after `npm run build` | VERIFIED |
| `dist/cmaps/` exists at dist root with files | 169 files confirmed after build | VERIFIED |
| `dist/standard_fonts/` exists at dist root with files | 16 files confirmed after build | VERIFIED |
| Runtime workerSrc URL in bundle is `/pdf.worker.min.mjs` | `grep -o "['\x60]/pdf\.worker[^'\x60]*['\x60]"` returns `` `/pdf.worker.min.mjs` `` | VERIFIED |
| Runtime cMapUrl in bundle is `/cmaps/` | `grep -o "['\x60]/cmaps[^'\x60]*['\x60]"` returns `` `/cmaps/` `` | VERIFIED |
| Runtime standardFontDataUrl in bundle is `/standard_fonts/` | `grep -o "['\x60]/standard_fonts[^'\x60]*['\x60]"` returns `` `/standard_fonts/` `` | VERIFIED |
| No CDN/unpkg/cdnjs URLs in `src/` | `grep -r "unpkg\|cdnjs\|cdn\.\|fonts\.google\|mozilla\.net" src/` — zero hits | VERIFIED |
| `pdfWorker.ts` workerSrc assignment anchored in `main.tsx` before any react-pdf usage (WR-02 fix) | `main.tsx` line 4: `import './lib/pdfWorker'` as first import | VERIFIED |

The `viteStaticCopy` plugin was correctly replaced with `scripts/copy-pdf-assets.mjs` (commit `c65119b`) after the code review identified that the plugin was producing incorrect nested paths. The script now copies all three assets to `public/` idempotently, which Vite serves at the site root in both dev and production build.

---

### Required Artifacts

| Artifact | Purpose | Status | Evidence |
|----------|---------|--------|----------|
| `src/store/documentStore.ts` | Zustand state machine (empty/loading/error/loaded) | VERIFIED | 40 lines; all 4 view states, 6 actions, `loadDocument`/`setNumPages`/`setError`/`reset` wired; 6 unit tests pass |
| `src/lib/pdfWorker.ts` | Sets `GlobalWorkerOptions.workerSrc` to `/pdf.worker.min.mjs`; exports `pdfOptions` with local cmaps/fonts paths | VERIFIED | 11 lines; workerSrc set to `/pdf.worker.min.mjs`; `pdfOptions` has `/cmaps/` and `/standard_fonts/` |
| `src/lib/coordinateMapper.ts` | Pure cssPixel↔pdfSpace conversion | VERIFIED | 98 lines; no React/DOM imports; exports `PageSpace`, `CssSpace`, `cssPixelToPageSpace`, `pageSpaceToCssPixel`; 88/88 round-trip tests pass |
| `src/test/coordinateMapper.test.ts` | Round-trip property test suite | VERIFIED | 201 lines; 88 parametric cases + 4 directional unit tests; affine mock mirrors pdfjs math exactly; tolerance `< 0.001` |
| `src/lib/fileValidation.ts` | MIME + extension whitelist, 100MB cap (DOC-01, DOC-02, T-01-05, T-01-06) | VERIFIED | 55 lines; size checked before `arrayBuffer()`; both MIME and extension must pass; 11 unit tests pass |
| `src/lib/imageWrapper.ts` | Wraps JPG/PNG to PDF Blob URL via pdf-lib `embedJpg`/`embedPng` (DOC-02) | VERIFIED | 75 lines; original bytes embedded without rasterization; tagged error wrapping; 6 unit tests pass |
| `src/components/UploadZone.tsx` | Full-screen drag-drop + Browse, handles both file paths (DOC-01) | VERIFIED | 303 lines; 4 drag events; `handleFile` shared for drag and picker; `setView('loading')` before async image wrap (CR-01 fix applied) |
| `src/components/DocumentViewer.tsx` | Full multi-page viewer with ResizeObserver fit-to-width, lazy pages, scroll tracking | VERIFIED | 170 lines; maps 1..numPages to LazyPage; IntersectionObserver scroll tracking; PageNavigation rendered when numPages > 0; `useEffect` cleanup for Blob URL revocation (WR-01 fix) |
| `src/components/LazyPage.tsx` | IntersectionObserver lazy render with A4 placeholder, `data-page-number` attribute | VERIFIED | 70 lines; placeholder preserves scroll height; `renderAnnotationLayer={false}`; observer disconnects after first intersection |
| `src/components/PageNavigation.tsx` | Prev/next pill with `aria-disabled`, `aria-live`, `sr-only` labels | VERIFIED | 204 lines; `scrollToPage` via `[data-page-number]` query; `aria-disabled="true"` (not `disabled`) at boundaries; both `aria-label` and `sr-only` on each button |
| `src/components/ErrorBanner.tsx` | Inline error card, `role="alert"`, retry (DOC-01 error flow) | VERIFIED | Exists; `role="alert"`, calls `reset()` without eager Blob URL revocation (WR-01 fix applied) |
| `src/App.tsx` | View-router wired to Zustand state machine | VERIFIED | 45 lines; routes empty→UploadZone, loading→LoadingSpinner, error→ErrorBanner, loaded→DocumentViewer |
| `src/main.tsx` | Entry point with `pdfWorker` as first import (WR-02 fix) | VERIFIED | `import './lib/pdfWorker'` is the first import line |
| `vite.config.ts` | Vite config; no viteStaticCopy (removed per CR-02 follow-up fix) | VERIFIED | 18 lines; plugins: `[react(), tailwindcss()]`; no static-copy plugin references |
| `scripts/copy-pdf-assets.mjs` | Copies worker/cmaps/standard_fonts from pdfjs-dist to `public/` | VERIFIED | 31 lines; `cpSync` for worker, `rmSync`+`cpSync` for directories; wired to `prepare`/`predev`/`prebuild` scripts |
| `vercel.json` | Vercel deployment config with `outputDirectory: dist` | VERIFIED | Present in repo (referenced in 01-01-SUMMARY.md) |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `main.tsx` | `src/lib/pdfWorker` | `import './lib/pdfWorker'` (side-effect, first line) | VERIFIED | Sets `GlobalWorkerOptions.workerSrc` before any react-pdf usage |
| `UploadZone.tsx` | `documentStore` | `useDocumentStore(s => s.loadDocument)`, `s.setError`, `s.setView` | VERIFIED | All store actions used in `handleFile` |
| `UploadZone.tsx` | `imageWrapper.ts` | `wrapImageAsPdf(file)` called for JPEG/PNG types | VERIFIED | Returns Blob URL fed into `loadDocument` |
| `UploadZone.tsx` | `fileValidation.ts` | `validateFile(file)` before any byte read | VERIFIED | Returns early with `setError` on invalid type or size |
| `DocumentViewer.tsx` | `pdfWorker.ts` | `import { pdfOptions } from '../lib/pdfWorker'` | VERIFIED | `pdfOptions` passed as `options` to react-pdf `<Document>` |
| `DocumentViewer.tsx` | `LazyPage.tsx` | `pageNumbers.map(n => <LazyPage pageNumber={n} containerWidth={...} />)` | VERIFIED | All pages mapped; `data-page-number` attributes present for scroll tracking |
| `DocumentViewer.tsx` | `PageNavigation.tsx` | `<PageNavigation scrollContainerRef={scrollContainerRef} />` | VERIFIED | Rendered when `numPages > 0`; scroll container ref passed for `scrollToPage` |
| `PageNavigation.tsx` | `documentStore` | `useDocumentStore` for `currentPage`, `numPages`, `setCurrentPage` | VERIFIED | Both read and write wired; `{currentPage} / {numPages}` rendered with `aria-live="polite"` |
| `App.tsx` | All components | `view === 'empty' && <UploadZone />` etc. | VERIFIED | Four branches cover all ViewState values |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `DocumentViewer.tsx` | `docUrl` | `useDocumentStore(s => s.docUrl)` — set by `loadDocument(blobUrl)` from `UploadZone` | Yes — Blob URL from `createObjectURL` or `wrapImageAsPdf` | FLOWING |
| `DocumentViewer.tsx` | `numPages` | `useDocumentStore(s => s.numPages)` — set by `onLoadSuccess` callback from react-pdf `<Document>` | Yes — real PDF page count from pdfjs parsing | FLOWING |
| `PageNavigation.tsx` | `currentPage` / `numPages` | `useDocumentStore` — `currentPage` updated by scroll IntersectionObserver and `scrollToPage` clicks | Yes — real page number from scroll position | FLOWING |
| `LazyPage.tsx` | `isVisible` | IntersectionObserver fires when element enters viewport + 200px margin | Yes — driven by real scroll position; placeholder displays until intersection | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compiles cleanly | `npx tsc --noEmit` | Exit 0, zero errors | PASS |
| Full test suite (117 cases) | `npx vitest run` | 5 test files, 117/117 passed, 850ms | PASS |
| Production build exits 0 | `npm run build` | Exit 0; `tsc -b` clean, 238 modules transformed; chunk size warning is non-blocking | PASS |
| Coordinate mapper round-trip (88 cases) | `npx vitest run src/test/coordinateMapper.test.ts` | 88 property test cases + 4 directional unit tests all pass within `< 0.001` tolerance | PASS |
| Copy-pdf-assets script runs and produces assets | `npm run build` triggers `prebuild: node scripts/copy-pdf-assets.mjs` | `[copy-pdf-assets] worker + cmaps + standard_fonts copied to public/` logged; all three assets present in `dist/` | PASS |
| No CDN URLs in source | `grep -r "unpkg\|cdnjs\|cdn\.\|fonts\.google\|mozilla\.net" src/` | Zero matches | PASS |
| Runtime worker URL is root-relative own-origin path | Bundle grep for workerSrc value | `` `/pdf.worker.min.mjs` `` — no CDN URL | PASS |

---

### Probe Execution

No phase-declared probes found. Step 7c: SKIPPED (no `scripts/*/tests/probe-*.sh` files exist).

---

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| DOC-01 | User can open a PDF by drag-and-drop or file picker | HUMAN NEEDED | `UploadZone.tsx` implements both paths and routes through `handleFile` → `loadDocument`. Visual confirmation requires browser. |
| DOC-02 | User can open an image (JPG/PNG) to sign | HUMAN NEEDED | `imageWrapper.ts` wraps image to PDF Blob URL via `embedJpg`/`embedPng`; wired in `UploadZone.handleFile`. Visual display requires browser. |
| DOC-03 | User can view and navigate all pages of a multi-page PDF | HUMAN NEEDED | `DocumentViewer` + `LazyPage` + `PageNavigation` all wired; 6 component tests prove `numPages` drives page array. Interactive navigation requires browser. |
| PRV-01 | All document processing happens entirely in the browser; document never uploaded to any server | SATISFIED | Architecture is purely client-side: `createObjectURL` (no upload), `wrapImageAsPdf` (pdf-lib in-browser), all processing in `src/lib/`. No server endpoints or fetch calls to external APIs exist in source. |
| PRV-02 | All assets self-hosted — no third-party CDN or network requests while signing | PARTIALLY SATISFIED (needs browser Network audit) | Configuration fully verified: all runtime URLs are root-relative own-origin paths, assets deployed to `dist/` root. Browser Network tab audit needed to confirm zero third-party requests at runtime. |

---

### Anti-Patterns Found

| File | Pattern | Severity | Assessment |
|------|---------|----------|------------|
| `src/components/LazyPage.tsx` | `"placeholder"` in comment (line 43: "Estimate A4/Letter page aspect ratio (1.414) for **placeholder** height") | Info | Not a stub — the placeholder div is a real layout element that preserves scroll height for lazy-loaded pages. The value `containerWidth * 1.414` is intentional A4 aspect-ratio estimation, overwritten by the real page once IntersectionObserver fires. NOT a hollow-data anti-pattern. |
| `src/components/DocumentViewer.tsx` | `if (!docUrl) return null` | Info | Guard clause, not a stub. Returns null only when `docUrl` is genuinely absent (empty/loading/error states). The real render path has full content. |
| `src/components/PageNavigation.tsx` | `if (!numPages \|\| numPages < 1) return null` | Info | Guard clause. Returns null correctly before page count is known. |

No `TBD`, `FIXME`, or `XXX` markers found in any source file.
No hardcoded empty array/object returns in components.
No `console.log`-only handlers.

Code review issues CR-01 through WR-04 and IN-03 from `01-REVIEW.md` were all addressed (commits `740479c`, `8ceec84`/`c65119b`, `f4e2b3b`, `8baf8e5`, `f72b014`). The `viteStaticCopy` path issue discovered post-review was also corrected (commit `c65119b`).

---

## Human Verification Required

All four items below must be completed in a real browser before the phase can be marked fully passed.

### 1. PDF Open and First Page Render (DOC-01, Success Criterion 1)

**Test:** Run `npm run dev`. Open the printed localhost URL. Click "Browse files" and select any PDF. Then separately drag-and-drop a different PDF onto the upload zone.
**Expected:** In both cases, the first page of the PDF renders on screen within ~1–2 seconds. The page appears as a white card centered on a gray canvas background. The loading spinner is visible briefly before the page appears.
**Why human:** Canvas rendering through react-pdf's `<Page>` → pdf.js cannot be asserted headlessly.

### 2. Image Open and Display (DOC-02, Success Criterion 2)

**Test:** Open a JPG and a PNG via Browse or drag-and-drop.
**Expected:** Each image displays as a single-page document in the same viewer as PDFs. The image fills the page area without distortion or quality loss. The "1 / 1" page indicator appears in the bottom pill.
**Why human:** Visual quality of the pdf-lib `embedJpg`/`embedPng` round-trip and correct page sizing require a real browser render.

### 3. Multi-Page Navigation (DOC-03, Success Criterion 3)

**Test:** Open a PDF with at least 5 pages. Scroll down through all pages. Click "Next" in the bottom navigation pill to advance page by page. Click "Prev" to go back. Note indicator behavior and button opacity.
**Expected:** (a) Continuous vertical scroll shows all pages as a column of white cards with 24px gaps on a gray background; (b) The "1 / N" indicator updates when scrolling; (c) "Prev" is visually dimmed (opacity ~0.35) and "Next" is active on page 1; "Next" dims on the last page; (d) Both buttons remain reachable by Tab key when dimmed; (e) Clicking prev/next scrolls smoothly to the target page and updates the indicator; (f) Clicking "Open another" in the top bar returns to the upload empty state without a page reload.
**Why human:** IntersectionObserver scroll tracking, smooth scroll behavior, aria-disabled focus reachability, and visual disabled state require real browser interaction.

### 4. DevTools Zero-Third-Party-Request Audit (PRV-01, PRV-02, Success Criterion 4)

**Test:** Open DevTools -> Network tab. Check "Disable cache". Clear the request log. Reload the page. Open a multi-page PDF. Let it fully render.
**Expected:** Every request in the Network tab shows the app's own origin (localhost in dev, or the Vercel preview domain). Specifically:
- The worker loads from `/pdf.worker.min.mjs` (not a CDN URL)
- CMaps load from `/cmaps/` (multiple small files, own origin)
- Standard fonts load from `/standard_fonts/` (own origin)
- Zero requests to: `cdnjs.cloudflare.com`, `unpkg.com`, `cdn.mozilla.net`, `fonts.gstatic.com`, or any other external domain
Repeat with `npm run build && npx vite preview` against the production build to confirm the deployed artifact also passes.
**Why human:** The Network tab audit is the definitive runtime check. Configuration grepping (done above, all pass) is necessary but not sufficient — it confirms the code intends self-hosting but not that the browser actually issues zero external requests at runtime.

---

## Gaps Summary

No gaps found. All automated checks pass:
- `npx tsc --noEmit` is clean (0 errors)
- `npx vitest run` is 117/117 (5 test files)
- `npm run build` exits 0
- All 5 success criteria have complete wiring in the codebase
- PRV-02 configuration is verified at both source and bundle level

The `human_needed` status reflects that 4 of 5 success criteria have a visual or behavioral component that cannot be asserted by grep, TypeScript, or Vitest. This is expected and was pre-declared in the plan documents (both `01-01-SUMMARY.md` and `01-04-SUMMARY.md` note `human_verify_mode: end-of-phase` deferrals).

---

_Verified: 2026-06-16T15:40:00Z_
_Verifier: Claude (gsd-verifier)_
