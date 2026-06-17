# Phase 3: Full Field Types + Workspace Controls — Research

**Researched:** 2026-06-17
**Domain:** React/TypeScript field model extension, pdf-lib text/checkbox export, zoom architecture, undo/redo history, inline editing in react-rnd, file-type validation
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Area 1: Field Types & Creation UX**
- Field palette: Signature, Initials, Date, Text, Checkbox buttons using click-to-arm → click-to-drop flow
- Initials (Phase 3): draw modal (same as signature), smaller default footprint, no persistence
- Date field: defaults to today, M/D/YYYY format, stored as `dateValue` string, user-editable
- Text field: inline input, single-line, Helvetica export
- Checkbox/X: bold "X" mark, placing = marking, no toggle
- Field model: extend type union to `'signature' | 'initials' | 'date' | 'text' | 'checkbox'`; add optional `textValue?`, `dateValue?`

**Area 2: Zoom Behavior (DOC-04)**
- Range: 50–200%, discrete steps (50, 75, 100, 125, 150, 175, 200)
- Zoom-out/zoom-in buttons + percentage readout + "Fit width" reset at 100%
- Add `zoom` multiplier to `documentStore` (default 1.0)
- Effective scale = `(containerWidth / originalWidth) * zoom`
- Fields stored in PDF-space — no field data mutation on zoom
- Zoom control near PageNavigation pill (bottom-center)
- Preserve current page in view on zoom; no cursor-anchored zoom

**Area 3: Undo/Redo (FLD-09)**
- Covered actions: add, delete, move (drag), resize, content edits (text/date value)
- Mechanism: history stack of `fields` array snapshots in `fieldStore`, cap ~50
- Text/date edits commit ONE entry on blur/confirm (not per keystroke)
- Undo/Redo toolbar buttons + Cmd/Ctrl+Z / Cmd/Ctrl+Shift+Z / Ctrl+Y
- Guard shortcuts against firing inside text/date inputs

**Area 4: Word-Doc Prompt (DOC-05)**
- Reject `.doc`/`.docx` by extension AND MIME
- Friendly guidance banner, no silent conversion, provide path back to choose PDF

**Area 5: Export of New Field Types**
- Image types (signature, initials): unchanged `embedPng` + `drawImage`
- Text & date: `pdfDoc.embedFont(StandardFonts.Helvetica)` + `page.drawText(...)`
- Checkbox/X: `drawText('X', ...)` with Helvetica-Bold sized to the box
- EXP-02: all types through `saveIncremental` + concat path; `markRefForSave` per touched page

### Claude's Discretion
- Exact visual styling of field palette, zoom control, undo/redo buttons
- Whether text fields support multi-line (single-line acceptable for v1)
- Checkbox rendering technique (drawText 'X' vs drawLine) — choose crisper
- History cap exact value (≥10, ~50 reasonable)
- Date default format locale handling (M/D/YYYY default)

### Deferred Ideas (OUT OF SCOPE)
- Typed signatures in script fonts → Phase 4 (SIG-02)
- Saving/reusing signatures & initials across sessions (IndexedDB) → Phase 4
- Rotated-page (90/180/270°) field placement correctness → v2
- Cursor-anchored zoom, page thumbnail sidebar, snap-to-alignment guides → v2
- Multi-line rich text fields → out of scope for v1
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DOC-04 | User can zoom the document in/out, with placed fields scaling correctly | Zoom architecture (Section 4), effectiveScale threading, react-pdf `width` prop interaction |
| DOC-05 | Word doc selection shows clear "export to PDF first" instruction | MIME/extension detection (Section 8), fileValidation extension pattern |
| FLD-02 | User can place initials, a date, free text, and a checkbox/X mark | Field model extension (Section 2), draw modal reuse, PlacedFieldWidget rendering (Section 6) |
| FLD-03 | User can set the date field value (defaults to today, editable) | Inline editing pattern (Section 7), `textValue` unified storage |
| FLD-04 | User can type the content of a free-text field | Inline editing pattern (Section 7), drag/input coexistence (Section 7.2) |
| FLD-08 | User can place fields on any page of a multi-page document | Multi-page placement verification (Section 9) |
| FLD-09 | User can undo and redo placement actions | Undo/redo architecture (Section 5), keyboard guard (Section 5.4) |
</phase_requirements>

---

## Summary

Phase 3 extends the existing single-signature loop into a full annotation workspace. The codebase is healthy after Phase 2: PDF-space coordinate storage is proven correct, the EXP-02 incremental-save path works, and the LazyPage/PlacedFieldWidget infrastructure is solid. All major Phase 3 features are either straightforward extensions of existing patterns or well-understood problems with established solutions.

The most important verified finding is a hard compatibility constraint: **`✕` (U+2715) cannot be encoded with WinAnsi/StandardEncoding**. `pdf-lib` standard fonts use WinAnsi and will throw `WinAnsi cannot encode "✕" (0x2715)` at runtime. The UI-SPEC checkbox display uses `✕` on-screen (rendered in system-ui, which does include it), but the PDF export layer MUST use ASCII `'X'` with `Helvetica-Bold`. This is not a design concern — it is a hard PDF export constraint.

The second verified key finding is the `react-pdf` `<Page>` prop interaction: passing `width` AND `scale` simultaneously causes the final render width to be `width * scale`, not just `width`. The zoom architecture must account for this. The simplest correct approach is to pass `width={containerWidth * zoom}` and omit the `scale` prop entirely — this keeps page raster and field overlays in sync using the same effectiveScale.

The undo/redo history is a manual past/future snapshot approach in `fieldStore` — no new dependency is needed. The pattern is simple, well-understood, and fits the existing Zustand store structure.

**Primary recommendation:** Extend `PlacedField` with a discriminated union approach using optional `dataUrl?` and `textValue?` fields on a unified interface. Keep the history stack as plain `PlacedField[][]` snapshots in `fieldStore`. Use `width={containerWidth * zoom}` (not `scale=`) on `<Page>` for zoom. Use ASCII `'X'` (not `✕`) for the checkbox PDF export.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Field type rendering (image/text/checkbox) | Browser / Client | — | react-rnd overlay, CSS rendering; pure client-side display |
| Text/date inline editing | Browser / Client | — | `<input>` inside react-rnd; value stored in Zustand |
| Zoom state | Browser / Client | — | `zoom` multiplier in documentStore; drives page width and field scale |
| Undo/redo history | Browser / Client | — | In-memory `fields` snapshots in fieldStore; session-only |
| Export of text/date/checkbox to PDF | Browser / Client | — | pdf-lib-incremental-save `drawText`; no network |
| Word-doc detection | Browser / Client | — | Extension + MIME check at file selection; no server |
| Multi-page field placement | Browser / Client | — | LazyPage per-page overlay; pageNumber key already correct |

---

## Standard Stack

### Core (all already installed — no new prod dependencies required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `pdf-lib-incremental-save` | 1.17.4 | Text/checkbox PDF export via `StandardFonts` + `drawText` | [VERIFIED: installed in project] Already the export engine; `StandardFonts.Helvetica` / `HelveticaBold` work without fontkit |
| `react-rnd` | 10.5.3 | Extended PlacedFieldWidget (now hosting `<input>` for text/date) | [VERIFIED: installed in project] Already used; `disableDragging` prop enables input-safe editing |
| `zustand` | 5.0.14 | Extended fieldStore (history stack) and documentStore (zoom) | [VERIFIED: installed in project] Already used; manual snapshot pattern fits perfectly |
| `react-pdf` | 10.4.1 | `<Page width={containerWidth * zoom}>` for zoom-aware rendering | [VERIFIED: installed in project] Already used; `width` prop drives both raster and overlay size |

