# Phase 1: Foundation + PDF Viewer — Research

**Researched:** 2026-06-16
**Domain:** Vite + React 19 + TypeScript SPA scaffold; react-pdf / pdfjs-dist PDF rendering; pdf-lib image wrapping; Coordinate Mapper design; Tailwind v4; Zustand 5; Vitest
**Confidence:** MEDIUM (core stack well-documented; pdfjs-dist version discrepancy verified from registry)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- Multi-page documents display as a continuous vertical scroll of pages (no paged one-at-a-time mode).
- Documents open at fit-to-width zoom by default.
- Navigation aids: a page indicator ("1 / N") plus prev/next buttons, in addition to scroll.
- Pages are centered with a max-width, on a neutral gray canvas backdrop.
- Upload entry is a full-screen drag-and-drop zone with a "browse" button; the user can drop a file anywhere on the empty state.
- Empty state is minimal with a single privacy line (e.g. "Your files never leave your browser").
- Once a document is loaded, an "open another" control lets the user switch documents (no full page reload required).
- The file picker is filtered to `.pdf,.jpg,.jpeg,.png`; files are still validated after selection.
- Opened images (JPG/PNG) are wrapped into a PDF immediately on load, giving a single uniform viewer/coordinate pipeline (everything in the viewer is a PDF).
- Pages are lazy-rendered as they scroll into view.
- Bad/corrupt/unsupported files show a friendly inline error with a retry path — no crash, no raw browser error.
- A simple centered spinner is shown while a document is parsing/rendering.
- A minimal top bar shows the "FreeESign" wordmark and document actions.
- Clean light/neutral theme with a single accent color; full brand treatment is deferred to Phase 5.
- Single-page app, no router — all state lives in Zustand.
- Coordinate Mapper API is at Claude's discretion: a pure utility converting cssPixel ↔ pdfSpace accounting for zoom scale and page rotation, with a round-trip test.

### Claude's Discretion

- All stack/scaffolding specifics (Vite config, Tailwind v4 @tailwindcss/vite setup, pdf.js worker wiring, Zustand store shape, file/folder structure, Vitest setup).
- Exact Coordinate Mapper function signatures and module layout.
- Spinner/error component visual details, exact accent color, top-bar layout specifics.
- Lazy-render mechanism (react-pdf per-page rendering, intersection-based, or react-pdf defaults).

### Deferred Ideas (OUT OF SCOPE)

- User-facing zoom in/out controls with field-scaling → Phase 3 (DOC-04).
- Word-document "export to PDF first" prompt → Phase 3 (DOC-05).
- Page thumbnail sidebar → v2 (ENH-02).
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DOC-01 | User can open a PDF by drag-and-drop or file picker | HTML5 drag-and-drop events + `<input type="file" accept=".pdf,...">` + File API |
| DOC-02 | User can open an image (JPG/PNG) to sign | File type detection by MIME/extension; pdf-lib image-wrap-on-load pipeline |
| DOC-03 | User can view and navigate all pages of a multi-page PDF | react-pdf `<Document>` onLoadSuccess numPages; lazy page rendering; PageNavigation component |
| PRV-01 | All document processing happens entirely in the browser; document never uploaded to any server | Static Vite build, no API routes, no fetch to external endpoints with file payload |
| PRV-02 | All assets self-hosted — no third-party CDN or network requests while signing | Worker + cMaps + standard_fonts copied to public/ via vite-plugin-static-copy; GlobalWorkerOptions.workerSrc set to local path |
</phase_requirements>

---

## Summary

Phase 1 scaffolds a Vite 8 + React 19 + TypeScript SPA and delivers a read-only document viewer that handles both PDFs and images. The three hardest technical problems are: (1) self-hosting the pdfjs-dist worker and CMaps so zero network requests escape to third-party origins, (2) designing the Coordinate Mapper — a pure math module that converts between CSS pixel space and PDF user space across zoom and rotation, which is the explicit contract Phase 2 field-placement depends on, and (3) lazy-rendering multi-page PDFs as they scroll into view so large documents don't OOM the browser.

A critical registry finding that CLAUDE.md did not capture: react-pdf 10.4.1 ships pdfjs-dist **5.4.296**, not 4.x. [VERIFIED: npm registry] The "pdfjs-dist v4" language in CLAUDE.md refers to the major version era that was current when the stack document was written; the peer dependency has since advanced. The pdfjs-dist API used by this plan (getViewport, convertToPdfPoint, convertToViewportPoint) is stable across 4.x and 5.x and is unaffected by this difference.

Image handling uses pdf-lib to wrap JPG/PNG into a single-page PDF on load, so the viewer pipeline processes exactly one format (PDF) regardless of input type. This simplification is a locked decision from CONTEXT.md and eliminates a whole class of coordinate-space branching in Phase 2.

**Primary recommendation:** Follow the public/ static-copy pattern for pdf.js worker + CMaps (not the `?url` Vite import trick, which has documented reliability issues with hashing across deployments). Build the Coordinate Mapper as a pure TypeScript module with no React dependency; test it with property-based round-trip tests in Vitest.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| PDF rendering / display | Browser (canvas) | — | react-pdf renders each page to a `<canvas>` element entirely in the browser; no server involved |
| Image → PDF wrapping | Browser (JS) | — | pdf-lib runs in-browser; wrapping happens at file-open time before anything else touches the document |
| Coordinate Mapper | Browser (pure TS) | — | Pure math module; consumes pdfjs viewport; no network or storage |
| File ingestion (drag-drop / picker) | Browser (File API) | — | HTML5 drag events and `<input type="file">` — all client-side |
| Asset serving (worker, CMaps, fonts) | Static origin (Vercel) | — | Files are copied to public/ at build time; served from app's own origin |
| Ephemeral UI state | Browser (Zustand) | — | Current document, page count, view mode — no server state in Phase 1 |

