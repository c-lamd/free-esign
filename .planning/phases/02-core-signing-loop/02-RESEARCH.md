# Phase 2: Core Signing Loop — Research

**Researched:** 2026-06-17
**Domain:** signature_pad, react-rnd, pdf-lib overlay export, incremental PDF save, Coordinate Mapper integration
**Confidence:** MEDIUM (core stack thoroughly verified from npm registry and official docs; EXP-02 approach resolved but depends on a community library)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- Draw pad: centered modal overlay, single black pen, Clear + Done/Confirm controls, 3:1 canvas aspect ratio, transparent-background PNG output
- Placement: click/tap on page to drop; default ~180px wide at current render scale, aspect ratio preserved; same confirmed signature re-placeable; new field auto-selected after drop; placement tool disarms after drop
- react-rnd for placed field widget: click to select, show handles + delete control; × button AND Delete/Backspace keyboard delete; corner-handles with aspect-ratio LOCKED; drag bounded within the page (`bounds="parent"`); field position stored in PDF-space via Coordinate Mapper
- Export: filename `{original-name}-signed.pdf`; "Download" button in top bar; app stays on document after download; EXP-02 zero-alteration is a hard rule proven by first-512-byte hex comparison

### Claude's Discretion

- signature_pad configuration (smoothing, devicePixelRatio handling), exact modal layout/animation
- react-rnd wiring details (controlled position/size state shape, handle styling), selection state in Zustand
- Coordinate update loop specifics for keeping widgets locked during scroll/resize
- Export module structure, exact pdf-lib save options (subject to EXP-02 proof)
- Default field size constant, minimum field size, z-ordering of multiple fields

### Deferred Ideas (OUT OF SCOPE)

- Typed signatures (script fonts) and saved/persisted signatures across sessions → Phase 4 (SIG-02, SIG-03, SIG-04, SIG-05)
- Initials, date, free-text, checkbox field types → Phase 3 (FLD-02/03/04)
- Zoom controls with field scaling, multi-page placement polish, undo/redo → Phase 3 (DOC-04, FLD-08, FLD-09)
- Pen color / ink options → v2 (ENH-04)
- Multi-party recipient routing → v2 (MP-01); only the data-model seam is reserved here
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SIG-01 | User can create a signature by drawing it with mouse, trackpad, or touch | signature_pad 5.1.3 pattern — useRef canvas, devicePixelRatio, transparent PNG export |
| FLD-01 | User can place a saved signature anywhere on the document | Click-to-place gesture + Coordinate Mapper cssPixelToPageSpace; store field as PDF-space rect |
| FLD-05 | User can drag any placed field to reposition it on the page | react-rnd onDragStop → CSS px → PDF-space via Coordinate Mapper; bounds="parent" |
| FLD-06 | User can resize a placed field using handles | react-rnd onResizeStop; lockAspectRatio={true}; minWidth=80, minHeight=24 |
| FLD-07 | User can delete a placed field | × control + document keydown listener for Delete/Backspace when selectedFieldId !== null |
| EXP-01 | User can download the signed document as a PDF | pdf-lib load/overlay/save + Blob download |
| EXP-02 | Exported PDF preserves original content — overlays appended, original never re-encoded | pdf-lib-incremental-save `saveIncremental()` concatenated onto originalBytes; proven by first-512-byte hex test |
| EXP-03 | Signed image exported as PDF with placed fields | Phase 1 imageWrapper already produces a PDF; export pipeline is uniform regardless of input type |
</phase_requirements>

---

## Summary

Phase 2 delivers the full signing loop: draw → place → resize/drag/delete → download. The three hardest technical problems are: (1) EXP-02 zero-alteration export — pdf-lib's standard `save()` re-serializes all objects and does NOT preserve original bytes; the only viable solution in the browser that passes a first-512-byte hex comparison is using `pdf-lib-incremental-save` to append new objects to the original file as a PDF incremental update; (2) obtaining a per-page pdfjs viewport for coordinate mapping — react-pdf's `<Page>` exposes `originalWidth` and `originalHeight` via the `onLoadSuccess` callback which, combined with the `containerWidth` (already tracked by ResizeObserver in DocumentViewer), is sufficient to compute the render scale and build a viewport-compatible object for the Coordinate Mapper; (3) keeping the overlay widget synchronized with the page when the container resizes — field positions stored in PDF-space (bottom-left, points) are re-converted to CSS pixels at the current render scale whenever `containerWidth` changes.

The key research finding on EXP-02: pdf-lib 1.17.1's `save()` has exactly four options (`useObjectStreams`, `addDefaultPage`, `objectsPerTick`, `updateFieldAppearances`) — there is no incremental save option. Standard `save()` rewrites the entire file. The CLAUDE.md guarantee ("overlay onto the original file bytes, never re-encode") requires an incremental update approach. `pdf-lib-incremental-save` (1.17.4) provides `saveIncremental()` as a drop-in extension to pdf-lib that appends only the changed objects, leaving the original bytes verbatim. The output of `Buffer.concat([originalBytes, pdfIncrementalBytes])` passes the first-512-byte hex comparison because the original bytes are prepended unchanged. [ASSUMED — verified behavior matches incremental update PDF spec but not independently confirmed by byte-level test in this session]

**Primary recommendation:** Use `pdf-lib-incremental-save` for EXP-02 with an automated Vitest test that loads a known PDF, runs the export, and byte-compares the first 512 bytes of input vs output.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Signature drawing (SIG-01) | Browser (canvas) | — | signature_pad draws on a `<canvas>` ref in the DOM; entirely client-side, no network |
| Signature modal + placement state | Browser (Zustand) | — | modalOpen, signatureDataUrl, placementMode, fields[], selectedFieldId all in Zustand |
| Placed-field widget (drag/resize) | Browser (react-rnd) | — | react-rnd is a React component; position/size state managed in Zustand, converted to CSS px for render |
| Coordinate mapping (CSS px ↔ PDF pt) | Browser (pure TS) | — | Coordinate Mapper is already built (Phase 1); takes viewport parameters derived from react-pdf Page callbacks |
| PDF export / overlay (EXP-01/02) | Browser (pdf-lib) | — | pdf-lib + pdf-lib-incremental-save run entirely in browser; signed PDF downloaded directly without upload |
| Page viewport dimensions | Browser (react-pdf callback) | — | `<Page onLoadSuccess>` provides `originalWidth` / `originalHeight`; combined with containerWidth to compute render scale |

---

## Standard Stack

### Core (Phase 1 already installed — these are additions for Phase 2)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| signature_pad | 5.1.3 | Freehand signature drawing on canvas | [VERIFIED: npm registry] CLAUDE.md-pinned; canonical smooth-stroke canvas lib; built-in devicePixelRatio + touch support; outputs PNG data URL directly via `toDataURL()` |
| react-rnd | 10.5.3 | Drag + resize overlay widget | [VERIFIED: npm registry] CLAUDE.md-pinned; single component for drag AND resize; controlled mode with `position`/`size` props; `bounds="parent"` enforces page boundary; `lockAspectRatio` built-in |
| pdf-lib-incremental-save | 1.17.4 | Incremental PDF save (EXP-02) | [VERIFIED: npm registry] Community fork of pdf-lib that adds `saveIncremental()`; the ONLY browser-compatible way to pass the first-512-byte hex test; 5330 weekly downloads, no postinstall, browser-compatible UMD ES5 build |

