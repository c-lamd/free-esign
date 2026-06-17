# Phase 3: Full Field Types + Workspace Controls — Pattern Map

**Mapped:** 2026-06-17
**Files analyzed:** 13 new/modified files
**Analogs found:** 13 / 13

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/store/fieldStore.ts` | store | CRUD + event-driven | self (extend in-place) | exact — same file |
| `src/store/documentStore.ts` | store | CRUD | self (extend in-place) | exact — same file |
| `src/components/LazyPage.tsx` | component | request-response | self (extend in-place) | exact — same file |
| `src/components/PlacedFieldWidget.tsx` | component | request-response | self (extend in-place) | exact — same file |
| `src/components/FieldPalette.tsx` | component | event-driven | `src/components/TopBar.tsx` (toolbar buttons) | role-match |
| `src/components/ZoomControl.tsx` | component | event-driven | `src/components/PageNavigation.tsx` (bottom pill) | role-match |
| `src/components/UndoRedoControls.tsx` | component | event-driven | `src/components/TopBar.tsx` (toolbar buttons) | role-match |
| `src/components/InitialsDrawModal.tsx` | component | event-driven | `src/components/SignatureDrawModal.tsx` | exact |
| `src/components/TopBar.tsx` | component | request-response | self (extend in-place) | exact — same file |
| `src/components/DocumentViewer.tsx` | component | event-driven | self (extend in-place) | exact — same file |
| `src/lib/exportPdf.ts` | utility | transform | self (extend in-place) | exact — same file |
| `src/lib/fileValidation.ts` | utility | transform | self (extend in-place) | exact — same file |
| `src/test/*.test.ts` | test | — | `src/test/fieldStore.test.ts`, `src/test/exportPdf.test.ts`, `src/test/fileValidation.test.ts` | exact |

---

## Pattern Assignments

### `src/store/fieldStore.ts` — extend PlacedField union + undo/redo history

**Role:** store, CRUD
**Analog:** self (lines 1–121 as read)

**Current type to replace** (lines 17–27):
```typescript
export interface PlacedField {
  id: string              // crypto.randomUUID()
  type: 'signature'       // Phase 3 extends: 'initials' | 'date' | 'text' | 'checkbox'
  pageNumber: number      // 1-indexed
  pdfX: number            // PDF user-space, bottom-left origin, points
  pdfY: number
  pdfWidth: number
  pdfHeight: number
  dataUrl: string         // transparent-background PNG data URL
  role?: string           // v2 multi-party seam (MP-01) — reserved, unused in Phase 2
}
```

**Extended type (Phase 3 target shape):**
```typescript
export type FieldType = 'signature' | 'initials' | 'date' | 'text' | 'checkbox'

export interface PlacedField {
  id: string
  type: FieldType
  pageNumber: number
  pdfX: number            // PDF user-space, bottom-left origin, points
  pdfY: number
  pdfWidth: number
  pdfHeight: number
  dataUrl?: string        // image types only (signature, initials); optional now
  textValue?: string      // date and text fields; unified string (type discriminates)
  role?: string           // v2 seam, reserved
}
```

**Immutable Zustand action pattern** (lines 88–103) — copy this shape for every new action:
```typescript
addField: (field) =>
  set((state) => ({
    fields: [...state.fields, field],
  })),

updateField: (id, updates) =>
  set((state) => ({
    fields: state.fields.map((f) => (f.id === id ? { ...f, ...updates } : f)),
  })),

deleteField: (id) =>
  set((state) => ({
    fields: state.fields.filter((f) => f.id !== id),
    selectedFieldId: state.selectedFieldId === id ? null : state.selectedFieldId,
  })),
```

**Map-replace pattern for pageDimensions** (lines 107–113) — use the same for any Map state:
```typescript
setPageDimensions: (pageNumber, dims) =>
  set((state) => {
    const next = new Map(state.pageDimensions)
    next.set(pageNumber, dims)
    return { pageDimensions: next }
  }),
```

**initialFieldState + reset pattern** (lines 67–74, 115–120) — extend initialFieldState to include new history fields, then resetFields picks them up automatically:
```typescript
const initialFieldState = {
  modalOpen: false,
  signatureDataUrl: null,
  placementMode: false,    // Phase 3: replace with armedFieldType: null
  fields: [] as PlacedField[],
  selectedFieldId: null,
  pageDimensions: new Map<number, PageDimensions>(),
  // ADD for Phase 3:
  armedFieldType: null as FieldType | null,
  initialsDataUrl: null as string | null,
  history: [] as PlacedField[][],
  historyIndex: -1,
}
```

**Undo/redo history actions — new pattern to add:**
```typescript
const MAX_HISTORY = 50

pushHistory: () =>
  set((state) => {
    const snapshot = [...state.fields]
    const newHistory = state.history.slice(0, state.historyIndex + 1)
    newHistory.push(snapshot)
    const bounded = newHistory.slice(-MAX_HISTORY)
    return { history: bounded, historyIndex: bounded.length - 1 }
  }),

undo: () =>
  set((state) => {
    if (state.historyIndex <= 0) return {}
    const newIndex = state.historyIndex - 1
    return { fields: [...state.history[newIndex]], historyIndex: newIndex, selectedFieldId: null }
  }),

redo: () =>
  set((state) => {
    if (state.historyIndex >= state.history.length - 1) return {}
    const newIndex = state.historyIndex + 1
    return { fields: [...state.history[newIndex]], historyIndex: newIndex, selectedFieldId: null }
  }),
```

**Backward compatibility note:** `placementMode` and `setPlacementMode` are replaced by `armedFieldType` and `setArmedFieldType`. All three callers (LazyPage, PlacementModeOverlay, TopBar) change in Phase 3, so a clean removal is safe. Remove `placementMode` from `FieldStore` interface and `initialFieldState`.

---

### `src/store/documentStore.ts` — add zoom state

**Role:** store, CRUD
**Analog:** self (lines 1–70 as read)

**Existing action shape to copy** (lines 51–58):
```typescript
setView: (view) => set({ view }),
loadDocument: (url) => set({ docUrl: url, view: 'loading', errorMessage: null }),
setCurrentPage: (currentPage) => set({ currentPage }),
setExportError: (exportError) => set({ exportError }),
```

**New zoom additions — follow this exact pattern:**
```typescript
// In DocumentStore interface:
zoom: number            // 0.5–2.0, default 1.0
setZoom: (z: number) => void

// In initial state (co-located with other primitives):
zoom: 1.0,

// In store actions (same one-liner pattern):
setZoom: (zoom) => set({ zoom }),

// In reset() — include zoom reset:
reset: () => set({ ..., zoom: 1.0 })
```

**ZOOM_STEPS constant — export from documentStore for shared use by ZoomControl:**
```typescript
export const ZOOM_STEPS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0] as const
```

---

### `src/components/LazyPage.tsx` — effectiveScale + armed-type drop

**Role:** component, request-response
**Analog:** self (lines 1–231 as read)

**Store subscription pattern** (lines 37–45) — copy for new store fields:
```typescript
const placementMode    = useFieldStore((s) => s.placementMode)   // → armedFieldType
const signatureDataUrl = useFieldStore((s) => s.signatureDataUrl)
const fields           = useFieldStore((s) => s.fields)
const selectedFieldId  = useFieldStore((s) => s.selectedFieldId)
// ADD:
const zoom             = useDocumentStore((s) => s.zoom)
const armedFieldType   = useFieldStore((s) => s.armedFieldType)
const initialsDataUrl  = useFieldStore((s) => s.initialsDataUrl)
const pushHistory      = useFieldStore((s) => s.pushHistory)
```

**effectiveScale computation — replace dims.scale with this pattern:**
```typescript
// Current (Phase 2, line 98):
const viewport = makeSimpleViewport(dims.originalWidth, dims.originalHeight, dims.scale)

// Phase 3 — compute effectiveScale first, pass it everywhere:
const effectiveScale = containerWidth && dims
  ? (containerWidth / dims.originalWidth) * zoom
  : dims?.scale ?? 1
const viewport = makeSimpleViewport(dims.originalWidth, dims.originalHeight, effectiveScale)
```

**react-pdf Page width prop — replace containerWidth alone** (line 192):
```typescript
// Phase 2:
<Page pageNumber={pageNumber} width={containerWidth} ... />

// Phase 3 (zoom-aware):
<Page pageNumber={pageNumber} width={containerWidth ? containerWidth * zoom : undefined} ... />
```

**pdfWidth/pdfHeight computation on drop — CRITICAL: divide by effectiveScale, not dims.scale** (lines 137–138):
```typescript
// Phase 2 (divides by dims.scale — wrong at zoom ≠ 1):
pdfWidth:  defaultWidthPx  / dims.scale,
pdfHeight: defaultHeightPx / dims.scale,

// Phase 3 (divide by effectiveScale — zoom-invariant):
pdfWidth:  defaultWidthPx  / effectiveScale,
pdfHeight: defaultHeightPx / effectiveScale,
```

**Extended drop handler — armed-type dispatch pattern:**
```typescript
const handleOverlayClick = useCallback(
  async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!armedFieldType || !dims) return
    if (armedFieldType === 'signature' && !signatureDataUrl) return
    if (armedFieldType === 'initials' && !initialsDataUrl) return

    const rect = e.currentTarget.getBoundingClientRect()
    const cssX = e.clientX - rect.left
    const cssY = e.clientY - rect.top
    const viewport = makeSimpleViewport(dims.originalWidth, dims.originalHeight, effectiveScale)

    // Default CSS sizes at current zoom:
    const defaults: Record<FieldType, { w: number; h: number }> = {
      signature: { w: 180, h: 60 },   // adjusted by PNG aspect ratio (existing async pattern)
      initials:  { w: 80,  h: 40 },   // adjusted by PNG aspect ratio
      date:      { w: 160, h: 28 },
      text:      { w: 160, h: 28 },
      checkbox:  { w: 32,  h: 32 },
    }
    // ... center on click, cssPixelToPageSpace ...

    const today = new Date()
    const textValue = armedFieldType === 'date'
      ? `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`
      : armedFieldType === 'text' ? '' : undefined

    const newField: PlacedField = {
      id: crypto.randomUUID(),
      type: armedFieldType,
      pageNumber,
      pdfX, pdfY, pdfWidth, pdfHeight,
      dataUrl: armedFieldType === 'signature' ? signatureDataUrl
             : armedFieldType === 'initials'  ? initialsDataUrl
             : undefined,
      textValue,
    }

    pushHistory()               // commit undo entry BEFORE add
    addField(newField)
    setSelectedFieldId(newField.id)
    setArmedFieldType(null)     // disarm
  },
  [armedFieldType, dims, effectiveScale, pageNumber, signatureDataUrl, initialsDataUrl,
   pushHistory, addField, setSelectedFieldId, setArmedFieldType],
)
```

**Overlay pointer-events — replace placementMode check** (line 208):
```typescript
// Phase 2:
pointerEvents: placementMode ? 'auto' : 'none',
cursor: placementMode ? 'crosshair' : 'default',

// Phase 3 (armed = any non-null armedFieldType):
const isArmed = armedFieldType !== null
pointerEvents: isArmed ? 'auto' : 'none',
cursor: isArmed ? 'crosshair' : 'default',
```

---

### `src/components/PlacedFieldWidget.tsx` — per-type rendering + inline editing

**Role:** component, request-response
**Analog:** self (lines 1–251 as read)

**CSS coordinate derivation pattern** (lines 66–68) — unchanged, still correct:
```typescript
const cssPos = pageSpaceToCssPixel({ x: field.pdfX, y: field.pdfY }, viewport)
const cssWidth  = field.pdfWidth  * viewport.scale
const cssHeight = field.pdfHeight * viewport.scale
```

**handleDragStop / handleResizeStop pattern** (lines 85–111) — call pushHistory BEFORE updateField:
```typescript
function handleDragStop(_e: unknown, d: { x: number; y: number }) {
  const newPdfPos = cssPixelToPageSpace({ x: d.x, y: d.y }, viewport)
  pushHistory()   // ADD: commit undo entry before the position change
  updateField(field.id, { pdfX: newPdfPos.x, pdfY: newPdfPos.y })
}

function handleResizeStop(_e, _direction, ref, _delta, position) {
  const newCssWidth  = parseFloat(ref.style.width)
  const newCssHeight = parseFloat(ref.style.height)
  const newPdfWidth  = newCssWidth  / viewport.scale
  const newPdfHeight = newCssHeight / viewport.scale
  const newPdfPos    = cssPixelToPageSpace({ x: position.x, y: position.y }, viewport)
  pushHistory()   // ADD
  updateField(field.id, { pdfX: newPdfPos.x, pdfY: newPdfPos.y,
                           pdfWidth: newPdfWidth, pdfHeight: newPdfHeight })
}
```

**Inline text/date editing — new local state + input pattern:**
```typescript
const [isEditing, setIsEditing] = useState(false)
const [localValue, setLocalValue] = useState(field.textValue ?? '')

// Sync local value when field.textValue changes externally (e.g., undo):
useEffect(() => { setLocalValue(field.textValue ?? '') }, [field.textValue])

function handleInputBlur() {
  setIsEditing(false)
  pushHistory()                                     // commit undo entry on blur
  updateField(field.id, { textValue: localValue })
}

// In Rnd props:
disableDragging={isEditing}    // prevent drag when typing

// Input element:
<input
  type="text"
  value={localValue}
  onChange={(e) => setLocalValue(e.target.value)}
  onFocus={() => setIsEditing(true)}
  onBlur={handleInputBlur}
  onMouseDown={(e) => e.stopPropagation()}   // prevent drag initiation on click-into-input
  aria-label={field.type === 'date' ? 'Date field value' : 'Text field content'}
  style={{ width: '100%', height: '100%', border: 'none', outline: 'none',
           fontSize: '14px', fontFamily: 'inherit', boxSizing: 'border-box',
           backgroundColor: 'transparent', padding: '2px 4px' }}
/>
```

**Per-type render dispatch — after the Rnd position/size derivation:**
```typescript
// Image types — same img as Phase 2 (now gated on field.type):
if (field.type === 'signature' || field.type === 'initials') {
  content = (
    <img src={field.dataUrl} alt={`Placed ${field.type}`} draggable={false}
         style={{ width: '100%', height: '100%', objectFit: 'contain',
                  display: 'block', userSelect: 'none' }} />
  )
}

// Text / date — inline editable input:
if (field.type === 'date' || field.type === 'text') {
  content = <input ... />   // see pattern above
}

// Checkbox — styled ✕ (U+2715 on-screen only; PDF export uses ASCII 'X'):
if (field.type === 'checkbox') {
  const fontSize = Math.min(cssHeight * 0.7, cssWidth * 0.7)
  content = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '100%', height: '100%',
                  fontSize, fontWeight: 700, userSelect: 'none', pointerEvents: 'none' }}>
      ✕
    </div>
  )
}
```

**Delete button aria-label — per-type strings** (extend from line 185):
```typescript
const deleteLabel: Record<FieldType, string> = {
  signature: 'Delete signature',
  initials:  'Delete initials',
  date:      'Delete date field',
  text:      'Delete text field',
  checkbox:  'Delete checkbox field',
}
// In the button: aria-label={deleteLabel[field.type]}
```

**Rnd lockAspectRatio per type:**
```typescript
lockAspectRatio={field.type === 'signature' || field.type === 'initials' || field.type === 'checkbox'}
// false for date/text (free resize)
```

---

### `src/components/FieldPalette.tsx` — NEW component

**Role:** component, event-driven
**Analog:** `src/components/TopBar.tsx` (toolbar button group, lines 73–108)

**Button group container — copy from TopBar** (line 73):
```typescript
<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
```

**Ghost/secondary button style — copy from TopBar "Add signature"** (lines 75–108):
```typescript
<button
  onClick={() => setArmedFieldType(type)}
  aria-label={`Add ${label} — click to arm, then click the document to place`}
  aria-pressed={armedFieldType === type}   // toggle state for accessibility
  style={{
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 400,
    color: armedFieldType === type ? 'var(--color-accent)' : 'var(--color-text-secondary)',
    padding: '8px',
    minHeight: '44px',
    minWidth: '44px',
    borderRadius: '4px',
    outline: 'none',
    // Armed state: accent underline or background highlight (Claude's discretion)
    borderBottom: armedFieldType === type ? '2px solid var(--color-accent)' : '2px solid transparent',
  }}
  onFocus={(e) => {
    e.currentTarget.style.outline = '2px solid var(--color-accent)'
    e.currentTarget.style.outlineOffset = '2px'
  }}
  onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
>
  {label}
</button>
```

**aria-disabled pattern for unavailable states** (from PageNavigation lines 77–78):
```typescript
// When initials button requires a draw step but no initialsDataUrl yet:
aria-disabled={isUnavailable ? 'true' : undefined}
// Do NOT use HTML disabled — keeps focus reachable (WCAG 2.5.5, established pattern)
```

**Store wiring:**
```typescript
const armedFieldType  = useFieldStore((s) => s.armedFieldType)
const setArmedFieldType = useFieldStore((s) => s.setArmedFieldType)
```

---

### `src/components/ZoomControl.tsx` — NEW component

**Role:** component, event-driven
**Analog:** `src/components/PageNavigation.tsx` (bottom-center fixed pill, lines 57–203)

**Fixed pill container — copy positioning from PageNavigation** (lines 59–68):
```typescript
<div
  style={{
    position: 'fixed',
    bottom: '24px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'var(--color-surface-elevated)',
    borderRadius: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    padding: '8px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    zIndex: 50,
  }}
>
```

**Button pattern with aria-disabled at boundaries — copy from PageNavigation** (lines 75–129):
```typescript
<button
  aria-label="Zoom out"
  aria-disabled={isAtMin ? 'true' : undefined}
  onClick={handleZoomOut}
  style={{
    minWidth: '44px',
    minHeight: '44px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'none', border: 'none',
    cursor: isAtMin ? 'default' : 'pointer',
    opacity: isAtMin ? 0.35 : 1,
    color: 'var(--color-text-primary)',
    borderRadius: '6px', padding: '0 8px', outline: 'none',
  }}
  onFocus={(e) => {
    e.currentTarget.style.outline = '2px solid var(--color-accent)'
    e.currentTarget.style.outlineOffset = '2px'
  }}
  onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
>
  {/* inline SVG minus icon, aria-hidden */}
