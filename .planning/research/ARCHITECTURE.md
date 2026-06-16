# Architecture Research

**Domain:** Browser-only PDF e-signature (self-signing, privacy-first)
**Researched:** 2026-06-16
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                          Browser (SPA)                               │
├──────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐   ┌──────────────┐   ┌──────────────────────────┐  │
│  │  Landing    │   │   App Shell  │   │    Signature Manager     │  │
│  │  Page /     │   │  (layout,    │   │  (draw/type UI,          │  │
│  │  Route      │   │   toolbar,   │   │   save/load from store)  │  │
│  └─────────────┘   │   zoom ctrl) │   └──────────────────────────┘  │
│                    └──────┬───────┘                                  │
├───────────────────────────┼──────────────────────────────────────────┤
│                    Document Workspace                                │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Page Container (per page, position: relative)              │    │
│  │  ┌──────────────────────────────────────────────┐           │    │
│  │  │  Canvas Layer  (pdf.js renders page pixels)  │           │    │
│  │  └──────────────────────────────────────────────┘           │    │
│  │  ┌──────────────────────────────────────────────┐           │    │
│  │  │  Field Overlay (position: absolute, same px  │           │    │
│  │  │  rect as canvas — draggable/resizable fields)│           │    │
│  │  └──────────────────────────────────────────────┘           │    │
│  └─────────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────────┤
│                          Core Modules                               │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────────────────┐  │
│  │ Coordinate   │  │  Field Store  │  │  Signature Store         │  │
│  │ Mapper       │  │  (in-memory   │  │  (IndexedDB /            │  │
│  │ (pixel ↔ PDF │  │   field list, │  │   localStorage for       │  │
│  │  user space) │  │   source of   │  │   drawn/typed sigs)      │  │
│  └──────────────┘  │   truth)      │  └──────────────────────────┘  │
│                    └───────────────┘                                 │
├─────────────────────────────────────────────────────────────────────┤
│                          Pipeline Modules                           │
│  ┌──────────────────────┐  ┌──────────────────────────────────────┐ │
│  │  File Ingestor       │  │  Export Pipeline                     │ │
│  │  (PDF → pdf.js doc   │  │  (Field Store → pdf-lib draw ops →   │ │
│  │   image → PDF wrap)  │  │   Uint8Array download)               │ │
│  └──────────────────────┘  └──────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| Landing Page | Marketing, privacy pitch, CTA | Static route (`/`), no PDF libs loaded |
| App Shell | Layout, toolbar, zoom state, page navigation | React component, owns `zoomLevel` state |
| File Ingestor | Accept PDF/image drop/click, produce in-memory doc model | `FileReader` → `ArrayBuffer`, pdf.js for PDF, pdf-lib for image→PDF wrap |
| Page Renderer | Render one PDF page onto `<canvas>` at current zoom | pdf.js `renderTask`, re-renders on zoom change |
| Field Overlay | Absolute-positioned `<div>` layer over each canvas | Pure DOM/CSS, no canvas; hosts draggable field widgets |
| Coordinate Mapper | Convert pixel↔PDF-user-space (accounts for zoom, DPR, rotation) | Thin module wrapping `viewport.convertToPdfPoint` / `convertToViewportPoint` |
| Field Store | In-memory list of `PlacedField` records; source of truth | Zustand store or plain React context |
| Signature Manager | Draw/type signature UI, save/load from Signature Store | Canvas-based draw pad + font renderer |
| Signature Store | Persist saved signatures/initials across sessions | IndexedDB (images > 64 KB); localStorage for small base64 data URLs |
| Export Pipeline | Map field store → pdf-lib draw ops on original bytes → download | Pure function; deterministic; no side effects |

---

## Recommended Project Structure