**Note on pdf-lib-incremental-save:** pdf-lib 1.17.1 is already installed (Phase 1 via imageWrapper). `pdf-lib-incremental-save` 1.17.4 is a fork that replaces pdf-lib — it is installed as a replacement, NOT alongside the original. See installation note below.

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| uuid (or crypto.randomUUID) | built-in | Generate unique field IDs | Use `crypto.randomUUID()` — available in all modern browsers, no package install needed |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pdf-lib-incremental-save | Manual xref append | Hand-rolling PDF incremental updates requires understanding xref byte offsets, trailer generation, and cross-reference stream encoding — high complexity, high failure risk; pdf-lib-incremental-save handles this correctly |
| pdf-lib-incremental-save | Standard pdf-lib save() with `useObjectStreams: false` | Standard save() still re-serializes all objects; first 512 bytes will NOT be byte-identical to the input; EXP-02 fails |
| react-rnd | @dnd-kit + custom resize | @dnd-kit has no resize; requires a separate library; more integration work with no benefit |
| signature_pad | react-signature-canvas wrapper | react-signature-canvas wraps signature_pad with React; adds abstraction overhead; direct use of signature_pad with a canvas ref is simpler and avoids React wrapper bugs |

**Installation:**
```bash
# Phase 2 additions
npm install signature_pad react-rnd

# EXP-02 incremental save — installs as pdf-lib replacement fork
npm install pdf-lib-incremental-save

# Note: pdf-lib-incremental-save replaces pdf-lib as a fork.
# Update existing imports from 'pdf-lib' to 'pdf-lib-incremental-save' in imageWrapper.ts.
# The API surface is identical for all existing calls (PDFDocument.create/load/embedJpg/embedPng/save).
```

**Version verification (confirmed 2026-06-17):**
- `signature_pad@5.1.3` — published 2025-12-03, 2.19M weekly downloads [VERIFIED: npm registry]
- `react-rnd@10.5.3` — published 2026-03-10, 1.09M weekly downloads [VERIFIED: npm registry]
- `pdf-lib-incremental-save@1.17.4` — published 2024-01-29, 5330 weekly downloads [VERIFIED: npm registry]

---

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| signature_pad | npm | 10+ yrs | 2.19M/wk | github.com/szimek/signature_pad | OK | Approved |
| react-rnd | npm | 8+ yrs | 1.09M/wk | github.com/bokuweb/react-rnd | OK | Approved |
| pdf-lib-incremental-save | npm | ~2.5 yrs | 5330/wk | github.com/remdra/pdf-lib-incremental-save | OK (but low stars: 11) | Approved with note — low star count but functionally correct; no postinstall; no deprecation; MIT license; only viable option for EXP-02 |
| pdf-lib | npm | 6+ yrs | 7.3M/wk | github.com/Hopding/pdf-lib | OK | Already installed (Phase 1) — replaced by pdf-lib-incremental-save fork |

**Packages removed due to SLOP verdict:** none
**Packages flagged as suspicious (SUS):** none — legitimacy seam returned OK for all packages. Note: pdf-lib-incremental-save has low community adoption (11 stars, 5330 downloads/wk) but is the correct technical solution and has no suspicious signals (no postinstall, active repo, MIT).

---

## Critical Finding: EXP-02 Zero-Alteration Export

### The Problem

pdf-lib 1.17.1's `save()` method has exactly four options:
- `useObjectStreams?: boolean` — switches between `PDFStreamWriter` (compressed) and `PDFWriter` (uncompressed); does NOT preserve original bytes
- `addDefaultPage?: boolean` — auto-adds empty page if document has none
- `objectsPerTick?: number` — performance tuning for async serialization
- `updateFieldAppearances?: boolean` — refreshes form field visuals

**There is no incremental save option in pdf-lib 1.17.1.** [VERIFIED: npm registry — PDFDocumentOptions.ts from unpkg.com/pdf-lib@1.17.1]

Standard `PDFDocument.load(bytes)` + `.save()` re-serializes all PDF objects from scratch. The output bytes differ from the input bytes, even for unchanged objects. The first 512 bytes of input vs output will NOT be identical. This means the Phase 2 success criterion (first-512-byte hex comparison) will FAIL with standard pdf-lib save. [CITED: github.com/Hopding/pdf-lib/issues/537 — "Even when reading and writing the same PDF multiple times, the binaries differ"]

### The Solution: pdf-lib-incremental-save

`pdf-lib-incremental-save` is a fork of pdf-lib 1.17.x that adds:
- `pdfDoc.takeSnapshot()` — captures the current object state
- `snapshot.markRefForSave(page.ref)` — marks which page references should be included in the incremental update
- `pdfDoc.saveIncremental(snapshot)` — serializes only the new/changed objects as a Uint8Array delta

The incremental update is then concatenated with the original bytes:
```typescript
const pdfIncrementalBytes = await pdfDoc.saveIncremental(snapshot)
const pdfBytes = new Uint8Array([...existingPdfBytes, ...pdfIncrementalBytes])
```

This produces a valid PDF with:
- **Original bytes verbatim from byte 0** — the first 512 bytes are identical to the input
- **New objects appended** — signature image XObject + page content stream addition
- **New xref section + trailer** — valid per PDF spec incremental update format
- **PDF readers layer the updates** — scanning from the end of file, finding the new xref, reading added objects

[CITED: github.com/remdra/pdf-lib-incremental-save README; pdf-lib-incremental-save npm page]

### Migration from pdf-lib to pdf-lib-incremental-save

Since pdf-lib-incremental-save is a fork (not a wrapper), it exports the same symbols as pdf-lib. The migration requires:

1. Uninstall `pdf-lib`, install `pdf-lib-incremental-save`
2. Update `import { PDFDocument, ... } from 'pdf-lib'` → `from 'pdf-lib-incremental-save'` in `imageWrapper.ts`
3. All existing pdf-lib calls (`.create()`, `.embedJpg()`, `.embedPng()`, `.addPage()`, `.drawImage()`, `.save()`) work unchanged

For the new export function, use the incremental path:
```typescript
// Source: github.com/remdra/pdf-lib-incremental-save README
import { PDFDocument, rgb } from 'pdf-lib-incremental-save'

export async function exportSignedPdf(
  originalPdfBytes: Uint8Array,
  fields: PlacedField[],
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(originalPdfBytes)
  const snapshot = pdfDoc.takeSnapshot()
  const pages = pdfDoc.getPages()

  for (const field of fields) {
    const page = pages[field.pageNumber - 1] // pageNumber is 1-indexed
    snapshot.markRefForSave(page.ref)
    
    // Embed PNG and draw at PDF-space coordinates
    const pngImage = await pdfDoc.embedPng(field.dataUrl)
    page.drawImage(pngImage, {
      x: field.pdfX,
      y: field.pdfY,
      width: field.pdfWidth,
      height: field.pdfHeight,
    })
  }

  const incrementalBytes = await pdfDoc.saveIncremental(snapshot)
  
  // Concatenate: original bytes + incremental update
  const result = new Uint8Array(originalPdfBytes.length + incrementalBytes.length)
  result.set(originalPdfBytes)
  result.set(incrementalBytes, originalPdfBytes.length)
  return result
}
```

[ASSUMED — the exact saveIncremental call requires snapshot.markRefForSave for each modified page; skipping markRefForSave may produce incomplete incremental updates]

### EXP-02 Automated Test Design

The test must:
1. Load a known small PDF (store a minimal valid PDF as a test fixture in `src/test/fixtures/sample.pdf` or as a Base64 string)
2. Call `exportSignedPdf()` with one placed field (fabricated PNG data URL)
3. Assert that the first 512 bytes of output === first 512 bytes of input

