# Project Research Summary

**Project:** FreeESign
**Domain:** Browser-only, privacy-first PDF e-signature web app (self-signing)
**Researched:** 2026-06-16
**Confidence:** HIGH

## Executive Summary

FreeESign is a static, client-side SPA that lets users sign PDF documents in the browser without uploading anything to a server. The product's entire identity rests on three non-negotiable properties: free to use, no uploads, and original content unaltered. Research confirms that the combination of these three properties has no direct competitor in the current free-tool landscape — most competing tools fail on at least one. The recommended build path is Vite + React (not Next.js), with pdf.js/react-pdf for rendering, pdf-lib for the export overlay, and IndexedDB (idb-keyval) for signature persistence. The core of the app is not the UI — it is the Coordinate Mapper module that converts between browser/DOM pixel space and PDF user-space. Everything else depends on getting that module right.

The highest-risk technical decision is how pdf-lib writes the signed output. STACK.md frames the standard `load()+save()` as an "overlay approach" that preserves visual and semantic content (text does not get re-rendered; images are not re-compressed with a lossy codec). However, ARCHITECTURE.md and PITFALLS.md both recommend using `PDFDocument.load(bytes, { forIncrementalUpdate: true })` followed by an incremental save, which appends new objects to the end of the original bytes and leaves the original content streams byte-for-byte identical. **Incremental save is the recommended default for FreeESign** because the product's core promise is "original content unaltered" — and incremental save is the only approach that makes that promise hold forensically, not just visually. The practical risk is that `pdf-lib-incremental-save` is a community package with uncertain long-term maintenance; if it becomes unviable, fall back to standard `save({ useObjectStreams: true })` and document the distinction clearly. This decision must be validated and locked during the export phase.

Key risks are concentrated in the PDF overlay phase: coordinate inversion (PDF bottom-left vs. DOM top-left), devicePixelRatio scaling errors, page rotation handling, and zoom-level drift. All of these are mitigated by a single strategy: build and test the Coordinate Mapper module first, before any UI work, and never store CSS pixel coordinates in the field store — only PDF user-space points. Privacy enforcement is equally critical: self-host all fonts, the pdf.js worker, and CMap files; never load from a CDN at runtime; never add Sentry or Google Analytics.

---

## Key Findings

### Recommended Stack

The stack is a pure client-side SPA with no server-side rendering requirements. Vite + React is the correct framework choice; Next.js App Router creates unnecessary friction because every library in this stack (pdf.js, canvas, signature_pad, react-rnd, idb-keyval) requires `"use client"` directives or SSR bailouts. Vite's `dist/` output deploys to Vercel as static assets with zero configuration. TypeScript is essential for catching coordinate-math bugs at compile time. Tailwind CSS v4 (CSS-native, no config file) keeps the styling footprint minimal.

**Core technologies:**
- **Vite 8 + React 19 + TypeScript 5**: Static SPA — no SSR overhead, deploys as static assets to Vercel
- **react-pdf 10 + pdfjs-dist 4**: PDF rendering to canvas — react-pdf manages the pdf.js worker lifecycle; do not upgrade pdfjs-dist independently (worker version mismatch)
- **pdf-lib 1.17.1**: PDF overlay and export — loads original bytes, draws signature objects, saves (incremental preferred; see reconciliation note above)
- **@pdf-lib/fontkit 1.1.1**: Required for embedding script TTF fonts for typed signatures; always use `{ subset: true }` to keep file size small
- **signature_pad 5.1.3**: Freehand canvas drawing — outputs PNG data URL directly, embeds into pdf-lib via `embedPng()` with no intermediate step
- **react-rnd 10.5.3**: Drag and resize of placed fields in a single component — @dnd-kit lacks resize; react-rnd is the obvious fit
- **idb-keyval 6.2.5**: IndexedDB-backed persistence for saved signatures — localStorage is capped at 5 MB (fragile for PNG data URLs); IndexedDB gives gigabytes with a simple promise API
- **Zustand 5**: In-session UI state (document model, placed fields, active tool, selected field) — 1 KB, no boilerplate, predictable for cross-component state
- **Tailwind CSS 4**: CSS-native configuration, utility-first, no runtime

**Version constraint:** react-pdf 10 pins pdfjs-dist v4. Do not upgrade pdfjs-dist independently.

### Expected Features