```
src/
├── routes/
│   ├── landing/          # Landing page (/, lazy-loaded separately)
│   └── app/              # Main signing app (/app or /sign)
├── components/
│   ├── workspace/
│   │   ├── PageContainer.tsx   # Wrapper (position: relative) per page
│   │   ├── PageCanvas.tsx      # pdf.js canvas render
│   │   └── FieldOverlay.tsx    # Absolute overlay, renders PlacedField widgets
│   ├── fields/
│   │   ├── SignatureField.tsx
│   │   ├── TextFieldWidget.tsx
│   │   ├── DateFieldWidget.tsx
│   │   ├── CheckboxFieldWidget.tsx
│   │   └── FieldHandle.tsx     # Shared drag/resize handle
│   └── signature-manager/
│       ├── DrawPad.tsx         # Canvas drawing surface
│       └── TypePad.tsx         # Font-rendered typed signature
├── core/
│   ├── coordinate-mapper.ts    # THE central shared module (see below)
│   ├── field-store.ts          # Zustand store: PlacedField[]
│   ├── signature-store.ts      # IndexedDB read/write for saved signatures
│   ├── ingestor.ts             # File → in-memory doc model
│   └── export-pipeline.ts      # Fields → pdf-lib ops → Uint8Array
├── types/
│   └── index.ts                # PlacedField, SavedSignature, DocumentModel
└── main.tsx
```

### Structure Rationale

- **`core/`:** Framework-agnostic. Every module here is a pure TypeScript function or class. This makes the export pipeline trivially testable without a DOM.
- **`components/`:** Only UI concerns. Components read from stores; they do not own business logic.
- **`routes/`:** Lazy-split so the PDF libraries (~1 MB) are not loaded on the landing page.

---

## Field Data Model

This is the source of truth. Every other module derives its behavior from this schema.

```typescript
// types/index.ts

type FieldType = 'signature' | 'initials' | 'text' | 'date' | 'checkbox';

interface PlacedField {
  id: string;                     // nanoid — stable across renders
  type: FieldType;

  // Location in PDF user-space (origin bottom-left, units: points)
  // NEVER store pixel coords here — always convert before storing.
  pageIndex: number;              // 0-based
  x: number;                     // PDF points from page left
  y: number;                     // PDF points from page bottom
  width: number;                  // PDF points
  height: number;                 // PDF points

  // Value
  value: string | null;           // data URL for signature/initials; text for text/date; '1'/'0' for checkbox

  // --- Multi-party extension point (v1: always 'self') ---
  recipientId: string;            // 'self' in v1; becomes a real ID when routing is added
  recipientRole: string;          // 'signer' in v1; 'approver' | 'counter-signer' later
}

interface SavedSignature {
  id: string;
  kind: 'signature' | 'initials';
  dataUrl: string;                // PNG data URL from canvas
  label?: string;                 // Optional user label
  createdAt: number;
}

interface DocumentModel {
  id: string;
  originalBytes: Uint8Array;      // NEVER mutated — used only by export pipeline
  pdfDoc: PDFDocumentProxy;       // pdf.js handle for rendering
  pageCount: number;
  fileName: string;
  isImageWrapped: boolean;        // true when source was JPEG/PNG, not native PDF
}
```

**Why PDF user-space for storage:** The field store survives zoom changes and re-renders because coordinates are zoom-independent. The Coordinate Mapper translates on demand; it never writes back.

**Multi-party extension point:** Adding `recipientId` and `recipientRole` in v1 costs nothing (always `'self'` / `'signer'`). When multi-party signing is added, the field store is filtered by recipient, and the UI renders a recipient selector. No schema rewrite required — only new consumers of existing fields.

---

## The Coordinate Mapper — Central Shared Module

This is the highest-risk architectural element. Get it wrong and every field placement is subtly broken.

### The Problem

Three coordinate spaces must be reconciled:

| Space | Origin | Y direction | Units | Scale |
|-------|--------|-------------|-------|-------|
| PDF user space | Bottom-left | Up | Points (1/72 in) | Fixed per page |
| pdf.js viewport pixels | Top-left | Down | CSS pixels | `scale * devicePixelRatio` |
| Screen/DOM pixels | Top-left | Down | CSS pixels | `scale` (CSS size) |

Additionally, pages can carry a `/Rotate` entry (0, 90, 180, 270 degrees) which rearranges axes entirely.

### The Solution: Delegate to pdf.js

pdf.js's `PageViewport` already encodes the full affine transform matrix that accounts for scale, DPR, Y-flip, and rotation. Use it exclusively:

```typescript
// core/coordinate-mapper.ts

import type { PageViewport } from 'pdfjs-dist';

/**
 * Convert a pointer event position (relative to the page container element)
 * into PDF user-space coordinates.
 *
 * @param viewport  - The PageViewport from page.getViewport({ scale })
 * @param cssX      - X in CSS pixels, relative to the top-left of the rendered page
 * @param cssY      - Y in CSS pixels, relative to the top-left of the rendered page
 * @param dpr       - window.devicePixelRatio (default 1)
 */
export function toPdfPoint(
  viewport: PageViewport,
  cssX: number,
  cssY: number,
  dpr = 1
): { x: number; y: number } {
  // viewport.convertToPdfPoint expects CANVAS pixels (not CSS pixels)
  const [x, y] = viewport.convertToPdfPoint(cssX * dpr, cssY * dpr);
  return { x, y };
}

/**
 * Convert PDF user-space coordinates to CSS pixel position
 * relative to the page container top-left corner.
 */
export function toViewportCssPoint(
  viewport: PageViewport,
  pdfX: number,
  pdfY: number,
  dpr = 1
): { x: number; y: number } {
  const [px, py] = viewport.convertToViewportPoint(pdfX, pdfY);
  return { x: px / dpr, y: py / dpr };
}

/**
 * Convert a PDF-space rect (x, y = bottom-left, width, height in points)
 * to a CSS-pixel rect (x, y = top-left for position: absolute).
 * This is used to position PlacedField widgets on the overlay.
 */
export function pdfRectToCssRect(
  viewport: PageViewport,
  pdfX: number,
  pdfY: number,
  pdfW: number,
  pdfH: number,
  dpr = 1
): { left: number; top: number; width: number; height: number } {
  const tl = toViewportCssPoint(viewport, pdfX, pdfY + pdfH, dpr); // PDF Y is bottom; top of rect = y+h
  const br = toViewportCssPoint(viewport, pdfX + pdfW, pdfY, dpr);
  return {
    left: tl.x,
    top: tl.y,
    width: br.x - tl.x,
    height: br.y - tl.y,
  };
}
```

**Key invariants:**
- `viewport` must be constructed with the SAME `scale` used to render the canvas — the overlay and canvas must share a single scale source.
- The `dpr` argument is `window.devicePixelRatio`. The canvas element's pixel dimensions are `viewport.width * dpr` (canvas attrs), but its CSS size is `viewport.width` CSS pixels. `convertToPdfPoint` operates in canvas pixels, so multiply before calling.
- Page rotation is handled automatically inside `viewport.convertToPdfPoint` as long as the viewport was created with `page.getViewport({ scale, rotation: page.rotate })`.
- On zoom change, ALL field overlays reposition by re-running `pdfRectToCssRect` with the new viewport. The stored PDF-space coords are unchanged.

**Known edge case:** pdf.js `convertToPdfPoint` has a documented bug with some rotated pages in older versions. Pin to pdf.js ≥ 4.x where the transform matrix is stable. Write a round-trip test: `toPdfPoint(toViewportCssPoint(x,y)) === (x, y)` within floating-point tolerance.

---

## Data Flow

### Upload → View

```
User drops file
    ↓
File Ingestor
  ├─ PDF → read as ArrayBuffer
  │       → store originalBytes (Uint8Array, frozen, never mutated)
  │       → PDFDocument.load(bytes) via pdf.js → pdfDoc
  │       → DocumentModel { id, originalBytes, pdfDoc, pageCount, fileName, isImageWrapped: false }
  │
  └─ Image (JPEG/PNG) → read as ArrayBuffer
          → pdf-lib: create 1-page PDF, embedJpg/embedPng, drawImage to fill page
          → save new PDF bytes as originalBytes
          → load those bytes into pdf.js → pdfDoc
          → DocumentModel { ..., isImageWrapped: true }
    ↓
App Shell receives DocumentModel
  → renders N PageContainers (one per page)
  → each PageContainer fires pdf.js page.render() into its <canvas>
  → FieldOverlay is mounted over each canvas (same dimensions)
```

### Field Placement