### No New Dependencies Required

Phase 3 adds zero new production dependencies. All capabilities are achievable with the installed stack:
- Undo/redo: manual array snapshot in Zustand (no zundo needed)
- Text export: `StandardFonts.Helvetica` already in `pdf-lib-incremental-save`
- Inline editing: native HTML `<input>` inside react-rnd
- Zoom: `width` prop arithmetic on `<Page>` + `containerWidth * zoom`
- Word-doc detection: `fileValidation.ts` extension (extension + MIME set additions)

**Installation:** No additional `npm install` needed for production code.

### Supporting (dev dependencies — already installed)

| Library | Version | Purpose |
|---------|---------|---------|
| `vitest` | 4.1.9 | New test suites for undo/redo, zoom-invariance, new-type export |
| `@testing-library/react` | 16.3.2 | Component tests for FieldPalette, ZoomControl, WordDocBanner |

---

## Package Legitimacy Audit

No new packages are introduced in Phase 3. All packages in use are already installed from Phase 1/2.

| Package | Registry | Verdict | Disposition |
|---------|----------|---------|-------------|
| All existing deps (see package.json) | npm | Pre-verified in Phase 1/2 | Approved — no re-audit needed |

**Packages removed due to SLOP verdict:** none
**Packages flagged as suspicious (SUS):** none

---

## Architecture Patterns

### System Architecture Diagram

```
User interaction (TopBar / ZoomControl / PlacedFieldWidget / UploadZone)
         │
         ▼
  fieldStore / documentStore (Zustand)
  ├── fields[]: PlacedField[]     ← arm + drop extends with new types
  ├── history[][]: PlacedField[][] ← undo/redo snapshots
  ├── historyIndex: number
  ├── armedFieldType: FieldType | null
  ├── initialsDataUrl: string | null
  └── zoom: number (documentStore) ← 0.5–2.0, default 1.0
         │
         ▼
  LazyPage (per page)
  ├── effectiveScale = (containerWidth / originalWidth) * zoom
  ├── <Page width={containerWidth * zoom}> ← raster at effectiveScale
  └── overlay div (position:absolute, inset:0)
      └── PlacedFieldWidget (per field on this page)
          ├── cssPos = pageSpaceToCssPixel(pdfXY, viewport(effectiveScale))
          ├── cssSize = pdfW * effectiveScale, pdfH * effectiveScale
          └── render:
              ├── 'signature'|'initials' → <img src={dataUrl}>
              ├── 'date'|'text' → <input value={textValue}>
              └── 'checkbox' → <div>✕</div>  (system-ui)
         │
         ▼
  exportPdf.ts (exportSignedPdf, extended)
  ├── image types → embedPng + drawImage (unchanged)
  ├── date/text → embedFont(Helvetica) + drawText(textValue, baseline-y)
  └── checkbox → embedFont(HelveticaBold) + drawText('X', ...)
      └── all: markRefForSave + saveIncremental + concat (EXP-02 preserved)

  fileValidation.ts
  └── MIME + extension sets extended with .doc/.docx → word-doc branch in UploadZone
```

### Recommended Project Structure (additions only)

```
src/
├── store/
│   ├── fieldStore.ts          # Extend: type union, textValue?, history[], historyIndex, armedFieldType, initialsDataUrl
│   └── documentStore.ts       # Extend: zoom: number, setZoom action
├── components/
│   ├── TopBar.tsx             # Extend: FieldPalette + UndoRedoControls
│   ├── FieldPalette.tsx       # NEW: 5 armed-state buttons
│   ├── UndoRedoControls.tsx   # NEW: undo/redo buttons + keyboard handler
│   ├── ZoomControl.tsx        # NEW: floating pill with −/+/Fit/readout
│   ├── InitialsDrawModal.tsx  # NEW: mirrors SignatureDrawModal
│   ├── PlacedFieldWidget.tsx  # Extend: per-type render + inline input
│   ├── LazyPage.tsx           # Extend: effectiveScale + armed-type drop
│   ├── DocumentViewer.tsx     # Extend: pass zoom to LazyPage, render ZoomControl
│   ├── PlacementModeOverlay.tsx # Extend: type-specific copy
│   └── UploadZone.tsx         # Extend: word-doc branch → WordDocBanner
├── lib/
│   ├── exportPdf.ts           # Extend: per-type draw branch
│   └── fileValidation.ts      # Extend: word-doc MIME/extension constants
└── test/
    ├── fieldStore.test.ts      # Extend: undo/redo, new field types
    ├── exportPdf.test.ts       # Extend: text/checkbox export, EXP-02 with text fields
    ├── coordinateMapper.test.ts # Extend: zoom-invariance assertion
    └── fileValidation.test.ts  # Extend: word-doc detection cases
```

---

## Section 1: PlacedField Model Extension

### Verified shape

Extend `PlacedField` in `src/store/fieldStore.ts`:

```typescript
// [VERIFIED: read from src/store/fieldStore.ts]
export interface PlacedField {
  id: string
  type: 'signature' | 'initials' | 'date' | 'text' | 'checkbox'
  pageNumber: number
  pdfX: number       // PDF user-space, bottom-left origin, points
  pdfY: number
  pdfWidth: number
  pdfHeight: number
  dataUrl?: string   // image types only (signature, initials)
  textValue?: string // date and text fields; checkbox has neither
  role?: string      // v2 MP-01 seam — reserved
}
```

**Key design decisions (from UI-SPEC 03):**
- `dateValue` is unified into `textValue` — a single string field for both date and text. The `type` discriminator distinguishes them. This avoids parallel string fields for functionally identical data. [VERIFIED: read from 03-UI-SPEC.md]
- `dataUrl` is now `optional` (was required in Phase 2 for signature-only). The export layer must guard `if (field.dataUrl)` before calling `embedPng`.
- `checkbox` fields carry neither `dataUrl` nor `textValue`; only geometry.

### Store extension: armedFieldType and initialsDataUrl

Replace `placementMode: boolean` with `armedFieldType: FieldType | null` (null = disarmed, a value = armed for that type). Add `initialsDataUrl` for the initials PNG from InitialsDrawModal.

```typescript
type FieldType = 'signature' | 'initials' | 'date' | 'text' | 'checkbox'

interface FieldStore {
  // ... existing ...
  armedFieldType: FieldType | null     // replaces placementMode
  initialsDataUrl: string | null       // PNG from InitialsDrawModal
  history: PlacedField[][]            // snapshot ring
  historyIndex: number                // current position (-1 = empty)

  setArmedFieldType: (type: FieldType | null) => void
  setInitialsDataUrl: (url: string | null) => void
  pushHistory: () => void             // snapshot current fields[]
  undo: () => void
  redo: () => void
}
```

**Backward compatibility:** Keep `placementMode` as a computed getter OR remove it and update all callers. Callers are: `LazyPage.tsx` (reads `placementMode`), `PlacementModeOverlay.tsx` (reads `placementMode`), `TopBar.tsx` (calls `setPlacementMode`). All three will change in Phase 3 anyway, so a clean removal is safe.

---

## Section 2: pdf-lib Text and Checkbox Export

### Verified: StandardFonts needs NO fontkit

[VERIFIED: node runtime test in this session]