```typescript
// src/test/exportPdf.test.ts — EXP-02 byte-identity assertion
import { describe, it, expect } from 'vitest'
import { exportSignedPdf } from '../lib/exportPdf'
import { SAMPLE_PDF_BASE64 } from './fixtures/samplePdf'

describe('EXP-02: zero-alteration export', () => {
  it('first 512 bytes of output are identical to input', async () => {
    const inputBytes = Uint8Array.from(atob(SAMPLE_PDF_BASE64), c => c.charCodeAt(0))
    const field = {
      id: 'test-1',
      type: 'signature' as const,
      pageNumber: 1,
      pdfX: 100, pdfY: 100, pdfWidth: 200, pdfHeight: 50,
      dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    }
    const outputBytes = await exportSignedPdf(inputBytes, [field])
    
    // First 512 bytes must be byte-identical
    const inputFirst512 = Array.from(inputBytes.slice(0, 512))
    const outputFirst512 = Array.from(outputBytes.slice(0, 512))
    expect(outputFirst512).toEqual(inputFirst512)
    
    // Output must be LONGER than input (incremental update appended)
    expect(outputBytes.length).toBeGreaterThan(inputBytes.length)
  })

  it('output is a valid PDF (starts with %PDF-)', () => {
    const inputBytes = Uint8Array.from(atob(SAMPLE_PDF_BASE64), c => c.charCodeAt(0))
    const header = new TextDecoder().decode(inputBytes.slice(0, 5))
    expect(header).toBe('%PDF-')
  })
})
```

**Note:** The `dataUrl` in the test uses a 1x1 transparent PNG, which is the minimal valid PNG. The fixture PDF needs to be a valid single-page PDF stored as a Base64 constant — a minimal "hello world" PDF can be generated once with `pdf-lib-incremental-save` and stored.

---

## Architecture Patterns

### System Architecture Diagram

```
User draws on SignatureDrawModal canvas
  │ (signature_pad on <canvas> ref with devicePixelRatio scaling)
  │
  ├── Clear: signaturePad.clear() → resets isEmpty
  └── Done: signaturePad.toDataURL('image/png')
             → PNG data URL stored in Zustand: signatureDataUrl
             → placementMode = true
             → modal closes

Placement Mode Armed (placementMode = true)
  │ PlacementModeOverlay banner visible, cursor = crosshair
  │
  User clicks on rendered page
  ├── click event on per-page overlay div
  ├── CSS pixel (x, y) from click event relative to page div
  ├── cssPixelToPageSpace(cssPoint, viewport) → PDF-space point
  │     viewport built from: containerWidth, page.originalWidth (from onLoadSuccess)
  │     scale = containerWidth / page.originalWidth
  ├── default size: 180px CSS wide → pdfWidth via scale
  ├── pdfHeight = pdfWidth / (pngNaturalWidth / pngNaturalHeight)
  ├── Create PlacedField record: {id, type, pageNumber, pdfX, pdfY, pdfWidth, pdfHeight, dataUrl}
  ├── Zustand: fields.push(field); selectedFieldId = field.id; placementMode = false
  └── PlacedFieldWidget renders on this page's overlay div

PlacedFieldWidget (react-rnd) render
  │ Reads field.pdfX/Y/W/H + current viewport (scale + rotation) from Zustand
  ├── pageSpaceToCssPixel(pdfPoint, viewport) → CSS position {x, y}
  ├── pdfWidth * scale → CSS width; pdfHeight * scale → CSS height
  └── <Rnd position={cssPos} size={cssSize} bounds="parent" lockAspectRatio={true}>
         <img src={field.dataUrl} style="width:100%;height:100%;object-fit:contain" />
       </Rnd>

User drags or resizes PlacedFieldWidget
  │ react-rnd calls onDragStop(e, d) or onResizeStop(e, dir, ref, delta, pos)
  ├── New CSS position/size from callback data
  ├── cssPixelToPageSpace(newCssPos, viewport) → new PDF-space origin
  ├── CSS size / scale → new PDF-space dimensions
  └── Zustand: updateField(id, { pdfX, pdfY, pdfWidth, pdfHeight })

User clicks "Download PDF" button
  │
  ├── Fetch originalPdfBytes (kept in Zustand as ArrayBuffer alongside docUrl)
  ├── exportSignedPdf(originalPdfBytes, fields)  ← src/lib/exportPdf.ts
  │     ├── PDFDocument.load(originalPdfBytes)
  │     ├── takeSnapshot()
  │     ├── for each field:
  │     │     markRefForSave(pages[field.pageNumber-1].ref)
  │     │     embedPng(field.dataUrl)
  │     │     page.drawImage(pngImage, { x: field.pdfX, y: field.pdfY, w: field.pdfWidth, h: field.pdfHeight })
  │     └── saveIncremental(snapshot) → incrementalBytes
  │         result = concat(originalPdfBytes, incrementalBytes)
  ├── new Blob([result], { type: 'application/pdf' })
  ├── URL.createObjectURL(blob) → anchor.click() → download
  └── filename: {original filename base}-signed.pdf
```

### Recommended Project Structure (Phase 2 additions)

```
src/
├── components/
│   ├── SignatureDrawModal.tsx     # NEW — centered modal, signature_pad canvas
│   ├── PlacementModeOverlay.tsx  # NEW — sticky banner, crosshair cursor
│   ├── PlacedFieldWidget.tsx     # NEW — react-rnd wrapper with handles + × delete
│   ├── TopBar.tsx                # MODIFIED — add Download PDF button
│   ├── DocumentViewer.tsx        # MODIFIED — add click handler, render PlacedFieldWidget per page
│   └── LazyPage.tsx              # MODIFIED — expose onLoadSuccess for page dimensions; add overlay div
├── lib/
│   ├── coordinateMapper.ts       # UNCHANGED — reused as-is (Phase 1 hand-off)
│   ├── imageWrapper.ts           # MODIFIED — update import from pdf-lib → pdf-lib-incremental-save
│   └── exportPdf.ts              # NEW — exportSignedPdf() using pdf-lib-incremental-save
├── store/
│   └── documentStore.ts          # MODIFIED — extend with fields, selectedFieldId, modalOpen, signatureDataUrl, placementMode, originalPdfBytes
└── test/
    ├── exportPdf.test.ts          # NEW — EXP-02 byte-identity test
    ├── fixtures/
    │   └── samplePdf.ts           # NEW — minimal valid PDF as Base64 string constant
    └── placedField.test.ts        # NEW — coordinate round-trip for field placement
```

### Pattern 1: signature_pad with React canvas ref

**What:** Attach a signature_pad instance to a canvas element using useRef; handle high-DPI screens via devicePixelRatio; export transparent-background PNG.

**When to use:** SignatureDrawModal component.

```typescript
// Source: github.com/szimek/signature_pad README (devicePixelRatio pattern)
import { useEffect, useRef } from 'react'
import SignaturePad from 'signature_pad'

function SignatureDrawModal() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const padRef = useRef<SignaturePad | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // High-DPI canvas scaling (built-in to signature_pad; must be done before init)
    const ratio = Math.max(window.devicePixelRatio || 1, 1)
    canvas.width = canvas.offsetWidth * ratio
    canvas.height = canvas.offsetHeight * ratio
    canvas.getContext('2d')?.scale(ratio, ratio)

    padRef.current = new SignaturePad(canvas, {
      penColor: 'rgb(0, 0, 0)',           // Single black pen (CONTEXT.md locked)
      backgroundColor: 'rgba(0,0,0,0)',   // Transparent — so PNG export has no white box
    })

    return () => {
      padRef.current?.off()   // Remove event listeners on unmount
    }
  }, [])

  const handleClear = () => padRef.current?.clear()
  
  const handleDone = () => {
    if (!padRef.current || padRef.current.isEmpty()) return
    // toDataURL with no args defaults to 'image/png' with transparent background
    const dataUrl = padRef.current.toDataURL('image/png')
    // Store in Zustand: signatureDataUrl = dataUrl; placementMode = true
  }
  
  const isEmpty = () => padRef.current?.isEmpty() ?? true

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label="Signature drawing canvas"
      style={{ touchAction: 'none' }}  // Prevent scroll-on-drag on mobile
    />
  )
}
```