```
User clicks on FieldOverlay
    ↓
PointerEvent (x, y relative to overlay element)
    ↓
Coordinate Mapper: toPdfPoint(viewport, x, y, dpr) → { pdfX, pdfY }
    ↓
Field Store: append PlacedField { id, type, pageIndex, x: pdfX, y: pdfY, width, height, value: null, recipientId: 'self', recipientRole: 'signer' }
    ↓
FieldOverlay re-renders
  → for each PlacedField on this page:
      Coordinate Mapper: pdfRectToCssRect(viewport, field) → { left, top, width, height }
      → render <FieldWidget style={{ position: 'absolute', left, top, width, height }} />
```

### Field Drag / Resize

```
User drags field widget
    ↓
PointerMove delta (in CSS pixels)
    ↓
Coordinate Mapper: toPdfPoint(viewport, newX, newY, dpr) → new PDF coords
    ↓
Field Store: update PlacedField.x / PlacedField.y
    ↓
FieldOverlay re-renders (field snaps to new position)
```

### Zoom Change

```
User changes zoom level
    ↓
App Shell updates zoomLevel state
    ↓
Each PageContainer: page.getViewport({ scale: BASE_SCALE * zoomLevel }) → new viewport
    ↓
Canvas re-renders at new scale
    ↓
FieldOverlay re-renders all fields using new viewport in pdfRectToCssRect
  → fields stay pixel-perfectly aligned because PDF-space coords are unchanged
```

### Export

```
User clicks "Download Signed PDF"
    ↓
Export Pipeline:
  1. PDFDocument.load(documentModel.originalBytes, { forIncrementalUpdate: true })
      → NOTE: load from originalBytes — the un-rendered copy; never the rendered canvas
  2. For each PlacedField in Field Store (sorted by page, then render order):
     a. signature / initials field with a PNG value:
        → embedPng(dataUrlToUint8Array(field.value))
        → page.drawImage(image, { x: field.x, y: field.y, width: field.width, height: field.height })
        NOTE: pdf-lib origin = bottom-left — matches PDF user-space directly. No Y-flip needed.
     b. text / date field:
        → page.drawText(field.value, { x: field.x, y: field.y, size: derivedFontSize(field.height) })
     c. checkbox field:
        → if checked: page.drawText('✓', ...) or drawLine cross
  3. pdfDoc.save() → Uint8Array
  4. Trigger browser download via URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
    ↓
User receives signed PDF
```

**Purity guarantee:** `export-pipeline.ts` is a pure function. It receives `originalBytes` and `fields[]` and returns `Uint8Array`. It has no React imports, no global state reads, no side effects. It can be called from a Web Worker in a future optimization pass without any refactoring.

**Incremental update:** Using `PDFDocument.load(bytes, { forIncrementalUpdate: true })` appends new objects to the end of the original file rather than rewriting it. The original content streams are never re-encoded. A forensic diff of the output shows the original bytes verbatim at offset 0.

---

## Architectural Patterns

### Pattern 1: Single Viewport Instance Per Page Per Render

**What:** The `PageViewport` object returned by `page.getViewport({ scale, rotation })` is the single source of truth for all geometry on that page. It is passed to both the canvas renderer AND the coordinate mapper. Never create a second viewport with different parameters for the same page.

**When to use:** Always. Every time zoom changes, create one viewport, pass it to render, and cache it in a ref for the overlay.

**Trade-offs:** Requires the overlay component to hold a ref to the current viewport. Small coupling cost, but eliminates an entire class of alignment bugs.

### Pattern 2: Store PDF-Space Coords, Derive Pixel Positions

**What:** The `PlacedField` store holds only PDF user-space coordinates. CSS pixel positions are derived on every render via the coordinate mapper. There is no "pixel position" state.

**When to use:** Always. This is the non-negotiable invariant.

**Trade-offs:** Tiny extra computation on every render. Completely eliminates stale-pixel-coordinate bugs on zoom.

### Pattern 3: Lazy-Load PDF Libraries

**What:** pdf.js and pdf-lib are loaded only when the user navigates to the app route, not on the landing page.

**When to use:** Always — combined bundle size is ~1 MB+.

```typescript
// routes/app/index.tsx
const Workspace = React.lazy(() => import('./Workspace'));
```

### Pattern 4: Image Normalization at Ingest Time