---

## Standard Stack

### Core (Phase 1 only — install all at project creation)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vite | 8.0.16 | Build + dev server | [VERIFIED: npm registry] Official scaffold; sub-second HMR; deploys as static assets |
| @vitejs/plugin-react | 6.0.2 | React Fast Refresh + JSX transform | [VERIFIED: npm registry] Official Vite React plugin; co-authored by Vite team |
| react | 19.2.7 | UI runtime | [VERIFIED: npm registry] CLAUDE.md-pinned; concurrent features, no SSR needed |
| react-dom | 19.2.7 | DOM renderer | [VERIFIED: npm registry] Peer of react |
| typescript | 5.x (via Vite) | Type safety | CLAUDE.md-pinned; bundled in react-ts template |
| tailwindcss | 4.3.1 | Styling | [VERIFIED: npm registry] CLAUDE.md-pinned v4; CSS-native config |
| @tailwindcss/vite | 4.3.1 | Vite plugin for Tailwind v4 | [VERIFIED: npm registry] Required for Vite integration (not the PostCSS plugin) |
| react-pdf | 10.4.1 | PDF display | [VERIFIED: npm registry] CLAUDE.md-pinned; thin React wrapper over pdf.js |
| pdfjs-dist | 5.4.296 | PDF parsing + rasterization | [VERIFIED: npm registry] Bundled by react-pdf 10.4.1 — do not install a different version |
| pdf-lib | 1.17.1 | Image → PDF wrapping on load | [VERIFIED: npm registry] CLAUDE.md-pinned; only pure-JS browser PDF writer |
| zustand | 5.0.14 | In-session UI state | [VERIFIED: npm registry] CLAUDE.md-pinned |
| vitest | 4.1.9 | Unit testing | [VERIFIED: npm registry] CLAUDE.md-specified; zero-config with Vite |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vite-plugin-static-copy | 4.1.1 | Copy pdfjs-dist assets to public/ | Required for self-hosting worker, CMaps, standard_fonts |
| jsdom | 29.1.1 | DOM environment for Vitest | Required for Vitest `environment: 'jsdom'` |
| @testing-library/react | 16.3.2 | React component testing | For any component tests beyond pure-TS unit tests |

**Installation:**
```bash
npm create vite@latest free-esign -- --template react-ts
cd free-esign

# Core deps
npm install react-pdf pdf-lib zustand

# Tailwind v4
npm install tailwindcss @tailwindcss/vite

# Self-hosting pdfjs-dist assets
npm install --save-dev vite-plugin-static-copy

# Testing
npm install --save-dev vitest jsdom @testing-library/react
```

> **Note:** Do not run `npm install pdfjs-dist` separately. react-pdf 10.4.1 already declares `pdfjs-dist@5.4.296` as a hard dependency; a separate install could produce a duplicate or mismatched version.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| public/ copy for worker | `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)` Vite pattern | `new URL()` is simpler but Vite's content-hashing can produce 404s on stale cache; public/ path is deterministic `/pdf.worker.min.mjs` forever |
| vite-plugin-static-copy for CMaps | Manual `cp` in package.json `prepare` script | The copy plugin runs on `vite build` automatically; manual cp is fragile on CI |
| IntersectionObserver for lazy pages | Progressive `onRenderSuccess` chaining | Both work; IntersectionObserver is more browser-native; progressive chaining is react-pdf's own recommended pattern |

---

## Package Legitimacy Audit

All "SUS" verdicts below are due to the `too-new` signal only. All packages have millions of weekly downloads, official GitHub repos under known organizations, and no postinstall scripts. The `too-new` flag fires because the legitimacy seam uses a publish-date recency heuristic that flags packages with very recent versions — not an indicator of suspicious provenance for established projects.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| react-pdf | npm | 8+ yrs | 5.1M/wk | github.com/wojtekmaj/react-pdf | OK | Approved |
| pdfjs-dist | npm | 10+ yrs | 19.2M/wk | github.com/mozilla/pdf.js | SUS (too-new) | Approved — Mozilla official distribution |
| pdf-lib | npm | 6+ yrs | 7.3M/wk | github.com/Hopding/pdf-lib | OK | Approved |
| @pdf-lib/fontkit | npm | 5+ yrs | 939K/wk | github.com/Hopding/fontkit | OK | Approved |
| zustand | npm | 5+ yrs | 41.6M/wk | github.com/pmndrs/zustand | SUS (too-new) | Approved — pmndrs official |
| vitest | npm | 3+ yrs | 69.3M/wk | github.com/vitest-dev/vitest | SUS (too-new) | Approved — Vite official project |
| vite | npm | 5+ yrs | 140M/wk | github.com/vitejs/vite | SUS (too-new) | Approved — official |
| tailwindcss | npm | 7+ yrs | 118M/wk | github.com/tailwindlabs/tailwindcss | SUS (too-new) | Approved — official |
| @tailwindcss/vite | npm | 1+ yr | 36.8M/wk | github.com/tailwindlabs/tailwindcss | SUS (too-new) | Approved — official |
| @vitejs/plugin-react | npm | 4+ yrs | — | github.com/vitejs/vite | OK | Approved |
| vite-plugin-static-copy | npm | 3+ yrs | — | — | — | Approved — well-known Vite ecosystem plugin |

**Packages removed due to SLOP verdict:** none
**Packages flagged as suspicious (SUS) that require checkpoint:** none — all SUS flags are purely due to recent version publish dates on established, official packages with millions of weekly downloads and authoritative source repos.

---

## Architecture Patterns

### System Architecture Diagram