**Critical pitfall — canvas resize:** If the modal resizes after initialization (e.g., window resize), the canvas pixel dimensions may not match the CSS dimensions. Add a ResizeObserver or reinitialize on resize. The simplest v1 approach: set canvas dimensions once on mount; modal has a fixed max-width (560px) so resize is rare.

**Transparent PNG export:** `toDataURL('image/png')` with `backgroundColor: 'rgba(0,0,0,0)'` produces a PNG with transparent background. The black strokes render on the transparent canvas. When this PNG is embedded in the PDF via `page.drawImage()`, only the ink is visible on the document — no white box.

**isEmpty() for button enable/disable:** `padRef.current.isEmpty()` returns `true` if no strokes have been drawn. Use this to drive `aria-disabled` on the "Add signature" button. Since signature_pad doesn't expose a React-friendly event, bind to `beginStroke` / `endStroke` events:
```typescript
useEffect(() => {
  const pad = padRef.current
  if (!pad) return
  const update = () => setHasStrokes(!pad.isEmpty())
  pad.addEventListener('beginStroke', update)
  pad.addEventListener('endStroke', update)
  return () => {
    pad.removeEventListener('beginStroke', update)
    pad.removeEventListener('endStroke', update)
  }
}, [])
```
[ASSUMED — beginStroke/endStroke events confirmed in signature_pad README; exact event names verified from github.com/szimek/signature_pad]

### Pattern 2: Obtaining Page Viewport from react-pdf for Coordinate Mapping

**What:** react-pdf's `<Page>` `onLoadSuccess` callback provides `originalWidth` and `originalHeight` (PDF points at scale 1). Combined with `containerWidth` (from DocumentViewer's ResizeObserver), compute render scale and build a viewport-compatible object for the Coordinate Mapper.

**Key insight resolving Phase 1 Open Question 3:** The `Page` component's `onLoadSuccess` callback (not `onRenderSuccess`, which has no parameters) provides the enhanced page object with `originalWidth` and `originalHeight` added by react-pdf. These are the PDF point dimensions at scale 1. The render scale is `containerWidth / originalWidth`. This is enough to drive the Coordinate Mapper without needing a real pdfjs `PageViewport`. [CITED: github.com/wojtekmaj/react-pdf/discussions/1535]

```typescript
// In LazyPage.tsx — MODIFIED for Phase 2
import { Page } from 'react-pdf'
import { cssPixelToPageSpace, pageSpaceToCssPixel } from '../lib/coordinateMapper'

interface PageDimensions {
  originalWidth: number   // PDF points at scale 1
  originalHeight: number  // PDF points at scale 1
  scale: number           // = containerWidth / originalWidth
}

// LazyPage.tsx: capture page dimensions and expose via callback
function LazyPage({ pageNumber, containerWidth, onPageLoad }: Props) {
  return (
    <div style={{ position: 'relative' }}>
      <Page
        pageNumber={pageNumber}
        width={containerWidth}
        renderTextLayer={false}
        renderAnnotationLayer={false}
        onLoadSuccess={(page) => {
          // page.originalWidth and page.originalHeight are react-pdf extensions
          // TypeScript: cast to { originalWidth: number; originalHeight: number }
          const { originalWidth, originalHeight } = page as unknown as PageDimensions
          const scale = containerWidth ? containerWidth / originalWidth : 1
          onPageLoad?.(pageNumber, { originalWidth, originalHeight, scale })
        }}
      />
      {/* Overlay div for PlacedFieldWidget (absolute, inset 0, pointer-events:none except on widgets) */}
      <div
        id={`page-overlay-${pageNumber}`}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      />
    </div>
  )
}
```

**Building a viewport-compatible object from originalWidth/originalHeight/scale:**

The Coordinate Mapper accepts any object with `convertToPdfPoint(x, y): number[]` and `convertToViewportPoint(x, y): number[]`. For rotation=0 (the default for most documents), the affine math is simple enough to implement directly without importing pdfjs:

```typescript
// For rotation=0 (most documents):
// PDF space: origin bottom-left, y increases upward
// CSS space: origin top-left, y increases downward
// At scale S and page height H (in PDF points):
//   pdfX = cssX / S
//   pdfY = H - cssY / S
// Reverse:
//   cssX = pdfX * S
//   cssY = (H - pdfY) * S

function makeSimpleViewport(originalWidth: number, originalHeight: number, scale: number) {
  return {
    convertToPdfPoint(cssX: number, cssY: number): number[] {
      return [cssX / scale, originalHeight - cssY / scale]
    },
    convertToViewportPoint(pdfX: number, pdfY: number): number[] {
      return [pdfX * scale, (originalHeight - pdfY) * scale]
    },
  }
}
```

[ASSUMED — this affine math is correct for rotation=0. For rotated pages (90/180/270), use the full pdfjs affine mock from the existing coordinateMapper tests. Phase 2 does not handle rotated pages in the MVP; defer to Phase 3.]

**Store page dimensions in Zustand:** Add `pageDimensions: Map<number, PageDimensions>` to the store. Updated via `onLoadSuccess` callback in LazyPage. Field placement and widget render both read from this map by `field.pageNumber`.

### Pattern 3: react-rnd Controlled Mode for PlacedFieldWidget

**What:** Use react-rnd in controlled mode with `position` and `size` from Zustand (converted to CSS pixels). On drag/resize stop, convert back to PDF-space and update store.

**When to use:** PlacedFieldWidget component, one per placed field.

```typescript
// Source: github.com/bokuweb/react-rnd README (controlled mode example)
import { Rnd } from 'react-rnd'

function PlacedFieldWidget({ field, viewport, isSelected, onSelect, onDelete }: Props) {
  const updateField = useFieldStore((s) => s.updateField)
  
  // Convert PDF-space rect to CSS pixels for rendering
  const cssPos = pageSpaceToCssPixel({ x: field.pdfX, y: field.pdfY }, viewport)
  const cssWidth = field.pdfWidth * viewport.scale
  const cssHeight = field.pdfHeight * viewport.scale
  
  return (
    <Rnd
      position={{ x: cssPos.x, y: cssPos.y }}
      size={{ width: cssWidth, height: cssHeight }}
      bounds="parent"                   // Constrained within the page overlay div
      lockAspectRatio={true}            // Signature image never distorted
      minWidth={80}
      minHeight={24}
      disableDragging={false}
      enableResizing={true}
      resizeHandleComponent={{          // Custom handle dots (accent color per UI-SPEC)
        topLeft: <ResizeHandle />,
        topRight: <ResizeHandle />,
        bottomLeft: <ResizeHandle />,
        bottomRight: <ResizeHandle />,
        top: <ResizeHandle />,
        bottom: <ResizeHandle />,
        left: <ResizeHandle />,
        right: <ResizeHandle />,
      }}
      onDragStop={(e, d) => {
        // d.x, d.y are CSS pixel position after drag
        const newPdfPos = cssPixelToPageSpace({ x: d.x, y: d.y }, viewport)
        updateField(field.id, { pdfX: newPdfPos.x, pdfY: newPdfPos.y })
      }}
      onResizeStop={(e, direction, ref, delta, position) => {
        // ref.style.width / ref.style.height are the new CSS dimensions (strings with 'px')
        const newCssWidth = parseFloat(ref.style.width)
        const newCssHeight = parseFloat(ref.style.height)
        const newPdfWidth = newCssWidth / viewport.scale
        const newPdfHeight = newCssHeight / viewport.scale
        const newPdfPos = cssPixelToPageSpace({ x: position.x, y: position.y }, viewport)
        updateField(field.id, {
          pdfX: newPdfPos.x, pdfY: newPdfPos.y,
          pdfWidth: newPdfWidth, pdfHeight: newPdfHeight
        })
      }}
    >
      <img src={field.dataUrl} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
      {isSelected && (
        <button onClick={() => onDelete(field.id)} aria-label="Delete signature">
          <span className="sr-only">Delete signature</span>×
        </button>
      )}
    </Rnd>
  )
}
```