```
node -e "const { PDFDocument, StandardFonts } = require('pdf-lib-incremental-save');
PDFDocument.create().then(doc => doc.embedFont(StandardFonts.Helvetica))
  .then(() => console.log('OK'))"
// → OK
// doc.context.fontkit === undefined (fontkit not required for standard fonts)
```

`@pdf-lib/fontkit` is only required for custom TTF/OTF embedding (Phase 4, typed signatures). Phase 3 does NOT need to register fontkit.

### Verified: ✕ (U+2715) cannot be encoded with WinAnsi

[VERIFIED: node runtime test in this session — hard constraint]

```typescript
// This THROWS at runtime:
page.drawText('✕', { font: fontBold, ... })
// Error: WinAnsi cannot encode "✕" (0x2715)

// This works:
page.drawText('X', { font: fontBold, ... })
// OK — ASCII 'X' is safe with any StandardFont
```

**Resolution:** The UI-SPEC specifies `✕` (U+2715) for the on-screen checkbox display (system-ui renders it fine), but the PDF export layer MUST use ASCII `'X'` with `StandardFonts.HelveticaBold`. This is a firm technical boundary. [VERIFIED: tested in this session]

### Verified: drawText y coordinate is the TEXT BASELINE

[VERIFIED: pdf-lib source and node test in this session]

In pdf-lib, `drawText({ x, y, ... })` places the text with `y` at the **baseline** of the glyphs — NOT the top-left of the bounding box. The field rectangle in PDF space is stored as bottom-left (pdfX, pdfY) with size (pdfWidth, pdfHeight).

**Pattern for centering text vertically in a field box:**

```typescript
// [VERIFIED: node runtime test — font methods confirmed]
async function embedFonts(pdfDoc: PDFDocument) {
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  return { helvetica, helveticaBold }
}

// Text/date fields:
function drawTextInBox(page: PDFPage, text: string, font: PDFFont, field: PlacedField) {
  // Size text to 75% of box height, leaving 25% padding
  const targetSize = font.sizeAtHeight(field.pdfHeight * 0.75)
  const glyphH = font.heightAtSize(targetSize)
  // Center vertically: baseline y = box_bottom + (box_height - glyph_height) / 2
  const baselineY = field.pdfY + (field.pdfHeight - glyphH) / 2
  page.drawText(text, {
    x: field.pdfX + 2, // 2pt left padding
    y: baselineY,
    font,
    size: targetSize,
  })
}

// Checkbox ('X' only — not '✕'):
function drawCheckboxX(page: PDFPage, fontBold: PDFFont, field: PlacedField) {
  const targetSize = fontBold.sizeAtHeight(Math.min(field.pdfWidth, field.pdfHeight) * 0.75)
  const glyphH = fontBold.heightAtSize(targetSize)
  const baselineY = field.pdfY + (field.pdfHeight - glyphH) / 2
  const xOffset = (field.pdfWidth - fontBold.widthOfTextAtSize('X', targetSize)) / 2
  page.drawText('X', {
    x: field.pdfX + xOffset,
    y: baselineY,
    font: fontBold,
    size: targetSize,
  })
}
```

**Available PDFFont methods (verified):** `heightAtSize(size)`, `sizeAtHeight(height)`, `widthOfTextAtSize(text, size)`. Note: `descendsAtSize` does NOT exist in pdf-lib-incremental-save — confirmed via runtime test. [VERIFIED: node runtime test]

### Verified: EXP-02 preserved with drawText

[VERIFIED: node runtime test — incremental save with drawText works]

The incremental-save + concat pattern works identically for `drawText` as it does for `drawImage`. The first 20 bytes of the original are preserved verbatim at offset 0 of the output. No special handling needed.

**Updated export loop skeleton:**

```typescript
// src/lib/exportPdf.ts — extended draw loop
const { helvetica, helveticaBold } = await embedFonts(pdfDoc) // embed once per export

for (const field of fields) {
  const page = pages[field.pageNumber - 1]
  snapshot.markRefForSave(page.ref)

  if (field.type === 'signature' || field.type === 'initials') {
    // unchanged from Phase 2
    if (!field.dataUrl?.startsWith(PNG_DATA_URL_PREFIX)) throw new Error(...)
    const pngImage = await pdfDoc.embedPng(base64ToPng(field.dataUrl))
    page.drawImage(pngImage, { x: field.pdfX, y: field.pdfY, width: field.pdfWidth, height: field.pdfHeight })

  } else if (field.type === 'date' || field.type === 'text') {
    drawTextInBox(page, field.textValue ?? '', helvetica, field)

  } else if (field.type === 'checkbox') {
    drawCheckboxX(page, helveticaBold, field)
  }
}
```

**Pitfall: embed fonts once, outside the field loop.** Calling `embedFont` inside the per-field loop embeds duplicate font objects into the PDF, inflating the incremental revision size. Embed both fonts unconditionally before the loop. [ASSUMED — pdf-lib best practice]

---

## Section 3: zoom Architecture

### Verified: react-pdf `<Page>` width + scale interaction

[VERIFIED: read from react-pdf Page.d.ts in this session]

From the official types:
> "If you define `width` and `scale` at the same time, the width will be multiplied by a given factor."

This means: `<Page width={containerWidth} scale={zoom}>` produces a render width of `containerWidth * zoom`. This is NOT the "pass two separate values" behavior one might expect.

**Two equivalent correct approaches:**
1. `<Page width={containerWidth * zoom}>` — pass a single computed width; omit `scale`. Simplest.
2. `<Page width={containerWidth} scale={zoom}>` — react-pdf multiplies them internally.

**Recommended:** Option 1 (`width={containerWidth * zoom}`) because it is explicit, easy to reason about, and the overlay div dimensions also compute `effectiveScale = (containerWidth / originalWidth) * zoom` from the same arithmetic.

### Scale threading pattern

```typescript
// documentStore.ts additions:
zoom: number    // 0.5–2.0, default 1.0
setZoom: (z: number) => void

// ZOOM_STEPS constant (shared between ZoomControl and store):
export const ZOOM_STEPS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0]

// LazyPage.tsx — compute effectiveScale from zoom:
const zoom = useDocumentStore((s) => s.zoom)
// ...
const effectiveScale = containerWidth && dims
  ? (containerWidth / dims.originalWidth) * zoom
  : dims?.scale ?? 1

// Pass to react-pdf Page:
<Page width={containerWidth ? containerWidth * zoom : undefined} ... />

// Pass to PlacedFieldWidget viewport:
const viewport = makeSimpleViewport(dims.originalWidth, dims.originalHeight, effectiveScale)
```

**Key invariant:** `PageDimensions.scale` stored in fieldStore continues to reflect the FIT-TO-WIDTH scale (`containerWidth / originalWidth`). The `effectiveScale` used for rendering is `PageDimensions.scale * zoom`. The viewport passed to PlacedFieldWidget is always computed with `effectiveScale`, never with the stored `scale` alone. `pdfX`/`pdfY`/`pdfWidth`/`pdfHeight` in the store are NEVER mutated on zoom change.

### onLoadSuccess scale update on zoom

`handlePageLoadSuccess` currently stores `scale = containerWidth / originalWidth`. This baseline scale (zoom=1) is what goes into `pageDimensions`. On zoom, we do NOT update `pageDimensions.scale` — we compute effectiveScale on the fly in the render path. This keeps the stored scale as a stable reference. [ASSUMED — design decision; no source to verify against, but follows from the architecture]