```
User file input
  │ (File object — browser memory)
  │
  ├── MIME check (PDF?)
  │     YES → File.arrayBuffer() → pass to react-pdf <Document>
  │     NO  → File.arrayBuffer() → pdf-lib.embedJpg/embedPng
  │                                  → PDFDocument.create() + addPage(imageSize)
  │                                  → page.drawImage() fills page
  │                                  → pdfDoc.save() → Uint8Array → Blob URL
  │                                  → pass Blob URL to react-pdf <Document>
  │
  └── react-pdf <Document file={...} options={{ cMapUrl, standardFontDataUrl }}>
        │  (pdfjs-dist worker: served from /pdf.worker.min.mjs on app origin)
        │
        onLoadSuccess({ numPages }) → Zustand: set numPages, view='loaded'
        │
        ┌── map pageNumbers → <LazyPage pageNumber={n} containerWidth={cw} />
        │     Each LazyPage: IntersectionObserver root=container
        │                      in view → render react-pdf <Page width={containerWidth}>
        │                      not in view → render placeholder div (preserves scroll height)
        │
        └── PageNavigation (fixed, bottom-center)
              scrollToPage(n) → containerRef.current.scrollTo(pageRef[n])
              Zustand: currentPage tracked via IntersectionObserver or scroll position

Coordinate Mapper (pure TS module — no React)
  cssPixelToPageSpace(cssX, cssY, viewport) → [pdfX, pdfY]
  pageSpaceToCssPixel(pdfX, pdfY, viewport) → [cssX, cssY]
    where viewport = page.getViewport({ scale, rotation })
    uses viewport.convertToPdfPoint() and viewport.convertToViewportPoint()
```

### Recommended Project Structure

```
free-esign/
├── public/
│   ├── pdf.worker.min.mjs        # copied from node_modules/pdfjs-dist/build/
│   ├── cmaps/                    # copied from node_modules/pdfjs-dist/cmaps/
│   └── standard_fonts/           # copied from node_modules/pdfjs-dist/standard_fonts/
├── src/
│   ├── main.tsx                  # app entry: ReactDOM.createRoot
│   ├── index.css                 # @import "tailwindcss"; + CSS custom properties
│   ├── App.tsx                   # root: TopBar + view state router (Zustand)
│   ├── store/
│   │   └── documentStore.ts      # Zustand store: view, numPages, currentPage, docUrl
│   ├── components/
│   │   ├── TopBar.tsx
│   │   ├── UploadZone.tsx        # drag-drop + browse, file validation
│   │   ├── LoadingSpinner.tsx
│   │   ├── ErrorBanner.tsx
│   │   ├── DocumentViewer.tsx    # react-pdf Document + lazy page list
│   │   ├── LazyPage.tsx          # IntersectionObserver wrapper around react-pdf Page
│   │   └── PageNavigation.tsx    # prev/next + page indicator pill
│   ├── lib/
│   │   ├── coordinateMapper.ts   # PURE TS — no React imports
│   │   ├── imageWrapper.ts       # pdf-lib JPG/PNG → PDF wrapping
│   │   └── pdfWorker.ts          # pdfjs GlobalWorkerOptions setup (imported once)
│   └── test/
│       └── coordinateMapper.test.ts
├── vite.config.ts
├── tsconfig.json
└── vercel.json
```

### Pattern 1: pdfjs Worker + CMaps Self-Hosting (Vite)

**What:** Serve worker, CMaps, and standard fonts from the app's own origin so no requests escape to cdn.mozilla.net or similar.

**When to use:** Always — this is a hard success criterion (PRV-02).

`vite.config.ts`:
```typescript
// Source: react-pdf official README (github.com/wojtekmaj/react-pdf)
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

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    viteStaticCopy({
      targets: [
        { src: cMapsDir, dest: '' },
        { src: standardFontsDir, dest: '' },
      ],
    }),
  ],
})
```

`src/lib/pdfWorker.ts` (import this file once, before any react-pdf usage):
```typescript
// Source: react-pdf official README
import { pdfjs } from 'react-pdf'

// Use the public/ static path — avoids Vite content-hash mismatches
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
```

Worker file placement (add to package.json `prepare` or run once):
```bash
cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/pdf.worker.min.mjs
```

`<Document>` options:
```typescript
// Source: react-pdf official README
const pdfOptions = {
  cMapUrl: '/cmaps/',
  cMapPacked: true,
  standardFontDataUrl: '/standard_fonts/',
}

<Document file={docUrl} options={pdfOptions} onLoadSuccess={...} />
```

**Gotcha — module execution order:** `pdfWorker.ts` must be imported in the same bundle entry that loads the Document component, or the default pdfjs workerSrc value will overwrite your custom setting. The safest place is `src/lib/pdfWorker.ts` imported at the top of `DocumentViewer.tsx` and/or `App.tsx`. [ASSUMED — based on observed behavior documented in react-pdf issues]

### Pattern 2: Fit-to-Width Pages with ResizeObserver

**What:** Pass the container's pixel width as the `width` prop to react-pdf `<Page>` so the page scales to fill the viewer.

**When to use:** On initial load and whenever the container resizes.

```typescript
// Source: react-pdf GitHub discussions/1467
import { useCallback, useState } from 'react'

function DocumentViewer() {
  const [containerWidth, setContainerWidth] = useState<number>()
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return
    const ro = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width)
    })
    ro.observe(node)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={containerRef} className="...">
      {/* containerWidth passed to each Page */}
      <Page pageNumber={1} width={containerWidth} />
    </div>
  )
}
```

### Pattern 3: Lazy Page Rendering via IntersectionObserver

**What:** Render a placeholder `<div>` at the page's estimated height when the page is off-screen; swap to a real `<Page>` when it enters the viewport.

**When to use:** Multi-page PDFs (any document with more than 1 page).