**Critical detail — `ref.style.width` is a string:** react-rnd's `onResizeStop` provides `ref.style.width` as a string like `"180px"`. Use `parseFloat(ref.style.width)` to get the number. [CITED: github.com/bokuweb/react-rnd README onResizeStop example]

**`bounds="parent"` requirement:** The parent element of `<Rnd>` must be `position: relative` for `bounds="parent"` to work correctly. The per-page overlay div must be `position: absolute; inset: 0` within the `position: relative` page wrapper. [ASSUMED — standard react-rnd bounds="parent" behavior]

**`lockAspectRatio` with the signature's natural ratio:** Pass `lockAspectRatio={pngNaturalWidth / pngNaturalHeight}` (a number) rather than `true` to lock to the exact signature PNG ratio rather than the initial CSS dimensions (which may be rounded). Extract natural dimensions by creating a temporary `Image` element:
```typescript
function getPngAspectRatio(dataUrl: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img.naturalWidth / img.naturalHeight)
    img.src = dataUrl
  })
}
```

### Pattern 4: pdf-lib drawImage Coordinate System

**What:** pdf-lib uses PDF user space — origin is bottom-left, y increases upward. The signature's `pdfY` from the Coordinate Mapper is already in this space. No Y-axis flip is needed as long as the field stores the BOTTOM-LEFT corner in PDF space.

**Critical:** react-rnd gives a position for the TOP-LEFT corner of the widget in CSS pixels. The Coordinate Mapper converts top-left CSS → PDF space correctly (it uses pdfjs `convertToPdfPoint` which handles the Y-flip). So `field.pdfY` (as stored in Zustand) is already the bottom-left Y in PDF points.

```typescript
// Source: pdf-lib.js.org official docs (drawImage options)
page.drawImage(pngImage, {
  x: field.pdfX,        // left edge in PDF points from left of page
  y: field.pdfY,        // BOTTOM edge in PDF points from bottom of page
  width: field.pdfWidth,
  height: field.pdfHeight,
  // opacity: 1 (default)
})
```

[CITED: pdf-lib.js.org/docs/api/classes/pdfpage — drawImage method]

**The Y coordinate stored in `field.pdfY` is the bottom-left corner.** The Coordinate Mapper's `cssPixelToPageSpace` converts the CSS top-left corner of the placed field to PDF bottom-left correctly because `viewport.convertToPdfPoint(x, y)` handles the coordinate origin flip. The result is ready for `page.drawImage()` without further adjustment.

### Anti-Patterns to Avoid

- **Using pdf-lib standard `save()` for EXP-02:** Re-serializes all objects; first 512 bytes will NOT match input. EXP-02 fails.
- **Using `backgroundColor: 'rgb(255,255,255)'` in signature_pad:** White background means the exported PNG has a white rectangle visible on the PDF document behind all text. Always use `rgba(0,0,0,0)` (transparent) for signature overlays.
- **Storing originalPdfBytes only as a Blob URL:** Need the raw bytes for pdf-lib. Store the original `ArrayBuffer` separately in Zustand when the file is opened. The Blob URL is for react-pdf rendering; the ArrayBuffer is for export. Keep both.
- **Applying Y-flip twice:** The Coordinate Mapper already handles the origin flip (top-left CSS → bottom-left PDF). Do NOT additionally flip the Y coordinate when calling `page.drawImage()` — that would double-invert and place the signature at the wrong position.
- **Not marking the page ref before drawing:** In pdf-lib-incremental-save, `snapshot.markRefForSave(page.ref)` must be called BEFORE modifying the page. If skipped, the incremental update may omit the page changes.
- **Making the overlay div opaque:** The per-page overlay div must have `pointer-events: none` at the div level with individual widgets enabling their own `pointer-events: auto`. Otherwise the overlay blocks mouse events on the PDF canvas.
- **Not calling `padRef.current?.off()` on unmount:** signature_pad attaches global event listeners to the canvas. Failing to call `.off()` leaks listeners and can cause errors after modal is closed.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Smooth Bezier stroke interpolation | Custom canvas drawing with raw mouse events | `signature_pad` | Pressure curve smoothing, devicePixelRatio, touch support all built-in |
| Drag + resize overlay | Custom mousedown/mousemove/mouseup handlers | `react-rnd` | Corner resize handles, bounds enforcement, aspect-ratio locking — each is a complex edge-case-filled feature |
| PDF incremental update byte construction | Manual xref table writing, trailer construction, byte-offset calculation | `pdf-lib-incremental-save` | The xref format is 20-byte-exact; byte offsets must account for the entire file; one off-by-one corrupts the PDF |
| PNG transparency compositing | Canvas `clearRect` + custom compositing | `signature_pad` with `backgroundColor: 'rgba(0,0,0,0)'` | Transparent PNG is signature_pad's default output when backgroundColor is transparent |
| UUID generation | Custom random string generator | `crypto.randomUUID()` (browser built-in) | Available in all modern browsers (Chrome 92+, Firefox 95+, Safari 15.4+); no npm package needed |

**Key insight:** The export pipeline's correctness guarantee (EXP-02) depends on PDF spec-conformant xref construction — this is not a DIY problem. The incremental update format requires exact byte offsets calculated from the entire preceding file content. Any hand-rolled implementation would need a full PDF spec implementation. `pdf-lib-incremental-save` already implements this correctly.

---

## Zustand Store Extension

Phase 2 extends the existing `documentStore.ts`. The planner should create this as a separate `fieldStore.ts` or extend the existing store. Recommendation: a second `useFieldStore` for Phase 2 state to keep the stores focused.

```typescript
// src/store/fieldStore.ts (NEW)
import { create } from 'zustand'

export interface PlacedField {
  id: string            // crypto.randomUUID()
  type: 'signature'     // Phase 3 adds: 'initials' | 'date' | 'text' | 'checkbox'
  pageNumber: number    // 1-indexed
  pdfX: number          // PDF user-space, bottom-left origin, points
  pdfY: number
  pdfWidth: number
  pdfHeight: number
  dataUrl: string       // PNG data URL (transparent background)
  role?: string         // v2 multi-party seam (MP-01) — not used in Phase 2
}

export interface PageDimensions {
  originalWidth: number   // PDF points at scale 1
  originalHeight: number
  scale: number           // containerWidth / originalWidth
}

interface FieldStore {
  // Signature draw modal
  modalOpen: boolean
  signatureDataUrl: string | null

  // Placement
  placementMode: boolean

  // Fields
  fields: PlacedField[]
  selectedFieldId: string | null

  // Page dimensions (needed for coordinate conversion)
  pageDimensions: Map<number, PageDimensions>

  // Actions
  openModal: () => void
  closeModal: () => void
  setSignatureDataUrl: (url: string | null) => void
  setPlacementMode: (active: boolean) => void
  addField: (field: PlacedField) => void
  updateField: (id: string, updates: Partial<PlacedField>) => void
  deleteField: (id: string) => void
  setSelectedFieldId: (id: string | null) => void
  setPageDimensions: (pageNumber: number, dims: PageDimensions) => void
  resetFields: () => void
}
```