</button>
```

**Percentage readout — copy from PageNavigation page indicator** (lines 131–146):
```typescript
<span
  aria-live="polite"
  aria-atomic="true"
  style={{
    fontSize: '14px', fontWeight: 400, lineHeight: 1.4,
    color: 'var(--color-text-secondary)',
    minWidth: '48px', textAlign: 'center', userSelect: 'none',
  }}
>
  {Math.round(zoom * 100)}%
</span>
```

**Fit/reset button — secondary ghost style like "Open another" in TopBar** (lines 170–203):
```typescript
<button onClick={() => setZoom(1.0)} aria-label="Reset zoom to fit width" ...>
  Fit
</button>
```

**Store wiring:**
```typescript
import { useDocumentStore, ZOOM_STEPS } from '../store/documentStore'
const zoom    = useDocumentStore((s) => s.zoom)
const setZoom = useDocumentStore((s) => s.setZoom)

const isAtMin = zoom <= ZOOM_STEPS[0]
const isAtMax = zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]

function handleZoomOut() {
  const idx = ZOOM_STEPS.indexOf(zoom)
  if (idx > 0) setZoom(ZOOM_STEPS[idx - 1])
}
function handleZoomIn() {
  const idx = ZOOM_STEPS.indexOf(zoom)
  if (idx >= 0 && idx < ZOOM_STEPS.length - 1) setZoom(ZOOM_STEPS[idx + 1])
}
```

**Positioning note:** ZoomControl pill goes to bottom-right of the PageNavigation pill (both fixed; differentiate by `left` offset or `right: 24px` vs `left: 50%` centering), or centered above the page-nav pill. Claude's discretion on exact offset; must not overlap PageNavigation.

---

### `src/components/UndoRedoControls.tsx` — NEW component

**Role:** component, event-driven
**Analog:** `src/components/TopBar.tsx` (toolbar button group, lines 73–203)

**Ghost button style — copy from TopBar "Add signature"** (lines 75–108):
```typescript
<button
  onClick={undo}
  aria-label="Undo"
  aria-disabled={canUndo ? undefined : 'true'}
  style={{
    background: 'none', border: 'none', cursor: canUndo ? 'pointer' : 'default',
    fontSize: '14px', fontWeight: 400,
    color: canUndo ? 'var(--color-text-secondary)' : 'var(--color-border)',
    padding: '8px', minHeight: '44px', minWidth: '44px',
    borderRadius: '4px', outline: 'none',
  }}
  onFocus={(e) => {
    e.currentTarget.style.outline = '2px solid var(--color-accent)'
    e.currentTarget.style.outlineOffset = '2px'
  }}
  onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