```typescript
// Source: [ASSUMED] — standard IntersectionObserver pattern in React
function LazyPage({ pageNumber, containerWidth }: { pageNumber: number; containerWidth?: number }) {
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true) },
      { rootMargin: '200px' }  // preload 200px before entering viewport
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} style={{ minHeight: containerWidth ? containerWidth * 1.414 : 800 }}>
      {isVisible && (
        <Page
          pageNumber={pageNumber}
          width={containerWidth}
          renderTextLayer={false}
          renderAnnotationLayer={false}
        />
      )}
    </div>
  )
}
```

> **Note:** `renderTextLayer={false}` and `renderAnnotationLayer={false}` are correct for Phase 1 (display only, no text selection needed). These improve performance. Phase 2+ may re-enable text layer if needed.

### Pattern 4: Image → PDF Wrapping

**What:** On load of a JPG/PNG, create an in-memory PDF containing the image as the sole page content, sized exactly to the image dimensions. Feed the resulting Blob URL to react-pdf as if it were a PDF.

```typescript
// Source: pdf-lib.js.org official docs
import { PDFDocument } from 'pdf-lib'

export async function wrapImageAsPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const pdfDoc = await PDFDocument.create()

  const mimeType = file.type
  const image = mimeType === 'image/jpeg' || mimeType === 'image/jpg'
    ? await pdfDoc.embedJpg(arrayBuffer)
    : await pdfDoc.embedPng(arrayBuffer)

  // Create page exactly sized to the image (PDF units = points, 72pt = 1 inch)
  // image.width/height are in pixels; pdf-lib treats them as points (72 DPI equivalence)
  const page = pdfDoc.addPage([image.width, image.height])
  page.drawImage(image, {
    x: 0,
    y: 0,
    width: image.width,
    height: image.height,
  })

  const pdfBytes = await pdfDoc.save()
  const blob = new Blob([pdfBytes], { type: 'application/pdf' })
  return URL.createObjectURL(blob)
}
```

**Note on coordinate system:** pdf-lib's `drawImage` y=0 is the bottom-left of the page. By setting page height = image height and drawing at y=0 with height = image.height, the image fills the entire page. The resulting PDF coordinates map 1:1 with the image's pixel grid when viewed at 72 DPI scale — which simplifies the Coordinate Mapper for images (no aspect adjustment needed).

### Pattern 5: Coordinate Mapper Module Design