**What:** When the user uploads an image (JPEG/PNG), immediately wrap it in a single-page PDF using pdf-lib. After ingest, the rest of the system only knows about PDFs. The `isImageWrapped` flag on `DocumentModel` is only needed to display a UI hint.

**When to use:** Always for images. Eliminates conditional logic from every downstream module.

---

## Build Order (Dependency Graph)

Build in this order. Each layer depends on the one above being stable.

```
1. Types (PlacedField, DocumentModel, SavedSignature)
        ↓
2. Coordinate Mapper  ← shared by everything below; build and test first
        ↓
3. File Ingestor  ← depends on DocumentModel type
        ↓
4. Field Store  ← depends on PlacedField type
        ↓
5. Page Renderer (PageCanvas)  ← depends on DocumentModel (has pdfDoc)
        ↓
6. Field Overlay  ← depends on Field Store + Coordinate Mapper + PageCanvas (must share viewport)
        ↓
7. Signature Manager + Signature Store  ← depends on Field Store (to fill a field value)
        ↓
8. Export Pipeline  ← depends on Field Store + DocumentModel.originalBytes; test without UI
        ↓
9. App Shell / Toolbar  ← wires everything together
        ↓
10. Landing Page  ← independent, no PDF libs; build any time after routing is set up
```

**Critical path:** Steps 1-2-3-5-6 form the minimum viable "upload and view" flow. Steps 4-7 form "place and sign." Step 8 is "download." The app is shippable as a read-only viewer after step 6, which is useful for verifying the canvas/overlay alignment before any export code is written.

---

## Anti-Patterns

### Anti-Pattern 1: Storing CSS Pixel Coordinates in the Field Store

**What people do:** On mouse click, store `event.clientX / event.clientY` directly in the field record.

**Why it's wrong:** Pixel positions are zoom-dependent. Stored pixel coords become wrong the moment the user changes zoom or opens the doc in a different window size. Fields drift off-target on export.

**Do this instead:** Always call `toPdfPoint(viewport, cssX, cssY, dpr)` and store only the PDF-space result.

### Anti-Pattern 2: Re-Encoding the Original PDF

**What people do:** Render each page to a canvas, then use `canvas.toDataURL()` to build a new PDF from rasterized images.

**Why it's wrong:** This is lossy. Text becomes non-searchable. File size balloons. Fonts are gone. This is exactly what competing tools do that mangling formatting.

**Do this instead:** Keep `originalBytes` frozen and only append with pdf-lib incremental update. The original content streams are never touched.

### Anti-Pattern 3: Using a Single Canvas for All Pages

**What people do:** Render all pages to one tall canvas for simplicity.

**Why it's wrong:** A single canvas for a 50-page doc can exceed browser canvas size limits (~16,384px height on most browsers). Re-rendering on zoom requires redrawing all pages. Coordinate mapping becomes page-index math on top of the pixel math.

**Do this instead:** One `<canvas>` per page inside a `PageContainer`. Only render visible pages (virtual scrolling or intersection observer) to manage memory.

### Anti-Pattern 4: Building the Export Pipeline with DOM Dependencies

**What people do:** Import React state or component refs inside `export-pipeline.ts`.

**Why it's wrong:** Couples the pure PDF manipulation logic to the UI framework, making testing hard and Web Worker migration impossible.

**Do this instead:** Export pipeline is a pure function. Pass `originalBytes` and `fields[]` as plain arguments.

---

## Integration Points

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| PageCanvas ↔ FieldOverlay | Shared `viewport` ref passed via parent `PageContainer` | Both must use identical `scale` — the parent owns it |
| FieldOverlay ↔ Coordinate Mapper | Direct import; mapper is stateless | No store, no events — just function calls |
| FieldOverlay ↔ Field Store | Zustand selector | Overlay subscribes to fields for its page index only |
| Signature Manager ↔ Field Store | Dispatch action on confirm | Manager produces a data URL; store updates `PlacedField.value` |
| Export Pipeline ↔ Field Store | One-time snapshot read at export time | Pipeline does not subscribe; reads current state synchronously |
| Export Pipeline ↔ DocumentModel | Receives `originalBytes` (Uint8Array) | Never receives the pdf.js `pdfDoc` handle — that is render-only |