>
  {/* inline SVG undo arrow, aria-hidden */}
</button>
```

**Keyboard shortcut handler — copy + extend from DocumentViewer** (lines 61–81):
```typescript
// Mount in UndoRedoControls (or extend DocumentViewer's existing handler):
useEffect(() => {
  function handleKeyDown(e: KeyboardEvent) {
    // Existing guard from DocumentViewer lines 68–72 — SAME guard applies:
    const target = e.target as HTMLElement | null
    if (target) {
      const tag = target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (target.isContentEditable) return
    }

    const isMod = e.metaKey || e.ctrlKey
    if (isMod && e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
      e.preventDefault(); redo(); return
    }
    if (isMod && (e.key === 'z' || e.key === 'Z')) {
      e.preventDefault(); undo(); return
    }
    if (e.ctrlKey && (e.key === 'y' || e.key === 'Y')) {
      e.preventDefault(); redo(); return
    }
  }
  document.addEventListener('keydown', handleKeyDown)
  return () => document.removeEventListener('keydown', handleKeyDown)
}, [undo, redo])
```

**Store wiring:**
```typescript
const undo         = useFieldStore((s) => s.undo)
const redo         = useFieldStore((s) => s.redo)
const historyIndex = useFieldStore((s) => s.historyIndex)
const historyLen   = useFieldStore((s) => s.history.length)
const canUndo = historyIndex > 0
const canRedo = historyIndex < historyLen - 1
```

---

### `src/components/InitialsDrawModal.tsx` — NEW component

**Role:** component, event-driven
**Analog:** `src/components/SignatureDrawModal.tsx` (mirrors it entirely)

Read `src/components/SignatureDrawModal.tsx` when writing this component — the Phase 3 modal is a near-identical copy with:
- Title changed to "Draw your initials"
- On confirm: call `setInitialsDataUrl(dataUrl)` instead of `setSignatureDataUrl(dataUrl)`; then call `setArmedFieldType('initials')` to arm placement
- Default canvas size may be smaller (e.g., 320×160 vs 560×220)
- The open/close action: add `initialsModalOpen: boolean` + `openInitialsModal/closeInitialsModal` to fieldStore following the same `modalOpen`/`openModal`/`closeModal` pattern (lines 80–82)

---

### `src/components/TopBar.tsx` — host FieldPalette + UndoRedoControls

**Role:** component, request-response
**Analog:** self (lines 1–208 as read)

**Extend the `view === 'loaded'` button group** (line 73) — insert FieldPalette and UndoRedoControls before the Download PDF button:
```typescript
{view === 'loaded' && (
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
    <FieldPalette />       {/* NEW — field type buttons */}
    <UndoRedoControls />   {/* NEW — undo/redo buttons */}
    {/* existing Download PDF button */}
    {/* existing Open another button */}
  </div>
)}
```

**No pattern changes to existing buttons** — ghost/secondary style and aria-disabled pattern are already established. FieldPalette and UndoRedoControls each self-contain their styles following the TopBar button conventions.

---

### `src/components/DocumentViewer.tsx` — pass zoom + keyboard shortcuts

**Role:** component, event-driven
**Analog:** self (lines 1–212 as read)

**Extend the existing keyboard handler** (lines 61–81) to include undo/redo keys — OR mount UndoRedoControls here instead of as a separate component and merge the handlers. Either way, the guard at lines 68–72 is the exact code to extend:
```typescript
// EXISTING guard — copy verbatim; do not duplicate with a second addEventListener:
const target = e.target as HTMLElement | null
if (target) {
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return
  if (target.isContentEditable) return
}
```

**Pass zoom down to LazyPage** — LazyPage reads zoom from documentStore directly, so no prop threading is needed. DocumentViewer only needs to pass `containerWidth` (unchanged).

**Render ZoomControl** — add below the PageNavigation component in the JSX:
```typescript
// After the existing PageNavigation conditional (line 206):
<ZoomControl />
```

---

### `src/lib/exportPdf.ts` — extend draw loop for text/date/checkbox

**Role:** utility, transform
**Analog:** self (lines 1–134 as read)

**EXP-02 incremental-save structure — preserve verbatim** (lines 39–88):
```typescript
const srcBytes = new Uint8Array(originalPdfBytes)
const pdfDoc = await PDFDocument.load(srcBytes)
const snapshot = pdfDoc.takeSnapshot()
const pages = pdfDoc.getPages()
// ... field loop ...
const incrementalBytes = await pdfDoc.saveIncremental(snapshot)
const result = new Uint8Array(srcBytes.length + incrementalBytes.length)
result.set(srcBytes, 0)
result.set(incrementalBytes, srcBytes.length)
return result
```

**dataUrl guard — move INSIDE the loop, gate on type** (currently lines 42–48 validate unconditionally):
```typescript
// Phase 3: move guard inside loop, before the per-type branch:
for (const field of fields) {
  const page = pages[field.pageNumber - 1]
  if (!page) throw new Error(...)
  snapshot.markRefForSave(page.ref)   // mark BEFORE any draw call (established pattern)

  if (field.type === 'signature' || field.type === 'initials') {
    // T-02-01 guard: now gated on type
    if (!field.dataUrl?.startsWith(PNG_DATA_URL_PREFIX)) {
      throw new Error(`Invalid dataUrl for field "${field.id}"`)
    }
    const base64 = field.dataUrl.slice(PNG_DATA_URL_PREFIX.length)
    const pngBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
    const pngImage = await pdfDoc.embedPng(pngBytes)
    page.drawImage(pngImage, { x: field.pdfX, y: field.pdfY,
                               width: field.pdfWidth, height: field.pdfHeight })

  } else if (field.type === 'date' || field.type === 'text') {
    // helvetica embedded ONCE before the loop (see below)
    drawTextInBox(page, field.textValue ?? '', helvetica, field)

  } else if (field.type === 'checkbox') {
    drawCheckboxX(page, helveticaBold, field)
  }
}
```

**Font embedding — ONCE before the loop** (RESEARCH Pitfall 7):
```typescript
import { PDFDocument, StandardFonts } from 'pdf-lib-incremental-save'
import type { PDFFont, PDFPage } from 'pdf-lib-incremental-save'