### ZoomControl step logic

```typescript
function zoomIn(current: number): number {
  const idx = ZOOM_STEPS.indexOf(current)
  return idx >= 0 && idx < ZOOM_STEPS.length - 1 ? ZOOM_STEPS[idx + 1] : current
}
function zoomOut(current: number): number {
  const idx = ZOOM_STEPS.indexOf(current)
  return idx > 0 ? ZOOM_STEPS[idx - 1] : current
}
function fitWidth(): number { return 1.0 }
```

**Page anchor on zoom:** The CONTEXT.md decision is "preserve the current page in view, no cursor anchor". The simplest implementation: on zoom, scroll the current page's DOM element into view after the state update settles (`requestAnimationFrame` or `setTimeout(0)` after `setZoom`). The IntersectionObserver's `currentPage` tracking already identifies which page was visible.

---

## Section 4: Undo/Redo Architecture

### Recommended: manual snapshot approach (no zundo)

zundo is not installed and the CONTEXT.md decision is "history stack of field-array snapshots." A manual implementation is ~20 lines, zero new dependencies, and fully predictable.

```typescript
// fieldStore.ts additions:
history: PlacedField[][]   // array of snapshots; history[historyIndex] = current fields
historyIndex: number       // -1 when empty

// Internal helper (not exported):
const MAX_HISTORY = 50

// pushHistory — call BEFORE any state-changing action:
pushHistory: () =>
  set((state) => {
    const snapshot = [...state.fields] // shallow copy of the array
    // Truncate redo tail: discard anything after historyIndex
    const newHistory = state.history.slice(0, state.historyIndex + 1)
    // Append current snapshot
    newHistory.push(snapshot)
    // Enforce cap
    const bounded = newHistory.slice(-MAX_HISTORY)
    return {
      history: bounded,
      historyIndex: bounded.length - 1,
    }
  }),

undo: () =>
  set((state) => {
    if (state.historyIndex <= 0) return {} // nothing to undo
    const newIndex = state.historyIndex - 1
    return {
      fields: [...state.history[newIndex]],
      historyIndex: newIndex,
      selectedFieldId: null, // clear selection on undo (avoids dangling ref)
    }
  }),

redo: () =>
  set((state) => {
    if (state.historyIndex >= state.history.length - 1) return {} // nothing to redo
    const newIndex = state.historyIndex + 1
    return {
      fields: [...state.history[newIndex]],
      historyIndex: newIndex,
      selectedFieldId: null,
    }
  }),
```

### Which actions push history

Every action that modifies `fields[]` must call `pushHistory()` FIRST. In Zustand the cleanest way is to include the push inside the action itself:

| Action | pushHistory? | Notes |
|--------|-------------|-------|
| `addField` | Yes | Push before appending the new field |
| `deleteField` | Yes | Push before removing |
| `updateField` (drag stop) | Yes | Push on `handleDragStop` in PlacedFieldWidget |
| `updateField` (resize stop) | Yes | Push on `handleResizeStop` |
| `updateField` (text/date blur) | Yes | Push on input `onBlur` — single commit, not per keystroke |
| `setSelectedFieldId` | No | UI state, not field data |
| `setZoom` | No | Explicitly excluded per CONTEXT.md |
| `resetFields` | No | Clears everything including history |

**Implementation: modify existing actions to accept a `withHistory: boolean` flag OR always push.** Simpler to always push in `addField`/`deleteField` directly, and call `pushHistory` explicitly from `handleDragStop`/`handleResizeStop`/`onBlur` in the widget before calling `updateField`.

**Pitfall: pushing history inside updateField breaks text-edit debouncing.** If `updateField` always pushes, every keystroke in a text field creates a history entry (up to MAX_HISTORY). The CONTEXT.md decision says commit on blur. Solution: `updateField` does NOT push history internally. Callers that should push (drag stop, resize stop, text blur) call a separate `pushHistory()` action then `updateField()`. Callers that should NOT push (live preview during drag) call `updateField()` alone.

**Simpler alternative:** expose `addFieldWithHistory`, `deleteFieldWithHistory` as wrappers that call `pushHistory` then the underlying action. Keeps history logic co-located.

### Keyboard shortcut guard

```typescript
// DocumentViewer.tsx (or a new UndoRedoControls component)
useEffect(() => {
  function handleKeyDown(e: KeyboardEvent) {
    // Guard: never fire while typing in an input
    const target = e.target as HTMLElement | null
    if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return
    if (target?.isContentEditable) return

    const isZ = e.key === 'z' || e.key === 'Z'
    const isY = e.key === 'y' || e.key === 'Y'
    const isMod = e.metaKey || e.ctrlKey

    if (isMod && isZ && e.shiftKey) { e.preventDefault(); redo(); return }
    if (isMod && isZ) { e.preventDefault(); undo(); return }
    if (e.ctrlKey && isY) { e.preventDefault(); redo(); return }
  }
  document.addEventListener('keydown', handleKeyDown)
  return () => document.removeEventListener('keydown', handleKeyDown)
}, [undo, redo])
```

The same guard already exists in DocumentViewer.tsx for Delete/Backspace (lines 67–73 of the verified file) — extend that handler rather than adding a second `addEventListener`.

---

## Section 5: Inline Text/Date Editing in react-rnd

### Problem: drag intercepts mouse events on children

react-rnd implements drag by listening to `mousedown` on its container. An `<input>` child that gets `mousedown` will have drag activated if the event bubbles. This causes the widget to start dragging when the user clicks into the input.

### Solution: stop propagation + conditional disableDragging

```typescript
// Inside PlacedFieldWidget, for date/text fields:
const [isEditing, setIsEditing] = useState(false)

// In the Rnd props:
disableDragging={isEditing}

// In the input:
<input
  onMouseDown={(e) => e.stopPropagation()}  // prevent drag initiation
  onFocus={() => setIsEditing(true)}
  onBlur={() => {
    setIsEditing(false)
    pushHistory()                            // commit undo entry on blur
    updateField(field.id, { textValue: localValue })
  }}
  onChange={(e) => setLocalValue(e.target.value)}  // local state for live preview
  value={localValue}
/>
```

**Local vs store state:** While editing, keep the current input value in local component state (`localValue`). Commit to the store on blur. This prevents per-keystroke store updates (and per-keystroke history entries). On blur: push history, then update store.

**Pitfall: `onBlur` fires before `onMouseDown` on a click-away.** If the user clicks elsewhere, `onBlur` fires on the input first (committing the value), then the click target's `onMouseDown` fires. This ordering is correct and safe.