**Note on `pageDimensions` and Zustand Map:** Zustand's `set` works correctly with `Map` objects but the Map must be replaced (not mutated) to trigger re-renders:
```typescript
setPageDimensions: (pageNumber, dims) => set((state) => {
  const next = new Map(state.pageDimensions)
  next.set(pageNumber, dims)
  return { pageDimensions: next }
})
```

**Note on `originalPdfBytes`:** Add `originalPdfBytes: ArrayBuffer | null` to `documentStore.ts` (the existing Phase 1 store). Set it when a file is opened (alongside `docUrl`). This is needed by `exportSignedPdf()`. The original bytes must be stored before creating the Blob URL, as `URL.createObjectURL()` produces an opaque URL with no way to recover the bytes later.

---

## Common Pitfalls

### Pitfall 1: Standard pdf-lib save() fails EXP-02

**What goes wrong:** `await pdfDoc.save()` produces output where the first 512 bytes differ from input. The hex-diff test fails.
**Why it happens:** `PDFDocument.save()` re-serializes all objects regardless of whether they changed. Output is a complete re-encoding of the PDF.
**How to avoid:** Use `pdf-lib-incremental-save` and `saveIncremental()`. Concatenate `[originalBytes, incrementalBytes]`.
**Warning signs:** Test failure on first-512-byte comparison; output file is smaller than input (object streams compressed) or has different xref structure.

### Pitfall 2: Y-coordinate inversion confusion

**What goes wrong:** Signature placed at the top of the page (small CSS Y) ends up at the BOTTOM of the exported PDF, or vice versa.
**Why it happens:** CSS origin is top-left; PDF origin is bottom-left. The Coordinate Mapper (via `viewport.convertToPdfPoint`) handles this conversion. But if you additionally subtract from page height, you double-invert.
**How to avoid:** Trust the Coordinate Mapper. `field.pdfY` (stored from `cssPixelToPageSpace`) is already correct for `page.drawImage({ y: field.pdfY })`. Do NOT additionally compute `pageHeight - field.pdfY`.
**Warning signs:** Signatures appear mirrored vertically in the exported PDF vs. where they were placed in the viewer.

### Pitfall 3: signature_pad canvas dimensions not set before init

**What goes wrong:** Strokes appear thin/blurry on high-DPI screens (retina), or the canvas renders at half resolution.
**Why it happens:** The canvas pixel dimensions must be set BEFORE creating the SignaturePad instance (or before any stroke is drawn). If the CSS sets the canvas size but the pixel dimensions aren't scaled by devicePixelRatio, the canvas draws at device-resolution but renders at CSS-resolution.
**How to avoid:** In `useEffect`, before `new SignaturePad(canvas, opts)`: set `canvas.width = canvas.offsetWidth * ratio` and `canvas.height = canvas.offsetHeight * ratio`, then call `canvas.getContext('2d').scale(ratio, ratio)`.
**Warning signs:** Signature looks blurry or pixelated in the canvas; signature preview PNG looks fine but canvas strokes look thin.

### Pitfall 4: `bounds="parent"` requires position:relative parent

**What goes wrong:** react-rnd widget drifts or is not constrained properly during dragging.
**Why it happens:** `bounds="parent"` uses `offsetParent` to calculate boundaries. The per-page overlay div must itself be `position: absolute` within a `position: relative` page wrapper for `offsetParent` to resolve correctly.
**How to avoid:** The per-page structure must be:
```
<div style="position:relative">       ← page wrapper (LazyPage outer div)
  <Page ... />                         ← react-pdf canvas
  <div style="position:absolute;inset:0">   ← overlay div (parent for react-rnd)
    <Rnd bounds="parent" ... />        ← PlacedFieldWidget
  </div>
</div>
```
**Warning signs:** Widget can be dragged outside the page area; `bounds="parent"` has no visible effect.

### Pitfall 5: Storing only Blob URL, losing original bytes for export

**What goes wrong:** `exportSignedPdf()` needs the original PDF bytes as a `Uint8Array`, but the store only has the Blob URL string.
**Why it happens:** Phase 1 stores `docUrl` (Blob URL string) for react-pdf rendering. The raw bytes from `file.arrayBuffer()` are not retained after the Blob URL is created.
**How to avoid:** In the file open handler (TopBar/UploadZone), store `file.arrayBuffer()` result in Zustand as `originalPdfBytes: ArrayBuffer | null`. This must happen before `URL.createObjectURL(blob)`.
**Warning signs:** `exportSignedPdf` receives `null` for bytes; export fails silently or throws.

### Pitfall 6: pdf-lib-incremental-save import conflicts with pdf-lib

**What goes wrong:** TypeScript type errors or runtime "Cannot find module" if both `pdf-lib` and `pdf-lib-incremental-save` are installed simultaneously.
**Why it happens:** `pdf-lib-incremental-save` is a fork (not a dependency of `pdf-lib`) that exports the same symbols. Having both creates conflicting module resolution.
**How to avoid:** Run `npm uninstall pdf-lib` before `npm install pdf-lib-incremental-save`. Update all imports from `'pdf-lib'` to `'pdf-lib-incremental-save'`.
**Warning signs:** TS errors about duplicate type declarations; bundle includes both pdf-lib and pdf-lib-incremental-save.

### Pitfall 7: `onResizeStop` ref.style.width is a string with 'px'

**What goes wrong:** `parseFloat` gives wrong values if the style is e.g. `"180.5px"` and you parse without trimming; or TypeScript error if you pass the string directly to a numeric field.
**Why it happens:** react-rnd's `onResizeStop` callback provides the new dimensions via `ref.style.width` / `ref.style.height`, which are CSS strings.
**How to avoid:** Always use `parseFloat(ref.style.width)` and `parseFloat(ref.style.height)` — `parseFloat` handles the 'px' suffix correctly.
**Warning signs:** Field width becomes `NaN` in Zustand; widget disappears after resize.

---

## Code Examples

### EXP-02 Export Pipeline (complete)

```typescript
// Source: github.com/remdra/pdf-lib-incremental-save README + pdf-lib.js.org docs
import { PDFDocument } from 'pdf-lib-incremental-save'
import type { PlacedField } from '../store/fieldStore'

export async function exportSignedPdf(
  originalPdfBytes: ArrayBuffer,
  fields: PlacedField[],
): Promise<Uint8Array> {
  const srcBytes = new Uint8Array(originalPdfBytes)
  const pdfDoc = await PDFDocument.load(srcBytes)
  const snapshot = pdfDoc.takeSnapshot()
  const pages = pdfDoc.getPages()

  for (const field of fields) {
    const page = pages[field.pageNumber - 1]
    snapshot.markRefForSave(page.ref)
    
    // Extract base64 data from data URL
    const base64 = field.dataUrl.split(',')[1]
    const pngBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
    
    const pngImage = await pdfDoc.embedPng(pngBytes)
    page.drawImage(pngImage, {
      x: field.pdfX,
      y: field.pdfY,
      width: field.pdfWidth,
      height: field.pdfHeight,
    })
  }

  const incrementalBytes = await pdfDoc.saveIncremental(snapshot)
  
  // Concatenate: original + incremental update
  const result = new Uint8Array(srcBytes.length + incrementalBytes.length)
  result.set(srcBytes, 0)
  result.set(incrementalBytes, srcBytes.length)
  return result
}
```

### Download Trigger

```typescript
// Standard browser download pattern — no server needed
export function triggerDownload(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Revoke after brief delay so download can start
  setTimeout(() => URL.revokeObjectURL(url), 100)
}
```

### Coordinate Mapper Usage in Placement Handler