// Before the field loop:
const helvetica     = await pdfDoc.embedFont(StandardFonts.Helvetica)
const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
```

**drawText helpers — new functions in exportPdf.ts:**
```typescript
function drawTextInBox(page: PDFPage, text: string, font: PDFFont, field: PlacedField) {
  if (!text) return
  const targetSize = font.sizeAtHeight(field.pdfHeight * 0.75)
  const glyphH = font.heightAtSize(targetSize)
  const baselineY = field.pdfY + (field.pdfHeight - glyphH) / 2
  page.drawText(text, { x: field.pdfX + 2, y: baselineY, font, size: targetSize })
}

function drawCheckboxX(page: PDFPage, fontBold: PDFFont, field: PlacedField) {
  // CRITICAL: use ASCII 'X', NOT '✕' (U+2715) — WinAnsi cannot encode it (RESEARCH verified)
  const dim = Math.min(field.pdfWidth, field.pdfHeight)
  const targetSize = fontBold.sizeAtHeight(dim * 0.75)
  const glyphH = fontBold.heightAtSize(targetSize)
  const baselineY = field.pdfY + (field.pdfHeight - glyphH) / 2
  const xOffset = (field.pdfWidth - fontBold.widthOfTextAtSize('X', targetSize)) / 2
  page.drawText('X', { x: field.pdfX + xOffset, y: baselineY, font: fontBold, size: targetSize })
}
```

**markRefForSave placement** (line 63) — already marked BEFORE draw; preserve this for all new types.

---

### `src/lib/fileValidation.ts` — add Word-doc detection

**Role:** utility, transform
**Analog:** self (lines 1–55 as read)

**Return type — extend with new variant** (line 12):
```typescript
// Phase 2:
export type FileValidationError = 'unsupported-type' | 'too-large' | null