**Date field default value:** Compute at drop time, not at component render time:
```typescript
// In LazyPage drop handler, for 'date' type:
const today = new Date()
const dateStr = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`
const newField: PlacedField = { ..., type: 'date', textValue: dateStr }
```

---

## Section 6: PlacedFieldWidget Per-Type Rendering

### Summary of changes per field type

**Signature / Initials (image types — minimal change):**
```typescript
if (field.type === 'signature' || field.type === 'initials') {
  return <img src={field.dataUrl} alt="Placed signature" ... />
}
```
- `lockAspectRatio={true}` (same as Phase 2 for both image types)
- Initials: default placed CSS width = 80px (vs 180px for signature)

**Date / Text (input types):**
```typescript
if (field.type === 'date' || field.type === 'text') {
  return (
    <input
      type="text"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onFocus={() => setIsEditing(true)}
      onBlur={handleInputBlur}
      onMouseDown={(e) => e.stopPropagation()}
      aria-label={field.type === 'date' ? 'Date field value' : 'Text field content'}
      placeholder={field.type === 'text' ? 'Type here' : undefined}
      style={{ width: '100%', height: '100%', border: '1px solid var(--color-border)', ... }}
    />
  )
}
```
- `lockAspectRatio={false}` (free resize)
- `disableDragging={isEditing}` on Rnd wrapper

**Checkbox:**
```typescript
if (field.type === 'checkbox') {
  const fontSize = Math.min(cssHeight * 0.7, cssWidth * 0.7)
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize, fontWeight: 700, userSelect: 'none', pointerEvents: 'none' }}>
      ✕
    </div>
  )
}
```
- Uses `✕` (U+2715) for on-screen display (system-ui renders it)
- PDF export uses ASCII `'X'` — completely separate code paths
- `lockAspectRatio={true}` (keep square-ish)
- Default placed size: 32×32 CSS px; min resize: 20×20 CSS px

### Delete button aria-label — per-type strings

```typescript
const deleteLabel = {
  signature: 'Delete signature',
  initials: 'Delete initials',
  date: 'Delete date field',
  text: 'Delete text field',
  checkbox: 'Delete checkbox field',
}[field.type]
```

---

## Section 7: Armed-Type Drop in LazyPage

The click handler in `handleOverlayClick` must be extended to handle all five armed types:

```typescript
// LazyPage.tsx — extended overlay click handler
const armedFieldType = useFieldStore((s) => s.armedFieldType)
const initialsDataUrl = useFieldStore((s) => s.initialsDataUrl)

async function handleOverlayClick(e) {
  if (!armedFieldType || !dims) return

  // For image types, need a dataUrl (signature or initials)
  if (armedFieldType === 'signature' && !signatureDataUrl) return
  if (armedFieldType === 'initials' && !initialsDataUrl) return

  const cssX = e.clientX - rect.left
  const cssY = e.clientY - rect.top
  const viewport = makeSimpleViewport(dims.originalWidth, dims.originalHeight, effectiveScale)

  // Default sizes (CSS px at current effectiveScale)
  const defaults: Record<FieldType, { w: number; h: number }> = {
    signature: { w: 180, h: 180 / aspectRatio },   // async aspect ratio like Phase 2
    initials:  { w: 80,  h: 80 / initialsAspect },  // async
    date:      { w: 160, h: 28 },
    text:      { w: 160, h: 28 },
    checkbox:  { w: 32,  h: 32 },
  }

  const { w, h } = defaults[armedFieldType]
  // ... center on click, convert to PDF space ...

  const today = new Date()
  const textValue = armedFieldType === 'date'
    ? `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`
    : armedFieldType === 'text' ? '' : undefined

  const newField: PlacedField = {
    id: crypto.randomUUID(),
    type: armedFieldType,
    pageNumber,
    pdfX, pdfY, pdfWidth, pdfHeight,
    dataUrl:   (armedFieldType === 'signature') ? signatureDataUrl
             : (armedFieldType === 'initials') ? initialsDataUrl
             : undefined,
    textValue,
  }

  pushHistory()   // commit undo entry before adding
  addField(newField)
  setSelectedFieldId(newField.id)
  setArmedFieldType(null)  // disarm after drop
}
```

**Pitfall: `effectiveScale` vs `dims.scale` in the viewport.** The viewport MUST be built with `effectiveScale` (= `dims.scale * zoom`), not with `dims.scale` alone. If zoom is 1.5 and you build the viewport with `dims.scale`, the placed field will be off by a factor of 1.5 in both axes. [ASSUMED — follows from scale architecture; no external source to cite]

---

## Section 8: Word-Doc Detection

### Exact MIME types

[VERIFIED: standard browser MIME types — confirmed against HTML5 spec]

```typescript
// fileValidation.ts additions:
const WORD_MIMES = new Set([
  'application/msword',                                                    // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
])