The MVP is well-defined. All features needed for "upload -> sign -> download" are low-to-medium complexity and require no backend. The main complexity is the annotation overlay system and coordinate mapping.

**Must have (table stakes):**
- Drag-and-drop + click-to-browse file upload (PDF and image) — without this, nothing works
- Multi-page PDF rendering with page navigation (prev/next, jump) — real documents are multi-page
- Draw signature (canvas, signature_pad) — the primary signing metaphor
- Type signature in script fonts (Dancing Script, Great Vibes, Pacifico, self-hosted TTF) — essential for trackpad/laptop users
- Place, drag, resize, delete signature/initials/date/text/checkbox fields — the core interaction loop
- Flatten and download signed PDF — the entire reason the user came; never paywalled
- "Files never leave your browser" trust signal, prominent in the editor and landing page — core differentiator

**Should have (competitive differentiators):**
- Saved signatures in IndexedDB — reuse across sessions without re-drawing; most browser-only tools skip this
- Undo/redo (Ctrl+Z / Cmd+Z, ~10 levels) — no competitor offers this; significant UX safety net
- In-app zoom controls (50%-200%) — Sejda explicitly warns users not to use browser zoom because it breaks coordinate mapping; in-app zoom that scales the overlay proportionally avoids this entirely
- Upload image of existing signature — third creation method, low effort, covers wet-ink scan use case
- Word doc prompt ("Save as PDF first") — prevents a silent failure mode; honest and user-friendly

**Defer (v2+):**
- Multi-party / send-to-others signing — requires email routing, signing order, audit trails, and a backend; 10x the build of v1
- Page thumbnail sidebar — useful for long documents; defer until multi-page UX is validated as a pain point
- PKI / cryptographic digital signatures — different product tier; visual electronic signatures cover the vast majority of everyday documents
- PDF editing (merge, split, rotate, compress) — dilutes the signing focus

### Architecture Approach

The architecture is a layered SPA with a strict separation of concerns: a pure `core/` layer of framework-agnostic TypeScript modules (coordinate mapper, field store, export pipeline, signature store, file ingestor) and a `components/` layer that only handles UI. Each PDF page is rendered by a `<canvas>` (pdf.js) with an absolutely-positioned HTML `<div>` overlay (react-rnd fields) sharing identical dimensions. The Coordinate Mapper is the foundational shared module — it is the first thing to build and test, before any UI. All field coordinates are stored in PDF user-space (bottom-left origin, points) and derived to CSS pixels on render; CSS pixel coordinates are never stored.

**Major components:**

1. **Coordinate Mapper (`core/coordinate-mapper.ts`)** — Converts between PDF user-space and CSS pixel space using pdf.js `PageViewport.convertToPdfPoint` / `convertToViewportPoint`. Handles zoom, DPR, and page rotation automatically. This is the highest-risk module; test it with a round-trip fixture before building anything else.
2. **Field Store (`core/field-store.ts`)** — Zustand store holding `PlacedField[]` in PDF user-space coordinates. Includes `recipientId: 'self'` and `recipientRole: 'signer'` on every field — the multi-party extension seam. No schema rewrite is needed to add multi-party later; only new consumers of existing fields.
3. **Export Pipeline (`core/export-pipeline.ts`)** — Pure function: receives `originalBytes: Uint8Array` and `fields: PlacedField[]`, returns `Uint8Array`. No React imports, no global state. Can run in a Web Worker without refactoring. Uses `PDFDocument.load(bytes, { forIncrementalUpdate: true })` (preferred) or `save({ useObjectStreams: true })` (fallback).
4. **Page Container + Canvas + Overlay (`components/workspace/`)** — `PageContainer` owns one `PageViewport` ref (single source of truth for geometry), renders `PageCanvas` (pdf.js canvas) and `FieldOverlay` (absolute overlay) with identical dimensions. They share `viewport` via the parent.
5. **Signature Manager (`components/signature-manager/`)** — Draw pad (signature_pad) + type pad (script fonts). Produces PNG data URL. Saves to Signature Store (IndexedDB via idb-keyval).
6. **File Ingestor (`core/ingestor.ts`)** — Normalizes PDF and image uploads to a uniform `DocumentModel`. Images are immediately wrapped in a single-page PDF using pdf-lib so the entire downstream pipeline only ever handles PDFs.