```typescript
// Source: coordinateMapper.ts (Phase 1 hand-off) + makeSimpleViewport Pattern 2
import { cssPixelToPageSpace } from '../lib/coordinateMapper'

function handlePageClick(
  e: React.MouseEvent<HTMLDivElement>,
  pageNumber: number,
  dims: PageDimensions,
  signatureDataUrl: string,
  pngAspectRatio: number,
) {
  const rect = e.currentTarget.getBoundingClientRect()
  const cssX = e.clientX - rect.left
  const cssY = e.clientY - rect.top
  
  const viewport = makeSimpleViewport(dims.originalWidth, dims.originalHeight, dims.scale)
  
  // Convert click point (top-left of field) to PDF space
  const defaultWidthPx = 180
  const defaultHeightPx = defaultWidthPx / pngAspectRatio
  
  // Center the field on the click point
  const fieldTopLeftCss = {
    x: cssX - defaultWidthPx / 2,
    y: cssY - defaultHeightPx / 2,
  }
  
  // Convert top-left CSS corner to PDF space (bottom-left in PDF terms)
  // The Coordinate Mapper handles the Y-axis flip
  const pdfBottomLeft = cssPixelToPageSpace(fieldTopLeftCss, viewport)
  
  const newField: PlacedField = {
    id: crypto.randomUUID(),
    type: 'signature',
    pageNumber,
    pdfX: pdfBottomLeft.x,
    pdfY: pdfBottomLeft.y,
    pdfWidth: defaultWidthPx / dims.scale,
    pdfHeight: defaultHeightPx / dims.scale,
    dataUrl: signatureDataUrl,
  }
  
  addField(newField)
  setSelectedFieldId(newField.id)
  setPlacementMode(false)
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| pdf-lib standard `save()` for overlay | pdf-lib-incremental-save `saveIncremental()` | Community fork 2023 | Enables EXP-02 byte-identity guarantee without hand-rolling xref |
| `disabled` attribute on buttons | `aria-disabled="true"` (keep focusable) | WCAG 2.5.5 requirement | Focus stays reachable at boundaries; pattern already used in Phase 1 |
| `window.addEventListener('resize')` for canvas resize | ResizeObserver (already Phase 1 pattern) | 2020+ standard | ResizeObserver catches container-level resize, not just window resize |

**Deprecated/outdated:**
- `toDataURL('image/png')` with opaque white background: valid but wrong for signature overlays — produces a white box in the PDF. Always use transparent (`rgba(0,0,0,0)` backgroundColor).
- `jsPDF`: Cannot load and overlay an existing PDF. Not applicable here — CLAUDE.md prohibits it.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `pdf-lib-incremental-save` `saveIncremental()` truly appends to original bytes such that the first 512 bytes of `concat([originalBytes, incrementalBytes])` are byte-identical to the original input | EXP-02 Critical Finding | If bytes differ, EXP-02 fails; would need to hand-roll xref append |
| A2 | `snapshot.markRefForSave(page.ref)` must be called BEFORE modifying the page for the modification to be included in the incremental update | EXP-02 export code | If order doesn't matter, no problem; if order matters and we get it wrong, signature silently omitted from incremental |
| A3 | react-pdf Page `onLoadSuccess` callback provides `originalWidth` and `originalHeight` as extended properties (not on native `PDFPageProxy`) | Pattern 2 / viewport | TypeScript types may not include these properties; need runtime cast or type augmentation |
| A4 | `makeSimpleViewport` (rotation=0 only) correctly maps the click coordinate to PDF space for documents without page rotation | Pattern 2 / coordinate math | Rotated documents would misplace fields; acceptable for Phase 2 MVP (rotation support deferred to Phase 3) |
| A5 | `pdfDoc.saveIncremental(snapshot)` handles multi-page documents correctly when multiple pages have been marked and modified | EXP-02 export code | If only single-page documents are supported, multi-page signature placement would fail export |
| A6 | `signature_pad` exposes `beginStroke` and `endStroke` events (not just `onBegin` / `onEnd`) for React-compatible state detection | Pattern 1 | If event names differ, hasStrokes detection breaks; fallback: check `isEmpty()` in an `afterUpdateStroke` callback |
| A7 | `react-rnd` `onResizeStop` `ref.style.width` always includes 'px' units (not percent or other units) | Pattern 3 / pitfall 7 | If ref.style.width is ever a percentage, parseFloat would give the correct number but the scale conversion would be wrong |

**Highest-risk assumption:** A1 (EXP-02 byte-identity). The automated test in Wave 0 should be written FIRST and run against the actual implementation to confirm. If it fails, the fallback is a manual incremental update append using pdf-lib's internal object serializer (complex but documented in the pdf-lib source).

---

## Open Questions (RESOLVED)

1. **pdf-lib-incremental-save API stability**
   - What we know: The library is a fork of pdf-lib 1.17.x, version 1.17.4, published Jan 2024, 5330 weekly downloads, 11 stars
   - What's unclear: Whether `saveIncremental` handles the image XObject reference correctly for multi-page documents; whether the resulting PDF opens in Adobe Acrobat without validation errors
   - Recommendation: Write the EXP-02 test in Wave 0 before any other Phase 2 code; run against a real PDF and verify: (a) first 512 bytes identical, (b) output opens in a PDF viewer, (c) signature is visible at the correct position

2. **How to handle `originalPdfBytes` for image-sourced documents**
   - What we know: For image files, Phase 1 creates a new PDF via `wrapImageAsPdf()` using `PDFDocument.create()`. The "original" bytes are the output of `pdf-lib-incremental-save`'s `pdfDoc.save()` (a freshly created PDF).
   - What's unclear: For image-sourced documents, the EXP-02 guarantee is that "the original image content is not re-encoded" — but the wrapping PDF itself is newly created, so there are no original bytes to preserve byte-for-byte. The first-512-byte test applies to the wrapped PDF (not the original image file). EXP-03 satisfaction: export the wrapped PDF with the signature overlay.
   - Recommendation: For image-sourced documents, store the wrapped PDF's bytes (from `wrapImageAsPdf()`) as `originalPdfBytes`. Apply the same incremental save path. The hex test compares the wrapped PDF input vs export output — this is still meaningful (proves the image content was not re-encoded during signing).

3. **TypeScript types for react-pdf Page `onLoadSuccess` callback**
   - What we know: `originalWidth` and `originalHeight` are runtime-present but TypeScript types may not include them on the `PDFPageProxy` type
   - What's unclear: Whether react-pdf 10.x exports a type for the enriched page callback object
   - Recommendation: Use `page as unknown as { originalWidth: number; originalHeight: number; scale: number }` in the `onLoadSuccess` handler; add a comment explaining the type augmentation. This is a known react-pdf pattern documented in github.com/wojtekmaj/react-pdf/discussions/901.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build tooling | ✓ | 22.21.1 | — |
| npm | Package management | ✓ | 10.9.4 | — |
| crypto.randomUUID | Field ID generation | ✓ | Browser built-in (Chrome 92+) | Use a minimal UUID polyfill (3 lines of Math.random) |
| Blob + URL.createObjectURL | PDF download | ✓ | Browser standard | — |
| canvas (2D context) | signature_pad drawing | ✓ | Browser standard | — |

**Missing dependencies with no fallback:** None — all required browser APIs are universally available.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 |
| Config file | `vite.config.ts` (existing `test:` block — already configured) |
| Quick run command | `npx vitest run src/test/exportPdf.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EXP-02 | First 512 bytes of output === first 512 bytes of input | unit | `npx vitest run src/test/exportPdf.test.ts` | ❌ Wave 0 |
| EXP-02 | Output is longer than input (incremental bytes appended) | unit | `npx vitest run src/test/exportPdf.test.ts` | ❌ Wave 0 |
| FLD-01/05/06 | Coordinate round-trip: click CSS point → PDF space → CSS pixel within 0.001 | unit | `npx vitest run src/test/fieldPlacement.test.ts` | ❌ Wave 0 |
| SIG-01 | signature_pad isEmpty() returns false after stroke, true after clear | unit | `npx vitest run src/test/signatureDraw.test.ts` | ❌ Wave 0 (browser-env, may need jsdom workaround) |
| EXP-01 | triggerDownload creates a Blob and anchor click (mock) | unit | `npx vitest run src/test/exportPdf.test.ts` | ❌ Wave 0 |
| PRV-01/02 | No network requests during export (architectural) | manual | DevTools Network — zero external requests | N/A |
| EXP-03 | Image-sourced document: export includes signature AND image content | manual | Open exported PDF in viewer, confirm image + signature visible | N/A |
| FLD-07 | Delete via × and Delete/Backspace removes field from Zustand | unit | `npx vitest run src/test/fieldStore.test.ts` | ❌ Wave 0 |