// Phase 3 — add 'word-doc' BEFORE 'unsupported-type' in check order:
export type FileValidationError = 'unsupported-type' | 'too-large' | 'word-doc' | null
```

**Word MIME/extension constants — add after ALLOWED_MIMES** (lines 18–25):
```typescript
const WORD_MIMES = new Set([
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])
const WORD_EXTENSIONS = new Set(['.doc', '.docx'])
```

**Validation order in validateFile — insert BEFORE the general unsupported-type check** (between lines 40 and 41):
```typescript
// Existing: size check (line 37–39)
// NEW: Word doc check BEFORE generic unsupported-type:
const ext = lastDot >= 0 ? file.name.slice(lastDot).toLowerCase() : ''
if (WORD_MIMES.has(file.type) || WORD_EXTENSIONS.has(ext)) {
  return 'word-doc'
}
// Then: existing MIME check (line 41)
// Then: existing extension check (line 47)
```

**UploadZone routing — new branch in handleFile** following the existing if/else pattern (lines 45–56):
```typescript
if (validationError === 'word-doc') {
  setError(
    'Word documents cannot be opened directly. To sign this file, export it as a PDF first (File → Export → PDF), then open the PDF here.',
  )
  return
}
```

---

## Tests — Extend Existing Files

### `src/test/fieldStore.test.ts` — add undo/redo + new field types

**Analog:** self (lines 1–191 as read)

**makeField helper — extend overrides to support new optional fields** (lines 5–17):
```typescript
function makeField(overrides: Partial<PlacedField> = {}): PlacedField {
  return {
    id: crypto.randomUUID(),
    type: 'signature',
    pageNumber: 1,
    pdfX: 10, pdfY: 20, pdfWidth: 100, pdfHeight: 30,
    dataUrl: 'data:image/png;base64,abc',
    ...overrides,
  }
}
// Usage for new types:
makeField({ type: 'text', dataUrl: undefined, textValue: 'hello' })
makeField({ type: 'checkbox', dataUrl: undefined })
makeField({ type: 'date', dataUrl: undefined, textValue: '6/17/2026' })
```

**beforeEach reset pattern** (line 29–31) — unchanged; resetFields now also clears history:
```typescript
beforeEach(() => {
  useFieldStore.getState().resetFields()
})
```

**Undo/redo test pattern — follow addField test style** (lines 36–52):
```typescript
it('pushHistory + undo reverts fields to prior state', () => {
  const store = useFieldStore.getState()
  store.addField(makeField({ id: 'f1' }))    // addField should push history internally
  store.undo()
  expect(useFieldStore.getState().fields).toHaveLength(0)
})