### External Libraries

| Library | Role | Notes |
|---------|------|-------|
| `pdfjs-dist` | Render PDF pages to canvas; viewport/coordinate API | Use the worker build; pin to ≥ 4.x for stable rotation |
| `pdf-lib` | Load original bytes, draw ops, incremental save, image wrapping | Use `{ forIncrementalUpdate: true }` on load |
| Zustand | Field store, doc model state | Lightweight; no boilerplate; works outside React |
| `idb` (or `idb-keyval`) | Signature Store persistence | Cleaner IndexedDB wrapper; avoid raw IDB API |
| `react-router-dom` | Landing vs. App routing | Needed for lazy-loading PDF libs out of landing bundle |

---

## Future Multi-Party Extension Point

The `recipientId` / `recipientRole` fields on `PlacedField` are the primary extension seam.

**v1 (self-signing):** Every field has `recipientId: 'self'`, `recipientRole: 'signer'`. The UI ignores these fields. The export pipeline processes all fields unconditionally.

**v2 (multi-party — future milestone):**

1. **Recipient model:** Add a `Recipient[]` array to `DocumentModel` (name, email, role, signingOrder). The UI gains a "recipient selector" in the toolbar.
2. **Field assignment:** When placing a field, the active recipient ID is stamped onto `PlacedField.recipientId`. The overlay renders fields color-coded by recipient.
3. **Routing:** The export pipeline changes from "draw all fields" to "draw fields for completed recipients" and generates a signing URL or export for the next recipient. This requires a backend — the only part that does.
4. **No schema rewrite:** `PlacedField` does not change shape. The store gains a filter. The export pipeline gains a parameter. The coordinate mapper is untouched. The rendering layers are untouched.

Estimate: adding multi-party adds a backend (routing, email, session) but requires **zero changes** to the core PDF manipulation and coordinate mapping code if the v1 schema is followed.

---

## Scaling Considerations

This is a browser-only static app. "Scaling" means CDN load and large-document performance, not backend capacity.

| Concern | Approach |
|---------|----------|
| Large PDFs (100+ pages) | Intersection Observer: only render visible pages. Unload canvas data for off-screen pages. |
| High-DPI screens | Cap `devicePixelRatio` at 2 in the viewport scale calculation to avoid 4x memory on 4K displays |
| Many placed fields | Field store is in-memory Zustand; 1,000 fields is trivially fast |
| CDN / Vercel | Vite SPA builds to static assets; zero Node.js runtime needed; deploy to Vercel or any CDN |
| Bundle size | Lazy-load `pdfjs-dist` and `pdf-lib` behind the app route; landing page stays < 50 KB |

---

## Sources

- [PDF.js Examples and Viewport API](https://mozilla.github.io/pdf.js/examples/)
- [PDF.js Express Coordinate Documentation](https://pdfjs.express/documentation/viewer/coordinates.8)
- [PDF Coordinate Systems — Apryse](https://apryse.com/blog/pdf-coordinates-and-pdf-processing)
- [pdf.js PageViewport: convertToPdfPoint issue with rotated pages](https://github.com/mozilla/pdf.js/issues/12003)
- [pdf-lib incremental save](https://github.com/remdra/pdf-lib-incremental-save)
- [pdf-lib PDFDocument API](https://pdf-lib.js.org/docs/api/classes/pdfdocument)
- [Understanding PDF.js Layers in React](https://www.react-pdf-kit.dev/blog/understanding-pdfjs-layers-and-how-to-use-them-in-reactjs/)
- [Nutrient: Instant JSON schema for PDF annotations](https://www.nutrient.io/guides/document-engine/json/schema/annotations/)
- [PDF-signature open source reference app](https://github.com/tzuyi0817/PDF-signature)
- [Konva.js signature pad and drag/resize](https://konvajs.org/docs/sandbox/Signature_Pad.html)
- [Vite vs Next.js for static/browser-only apps (2026)](https://dev.to/shadcndeck_dev/nextjs-vs-vite-choosing-the-right-tool-in-2026-38hp)

---

*Architecture research for: FreeESign — browser-only PDF e-signature*
*Researched: 2026-06-16*