**Recommended build order (from ARCHITECTURE.md):**
1. Types -> 2. Coordinate Mapper (build + test first) -> 3. File Ingestor -> 4. Field Store -> 5. Page Renderer -> 6. Field Overlay -> 7. Signature Manager + Signature Store -> 8. Export Pipeline -> 9. App Shell / Toolbar -> 10. Landing Page

The app is shippable as a read-only PDF viewer after step 6, which allows verifying canvas/overlay alignment before any export code is written.

### Critical Pitfalls

1. **Incremental save vs. full rewrite (CRITICAL)** — `PDFDocument.save()` without incremental update rewrites the entire PDF, silently violating the "original content unaltered" promise. Use `PDFDocument.load(bytes, { forIncrementalUpdate: true })` and the `pdf-lib-incremental-save` package. Verify by hex-diffing the first 512 bytes of input and output — they must be identical. If the incremental-save package becomes unviable, fall back to standard save with `{ useObjectStreams: true }` and document the trade-off. Flag as a decision to lock during the export phase.

2. **Coordinate system inversion (Y-axis)** — PDF user-space has a bottom-left origin (Y up); the DOM has a top-left origin (Y down). Missing this inversion places every signature mirrored vertically. Delegate all coordinate conversion to the pdf.js `PageViewport` transform; never hand-roll a Y-flip. Write a unit test: place a field at DOM top-left, verify it lands at PDF top-left in the export.

3. **devicePixelRatio scaling** — On Retina/HiDPI displays, `canvas.width` is physical pixels but mouse events are CSS pixels. Mixing the two introduces a 2x placement error. The safe formula: derive position from `canvasEl.getBoundingClientRect()`, not `canvas.width`. The Coordinate Mapper handles this when constructed correctly with `viewport` and `dpr`.

4. **pdf.js worker not loaded in production** — pdf.js requires a Web Worker file that bundlers do not automatically resolve. Copy `pdf.worker.min.mjs` to `public/` and set `GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'`. Establish this in the first rendering phase; a "Setting up fake worker" console message is the failure indicator.

5. **Privacy leakage via third-party assets** — Loading fonts from Google Fonts, CMaps from jsDelivr, or adding Sentry/analytics SDKs breaks the "never leaves your browser" promise. Self-host all fonts (bundle as `src/assets/fonts/`), copy CMap files to `public/cmaps/`, use zero third-party CDN requests. Enforce via a Content Security Policy. Audit with DevTools Network tab before first public release.

6. **localStorage quota failures** — PNG signature data URLs are 50-200 KB each. localStorage is capped at 5 MB (near zero in iOS Safari private browsing). Use IndexedDB (idb-keyval) from day one. Retrofitting from localStorage to IndexedDB is non-trivial; do not use localStorage as a shortcut.

---

## Implications for Roadmap

Based on combined research, a 6-phase roadmap is recommended. The critical path is: foundation -> PDF viewing -> field overlay -> signing -> export -> launch.

### Phase 1: Project Foundation + Scaffolding
**Rationale:** Establish the build toolchain, types, and the Coordinate Mapper before any UI work. The Coordinate Mapper is load-bearing for every phase that follows; bugs here propagate everywhere. Setting up privacy constraints (no CDN, self-hosted assets, CSP) at the start is far cheaper than retrofitting.
**Delivers:** Working Vite + React + TypeScript project with Tailwind; pdf.js worker configured in `public/`; CMap files in `public/cmaps/`; script fonts self-hosted in `src/assets/fonts/`; `types/index.ts` with `PlacedField`, `DocumentModel`, `SavedSignature`; `core/coordinate-mapper.ts` with unit tests (round-trip and rotation fixtures); basic Vercel deployment.
**Avoids:** Pitfalls 7 (worker), 8 (CMaps), 12 (privacy leakage), 16 (Next.js SSR)
**Research flag:** Standard patterns — no additional research needed.

### Phase 2: PDF Viewing
**Rationale:** Users need to see their document before placing fields. This phase validates the canvas rendering pipeline and establishes the `PageContainer`/`PageCanvas`/`FieldOverlay` structural pattern that Phase 3 builds on top of.
**Delivers:** File upload (drag-drop + picker, PDF and image normalization via ingestor), multi-page PDF rendering via react-pdf/pdf.js, page navigation, in-app zoom controls, Word doc prompt for .docx files, lazy-loading of PDF libraries behind the app route.
**Uses:** react-pdf, pdfjs-dist, File Ingestor (`core/ingestor.ts`)
**Avoids:** Pitfalls 7 (worker), 8 (CMaps), 9 (large PDF memory leaks), 16 (SSR)
**Research flag:** Standard patterns — react-pdf documentation is comprehensive.