it('pushHistory + redo re-applies the undone action', () => {
  const store = useFieldStore.getState()
  store.addField(makeField({ id: 'f1' }))
  store.undo()
  store.redo()
  expect(useFieldStore.getState().fields).toHaveLength(1)
})

it('history cap: 51 pushes results in MAX_HISTORY (50) entries', () => {
  const store = useFieldStore.getState()
  for (let i = 0; i < 51; i++) {
    store.pushHistory()
  }
  expect(useFieldStore.getState().history.length).toBeLessThanOrEqual(50)
})
```

### `src/test/exportPdf.test.ts` — add text/checkbox EXP-02 cases

**Analog:** self (lines 1–155 as read)

**Field fixture style — copy from lines 44–55, no dataUrl for text/checkbox:**
```typescript
it('text field export: first 512 bytes byte-identical to input (EXP-02)', async () => {
  const field: PlacedField = {
    id: 'text-1', type: 'text', pageNumber: 1,
    pdfX: 50, pdfY: 50, pdfWidth: 100, pdfHeight: 20,
    textValue: 'Hello World',
  }
  const output = await exportSignedPdf(INPUT_BYTES.buffer as ArrayBuffer, [field])
  const inputFirst512  = Array.from(INPUT_BYTES.slice(0, 512))
  const outputFirst512 = Array.from(output.slice(0, 512))
  expect(outputFirst512).toEqual(inputFirst512)
})
```

**Rejection test pattern** (lines 86–100) — extend for the new type-gated guard:
```typescript
it('rejects non-image field with a dataUrl (signature type) when dataUrl is invalid', async () => {
  // Existing behavior preserved; image guard is now inside the loop
})
// Text/checkbox fields with no dataUrl must NOT throw — no guard applies:
it('does not throw for checkbox field (no dataUrl required)', async () => {
  // ...
})
```

### `src/test/fileValidation.test.ts` — add Word-doc cases

**Analog:** self (lines 1–101 as read)

**makeFile helper pattern** (lines 7–14) — already supports arbitrary MIME + name:
```typescript
it('rejects .docx with correct MIME → word-doc (not unsupported-type)', () => {
  expect(
    validateFile(makeFile('report.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'))
  ).toBe('word-doc')
})