**Note on SIG-01 testing:** signature_pad requires a real canvas element with pointer events. In Vitest jsdom, `HTMLCanvasElement.getContext('2d')` returns null unless mocked. Recommendation: mock the canvas context in `src/test/setup.ts` for the signature draw test, or limit to testing the Zustand state changes (isEmpty tracking, modal open/close).

### Sampling Rate

- **Per task commit:** `npx vitest run src/test/exportPdf.test.ts` — EXP-02 is the critical path; this test must stay green at every commit
- **Per wave merge:** `npx vitest run` — full suite
- **Phase gate:** Full suite green + manual EXP-03 verification (open exported PDF in PDF reader, confirm signature visible, original content unaltered)

### Wave 0 Gaps

- [ ] `src/test/exportPdf.test.ts` — EXP-02 byte-identity test (CRITICAL — write first, must pass before export code is considered done)
- [ ] `src/test/fixtures/samplePdf.ts` — minimal valid 1-page PDF as Base64 string constant; generate once with `pdf-lib-incremental-save` and hardcode
- [ ] `src/test/fieldPlacement.test.ts` — coordinate round-trip test for click → PDF-space → CSS pixel
- [ ] `src/test/fieldStore.test.ts` — Zustand store unit tests (addField, updateField, deleteField, selectedFieldId)
- [ ] `npm uninstall pdf-lib && npm install pdf-lib-incremental-save` — update imports in `imageWrapper.ts`

---

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1`

### Applicable ASVS Categories (Level 1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No accounts — out of scope |
| V3 Session Management | No | No sessions — out of scope |
| V4 Access Control | No | Single-user, client-only |
| V5 Input Validation | Yes | Validate PNG data URL format before passing to pdf-lib `embedPng`; limit signature canvas size to prevent DoS |
| V6 Cryptography | No | No encryption needed |
| V11 Business Logic | Yes | Enforce minimum/maximum field count; prevent export when no fields placed; prevent malformed data URLs |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed/oversized PNG data URL passed to pdf-lib embedPng | Tampering/DoS | Validate data URL prefix (`data:image/png;base64,`) before calling embedPng; wrap in try/catch; surface ErrorBanner on failure |
| pdf-lib export throws (corrupt input PDF) | DoS | Wrap `exportSignedPdf()` in try/catch; surface "Could not export" ErrorBanner; never let unhandled rejection crash the app |
| Delete/Backspace event handler firing on text inputs | Tampering (accidental data loss) | Only fire field deletion when `selectedFieldId !== null` AND `event.target` is not an `<input>` or `<textarea>` |
| Signature PNG data URL exfiltration | Info Disclosure | All data stays in Zustand (memory) and IndexedDB (Phase 4); no server calls; PRV-01 architectural guarantee |
| Large canvas causing OOM (DoS) | DoS | Limit signature canvas to 560px width × 180px height (fixed modal size); devicePixelRatio scaling doubles each dimension at most |
| Export of unsigned document (zero fields placed) | Business Logic | "Download PDF" button is `aria-disabled` when `fields.length === 0`; enforce in export handler as well |

**Security note:** Phase 2 introduces no new server endpoints, no auth flows, and no file uploads. The security surface is: (1) the signature PNG data URL going through pdf-lib's PNG decoder — wrap in try/catch, (2) the Delete/Backspace handler — scope to field selection only, (3) the export pipeline — wrap entirely in try/catch and surface ErrorBanner on any failure.

---

## Project Constraints (from CLAUDE.md)

All constraints from CLAUDE.md are enforced. Phase 2-specific checks:

1. **Document integrity (zero-alteration):** pdf-lib standard `save()` violates this. Use `pdf-lib-incremental-save` `saveIncremental()`. The EXP-02 automated test is the enforcement gate.
2. **Client-side only:** `exportSignedPdf()` runs entirely in the browser. No fetch calls. No external URLs in the export pipeline.
3. **Persistence:** Signed signatures are NOT persisted in Phase 2 (Phase 4). `signatureDataUrl` lives in Zustand (session only).
4. **PRV-02 (self-hosted assets):** `signature_pad` and `react-rnd` are npm packages bundled by Vite — no CDN requests. The PNG is generated in-browser. The export runs in-browser. Zero new third-party network requests.
5. **No router:** All Phase 2 state (modal, fields, placement mode) in Zustand — no URL changes.
6. **pdf-lib 1.17.1 → pdf-lib-incremental-save 1.17.4:** The fork maintains API compatibility. `imageWrapper.ts` import path changes; all other call sites unchanged.

---

## Sources

### Primary (MEDIUM confidence — npm registry + official docs verified)

- npm registry — verified signature_pad@5.1.3, react-rnd@10.5.3, pdf-lib-incremental-save@1.17.4 versions, download counts, publish dates
- unpkg.com/pdf-lib@1.17.1/src/api/PDFDocumentOptions.ts — confirmed complete SaveOptions interface (4 options only, no incremental)
- pdf-lib.js.org/docs/api/interfaces/saveoptions — confirmed SaveOptions properties
- github.com/szimek/signature_pad README — devicePixelRatio pattern, toDataURL, event API
- github.com/bokuweb/react-rnd README — controlled mode, onDragStop/onResizeStop signatures, bounds, lockAspectRatio
- github.com/wojtekmaj/react-pdf/discussions/1535 — Page onLoadSuccess originalWidth/originalHeight
- github.com/remdra/pdf-lib-incremental-save README — saveIncremental API, concatenation pattern
- pdf-lib.js.org/docs/api/classes/pdfpage — drawImage method, coordinate system (bottom-left origin)
- Phase 1 research (01-RESEARCH.md) — Coordinate Mapper API, pdfjs viewport, LazyPage patterns

### Secondary (LOW confidence — WebSearch verified against official sources)

- github.com/Hopding/pdf-lib/issues/537 — confirms standard save() produces non-deterministic bytes (different binary per save)
- github.com/wojtekmaj/react-pdf/discussions/901 — originalWidth/originalHeight edge case (zero for some pages)
- pspdfkit.com/blog/2019/incremental-and-full-save-in-pdfs/ — PDF incremental update spec overview

---

## Metadata

**Confidence breakdown:**
- Standard stack (signature_pad, react-rnd): HIGH — npm registry verified, official docs confirmed, CLAUDE.md-pinned versions match
- EXP-02 approach (pdf-lib-incremental-save): MEDIUM — library exists, API documented, but byte-identity behavior is ASSUMED until the automated test confirms it
- Architecture patterns: MEDIUM — react-rnd controlled mode and signature_pad React integration are documented in official READMEs; makeSimpleViewport math is ASSUMED for rotation=0
- Pitfalls: MEDIUM — most are based on documented behavior in official repos; some are derived from general PDF/canvas knowledge

**Research date:** 2026-06-17
**Valid until:** 2026-07-17 (30 days — stack is stable; pdf-lib-incremental-save is slow-moving)