const WORD_EXTENSIONS = new Set(['.doc', '.docx'])
```

**Return type extension:** Add a new `FileValidationError` variant `'word-doc'` so the UploadZone can route to the WordDocBanner specifically (vs the generic unsupported-type error):

```typescript
export type FileValidationError = 'unsupported-type' | 'too-large' | 'word-doc' | null
```

**Ordering in validateFile:** Check Word MIME/extension BEFORE the generic unsupported-type check, so `.docx` files get the friendly `'word-doc'` response rather than the generic error.

**Browser behavior note:** Windows Chrome correctly reports `application/vnd.openxmlformats-officedocument.wordprocessingml.document` for `.docx` files. However, some browsers may report `application/zip` for `.docx` (it is a ZIP archive). The extension check is the reliable signal for `.docx`; the MIME provides defense-in-depth. The pattern is already established in `validateFile` (MIME AND extension). [ASSUMED — browser behavior; not verified in this session against a live browser]

**UploadZone routing:**
```typescript
if (validationError === 'word-doc') {
  // Show WordDocBanner with guidance copy instead of generic error
  setWordDocMode(true)  // local state to swap the displayed content
  return
}
```

---

## Section 9: Multi-Page Placement Correctness (FLD-08)

### Verified: current implementation already supports multi-page

[VERIFIED: read from src/components/LazyPage.tsx and src/lib/exportPdf.ts]

The existing architecture already satisfies FLD-08:

1. **Placement:** `LazyPage` is rendered per page; the drop handler runs in the scope of its `pageNumber` prop and tags the field with `pageNumber`. Fields are filtered by `f.pageNumber === pageNumber` in each `LazyPage`. [VERIFIED: LazyPage.tsx lines 48, 135]

2. **Export:** `pages[field.pageNumber - 1]` indexes the correct page in the pdfDoc. [VERIFIED: exportPdf.ts lines 55-59]

3. **Coordinate storage:** PDF-space coordinates are per-page (each page has its own coordinate system), stored on the field. No cross-page coordinate confusion.

### Potential gap: pages of differing sizes

If a multi-page PDF has pages of different dimensions (e.g., a landscape page 1 and portrait page 2), each page's `originalWidth`/`originalHeight` differs. `pageDimensions` is keyed by `pageNumber`, so each page gets its own scale. Fields placed on page 2 use page 2's dimensions. **This is already correct** — no changes needed.

### Potential gap: lazy-render + placement before page loads

A field can only be placed on a page after `onLoadSuccess` fires (which populates `pageDimensions` for that page). The `handleOverlayClick` guards `if (!dims) return` — placement on an unloaded page is a no-op. The IntersectionObserver preloads pages 200px before they enter view. **No gap exists** for normal use; the guard prevents silent errors. [VERIFIED: LazyPage.tsx line 92, 200px rootMargin line 66]

### Potential gap: LazyPage stays rendered after first visibility

Once a LazyPage becomes intersecting, it stays rendered (observer disconnects after first intersection, `isVisible` never resets to false). This means the overlay and all placed fields remain rendered even for off-screen pages. This is the correct behavior for placement correctness — fields on any page remain interactive. [VERIFIED: LazyPage.tsx lines 59-62]

---

## Section 10: Testing Strategy

### Existing test patterns (verified)

- `src/test/exportPdf.test.ts`: EXP-02 byte-identity test (first 512 bytes), uses `SAMPLE_PDF_BASE64` fixture
- `src/test/fieldStore.test.ts`: addField, updateField, deleteField, resetFields — uses `useFieldStore.getState()` directly (no React rendering needed)
- `src/test/coordinateMapper.test.ts`: coordinate round-trip tests
- `src/test/fileValidation.test.ts`: MIME/extension combinations

### New test requirements per requirement

| Req ID | Behavior | Test Type | Automated Command | File |
|--------|----------|-----------|-------------------|------|
| DOC-04 | Zoom-invariance: place at zoom 1.0 and zoom 1.5 → identical `pdfX`/`pdfY` | unit | `vitest run src/test/coordinateMapper.test.ts` | Extend existing |
| DOC-05 | `.docx` MIME → `'word-doc'` result; `.doc` extension → `'word-doc'` | unit | `vitest run src/test/fileValidation.test.ts` | Extend existing |
| FLD-02 | `addField` with type='initials'/'date'/'text'/'checkbox' → store accepts | unit | `vitest run src/test/fieldStore.test.ts` | Extend existing |
| FLD-03 | Date field textValue defaults to today's date string | unit | `vitest run src/test/fieldStore.test.ts` | Extend existing |
| FLD-04 | Text field textValue persists after updateField | unit | `vitest run src/test/fieldStore.test.ts` | Extend existing |
| FLD-08 | Export: field on page 2 → `pages[1]` receives the draw call | unit | `vitest run src/test/exportPdf.test.ts` | Extend existing |
| FLD-09 | pushHistory + undo/redo: fields[] reverts correctly | unit | `vitest run src/test/fieldStore.test.ts` | Extend existing |
| FLD-09 | History cap at MAX_HISTORY (50) | unit | `vitest run src/test/fieldStore.test.ts` | New test |
| EXP-02 | Text field export preserves first 512 bytes | unit | `vitest run src/test/exportPdf.test.ts` | Extend existing |
| EXP-02 | Checkbox (X) export preserves first 512 bytes | unit | `vitest run src/test/exportPdf.test.ts` | Extend existing |

### Zoom-invariance test pattern

```typescript
// src/test/coordinateMapper.test.ts (new test)
it('placing a field at zoom 1.0 and zoom 1.5 produces identical PDF coordinates', () => {
  const originalWidth = 612
  const originalHeight = 792
  const containerWidth = 600
  const fitScale = containerWidth / originalWidth  // ~0.98

  const clickCss = { x: 200, y: 300 }

  // At zoom 1.0:
  const effectiveScale1 = fitScale * 1.0
  const vp1 = makeSimpleViewport(originalWidth, originalHeight, effectiveScale1)
  const pdf1 = cssPixelToPageSpace(clickCss, vp1)
  const pdfWidth1 = 160 / effectiveScale1  // field width in PDF points

  // At zoom 1.5:
  const effectiveScale2 = fitScale * 1.5
  // Scale click to zoom 1.5 space: same physical click position on the page
  const scaledClick = { x: clickCss.x * 1.5, y: clickCss.y * 1.5 }
  const vp2 = makeSimpleViewport(originalWidth, originalHeight, effectiveScale2)
  const pdf2 = cssPixelToPageSpace(scaledClick, vp2)
  const pdfWidth2 = 160 / effectiveScale2

  // PDF coordinates should be identical regardless of zoom
  expect(pdf1.x).toBeCloseTo(pdf2.x, 5)
  expect(pdf1.y).toBeCloseTo(pdf2.y, 5)
  expect(pdfWidth1).toBeCloseTo(pdfWidth2, 5)
})
```

**Note on zoom-invariance test design:** The test simulates the fact that the SAME pixel on the screen maps to the SAME PDF point regardless of zoom — because the click's CSS position relative to the page scales proportionally with the page render width. The user's physical click (e.g., "click at 1/3 down the page") corresponds to a different `cssX, cssY` at zoom 1.5 vs zoom 1.0, but the PDF coordinate that maps to "1/3 down the page" is the same. The test must reflect this by scaling the click CSS coordinates proportionally.

### EXP-02 extension for text/checkbox

```typescript
// src/test/exportPdf.test.ts — additional test cases
it('text field export: first 512 bytes byte-identical to input (EXP-02)', async () => {
  const textField: PlacedField = {
    id: 'text-1', type: 'text', pageNumber: 1,
    pdfX: 50, pdfY: 50, pdfWidth: 100, pdfHeight: 20,
    textValue: 'Hello World',
  }
  const output = await exportSignedPdf(INPUT_BYTES.buffer as ArrayBuffer, [textField])
  expect(Array.from(output.slice(0, 512))).toEqual(Array.from(INPUT_BYTES.slice(0, 512)))
})