it('rejects .doc with application/msword → word-doc', () => {
  expect(validateFile(makeFile('contract.doc', 'application/msword'))).toBe('word-doc')
})

it('rejects .docx by extension even if MIME is application/zip (browser quirk)', () => {
  expect(validateFile(makeFile('report.docx', 'application/zip'))).toBe('word-doc')
})
```

---

## Shared Patterns

### Zustand Immutable Updates
**Source:** `src/store/fieldStore.ts` lines 88–113
**Apply to:** all new store actions in fieldStore.ts and documentStore.ts
- Arrays: always spread `[...state.fields, ...]` or `state.fields.map(...)` / `.filter(...)`
- Maps: always `new Map(state.pageDimensions)` before mutating
- Never mutate state in-place

### aria-disabled (not HTML disabled)
**Source:** `src/components/PageNavigation.tsx` lines 77–78; `src/components/TopBar.tsx` lines 113–114
**Apply to:** FieldPalette buttons, ZoomControl buttons, UndoRedoControls buttons
```typescript
aria-disabled={isDisabled ? 'true' : undefined}
// NOT: disabled={true}
cursor: isDisabled ? 'default' : 'pointer',
opacity: isDisabled ? 0.35 : 1,
```

### Focus Ring Pattern
**Source:** `src/components/TopBar.tsx` lines 98–105; `src/components/PageNavigation.tsx` lines 96–101
**Apply to:** every interactive button in new components
```typescript
onFocus={(e) => {
  e.currentTarget.style.outline = '2px solid var(--color-accent)'
  e.currentTarget.style.outlineOffset = '2px'
}}
onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
```

### Keyboard Guard (INPUT/TEXTAREA/contentEditable)
**Source:** `src/components/DocumentViewer.tsx` lines 68–72
**Apply to:** UndoRedoControls keyboard handler (undo/redo); extend the Delete/Backspace handler rather than adding a second `addEventListener`
```typescript
const target = e.target as HTMLElement | null
if (target) {
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return
  if (target.isContentEditable) return
}
```

### PDF-Space Coordinate Storage
**Source:** `src/components/LazyPage.tsx` lines 128–138; `src/lib/coordinateMapper.ts`
**Apply to:** all new field types in handleOverlayClick
- Store `pdfX`, `pdfY`, `pdfWidth`, `pdfHeight` in PDF user-space points (bottom-left origin)
- Divide CSS pixel sizes by `effectiveScale` (NOT `dims.scale`) to get PDF-space sizes
- Use `cssPixelToPageSpace` for CSS→PDF; `pageSpaceToCssPixel` for PDF→CSS

### EXP-02 Incremental-Save Concat
**Source:** `src/lib/exportPdf.ts` lines 39–88
**Apply to:** all new field types in the export loop
- `takeSnapshot()` before any draw
- `markRefForSave(page.ref)` BEFORE `drawImage`/`drawText` on that page
- `saveIncremental(snapshot)` then concat: `result.set(srcBytes, 0); result.set(incrementalBytes, srcBytes.length)`

### CSS Token Usage
**Source:** `src/index.css` `:root` (tokens already defined); `src/components/TopBar.tsx` throughout
**Apply to:** all new Phase 3 components
```
--color-surface-elevated  → pill/modal backgrounds
--color-accent            → armed state, focus rings, primary buttons
--color-destructive       → delete controls
--color-text-primary      → labels, readouts
--color-text-secondary    → ghost buttons, inactive states
--color-border            → separators, disabled states
```

---

## No Analog Found

All Phase 3 files have strong analogs. No file requires novel pattern discovery.

| File | Role | Closest Pattern Source |
|------|------|----------------------|
| `src/components/InitialsDrawModal.tsx` | component | `src/components/SignatureDrawModal.tsx` — read before writing; near-identical copy |

---

## Metadata

**Analog search scope:** `src/store/`, `src/components/`, `src/lib/`, `src/test/`
**Files read:** 13 source files
**Pattern extraction date:** 2026-06-17
**Key constraint:** ASCII `'X'` in PDF export for checkbox; `✕` (U+2715) on-screen only — WinAnsi encoding throws at runtime otherwise (RESEARCH verified)
**Key constraint:** `effectiveScale = dims.scale * zoom` must be used everywhere — never `dims.scale` alone when zoom ≠ 1.0
**Key constraint:** embed Helvetica + HelveticaBold ONCE before the field loop, not per field