### Phase 3: Field Overlay + Placement
**Rationale:** This is the highest-risk phase architecturally. It builds the Coordinate Mapper integration, the Field Store, and the drag/resize system. It must be correct before the Export Pipeline is written, because export translates from the same stored coordinates.
**Delivers:** `core/field-store.ts` (Zustand, PlacedField in PDF user-space, recipientId/role seam included); `components/workspace/FieldOverlay.tsx`; react-rnd field widgets for all field types (signature, initials, date, text, checkbox); drag, resize, delete; undo/redo command stack (~10 levels); fields survive zoom changes because coordinates are PDF-space-native.
**Uses:** react-rnd, Zustand, Coordinate Mapper
**Avoids:** Anti-pattern of storing CSS pixel coords; Pitfalls 3 (DPR), 5 (zoom drift)
**Research flag:** Needs research during planning — react-rnd controlled-mode + zoom-aware PDF-space coordinate update loop needs a working prototype before the implementation plan is finalized.

### Phase 4: Signature Creation + Persistence
**Rationale:** This phase adds the signature creation UI and IndexedDB persistence. It depends on Phase 3 fields to know where to inject a signature value into a `PlacedField.value`. Keeping it a separate phase ensures the overlay system is stable before adding the modal/panel flow.
**Delivers:** Draw pad (signature_pad canvas, clear button, confirm), type pad (3 script fonts, font picker), upload signature image; `core/signature-store.ts` (idb-keyval, IndexedDB); saved signatures panel (up to 5 saved, reuse without re-drawing); high-resolution signature re-render for print quality.
**Uses:** signature_pad, idb-keyval, @pdf-lib/fontkit
**Avoids:** Pitfalls 10 (blurry in print), 11 (localStorage quota), 15 (iOS touch/scroll conflict)
**Research flag:** Standard patterns — signature_pad integration and iOS `touch-action: none` fix are documented.

### Phase 5: Export Pipeline
**Rationale:** By this phase, the full field store is populated and the original bytes have been held in memory since upload. This phase converts fields -> pdf-lib draw operations -> Uint8Array download. It is the most technically sensitive phase because of the incremental-save decision.
**Delivers:** `core/export-pipeline.ts` (pure function, no React imports); incremental save using `PDFDocument.load(originalBytes, { forIncrementalUpdate: true })` + `pdf-lib-incremental-save` (preferred); typed signature font embedding with fontkit (`subset: true`); signed download as `[originalname]-signed.pdf`; export spinner for large files; hex-diff verification test.
**Uses:** pdf-lib, @pdf-lib/fontkit, pdf-lib-incremental-save (or fallback)
**Avoids:** Pitfalls 1 (full rewrite), 2 (Y-axis), 3 (DPR), 4 (rotation), 5 (zoom), 6 (WinAnsi crash), 13 (hyperlinks lost)
**Research flag:** Needs research during planning — validate `pdf-lib-incremental-save` maintenance status and compatibility with pdf-lib 1.17.1 before writing export code. If unviable, document the fallback and update landing page copy.

### Phase 6: Landing Page + Launch Readiness
**Rationale:** The signing tool is complete after Phase 5. This phase adds the marketing surface, final privacy audit, and production deployment. The landing page is independent of PDF libraries and lazy-split to load at < 50 KB.
**Delivers:** Landing page with personal hero copy, how-it-works, FAQ (including "is this legally binding?" note), optional Buy Me a Coffee footer link; Content Security Policy header; DevTools Network audit (zero non-origin requests after page load); Vercel production deployment; "Looks Done But Isn't" checklist from PITFALLS.md completed.
**Avoids:** Pitfall 12 (third-party data leakage — CSP audit)
**Research flag:** Standard patterns — pure content and copywriting work.

### Phase Ordering Rationale

- The Coordinate Mapper must exist and be tested before any field placement code is written. Coordinate bugs propagate into both the overlay (wrong visual position) and the export (wrong PDF position).
- The `PageContainer`/`PageCanvas`/`FieldOverlay` DOM structure must be stable and rendering correctly before react-rnd widgets are mounted on top of it. Viewport sharing between canvas and overlay must be verified at the viewing phase.
- The export pipeline translates from the field store's PDF-space coordinates. Those coordinates must be correct before the export is written or tested.
- The signature creation flow fills `PlacedField.value`. The field placement flow must exist first so there is a field to fill.
- Keeping `export-pipeline.ts` free of React imports from the start enables Web Worker migration in a future optimization pass without any refactoring.
- The landing page is independent of all PDF libraries and does not block any technical work. Writing it last ensures the copy reflects the actual shipped product.