it('checkbox field export: first 512 bytes byte-identical to input (EXP-02)', async () => {
  const checkbox: PlacedField = {
    id: 'cb-1', type: 'checkbox', pageNumber: 1,
    pdfX: 50, pdfY: 50, pdfWidth: 20, pdfHeight: 20,
  }
  const output = await exportSignedPdf(INPUT_BYTES.buffer as ArrayBuffer, [checkbox])
  expect(Array.from(output.slice(0, 512))).toEqual(Array.from(INPUT_BYTES.slice(0, 512)))
})
```

---

## Common Pitfalls

### Pitfall 1: U+2715 (✕) in PDF export throws at runtime
**What goes wrong:** `page.drawText('✕', { font: helveticaBold, ... })` throws `WinAnsi cannot encode "✕" (0x2715)` at the moment a user downloads a signed PDF with a checkbox field. Silent in development if not tested.
**Why it happens:** pdf-lib StandardFonts use WinAnsi (Windows-1252) encoding. U+2715 is not in WinAnsi.
**How to avoid:** Use ASCII `'X'` in the PDF export path. Use `✕` only in the CSS/HTML on-screen render (system-ui font includes it).
**Warning signs:** Test coverage — add an explicit unit test for checkbox export before implementing.

### Pitfall 2: `effectiveScale` vs stored `dims.scale` in viewport
**What goes wrong:** Using `dims.scale` (fit-to-width, zoom=1 baseline) to build the viewport at zoom ≠ 1 causes field placement and rendering to be offset. A placed field at zoom=1.5 appears in the wrong CSS position.
**Why it happens:** The stored scale is computed once in `onLoadSuccess`. It does not include the zoom multiplier.
**How to avoid:** Always compute `effectiveScale = dims.scale * zoom` and pass it to `makeSimpleViewport`. Never use `dims.scale` directly for rendering.
**Warning signs:** Fields appear offset when zoom ≠ 1.0 but correct at zoom 1.0.

### Pitfall 3: `drawText` y = baseline, not top-left
**What goes wrong:** Setting `y = field.pdfY` (bottom of the field box) places the text with its baseline at the box bottom, and descenders clip below the box.
**Why it happens:** pdf-lib text y-coordinate is the text baseline, not the top of the bounding box.
**How to avoid:** Compute `baselineY = field.pdfY + (field.pdfHeight - font.heightAtSize(size)) / 2` for vertical centering.
**Warning signs:** Exported text appears to float at the bottom of the field box rather than centered.

### Pitfall 4: Per-keystroke undo history flood
**What goes wrong:** Calling `pushHistory` on every `onChange` in a text/date input creates up to MAX_HISTORY entries while the user types a 20-character string, filling the ring instantly and making undo useless.
**Why it happens:** The undo action is attached to a live-updating state, not a committed state.
**How to avoid:** Keep editing value in local component state; push history and commit to store only on `onBlur`.
**Warning signs:** Pressing Undo after typing a word only undoes one character at a time.

### Pitfall 5: Passing both `width` and `scale` to react-pdf `<Page>` without understanding multiplication
**What goes wrong:** `<Page width={containerWidth} scale={zoom}>` renders at `containerWidth * zoom` — which is correct and intentional BUT if the overlay div is sized to `containerWidth` (not multiplied), fields will be rendered at different scales than the page canvas, causing drift.
**Why it happens:** The developer sets `<Page>` to zoom but forgets to apply the same zoom to the overlay's child widgets.
**How to avoid:** Use `width={containerWidth * zoom}` on `<Page>` and the same `effectiveScale` (which already incorporates zoom) in the viewport for PlacedFieldWidget. Or equivalently set `width={containerWidth}` and `scale={zoom}` on Page, but then ensure the overlay also uses `containerWidth * zoom` as its expected width.
**Warning signs:** At zoom > 1.0, PDF page appears larger but fields stay in their original CSS positions.

### Pitfall 6: Not guarding `dataUrl` validation for non-image types
**What goes wrong:** The current `exportSignedPdf` validates ALL fields' `dataUrl` unconditionally before the loop (line 41-46 in exportPdf.ts). After Phase 3, `date`/`text`/`checkbox` fields have no `dataUrl`, so the guard throws on every export with those field types.
**Why it happens:** The Phase 2 validation loop assumes all fields are image types.
**How to avoid:** Move `dataUrl` validation inside the per-field loop, gated on `field.type`:
```typescript
if (field.type === 'signature' || field.type === 'initials') {
  if (!field.dataUrl?.startsWith(PNG_DATA_URL_PREFIX)) throw new Error(...)
}
```
**Warning signs:** Export fails silently or with a confusing error after adding a text field.

### Pitfall 7: Embedding fonts inside the per-field loop
**What goes wrong:** Each call to `pdfDoc.embedFont(StandardFonts.Helvetica)` adds a font resource to the PDF. Calling it once per field (N times) creates N font entries in the incremental revision, bloating the output.
**Why it happens:** Font embedding is an expensive operation that should be done once per document operation.
**How to avoid:** Embed Helvetica and Helvetica-Bold once before the field loop, reuse the returned `PDFFont` objects.
**Warning signs:** Output file size grows linearly with the number of text/checkbox fields.

### Pitfall 8: Undo/redo fires while typing (missing keyboard guard)
**What goes wrong:** User types Ctrl+Z inside a text field input → the character they typed is undone by the browser's text undo (correct), BUT it also triggers the app's undo action (incorrect), reverting the entire fields array.
**Why it happens:** The keydown listener on `document` fires even when an input is focused.
**How to avoid:** Guard the keydown handler: `if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return`. This guard already exists in DocumentViewer for Delete/Backspace — extend it to the undo/redo handler.
**Warning signs:** Undo inside a text field unexpectedly removes a placed field instead of undoing text input.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag + resize of placed widgets | Custom drag/resize with mouse events | `react-rnd` (already installed) | 8-direction handles, bounds, controlled mode, touch support — massive complexity to re-implement |
| PDF text embedding (standard fonts) | Roll own encoding / font stream | `pdf-lib-incremental-save` `embedFont(StandardFonts.Helvetica)` | WinAnsi encoding, font resource management, stream formatting all handled |
| Coordinate CSS↔PDF conversion | Re-derive affine math | `makeSimpleViewport` + `coordinateMapper.ts` (already tested) | Y-flip logic already tested with property tests; double-inversion is the classic bug |
| Browser storage beyond sessionStorage | localStorage for image blobs | (Phase 4, idb-keyval) | Phase 3 doesn't persist initials — no storage needed here |
| File type sniffing from bytes | Custom magic-bytes parser | Extension + MIME whitelist in `fileValidation.ts` | Already established pattern; browser provides MIME; extension is defense-in-depth |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| jsPDF (generate from scratch) | pdf-lib-incremental-save (overlay onto original) | Phase 2 decision | EXP-02 byte-identity possible |
| `placementMode: boolean` | `armedFieldType: FieldType \| null` | Phase 3 (this phase) | Supports 5 field types with the same arm/drop UX |
| Single field type ('signature') | Discriminated union ('signature' \| 'initials' \| 'date' \| 'text' \| 'checkbox') | Phase 3 (this phase) | Text and checkbox exported as real PDF objects |

**Deprecated/outdated in this codebase:**
- `placementMode: boolean` → replaced by `armedFieldType: FieldType | null`
- `dataUrl: string` (required, non-optional) → becomes `dataUrl?: string` (optional for non-image types)
- `setPlacementMode(true/false)` → replaced by `setArmedFieldType(type | null)`
- Caller pattern: `openModal` → for initials, triggers InitialsDrawModal (separate from signature modal)

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 |
| Config file | `vite.config.ts` (vitest config co-located) |
| Quick run command | `npm test -- --run` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DOC-04 | Zoom-invariance: same click → same PDF coords at zoom 1.0 and 1.5 | unit | `vitest run src/test/coordinateMapper.test.ts` | Extend existing |
| DOC-04 | ZoomControl step arithmetic: zoomIn/zoomOut correctly advance ZOOM_STEPS | unit | `vitest run src/test/documentStore.test.ts` | Extend existing |
| DOC-05 | `.docx` → `'word-doc'` validation result | unit | `vitest run src/test/fileValidation.test.ts` | Extend existing |
| DOC-05 | `.doc` → `'word-doc'` validation result | unit | `vitest run src/test/fileValidation.test.ts` | Extend existing |
| DOC-05 | `application/msword` MIME alone → `'word-doc'` | unit | `vitest run src/test/fileValidation.test.ts` | Extend existing |
| FLD-02 | addField with type='initials' → accepted in store | unit | `vitest run src/test/fieldStore.test.ts` | Extend existing |
| FLD-02 | addField with type='checkbox' → accepted in store | unit | `vitest run src/test/fieldStore.test.ts` | Extend existing |
| FLD-03 | Date field textValue = M/D/YYYY at creation | unit | `vitest run src/test/fieldStore.test.ts` | Extend existing |
| FLD-04 | updateField textValue persists through store round-trip | unit | `vitest run src/test/fieldStore.test.ts` | Extend existing |
| FLD-08 | Export: field on page 2 draws on pages[1], not pages[0] | unit | `vitest run src/test/exportPdf.test.ts` | Extend existing |
| FLD-09 | pushHistory + undo: fields[] reverts to prior state | unit | `vitest run src/test/fieldStore.test.ts` | Extend existing |
| FLD-09 | pushHistory + redo: fields[] advances to undone state | unit | `vitest run src/test/fieldStore.test.ts` | Extend existing |
| FLD-09 | History cap: 51 pushes = MAX_HISTORY (50) entries, not 51 | unit | `vitest run src/test/fieldStore.test.ts` | Extend existing |
| FLD-09 | New action after undo truncates redo tail | unit | `vitest run src/test/fieldStore.test.ts` | Extend existing |
| EXP-02 | Text field export: first 512 bytes byte-identical (EXP-02) | unit | `vitest run src/test/exportPdf.test.ts` | Extend existing |
| EXP-02 | Checkbox field export: first 512 bytes byte-identical (EXP-02) | unit | `vitest run src/test/exportPdf.test.ts` | Extend existing |
| EXP-02 | Date field export: drawText with today's date string | unit | `vitest run src/test/exportPdf.test.ts` | Extend existing |

### Sampling Rate

- **Per task commit:** `npm test -- --run` (full suite; ~5s)
- **Per wave merge:** `npm test` (same; Vitest has no separate watch mode for CI)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- None — existing test infrastructure covers all phase requirements. All new test cases extend existing test files; no new files or framework config needed.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No auth in this app |
| V3 Session Management | No | No sessions |
| V4 Access Control | No | Client-side only |
| V5 Input Validation | Yes | fileValidation.ts whitelist (MIME + extension); `textValue` stored as string, passed to `page.drawText` |
| V6 Cryptography | No | No crypto operations |

### Known Threat Patterns for this Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Word-doc opened as PDF (rename attack) | Spoofing | MIME + extension both checked; neither alone is sufficient |
| PDF injection via drawText content | Tampering | pdf-lib encodes text as WinAnsi bytes; no injection vector through text content |
| Undo history leaking field content to other sessions | Information Disclosure | History is in-memory JS; no persistence; `resetFields` clears it on new document load |
| SVG/HTML in textValue rendered as markup | Tampering | `drawText` in pdf-lib encodes as PDF text operators, not rendered HTML; `<input>` in React renders as plain text |
| Memory exhaustion via MAX_HISTORY × large field arrays | DoS | Cap at 50 snapshots; each snapshot is a shallow copy of the fields array; fields contain only primitives + a dataUrl string |

**Security note on `textValue` in `drawText`:** pdf-lib's `drawText` encodes the string as WinAnsi bytes before writing to the PDF content stream. There is no scripting or injection vector through this path — the text is rendered as glyphs, not interpreted as PDF operators. [ASSUMED — based on pdf-lib architecture; no CVE search performed]

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build/test | ✓ | 22.21.1 | — |
| npm | Package management | ✓ | (from Node) | — |
| pdf-lib-incremental-save | PDF export | ✓ | 1.17.4 | — |
| react-rnd | Field widget | ✓ | 10.5.3 | — |
| Vitest | Testing | ✓ | 4.1.9 | — |
| zustand | State | ✓ | 5.0.14 | — |

**Missing dependencies with no fallback:** none — all required dependencies are installed.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Calling `embedFont` inside the per-field loop creates duplicate font entries in the incremental revision | Section 2 Pitfall 7 | Minor: output file slightly larger than needed; not a correctness issue |
| A2 | `dims.scale` stored by `onLoadSuccess` should NOT include zoom; effectiveScale is computed on the fly | Section 3 | Medium: if scale is stored with zoom, zoom-invariance breaks; easy to verify in code |
| A3 | Some browsers may report `application/zip` for `.docx` files instead of the correct MIME | Section 8 | Low: the extension check catches it regardless; defense-in-depth already covers this |
| A4 | Clearing `selectedFieldId` on undo/redo is the correct UX (avoids dangling selection references) | Section 4 | Low: could restore selection if the undone state happens to contain the same field ID |
| A5 | `textValue` in `drawText` has no PDF injection attack surface through pdf-lib's encoding path | Security Domain | Medium: no CVE search performed; should be verified if threat model is reviewed |

**Risk summary:** All assumptions are LOW-to-MEDIUM. None affect correctness of the core export path or the zoom-invariance guarantee — those are VERIFIED claims.

---

## Open Questions (RESOLVED)

1. **Should `deleteField` also clear the undo history?**
   - What we know: CONTEXT.md says "delete field" is undoable (it IS a history-pushing action)
   - What's unclear: whether deleting via the × button should put the deleted field's state in undo history so "Undo" restores it
   - Recommendation: Yes — `deleteField` SHOULD push history first, then remove. This makes Delete undoable, which is correct (CONTEXT.md: "field deletion is now fully recoverable via Undo").

2. **What happens if the user undoes all the way to an empty `fields[]`?**
   - What we know: `historyIndex <= 0` → undo disabled. `history[0]` would be the initial empty snapshot pushed before the first `addField`.
   - What's unclear: whether the initial empty state should be in history at all (if not, undo stops one step before empty).
   - Recommendation: Push a snapshot of `[]` as history[0] at document load so undo can fully revert to the initial clean state. Call `pushHistory()` once in `resetFields`/on document load.

3. **How does `pushHistory` interact with `resetFields`?**
   - What we know: `resetFields()` is called when opening a new document. It should clear history entirely.
   - Recommendation: `resetFields` should reset `history: []` and `historyIndex: -1`. This is already implied by the existing `initialFieldState` pattern.

---

## Sources

### Primary (HIGH confidence)
- [VERIFIED] `src/store/fieldStore.ts` — current PlacedField interface, store shape, all actions
- [VERIFIED] `src/store/documentStore.ts` — current store shape, no zoom state confirmed
- [VERIFIED] `src/lib/exportPdf.ts` — EXP-02 export path, current dataUrl-only validation
- [VERIFIED] `src/lib/pageViewport.ts` — makeSimpleViewport signature, rotation=0 only confirmed
- [VERIFIED] `src/lib/fileValidation.ts` — current MIME/extension sets, validateFile flow
- [VERIFIED] `src/components/LazyPage.tsx` — placement handler, effectiveScale usage, per-page pageNumber keying
- [VERIFIED] `src/components/PlacedFieldWidget.tsx` — drag/resize handlers, coordinate conversion
- [VERIFIED] `src/components/DocumentViewer.tsx` — keyboard handler with existing INPUT guard
- [VERIFIED] `src/components/UploadZone.tsx` — handleFile routing, error messaging
- [VERIFIED] `src/components/TopBar.tsx` — current toolbar layout
- [VERIFIED] `node_modules/react-pdf/dist/Page.d.ts` — width + scale prop interaction; PageCallback.originalWidth
- [VERIFIED] `node_modules/react-pdf/dist/shared/types.d.ts` — PageCallback type including originalWidth/originalHeight
- [VERIFIED] Node runtime: `pdf-lib-incremental-save` StandardFonts list
- [VERIFIED] Node runtime: `drawText('✕')` throws WinAnsi encode error; `drawText('X')` succeeds
- [VERIFIED] Node runtime: EXP-02 preserved with `drawText` (first 20 bytes match after incremental save)
- [VERIFIED] Node runtime: `PDFFont` available methods (`heightAtSize`, `sizeAtHeight`, `widthOfTextAtSize`) — `descendsAtSize` does NOT exist
- [VERIFIED] `package.json` — complete dependency list; zundo is NOT installed
- [VERIFIED] `.planning/config.json` — `nyquist_validation: true`, `security_enforcement: true`
- [VERIFIED] `03-CONTEXT.md` — all locked decisions
- [VERIFIED] `03-UI-SPEC.md` — component inventory, state machine additions, PlacedField model

### Secondary (MEDIUM confidence)
- [CITED] react-pdf Page.d.ts: "If you define width and scale at the same time, the width will be multiplied by a given factor"

### Tertiary (LOW confidence)
- [ASSUMED] per-iteration `embedFont` creates duplicate PDF resources
- [ASSUMED] some browsers report `application/zip` for `.docx`
- [ASSUMED] `textValue` via `drawText` has no PDF injection attack surface

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified as installed; no new deps required
- Architecture: HIGH — verified against actual source files; scale threading confirmed
- Pitfalls: HIGH for PDF export (runtime-verified); MEDIUM for undo/redo edge cases (logic-verified, not browser-tested)
- Security: MEDIUM — standard patterns applied; no active CVE search

**Research date:** 2026-06-17
**Valid until:** 2026-07-17 (stable deps; re-validate if react-pdf or pdf-lib-incremental-save is upgraded)