**What:** A pure TypeScript module (no React, no DOM) that converts between CSS pixel space (as reported by react-pdf's rendered `<Page>`) and PDF user space (bottom-left origin, points at 72 DPI scale 1).

**Key insight:** pdfjs-dist's `PageViewport` already does the heavy math. The Coordinate Mapper is a thin, testable wrapper over `viewport.convertToPdfPoint()` and `viewport.convertToViewportPoint()`. [CITED: developer.mescius.com/document-solutions/javascript-pdf-viewer/api/types/PageViewport.html]

```typescript
// Source: PageViewport API docs — convertToPdfPoint / convertToViewportPoint
// [CITED: developer.mescius.com/document-solutions/javascript-pdf-viewer/api/types/PageViewport.html]

export interface PageSpace {
  x: number  // PDF user space x (origin: bottom-left)
  y: number  // PDF user space y (origin: bottom-left)
}

export interface CssSpace {
  x: number  // CSS pixels from top-left of the rendered canvas
  y: number  // CSS pixels from top-left of the rendered canvas
}

// viewport is obtained from: page.getViewport({ scale, rotation })
// where scale = containerWidth / page.getViewport({ scale: 1 }).width
// and rotation is the page's intrinsic rotation (from PDF metadata, typically 0)

export function cssPixelToPageSpace(
  css: CssSpace,
  viewport: { convertToPdfPoint(x: number, y: number): number[] }
): PageSpace {
  const [pdfX, pdfY] = viewport.convertToPdfPoint(css.x, css.y)
  return { x: pdfX, y: pdfY }
}

export function pageSpaceToCssPixel(
  pdf: PageSpace,
  viewport: { convertToViewportPoint(x: number, y: number): number[] }
): CssSpace {
  const [cssX, cssY] = viewport.convertToViewportPoint(pdf.x, pdf.y)
  return { x: cssX, y: cssY }
}
```

**Round-trip property test (Vitest):**
```typescript
// Test: convert to PDF space and back — must land within epsilon at any scale/rotation
import { describe, it, expect } from 'vitest'
import { cssPixelToPageSpace, pageSpaceToCssPixel } from '../lib/coordinateMapper'

// Mock viewport matching pdfjs PageViewport API shape
function makeViewport(scale: number, rotation: 0 | 90 | 180 | 270) {
  // ... use an actual pdfjs-dist PageViewport or a minimal mock with the affine math
}

describe('coordinateMapper round-trip', () => {
  it('returns within epsilon at scale=1 rotation=0', () => {
    const viewport = makeViewport(1, 0)
    const original = { x: 150, y: 200 }
    const pdfSpace = cssPixelToPageSpace(original, viewport)
    const recovered = pageSpaceToCssPixel(pdfSpace, viewport)
    expect(Math.abs(recovered.x - original.x)).toBeLessThan(0.001)
    expect(Math.abs(recovered.y - original.y)).toBeLessThan(0.001)
  })
  // Repeat for scale=1.5, scale=0.75, rotation=90, rotation=270
})
```

**Implementation note on viewport mock vs. real viewport:** The cleanest approach is to import `pdfjs-dist` in tests and construct a real `PageViewport` via `pdfjsLib.getDocument(...).then(p => p.getPage(1)).then(pg => pg.getViewport(...))`. For a pure unit test without a real PDF, use a minimal mock that implements the 6-element affine matrix math directly. The round-trip property holds if and only if both functions use the same viewport object — this is what the test proves.

### Pattern 6: Zustand Store Shape

```typescript
// Source: Zustand official docs + [ASSUMED] for FreeESign-specific shape
import { create } from 'zustand'

type ViewState = 'empty' | 'loading' | 'error' | 'loaded'

interface DocumentStore {
  // View mode (maps to UI-SPEC state machine)
  view: ViewState
  setView: (v: ViewState) => void

  // Document
  docUrl: string | null       // Blob URL of the current PDF (or wrapped image)
  numPages: number | null
  currentPage: number         // 1-indexed
  errorMessage: string | null

  // Actions
  loadDocument: (url: string) => void
  setNumPages: (n: number) => void
  setCurrentPage: (n: number) => void
  setError: (msg: string) => void
  reset: () => void
}

export const useDocumentStore = create<DocumentStore>()((set) => ({
  view: 'empty',
  docUrl: null,
  numPages: null,
  currentPage: 1,
  errorMessage: null,

  setView: (view) => set({ view }),
  loadDocument: (url) => set({ docUrl: url, view: 'loading', errorMessage: null }),
  setNumPages: (numPages) => set({ numPages, view: 'loaded' }),
  setCurrentPage: (currentPage) => set({ currentPage }),
  setError: (errorMessage) => set({ errorMessage, view: 'error' }),
  reset: () => set({ view: 'empty', docUrl: null, numPages: null, currentPage: 1, errorMessage: null }),
}))
```

### Pattern 7: Tailwind v4 Setup (Vite)

**What:** Tailwind v4 is CSS-native — no `tailwind.config.js`, no `@tailwind base/components/utilities` directives. One `@import` in CSS, one plugin in Vite config.

```typescript
// vite.config.ts — already shown in Pattern 1
import tailwindcss from '@tailwindcss/vite'
plugins: [ ..., tailwindcss() ]
```

```css
/* src/index.css */
@import "tailwindcss";

/* CSS custom properties from UI-SPEC */
:root {
  --color-surface: #F9FAFB;
  --color-surface-elevated: #FFFFFF;
  --color-canvas: #E5E7EB;
  --color-accent: #2563EB;
  --color-destructive: #DC2626;
  --color-text-primary: #111827;
  --color-text-secondary: #6B7280;
  --color-border: #D1D5DB;
}

/* sr-only utility (accessibility — UI-SPEC requirement) */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}
```

### Vitest Configuration

```typescript
// vite.config.ts — add test block to the existing config
/// <reference types="vitest" />
export default defineConfig({
  // ... plugins from Pattern 1 ...
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
```

```typescript
// src/test/setup.ts
import '@testing-library/jest-dom'
```

### Anti-Patterns to Avoid

- **Using `?url` Vite import for the worker:** `import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url"` works in dev but Vite's content-hash mangles the filename in production builds, causing worker 404s on subsequent deploys. Use public/ path instead.
- **Installing pdfjs-dist separately:** react-pdf 10.4.1 pins pdfjs-dist 5.4.296 as a hard dependency. A separate `npm install pdfjs-dist` may install a different version alongside it, causing worker version mismatch errors at runtime.
- **Setting workerSrc in a separate file that is imported before react-pdf:** Module execution order in bundlers is not guaranteed. Import `pdfWorker.ts` at the top of the file that also imports react-pdf components, or inline the `GlobalWorkerOptions.workerSrc` assignment at the top of `DocumentViewer.tsx`.
- **Rendering all pages simultaneously:** A 100-page PDF with all pages in the DOM will OOM the tab. Always use lazy rendering (IntersectionObserver or progressive onRenderSuccess).
- **Using `renderTextLayer={true}` (default) without a CSS stylesheet import:** react-pdf's text layer requires its own CSS stylesheet (`import 'react-pdf/dist/Page/TextLayer.css'`) or text will render over the canvas in the wrong position. For Phase 1 (display only), set `renderTextLayer={false}`.
- **Storing the raw PDF File object in Zustand:** Store a Blob URL (string) instead. File objects cannot be serialized, and holding large byte arrays in JS state can cause memory issues.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF rendering in canvas | Custom canvas renderer | react-pdf `<Page>` | Font handling, CMap support, text rendering, page transforms — all solved |
| Coordinate affine matrix math | Hand-coded rotation/scale matrix | `viewport.convertToPdfPoint()` / `convertToViewportPoint()` | pdfjs-dist already ships a correct, tested affine matrix for any rotation and scale combination |
| Image → PDF conversion | Canvas `toDataURL` then wrap | pdf-lib `embedJpg/embedPng` | Canvas rasterization re-encodes with lossy compression; pdf-lib embeds the original bytes |
| Asset copying at build time | npm scripts + custom Node.js copy | vite-plugin-static-copy | Handles CJS/ESM interop, normalizes paths cross-platform, integrates with Vite build lifecycle |
| Responsive width tracking | `window.addEventListener('resize')` | `ResizeObserver` via `useCallback` ref | ResizeObserver fires on container resize regardless of window size (drawer/panel resize); window resize misses these |

**Key insight:** The pdfjs-dist `PageViewport` is the entire Coordinate Mapper implementation — the custom module just wraps its two methods with typed interfaces and makes them unit-testable in isolation.

---

## Common Pitfalls

### Pitfall 1: pdfjs-dist Version Mismatch

**What goes wrong:** Runtime error "The API version does not match the Worker API version" or blank page renders.
**Why it happens:** react-pdf 10.4.1 internally imports pdfjs-dist 5.4.296. If you also install pdfjs-dist separately (any version), npm may hoist a different version and the worker file from public/ will be at a different version than the main library.
**How to avoid:** Do NOT run `npm install pdfjs-dist`. Let react-pdf's hoisted copy be the only copy. Copy the worker file from `node_modules/pdfjs-dist/build/pdf.worker.min.mjs` — which is already react-pdf's pinned version.
**Warning signs:** Console error mentioning "API version"; blank white `<Page>` canvases with no error in the React tree.

### Pitfall 2: Third-Party Network Request from pdfjs-dist CMaps

**What goes wrong:** After loading a PDF, DevTools Network shows a request to `cdnjs.cloudflare.com` or `cdn.mozilla.net` for CMap files — violating PRV-02.
**Why it happens:** pdfjs-dist defaults `cMapUrl` to a CDN path. If you don't pass `cMapUrl` in the `<Document options={...}>` prop, it falls back to the CDN.
**How to avoid:** Always pass `options={{ cMapUrl: '/cmaps/', cMapPacked: true, standardFontDataUrl: '/standard_fonts/' }}` to `<Document>`. The files must exist at those paths (copied by vite-plugin-static-copy).
**Warning signs:** Network panel shows any request not to `localhost:5173` (dev) or your Vercel domain (prod) after loading a document.

### Pitfall 3: Worker workerSrc Overwrite

**What goes wrong:** You set `pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'` in `pdfWorker.ts`, but a later import of `react-pdf` resets it to the default CDN URL.
**Why it happens:** Module bundlers execute module-level code in import order. If react-pdf's internal setup code runs after your assignment, it can reset the value.
**How to avoid:** Set `workerSrc` in the same module that imports `<Document>`, not in a separate file. Place the assignment at the top of `DocumentViewer.tsx` before any other react-pdf imports, or use a dynamic import.
**Warning signs:** Worker 404 to `/pdf.worker.min.mjs` followed by fallback requests to CDN URL.

### Pitfall 4: Image Coordinate Discrepancy (Pixels vs. PDF Points)

**What goes wrong:** Signatures placed on a wrapped image PDF land in the wrong position when exported, even though they looked correct in the viewer.
**Why it happens:** PDF points at 72 DPI = 1 point per pixel at scale 1. But images uploaded at higher DPI (e.g., 300 DPI) have pixel dimensions much larger than their intended print size. When pdf-lib wraps the image using `[image.width, image.height]` as page dimensions in points, the PDF page is sized in points equal to pixels — which at 72 DPI means a 300 DPI image appears ~4x too large on paper.
**How to avoid:** For Phase 1 (viewer only), this doesn't bite yet — the Coordinate Mapper round-trip still works because both viewer and PDF use the same scale. Document this discrepancy for Phase 2 (export). The export step in Phase 2 must handle DPI normalization if needed.
**Warning signs:** Exported PDF with placed signatures is much larger or smaller than the original image when printed.

### Pitfall 5: ResizeObserver and Infinite Re-render Loop

**What goes wrong:** Setting container width in state triggers a re-render that changes the page width, which changes the container size, which triggers the ResizeObserver again — infinite loop.
**Why it happens:** The ResizeObserver callback calls `setContainerWidth`, the component re-renders with a new `<Page width={...}>`, pdf.js re-renders the canvas at a new size, which doesn't change the container width — usually fine. But if the parent container has `width: fit-content` or similar, a render could change the width, triggering another ResizeObserver callback.
**How to avoid:** Give the container a fixed/constrained CSS width (`max-width`, `100%` inside a fixed-width parent, or `width: 100vw`). Never use `width: fit-content` on the PDF viewer container.
**Warning signs:** React DevTools profiler shows continuous re-renders of DocumentViewer at 60fps after document load.

---

## Code Examples

### Verified: pdf-lib image wrap (official docs pattern)

```typescript
// Source: pdf-lib.js.org official docs
import { PDFDocument } from 'pdf-lib'

async function wrapImageAsPdf(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const pdfDoc = await PDFDocument.create()
  const image = file.type === 'image/png'
    ? await pdfDoc.embedPng(buf)
    : await pdfDoc.embedJpg(buf)
  const page = pdfDoc.addPage([image.width, image.height])
  page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height })
  const bytes = await pdfDoc.save()
  return URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
}
```

### Verified: react-pdf Document + Page (official README pattern)

```tsx
// Source: github.com/wojtekmaj/react-pdf README
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
// Do NOT import TextLayer.css in Phase 1 — renderTextLayer={false}

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

const options = {
  cMapUrl: '/cmaps/',
  cMapPacked: true,
  standardFontDataUrl: '/standard_fonts/',
}

function PdfViewer({ url }: { url: string }) {
  const [numPages, setNumPages] = useState<number>()
  return (
    <Document
      file={url}
      options={options}
      onLoadSuccess={({ numPages }) => setNumPages(numPages)}
    >
      {Array.from({ length: numPages ?? 0 }, (_, i) => (
        <Page
          key={i + 1}
          pageNumber={i + 1}
          width={containerWidth}
          renderTextLayer={false}
          renderAnnotationLayer={false}
        />
      ))}
    </Document>
  )
}
```

### Verified: Zustand v5 TypeScript store

```typescript
// Source: github.com/pmndrs/zustand README
import { create } from 'zustand'

interface MyStore { count: number; increment: () => void }

const useMyStore = create<MyStore>()((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}))
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `import pdfWorker from 'pdfjs-dist/build/pdf.worker.js'` | `GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'` (public/) | pdfjs-dist 4.x → 5.x (worker filename now `.mjs`) | Worker import path changed; file is `.min.mjs` not `.js` |
| pdfjs-dist 4.x (as mentioned in CLAUDE.md) | pdfjs-dist 5.4.296 (pinned by react-pdf 10.4.1) | react-pdf 10.4.1 released | CLAUDE.md stack doc is slightly stale; API surface unchanged |
| Tailwind v3 `tailwind.config.js` + PostCSS plugin | Tailwind v4 `@tailwindcss/vite` + `@import "tailwindcss"` in CSS | Jan 2025 (v4.0 release) | No config file needed; CSS-native tokens |
| `@apply` directives | CSS custom properties via `:root` variables | Tailwind v4 | Better DX, no Tailwind-specific syntax in component CSS |

**Deprecated/outdated:**
- `react-pdf/dist/esm/entry.webpack5.js` and similar webpack-specific entries: no longer needed with Vite; use `react-pdf` direct import.
- `pdfjs-dist/build/pdf.worker.js` (CommonJS): superseded by `.mjs` in pdfjs-dist 5.x. Use `pdf.worker.min.mjs`.
- `tailwindcss/vite` was previously a PostCSS plugin; v4 ships `@tailwindcss/vite` as a proper Vite plugin — do not use the PostCSS approach.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Setting `workerSrc` in a separate `pdfWorker.ts` import may be overwritten by react-pdf internals depending on module execution order | Pitfall 3 + Pattern 1 | Worker loads from CDN instead of local path — PRV-02 failure; easy to fix by inlining the assignment |
| A2 | IntersectionObserver with `rootMargin: '200px'` provides sufficient preloading for smooth scroll without OOM on 50+ page PDFs | Pattern 3 | Pages pop in visibly on fast scroll; fix by increasing rootMargin or switching to progressive onRenderSuccess pattern |
| A3 | `image.width/height` from pdf-lib embedJpg/embedPng are in pixels, treated as PDF points (72 DPI equivalence) | Pattern 4 | Image PDF appears wrong size; DPI normalization needed |
| A4 | pdfjs-dist 5.x ships `build/pdf.worker.min.mjs` at the path `node_modules/pdfjs-dist/build/pdf.worker.min.mjs` | Pattern 1 | Worker copy command fails; need to find alternate path via `require.resolve` |
| A5 | pdfjs-dist `convertToPdfPoint` and `convertToViewportPoint` handle all 4 rotation values (0/90/180/270) correctly | Coordinate Mapper design | Round-trip test fails for rotated pages; would need to apply rotation adjustment manually |

**If this table is empty:** N/A — see above.

---

## Open Questions

1. **Exact path to `pdf.worker.min.mjs` in pdfjs-dist 5.4.296**
   - What we know: pdfjs-dist 5.3.x ships `build/pdf.worker.min.mjs` (confirmed via unpkg for 5.3.93)
   - What's unclear: Whether 5.4.296 uses the same path or has a restructured build output
   - Recommendation: At Wave 0 setup, run `ls node_modules/pdfjs-dist/build/` and confirm; adjust the public/ copy command accordingly

2. **Whether to use `new URL()` pattern or public/ copy for the worker**
   - What we know: Public/ path is deterministic and deployment-safe; `new URL()` is more portable but has documented hash issues
   - What's unclear: Whether Vite 8 has fixed the content-hash issue with `?url` imports
   - Recommendation: Start with public/ copy (safer); if the copy adds unwanted CI friction, migrate to `?url` later

3. **pdfjs-dist `getViewport` — does react-pdf expose the viewport object to consuming code?**
   - What we know: react-pdf renders pages internally; the raw pdfjs `PDFPageProxy` is not directly exposed via a prop
   - What's unclear: How Phase 2 field-placement will obtain a viewport for coordinate mapping at the current scale
   - Recommendation: The Coordinate Mapper should accept a `viewport` parameter constructed externally. Phase 2 will need to obtain the viewport either by calling `pdfjsLib.getDocument()` independently (from the same Blob URL), or by caching viewports via a react-pdf `onRenderSuccess` callback which provides page dimensions. Design the Coordinate Mapper API so it takes a viewport object (or equivalent {scale, rotation, width, height} shape) — not a page index.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vite build | ✓ | 22.21.1 | — |
| npm | Package management | ✓ | 10.9.4 | — |
| vite (global) | Not required | ✗ | — | `npx vite` or local install via npm |
| Browser (for testing) | PDF rendering | ✓ (via jsdom) | jsdom 29.1.1 | — |
| Vercel CLI | Deploy preview | Not checked | — | Deploy via GitHub integration |

**Missing dependencies with no fallback:** None — all required tooling is available via npm install.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 |
| Config file | `vite.config.ts` (`test:` block) — none exists yet (Wave 0 gap) |
| Quick run command | `npx vitest run --reporter=verbose src/test/coordinateMapper.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DOC-01 | File drag-drop and picker accept .pdf/.jpg/.jpeg/.png, reject other types | unit | `npx vitest run src/test/fileValidation.test.ts` | ❌ Wave 0 |
| DOC-02 | JPG/PNG produces a valid Blob URL from pdf-lib wrapping | unit | `npx vitest run src/test/imageWrapper.test.ts` | ❌ Wave 0 |
| DOC-03 | numPages returned from `onLoadSuccess` drives LazyPage array length | unit/component | `npx vitest run src/test/documentViewer.test.ts` | ❌ Wave 0 |
| PRV-01 | No fetch/XHR to external origins during PDF load (architectural — enforced by static build) | manual | Open DevTools Network after loading a PDF; zero third-party requests | N/A |
| PRV-02 | Zero third-party network requests after document load | e2e / manual | DevTools Network tab audit — filter by "3rd party" | N/A |
| Coord Mapper | Round-trip: cssPixel → pdfSpace → cssPixel within 0.001 tolerance at any scale and rotation | unit (property) | `npx vitest run src/test/coordinateMapper.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run src/test/coordinateMapper.test.ts` (fastest pure-TS test)
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green + manual DevTools Network audit showing zero third-party requests

### Wave 0 Gaps

- [ ] `vite.config.ts` — add `test: { globals: true, environment: 'jsdom', setupFiles: [...] }` block
- [ ] `src/test/setup.ts` — `import '@testing-library/jest-dom'`
- [ ] `src/test/coordinateMapper.test.ts` — round-trip property tests (covers phase success criterion)
- [ ] `src/test/imageWrapper.test.ts` — verifies pdf-lib wrapping returns a valid Blob URL
- [ ] `src/test/fileValidation.test.ts` — verifies MIME/extension validation logic rejects unsupported types

*(PRV-01 and PRV-02 are manual checks — no automated test infrastructure needed for them)*

---

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1` per config.json

### Applicable ASVS Categories (Level 1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No accounts, no auth — out of scope for this app |
| V3 Session Management | No | No sessions — out of scope |
| V4 Access Control | No | Single-user, no roles |
| V5 Input Validation | Yes | Validate file type (MIME + extension check) and file size before processing; never pass unchecked input to pdf-lib or pdfjs |
| V6 Cryptography | No | No encryption needed |
| V11 Business Logic | Yes | File size limit (>100MB → friendly error, per UI-SPEC); file type whitelist (PDF/JPG/PNG only) |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious PDF exploiting pdfjs-dist renderer | Tampering/EoP | pdfjs-dist sandboxes rendering in a worker; no plugin execution; keep pdfjs-dist up-to-date |
| SVG/HTML injection via PDF annotation layer | Tampering | `renderAnnotationLayer={false}` in Phase 1 eliminates this attack surface |
| Oversized file causing OOM / browser hang | DoS | Enforce 100 MB file size limit before calling `file.arrayBuffer()` (UI-SPEC copywriting contract confirms 100MB limit) |
| Malicious PNG/JPG causing pdf-lib to throw | Tampering | Wrap `wrapImageAsPdf()` in try/catch; surface friendly error via ErrorBanner |
| Third-party origin request leaking document metadata | Info Disclosure | Self-hosted assets (PRV-02) eliminate all outbound requests during signing |

**Security note:** Phase 1 has no auth, no server, and no network writes. The primary security surface is the file ingestion pipeline — validate before processing, handle parse errors gracefully, and keep `renderAnnotationLayer={false}` to eliminate annotation-based injection.

---

## Sources

### Primary (MEDIUM confidence — official docs / registry verified)

- npm registry — verified all package versions and dependency graph (react-pdf 10.4.1 → pdfjs-dist 5.4.296)
- github.com/wojtekmaj/react-pdf README — worker setup, cMapUrl, standardFontDataUrl, Document/Page API
- pdf-lib.js.org official docs — embedJpg, embedPng, addPage, drawImage API
- developer.mescius.com/document-solutions/javascript-pdf-viewer/api/types/PageViewport.html — convertToPdfPoint, convertToViewportPoint method signatures
- github.com/pmndrs/zustand — v5 TypeScript store creation pattern
- vite.dev/guide/ — scaffold command, Node.js version requirements (v22.12+ for current Vite)
- Tailwind CSS v4 install guides (multiple sources, consistent) — @tailwindcss/vite plugin, CSS-only @import

### Secondary (LOW confidence — web search, cross-referenced)

- medium.com/@prospercoded (Dec 2025) — public/ copy approach for worker self-hosting
- github.com/wojtekmaj/react-pdf discussions/1691 — lazy rendering approaches (progressive onRenderSuccess vs virtualization)
- github.com/wojtekmaj/react-pdf discussions/1467 — ResizeObserver width prop pattern
- app.unpkg.com/pdfjs-dist@5.3.93/files/build/pdf.worker.min.mjs — confirms file exists at this path in pdfjs-dist 5.x

---

## Project Constraints (from CLAUDE.md)

All of these are enforced — research findings that contradict them are flagged as assumptions:

1. **Document integrity:** Zero alteration of the original PDF bytes — overlay only; never re-encode. Phase 1 does not do any overlay or export, so this is not a Phase 1 constraint, but the image-wrap pipeline must not re-encode the image (pdf-lib `embedJpg/embedPng` embeds original bytes).
2. **Client-side only:** No server, no upload, no accounts. Vite static build enforces this architecturally.
3. **Persistence:** Saved signatures in IndexedDB — not relevant in Phase 1 (no signatures yet).
4. **Vercel-hostable:** Static `dist/` folder from `vite build`. Add `vercel.json` with `{ "outputDirectory": "dist" }`.
5. **Vite 8 + React 19 + TypeScript:** Confirmed available via npm (Vite 8.0.16, React 19.2.7, TS 6.0.3 bundled in template).
6. **Tailwind v4:** Use `@tailwindcss/vite` plugin; NO `tailwind.config.js`.
7. **react-pdf 10.4.1 + pdfjs-dist (pinned):** Do not install pdfjs-dist independently.
8. **No router:** All state in Zustand — confirmed.
9. **Vitest for unit tests:** Confirmed; co-located in vite.config.ts.

**Discrepancy from CLAUDE.md:** CLAUDE.md states "pdfjs-dist 4.x (peer of react-pdf 10)". The actual pinned version is **5.4.296**. The API surface (getViewport, worker setup, cMaps) is compatible — no plan changes needed — but the worker filename is now `pdf.worker.min.mjs` (`.mjs` extension, not `.js`). All plan tasks must use the `.mjs` filename.

---

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM — all package versions verified from npm registry; pdfjs-dist discrepancy resolved
- Worker/CMaps self-hosting: MEDIUM — confirmed from official react-pdf README; exact file path is assumption A4
- Architecture patterns: MEDIUM — Coordinate Mapper design based on verified pdfjs-dist viewport API; LazyPage implementation is ASSUMED
- Pitfalls: MEDIUM — worker ordering and CMaps CDN fallback are well-documented in react-pdf issues

**Research date:** 2026-06-16
**Valid until:** 2026-07-16 (30 days — react-pdf and Vite are stable; Tailwind v4 is current)