### Research Flags

Phases needing deeper research during planning:
- **Phase 3 (Field Overlay):** react-rnd controlled-mode integration with zoom-aware PDF-space coordinate updates. Prototype the drag/resize -> toPdfPoint -> store-update loop before finalizing the implementation plan.
- **Phase 5 (Export Pipeline):** `pdf-lib-incremental-save` maintenance status must be confirmed at planning time. If not viable, the fallback (standard save with `{ useObjectStreams: true }`) must be explicitly documented and the landing page copy updated accordingly.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** Vite + TypeScript + Tailwind + pdf.js worker setup is thoroughly documented.
- **Phase 2 (PDF Viewing):** react-pdf covers multi-page rendering, worker setup, and CMap configuration.
- **Phase 4 (Signatures):** signature_pad integration and iOS touch fixes are documented in the library's issue tracker.
- **Phase 6 (Landing Page):** Pure content work; no technical research needed.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core library choices verified against npm registry and official docs as of 2026-06-16. Version compatibility matrix confirmed. |
| Features | HIGH | Competitor feature audit covers Smallpdf, ilovepdf, Sejda, PDFGear. Feature dependencies and MVP definition are clear and internally consistent. |
| Architecture | HIGH | Component model, data flow, and build order derived from multiple working reference implementations. Coordinate Mapper design uses pdf.js's own viewport API. |
| Pitfalls | HIGH | Every pitfall sourced from confirmed GitHub issues or library bug trackers with reproduction details. The "looks done but isn't" checklist provides concrete verification steps. |

**Overall confidence:** HIGH

### Gaps to Address

- **`pdf-lib-incremental-save` viability:** Maintenance status and compatibility with pdf-lib 1.17.1 must be confirmed before Phase 5 planning. If unviable, decide on the fallback and update landing page copy. Do not leave this ambiguous.
- **react-rnd + zoom-aware coordinate updates:** The exact integration between react-rnd's `onDragStop`/`onResizeStop` callbacks and `toPdfPoint` at varying zoom levels needs a prototype before Phase 3 implementation planning is finalized.
- **iOS touch drawing on real hardware:** signature_pad's iOS behavior must be tested on an actual iOS device (not Safari on macOS) before Phase 4 ships. Simulators do not reproduce the scroll/draw conflict reliably.
- **Print quality of embedded signatures:** Validate that re-rendering drawn signatures to a higher-resolution offscreen canvas before embedding produces acceptably sharp print output before Phase 5 ships.

---

## Sources

### Primary (HIGH confidence)
- pdf-lib GitHub issue #639 — stream decompression / full rewrite behavior confirmed
- pdf-lib GitHub issues #1759, #1152 — WinAnsi encoding crash with non-Latin characters
- pdf-lib GitHub issues #341, #606 — hyperlinks lost after copyPages / drawPage
- pdf-lib-incremental-save npm/GitHub — incremental update approach
- react-pdf GitHub discussions #1520 — worker version sync requirement
- pdf.js GitHub issue #19519 — Vite worker resolution failure
- signature_pad GitHub issues #308, #787 — iOS touchmove passive event / multi-touch jumps
- MDN Storage quotas and eviction criteria — localStorage limits on iOS
- pdfjs-dist 4.x PageViewport API docs — convertToPdfPoint / convertToViewportPoint
- npm registry (2026-06-16) — version verification for all stack packages

### Secondary (MEDIUM confidence)
- Competitor feature inventory (Smallpdf, ilovepdf, Sejda, PDFGear) — feature landscape
- PDF-signature reference implementation (tzuyi0817) — open source architecture reference
- signaturepdf (24eme) — open source PHP + PDF.js + Fabric.js reference
- Vite vs. Next.js for client-only apps 2026 — framework decision rationale

### Tertiary (needs validation during implementation)
- `pdf-lib-incremental-save` — maintenance and compatibility with pdf-lib 1.17.1 must be confirmed at Phase 5 planning time

---
*Research completed: 2026-06-16*
*Ready for roadmap: yes*
