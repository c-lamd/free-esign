# Phase 4: Typed Signatures + Signature Persistence — Pattern Map

**Mapped:** 2026-06-17
**Files analyzed:** 13 new/modified files
**Analogs found:** 13 / 13 (all files have usable analog patterns in-codebase)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/store/fieldStore.ts` (MODIFY) | store | CRUD + event-driven | `src/store/fieldStore.ts` itself | self (extend in-place) |
| `src/lib/savedSignatures.ts` (NEW) | utility / persistence | CRUD + async I/O | `src/lib/exportPdf.ts` (module-level cache + async helper pattern) | role-match |
| `src/lib/fonts.ts` (NEW) | utility / asset-loader | async I/O + cache | `src/lib/exportPdf.ts` (module-level Map cache, same-origin fetch pattern) | role-match |
| `src/lib/exportPdf.ts` (MODIFY) | utility / export | batch transform | `src/lib/exportPdf.ts` itself — extend `hasTextFields` gate and per-field loop | self (extend in-place) |
| `src/components/SignatureDrawModal.tsx` (MODIFY) | component / modal | request-response | `src/components/SignatureDrawModal.tsx` itself + ARIA tab pattern | self (extend in-place) |
| `src/components/InitialsDrawModal.tsx` (MODIFY) | component / modal | request-response | `src/components/SignatureDrawModal.tsx` (identical structure) | exact |
| `src/components/SavedItemCard.tsx` (NEW) | component / display | event-driven | `src/components/PlacedFieldWidget.tsx` (delete button pattern, `aria-label` + sr-only, destructive hover) | role-match |
| `src/components/PlacedFieldWidget.tsx` (MODIFY) | component / display | event-driven | `src/components/PlacedFieldWidget.tsx` itself — add font-backed branch | self (extend in-place) |
| `src/components/LazyPage.tsx` (MODIFY) | component / controller | event-driven | `src/components/LazyPage.tsx` itself — extend `handleOverlayClick` | self (extend in-place) |
| `src/App.tsx` (MODIFY) | app root | event-driven | `src/App.tsx` itself — no `useEffect` yet; see documentStore for pattern | self |
| `src/index.css` (MODIFY) | config / styles | — | `src/index.css` `:root` token block | self (extend in-place) |
| `public/fonts/*.ttf + *-LICENSE.txt` (NEW) | static asset | — | `public/standard_fonts/` (existing vendored PDF standard fonts) | structural-match |
| `src/test/savedItems.test.ts` (NEW) | test | CRUD | `src/test/fieldStore.test.ts` (Zustand action tests + `beforeEach` reset) | exact |

---

## Pattern Assignments

---

### `src/store/fieldStore.ts` (MODIFY — store, CRUD)

**Analog:** `src/store/fieldStore.ts` lines 27–38, 74–114, 137–239

**What changes:** Add `fontFamily?` to `PlacedField`; add `SavedItem` export interface; add `savedItems`, `armedTypedPayload` to `FieldStore`; add `setArmedTypedPayload`, `loadSavedItems`, `addSavedItem`, `deleteSavedItem` actions.

**Existing PlacedField interface pattern** (lines 27–38) — add `fontFamily?` here:
```typescript
export interface PlacedField {
  id: string
  type: FieldType
  pageNumber: number
  pdfX: number; pdfY: number; pdfWidth: number; pdfHeight: number
  dataUrl?: string        // image types only (signature, initials)
  textValue?: string      // date, text, AND typed signature/initials text
  fontFamily?: string     // NEW Phase 4: typed signature/initials only
  role?: string           // v2 multi-party seam (MP-01)
}
```

**Existing simple set-action pattern** (lines 143–145) — copy for `setArmedTypedPayload`:
```typescript
setArmedFieldType: (armedFieldType) => set({ armedFieldType }),
// → copy as:
setArmedTypedPayload: (armedTypedPayload) => set({ armedTypedPayload }),
```

**Existing async-action pattern** — there is none yet. Model on `addField` (lines 168–177) for immutable state updates, but wrap in async and call idb-keyval before `set()`:
```typescript
// Existing synchronous addField pattern (lines 168–177):
addField: (field) =>
  set((state) => {
    const newFields = [...state.fields, field]
    const [newHistory, newIndex] = appendSnapshot(state.history, state.historyIndex, [...newFields])
    return { fields: newFields, history: newHistory, historyIndex: newIndex }
  }),

// Phase 4 async variant pattern for addSavedItem:
// NOTE: Zustand set() is synchronous — async actions must be declared as
// regular async functions (not arrow functions passed to set).
// Pattern: do the I/O outside set(), then call set() with the result.
addSavedItem: async (item) => {
  // 1. Optimistic update: prepend to state immediately
  // 2. Persist to IndexedDB
  // 3. If persist fails, show non-blocking error (see CONTEXT area 3)
},
```

**Critical constraints:**
- `fontFamily?` is optional — all existing `PlacedField` spreads still compile without change.
- `armedTypedPayload` must be cleared (`setArmedTypedPayload(null)` AND `setArmedFieldType(null)`) after each typed field drop — same as the existing `setArmedFieldType(null)` at LazyPage line 199.
- `savedItems` initial state = `[]` (IndexedDB hydrated on mount via `loadSavedItems`).
- Immutable update pattern: `[...savedItems, item]` — never `push()`.

---

### `src/lib/savedSignatures.ts` (NEW — utility, CRUD + async I/O)

**Analog:** `src/lib/exportPdf.ts` — module-level constant, async function with try/catch, pure utility with no React imports.

**Module-level constant pattern** (exportPdf.ts line 31):
```typescript
const PNG_DATA_URL_PREFIX = 'data:image/png;base64,'
// → copy style for:
const IDB_KEY = 'savedSignatureItems'
```

**Async function with typed return** (exportPdf.ts lines 122–125):
```typescript
export async function exportSignedPdf(
  originalPdfBytes: ArrayBuffer,
  fields: PlacedField[],
): Promise<Uint8Array> {
```
Copy this signature style for `loadAll`, `addItem`, `deleteItem`.

**Full idb-keyval API pattern** (from RESEARCH.md Pattern 4):
```typescript
import { get, set } from 'idb-keyval'

const IDB_KEY = 'savedSignatureItems'

export async function loadAll(): Promise<SavedItem[]> {
  return (await get<SavedItem[]>(IDB_KEY)) ?? []
}

export async function addItem(item: SavedItem): Promise<void> {
  const current = await loadAll()
  await set(IDB_KEY, [item, ...current])  // prepend — newest-first
}

export async function deleteItem(id: string): Promise<void> {
  const current = await loadAll()
  await set(IDB_KEY, current.filter((i) => i.id !== id))
}
```

**Critical constraints:**
- Export `SavedItem` type from `fieldStore.ts` — do NOT redefine it here.
- This module is mocked in tests: `vi.mock('idb-keyval', () => ({ get: vi.fn()..., set: vi.fn()... }))`.
- No React imports — this is a pure I/O utility.

---

### `src/lib/fonts.ts` (NEW — utility, async I/O + cache)

**Analog:** `src/lib/exportPdf.ts` — module-level Map cache (`fontBytesCache`) pattern from RESEARCH.md Pattern 3. The `hasTextFields` guard (lines 134–140) shows the "embed once, guarded" pattern.

**Module-level Map cache pattern** (from RESEARCH.md Pattern 3, modeled on exportPdf module-level const):
```typescript
// FONT_FILE_MAP is a static allowlist — security guard against path traversal
// (RESEARCH Security section: unknown keys throw before fetch is called)
const FONT_FILE_MAP: Record<string, string> = {
  'Dancing Script': '/fonts/DancingScript-Regular.ttf',
  'Great Vibes':    '/fonts/GreatVibes-Regular.ttf',
  'Pacifico':       '/fonts/Pacifico-Regular.ttf',
}

// Module-level cache — NOT React state; avoids re-renders on repeated exports
const fontBytesCache = new Map<string, Uint8Array>()

export async function loadFontBytes(fontFamily: string): Promise<Uint8Array> {
  if (fontBytesCache.has(fontFamily)) return fontBytesCache.get(fontFamily)!
  const path = FONT_FILE_MAP[fontFamily]
  if (!path) throw new Error(`Unknown font family: "${fontFamily}"`)
  const bytes = new Uint8Array(await fetch(path).then((r) => r.arrayBuffer()))
  fontBytesCache.set(fontFamily, bytes)
  return bytes
}
```

**Critical constraints:**
- `FONT_FILE_MAP` allowlist check MUST throw before `fetch()` is called (security: PRV-02 + path traversal).
- `fetch('/fonts/Font.ttf')` — same-origin, NOT `import ... ?url` (CONTEXT area 5 locked decision).
- Cache is module-level `let` / `Map`, not React state — avoids re-renders.
- In tests: mock `globalThis.fetch` to return a minimal ArrayBuffer rather than hitting the network.

---

### `src/lib/exportPdf.ts` (MODIFY — utility, batch transform)

**Analog:** `src/lib/exportPdf.ts` itself — the existing `hasTextFields` gate (lines 134–140), `drawTextInBox` helper (lines 69–85), `drawCheckboxX` helper (lines 97–110), and per-field loop (lines 142–179).

**Existing `hasTextFields` gate pattern** (lines 134–140) — copy for `hasFontBackedFields`:
```typescript
const hasTextFields = fields.some(
  (f) => f.type === 'date' || f.type === 'text' || f.type === 'checkbox',
)
const helvetica = hasTextFields ? await pdfDoc.embedFont(StandardFonts.Helvetica) : null
const helveticaBold = hasTextFields
  ? await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  : null
```
New gate (add immediately after the existing one):
```typescript
const hasFontBackedFields = fields.some(
  (f) => (f.type === 'signature' || f.type === 'initials') && !!f.textValue && !!f.fontFamily,
)

if (hasFontBackedFields) {
  pdfDoc.registerFontkit(fontkit)  // MUST be called before embedFont for custom TTFs
}

// Embed each unique font family once — deduplication via Map
// (embedding 5× the same font wastes space — RESEARCH Pitfall: embedFont in loop)
const embeddedFonts = new Map<string, PDFFont>()
if (hasFontBackedFields) {
  for (const field of fields) {
    if (field.fontFamily && !embeddedFonts.has(field.fontFamily)) {
      const ttfBytes = await loadFontBytes(field.fontFamily)
      const pdfFont = await pdfDoc.embedFont(ttfBytes, { subset: true })
      embeddedFonts.set(field.fontFamily, pdfFont)
    }
  }
}
```

**Existing `drawTextInBox` sizing pattern** (lines 69–85) — `drawSignatureText` uses the SAME `font.sizeAtHeight` / `font.widthOfTextAtSize` / `font.heightAtSize` methods but does NOT truncate:
```typescript
// Existing truncating pattern (lines 71–84):
const targetSize = font.sizeAtHeight(field.pdfHeight * 0.75)
const glyphH = font.heightAtSize(targetSize)
const baselineY = field.pdfY + (field.pdfHeight - glyphH) / 2
const maxWidth = field.pdfWidth - 2
const visibleText = truncateToFit(text, font, targetSize, maxWidth)  // TRUNCATES

// New fit-to-box pattern for drawSignatureText (NO truncation — CONTEXT area 2):
function drawSignatureText(page: PDFPage, text: string, font: PDFFont, field: PlacedField): void {
  if (!text) return
  const padding = 4
  const sizeFromHeight = font.sizeAtHeight(field.pdfHeight * 0.85)
  const textWidthAtTarget = font.widthOfTextAtSize(text, sizeFromHeight)
  const maxWidth = field.pdfWidth - padding
  const finalSize =
    textWidthAtTarget > maxWidth
      ? sizeFromHeight * (maxWidth / textWidthAtTarget)
      : sizeFromHeight
  const glyphH = font.heightAtSize(finalSize)
  const xOffset = (field.pdfWidth - font.widthOfTextAtSize(text, finalSize)) / 2
  const baselineY = field.pdfY + (field.pdfHeight - glyphH) / 2
  page.drawText(text, { x: field.pdfX + xOffset, y: baselineY, font, size: finalSize })
}
```

**Existing per-field loop branch pattern** (lines 153–178) — add font-backed branch after the existing image-backed branch:
```typescript
if (field.type === 'signature' || field.type === 'initials') {
  if (field.dataUrl) {
    // Existing image-backed path (lines 155–172) — UNCHANGED
    if (!field.dataUrl?.startsWith(PNG_DATA_URL_PREFIX)) { throw ... }
    ...
    page.drawImage(pngImage, { x, y, width, height })
  } else if (field.textValue && field.fontFamily) {
    // NEW font-backed path
    const pdfFont = embeddedFonts.get(field.fontFamily)!
    drawSignatureText(page, field.textValue, pdfFont, field)
  }
}
```

**Critical constraints:**
- `registerFontkit(fontkit)` MUST be called before `embedFont` — throws `FontkitNotRegisteredError` otherwise (RESEARCH Pitfall 1).
- Import `fontkit from '@pdf-lib/fontkit'` and `{ loadFontBytes } from './fonts'`.
- `{ subset: true }` on all custom font embeds — reduces exported file size.
- `drawSignatureText` must NOT truncate — that is the entire point; see CONTEXT area 2.
- EXP-02 unchanged: `saveIncremental → concat` path is not touched.

---

### `src/components/SignatureDrawModal.tsx` (MODIFY — component/modal, request-response)

**Analog:** `src/components/SignatureDrawModal.tsx` itself — the entire file is the pattern. Extend it; do not rewrite from scratch.

**Existing modal shell pattern** (lines 152–172) — scrim + dialog styles are UNCHANGED:
```typescript
const scrimStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.45)', zIndex: 50,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}
const dialogStyle: React.CSSProperties = {
  background: 'var(--color-surface-elevated)', borderRadius: '12px', padding: '24px',
  width: 'calc(100vw - 32px)', maxWidth: '560px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
  outline: 'none',
}
```

**Existing focus-trap pattern** (lines 82–119) — extend the focusable query string to include `input, [role="radio"]` for the new tab panels:
```typescript
// Existing (line 95–96):
const allFocusable = dialog.querySelectorAll<HTMLElement>('button, canvas[tabindex="0"]')
// Phase 4 update:
const allFocusable = dialog.querySelectorAll<HTMLElement>(
  'button, canvas[tabindex="0"], input, [role="radio"]'
)
```

**Existing aria-disabled CTA pattern** (lines 344–371):
```typescript
<button
  aria-disabled={!hasStrokes ? 'true' : undefined}
  aria-label={!hasStrokes ? 'Add signature — draw a signature first' : 'Add signature'}
  style={{ ...accentButtonStyle, opacity: hasStrokes ? 1 : 0.45 }}
>
```
Copy for Type tab CTA: `aria-disabled={!typedText ? 'true' : undefined}` with `opacity: typedText ? 1 : 0.45`.

**Existing trigger-focus-restore pattern** (lines 139–146):
```typescript
function handleClose() {
  closeModal()
  if (triggerRef.current && 'focus' in triggerRef.current) {
    ;(triggerRef.current as HTMLElement).focus()
  }
  triggerRef.current = null
}
```
Unchanged — keep this exactly.

**New tab bar pattern** (ARIA tab widget from RESEARCH.md Pattern 7):
```typescript
// Tab bar — add between <h2> title and panel content:
<div role="tablist" aria-label="Signature creation methods">
  {(['saved', 'draw', 'type'] as const).map((tab, idx) => (
    <button
      key={tab}
      role="tab"
      id={`sig-tab-${tab}`}
      aria-controls={`sig-panel-${tab}`}
      aria-selected={activeTab === tab}
      tabIndex={activeTab === tab ? 0 : -1}  // roving tabindex
      onClick={() => setActiveTab(tab)}
      onKeyDown={(e) => handleTabKeyDown(e, idx)}
      style={{
        background: 'none', border: 'none',
        borderBottom: activeTab === tab ? '2px solid var(--color-accent)' : '2px solid transparent',
        color: activeTab === tab ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
        fontSize: '14px', fontWeight: 400, padding: '8px 16px',
        minHeight: '44px', cursor: 'pointer', fontFamily: 'inherit',
      }}
    >
      {tab === 'saved' ? 'Saved' : tab === 'draw' ? 'Draw' : 'Type'}
    </button>
  ))}
</div>
```

**"Save for reuse" checkbox pattern** (new, follows existing `input::placeholder` CSS convention from index.css):
```typescript
// Controlled boolean local state, default true (CONTEXT area 3)
const [saveForReuse, setSaveForReuse] = useState(true)

<div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', minHeight: '44px' }}>
  <input
    id="save-for-reuse"
    type="checkbox"
    checked={saveForReuse}
    onChange={(e) => setSaveForReuse(e.target.checked)}
  />
  <label htmlFor="save-for-reuse" style={{ fontSize: '14px', color: 'var(--color-text-primary)', cursor: 'pointer' }}>
    Save for reuse
  </label>
</div>
```

**Critical constraints:**
- Draw tab content (canvas, Clear canvas, Discard, CTA) is UNCHANGED from Phase 2.
- `handleAddSignature` (Phase 2 name) becomes "Use signature" copy (CONTEXT area 1 copywriting).
- On Type tab confirm: call `setArmedTypedPayload({ text, fontFamily, kind: 'signature' })` + `setArmedFieldType('signature')` + `handleClose()`.
- On Saved tab confirm: arm with the selected saved item's payload (dataUrl OR text+fontFamily).
- If `saveForReuse` is checked: call `addSavedItem(item)` before closing — failure is non-blocking (see CONTEXT area 3 error copy).

---

### `src/components/InitialsDrawModal.tsx` (MODIFY — component/modal, request-response)

**Analog:** `src/components/SignatureDrawModal.tsx` — identical structure. Every pattern from SignatureDrawModal applies 1-for-1.

Differences from SignatureDrawModal:
- Modal title: `"Create initials"`
- Input placeholder: `"Your initials"`
- Input `aria-label`: `"Your initials for signature"`
- Confirm action: `setArmedTypedPayload({ ..., kind: 'initials' })` + `setArmedFieldType('initials')`
- Saved panel filter: `savedItems.filter(i => i.kind === 'initials')`
- All "signature" copy strings → "initials"

See SignatureDrawModal pattern assignment above for all concrete excerpts — apply them verbatim, substituting 'initials' for 'signature' where indicated.

---

### `src/components/SavedItemCard.tsx` (NEW — component/display, event-driven)

**Analog:** `src/components/PlacedFieldWidget.tsx` — delete button pattern (lines 314–366), `stopPropagation` on delete click (line 125), destructive hover color `#B91C1C` (line 357), `aria-label` convention.

**Delete button pattern from PlacedFieldWidget** (lines 314–365) — scale down to 20px visual / 32px touch target:
```typescript
// Existing 24px delete button (PlacedFieldWidget.tsx lines 319–345):
style={{
  position: 'absolute', top: '-12px', right: '-12px',
  width: '24px', height: '24px',
  backgroundColor: 'var(--color-destructive)', color: 'white',
  border: 'none', borderRadius: '50%', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: '14px', fontWeight: 600,
}}

// SavedItemCard version — 20px visual, 4px padding → 28px touch (plus card border):
style={{
  position: 'absolute', top: '4px', right: '4px',
  width: '20px', height: '20px',
  backgroundColor: 'var(--color-destructive)', color: 'white',
  border: 'none', borderRadius: '50%', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: '12px', fontWeight: 600, padding: '6px',  // padding extends touch target
}}
```

**stopPropagation pattern** (PlacedFieldWidget.tsx line 125):
```typescript
function handleDeleteClick(e: React.MouseEvent) {
  e.stopPropagation()  // prevent card selection on delete
  deleteField(field.id)
}
// → copy as:
function handleDeleteClick(e: React.MouseEvent) {
  e.stopPropagation()  // prevent card activation on delete (UI-SPEC)
  onDelete(item.id)
}
```

**Hover + focus ring pattern** (PlacedFieldWidget.tsx lines 346–365) — copy exactly:
```typescript
onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#B91C1C' }}
onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-destructive)' }}
onFocus={(e) => { e.currentTarget.style.outline = '2px solid var(--color-accent)'; e.currentTarget.style.outlineOffset = '2px' }}
onBlur={(e) => { e.currentTarget.style.outline = 'none'; e.currentTarget.style.outlineOffset = '0' }}
```

**Card `role="radio"` pattern** (from UI-SPEC + RESEARCH Pattern 7):
```typescript
<div
  role="radio"
  aria-checked={isSelected}
  tabIndex={isSelected ? 0 : -1}   // roving tabindex same as tabs
  onClick={() => onSelect(item.id)}
  style={{
    position: 'relative', borderRadius: '8px', padding: '8px',
    cursor: 'pointer', minHeight: '80px',
    background: 'var(--color-surface)',
    border: isSelected ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
  }}
>
```

**Thumbnail content branch** (models on PlacedFieldWidget per-type content, lines 172–248):
```typescript
// Drawn item — image thumbnail:
{item.dataUrl && (
  <img src={item.dataUrl} alt="Saved signature"
    style={{ width: '100%', height: '56px', objectFit: 'contain', display: 'block' }} />
)}
// Typed item — text in script font:
{item.text && item.fontFamily && (
  <div style={{
    fontFamily: item.fontFamily, fontSize: '20px',
    color: 'var(--color-text-primary)', textAlign: 'center',
    height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  }}>
    {item.text}
  </div>
)}
// Caption:
<div style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
  {item.source === 'drawn' ? 'Drawn' : 'Typed'}
</div>
```

---

### `src/components/PlacedFieldWidget.tsx` (MODIFY — component/display, event-driven)

**Analog:** `src/components/PlacedFieldWidget.tsx` itself — the `checkbox` branch (lines 227–248) is the closest existing analog to the new font-backed display branch (computed fontSize, centered div, `pointerEvents: 'none'`).

**Existing checkbox computed-size branch** (lines 227–248) — copy shape for font-backed branch:
```typescript
} else if (field.type === 'checkbox') {
  const fontSize = Math.min(cssHeight * 0.7, cssWidth * 0.7)
  content = (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      width: '100%', height: '100%', fontSize,
      fontWeight: 700, color: 'var(--color-text-primary)',
      userSelect: 'none', pointerEvents: 'none',
    }}>
      ✕
    </div>
  )
}
```
New font-backed branch — add INSIDE the existing `signature || initials` block, branching on `field.dataUrl`:
```typescript
if (field.type === 'signature' || field.type === 'initials') {
  if (field.dataUrl) {
    // EXISTING drawn branch — unchanged (lines 174–189)
    content = <img src={field.dataUrl} ... />
  } else if (field.textValue && field.fontFamily) {
    // NEW font-backed branch (Phase 4)
    const fontSize = Math.min(
      cssHeight * 0.85,
      cssWidth / (field.textValue.length * 0.6 + 0.5),
    )
    content = (
      <div style={{
        width: '100%', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
        fontFamily: field.fontFamily,   // CSS @font-face name — same TTF as export (WYSIWYG)
        fontSize,
        color: 'var(--color-text-primary)',
        whiteSpace: 'nowrap',
        userSelect: 'none',
        pointerEvents: 'none',
      }}>
        {field.textValue}
      </div>
    )
  }
}
```

**`lockAspectRatio` fix** (line 254–255) — current code locks for all sig/initials:
```typescript
// Existing (line 254–255):
const shouldLockAspectRatio =
  field.type === 'signature' || field.type === 'initials' || field.type === 'checkbox'

// Phase 4 fix — lock only for image-backed (drawn) fields, not font-backed (RESEARCH Pitfall 2):
const shouldLockAspectRatio =
  ((field.type === 'signature' || field.type === 'initials') && !!field.dataUrl)
  || field.type === 'checkbox'
```

**ARIA label update** — update the `WRAPPER_ARIA_LABEL` constant (lines 60–66) to add typed-specific labels. Either extend the Record or add a runtime check for the typed case.

**Critical constraints:**
- `lockAspectRatio` change is a bug fix that was always needed once `fontFamily` exists — MUST land in the same task as the font-backed branch.
- `fontFamily: field.fontFamily` CSS value — if the @font-face declares `"Dancing Script"` (with quotes), the inline style must use the same string. React handles unquoted multi-word names correctly in `style` objects; browser resolves them.

---

### `src/components/LazyPage.tsx` (MODIFY — component/controller, event-driven)

**Analog:** `src/components/LazyPage.tsx` itself — the `handleOverlayClick` callback (lines 110–213) and the existing `armedFieldType === 'signature'` guard (line 114).

**Existing guard pattern** (lines 113–115) — add typed-payload guard alongside:
```typescript
// Existing:
if (armedFieldType === 'signature' && !signatureDataUrl) return
if (armedFieldType === 'initials' && !initialsDataUrl) return
// Phase 4 — typed fields need neither dataUrl check; armedTypedPayload being set is sufficient
```

**Existing image-aspect-ratio block** (lines 143–159) — skip this block for typed fields:
```typescript
// Existing: loads PNG via new Image() to get natural aspect ratio
// Phase 4: typed fields use fixed default 200×56px CSS (no image to load)
// Guard the existing block:
if ((armedFieldType === 'signature' || armedFieldType === 'initials') && !armedTypedPayload) {
  // existing aspectRatio computation — unchanged
}
```

**Existing `newField` construction** (lines 180–193) — add typed branch:
```typescript
// Existing spread pattern (lines 188–192):
...(armedFieldType === 'signature' ? { dataUrl: signatureDataUrl! } :
    armedFieldType === 'initials'  ? { dataUrl: initialsDataUrl! }  : {}),
...(textValue !== undefined ? { textValue } : {}),

// Phase 4 extension — typed payload branch replaces the dataUrl spreads:
// (evaluate BEFORE the existing spread; if armedTypedPayload is set, use it)
const isTyped = !!armedTypedPayload && (
  armedFieldType === 'signature' || armedFieldType === 'initials'
)
const fieldPayload = isTyped
  ? { textValue: armedTypedPayload!.text, fontFamily: armedTypedPayload!.fontFamily }
  : armedFieldType === 'signature' ? { dataUrl: signatureDataUrl! }
  : armedFieldType === 'initials'  ? { dataUrl: initialsDataUrl! }
  : {}
```

**Default size for typed** — replace the existing `{ w: 180, h: 60 }` / `{ w: 80, h: 40 }` values for sig/initials when typed:
```typescript
// Typed default: 200×56px CSS (UI-SPEC PlacedFieldWidget section)
// Drawn default: existing values + aspect ratio correction (unchanged)
const defaults: Record<FieldType, { w: number; h: number }> = {
  signature: isTyped ? { w: 200, h: 56 } : { w: 180, h: 60 },
  initials:  isTyped ? { w: 200, h: 56 } : { w: 80,  h: 40 },
  // ... other types unchanged
}
```

**Existing disarm pattern** (line 199) — extend to clear both states:
```typescript
// Existing (line 199):
setArmedFieldType(null)

// Phase 4: also clear typed payload
setArmedTypedPayload(null)
setArmedFieldType(null)
```

**Existing `useCallback` dependency array** (lines 202–213) — add `armedTypedPayload` and `setArmedTypedPayload` to the deps.

---

### `src/App.tsx` (MODIFY — app root, event-driven)

**Analog:** `src/App.tsx` itself — currently has no `useEffect`. Closest behavioral analog is the existing `useDocumentStore` subscription pattern (line 2).

**Existing store subscription pattern** (App.tsx line 2):
```typescript
const view = useDocumentStore((s) => s.view)
```

**New `useEffect` hydration pattern** (from RESEARCH.md Pattern 4 — App mount initialization):
```typescript
import { useEffect } from 'react'
import { useFieldStore } from './store/fieldStore'

// Inside App():
const loadSavedItems = useFieldStore((s) => s.loadSavedItems)
useEffect(() => {
  loadSavedItems()
}, [loadSavedItems])
```

This is a one-time side effect on mount (empty deps on `loadSavedItems` which is a stable Zustand selector). It populates `savedItems` from IndexedDB before the user first opens the signature modal.

**Critical constraint:** `loadSavedItems` must be stable (not recreated on re-renders) — Zustand action selectors are stable by default. The dep array `[loadSavedItems]` is correct and will only fire once.

---

### `src/index.css` (MODIFY — config/styles)

**Analog:** `src/index.css` itself — the existing `:root` token block (lines 3–12) and `.sr-only` class (lines 14–21).

**Existing @import + :root pattern** (lines 1–12):
```css
@import "tailwindcss";

:root {
  --color-surface: #F9FAFB;
  /* ... 7 tokens ... */
}
```

**New @font-face declarations** — add after the existing `:root` block, before `.sr-only`:
```css
@font-face {
  font-family: "Dancing Script";
  src: url("/fonts/DancingScript-Regular.ttf") format("truetype");
  font-weight: 400;
  font-style: normal;
  font-display: block;   /* block prevents FOUT on signature preview — NOT swap */
}

@font-face {
  font-family: "Great Vibes";
  src: url("/fonts/GreatVibes-Regular.ttf") format("truetype");
  font-weight: 400;
  font-style: normal;
  font-display: block;
}

@font-face {
  font-family: "Pacifico";
  src: url("/fonts/Pacifico-Regular.ttf") format("truetype");
  font-weight: 400;
  font-style: normal;
  font-display: block;
}
```

**Critical constraints:**
- `font-display: block` — NOT `swap`. `swap` causes FOUT (flash of unstyled text) in the signature preview, which is especially visually jarring (RESEARCH anti-patterns section).
- The `font-family` string must exactly match what the widget uses in inline `style={{ fontFamily: ... }}`.
- No new CSS custom properties are added — all color tokens already exist (UI-SPEC).

---

### `public/fonts/*.ttf + *-LICENSE.txt` (NEW — static assets)

**Analog:** `public/` directory structure (existing `public/standard_fonts/`, `public/cmaps/`, pdfjs worker `public/pdf.worker.min.mjs`).

Vendored assets follow the existing pattern of placing static binary files in `public/` subdirectories with accompanying license files.

**File layout to mirror:**
```
public/
  fonts/
    DancingScript-Regular.ttf
    DancingScript-LICENSE.txt     # SIL OFL
    GreatVibes-Regular.ttf
    GreatVibes-LICENSE.txt        # SIL OFL
    Pacifico-Regular.ttf
    Pacifico-LICENSE.txt          # SIL OFL
```

Source: download from fonts.google.com, select each font, Download Family → extract `.ttf` file. License (`OFL.txt`) is included in the zip.

**Critical constraint:** Files in `public/` are served at the root path — `/fonts/DancingScript-Regular.ttf` maps to `public/fonts/DancingScript-Regular.ttf`. This is the path used in both `@font-face src:` and `fetch('/fonts/...')`.

---

### `src/test/savedItems.test.ts` (NEW — test, CRUD)

**Analog:** `src/test/fieldStore.test.ts` — the `useFieldStore.getState()` + `beforeEach(resetFields)` pattern (lines 1–32); the immutable-update assertions (lines 44–50).

**Existing store test structure** (fieldStore.test.ts lines 1–50) — copy exactly:
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useFieldStore } from '../store/fieldStore'

// Mock idb-keyval BEFORE importing fieldStore — module-level mock
vi.mock('idb-keyval', () => ({
  get: vi.fn().mockResolvedValue(undefined),
  set: vi.fn().mockResolvedValue(undefined),
  del: vi.fn().mockResolvedValue(undefined),
}))

describe('savedItems slice', () => {
  beforeEach(() => {
    useFieldStore.getState().resetFields()   // same reset pattern as fieldStore.test.ts
    vi.clearAllMocks()
  })
  // ...
})
```

**Existing action assertion pattern** (fieldStore.test.ts lines 36–42):
```typescript
it('addField pushes a new field; fields.length increases to 1', () => {
  const store = useFieldStore.getState()
  const field = makeField({ id: 'f1' })
  store.addField(field)
  expect(useFieldStore.getState().fields).toHaveLength(1)
})
// → copy as async for addSavedItem:
it('addSavedItem adds item to savedItems state', async () => {
  const store = useFieldStore.getState()
  await store.addSavedItem(makeItem({ id: 'i1' }))
  expect(useFieldStore.getState().savedItems).toHaveLength(1)
})
```

**Critical constraints:**
- `vi.mock('idb-keyval', ...)` MUST appear at module level before any import that transitively imports idb-keyval — Vitest hoists `vi.mock` calls (RESEARCH Pitfall 4).
- The mock covers `fieldStore.test.ts` too once `fieldStore.ts` imports idb-keyval indirectly — add the mock to `fieldStore.test.ts` as well (or add it to `src/test/setup.ts` globally).
- Test EXP-02 for typed-sig export: use the same `INPUT_BYTES.buffer as ArrayBuffer` pattern from `exportPdf.test.ts` line 56, and mock `globalThis.fetch` to return a minimal valid ArrayBuffer for the font fetch.

---

### Test extensions — `exportPdf.test.ts` + `signatureDraw.test.ts` + `fieldStore.test.ts`

**Analog:** All three existing test files — follow their exact structure.

**exportPdf.test.ts — mock fetch for font bytes** (models on existing `URL.createObjectURL` stub, lines 22–38):
```typescript
// Add in beforeAll alongside existing URL stubs:
const MINIMAL_TTF_BYTES = new Uint8Array([0, 1, 0, 0])  // placeholder — not parsed by export test
vi.spyOn(globalThis, 'fetch').mockResolvedValue({
  arrayBuffer: () => Promise.resolve(MINIMAL_TTF_BYTES.buffer),
} as unknown as Response)
```

**signatureDraw.test.ts — Type tab render test** (models on existing modal render + `fireEvent` pattern in that file):
```typescript
// New describe block after existing ones:
describe('Type tab', () => {
  it('CTA is aria-disabled when input is empty', () => {
    // render modal, click Type tab, check aria-disabled on "Use signature"
  })
  it('CTA is enabled when text is present', () => {
    // render modal, click Type tab, type in input, check aria-disabled is gone
  })
})
```

---

## Shared Patterns

### Immutable Zustand state update
**Source:** `src/store/fieldStore.ts` lines 168–177, 179–182
**Apply to:** All `fieldStore.ts` action additions (Phase 4 saved-items actions)
```typescript
// Always spread existing arrays, never mutate in-place:
addField: (field) => set((state) => ({ fields: [...state.fields, field] }))
// → savedItems equivalent:
// set((state) => ({ savedItems: [item, ...state.savedItems] }))
```

### aria-disabled (not HTML disabled)
**Source:** `src/components/SignatureDrawModal.tsx` line 344; `src/components/PlacedFieldWidget.tsx` WRAPPER_ARIA_LABEL pattern
**Apply to:** All CTA buttons in Type tab, Saved tab, Draw tab across both modals; SavedItemCard delete
```typescript
aria-disabled={!hasStrokes ? 'true' : undefined}
// NOT: disabled={!hasStrokes}
// Reason: HTML disabled removes button from focus order; aria-disabled keeps it focusable (UI-SPEC)
```

### Focus ring on interactive elements
**Source:** `src/components/SignatureDrawModal.tsx` lines 307–311 (onFocus/onBlur handlers)
**Apply to:** All new interactive elements (tab buttons, font-option cards, SavedItemCard, "Save for reuse" checkbox)
```typescript
onFocus={(e) => { e.currentTarget.style.outline = '2px solid var(--color-accent)'; e.currentTarget.style.outlineOffset = '2px' }}
onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
```

### Destructive delete button hover color
**Source:** `src/components/PlacedFieldWidget.tsx` line 357
**Apply to:** SavedItemCard delete button
```typescript
onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#B91C1C' }}    // red-700
onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-destructive)' }}
```

### `crypto.randomUUID()` for IDs
**Source:** `src/components/LazyPage.tsx` line 181; `src/test/fieldStore.test.ts` line 7
**Apply to:** `SavedItem.id` generation in `addSavedItem` action
```typescript
id: crypto.randomUUID()
```

### PDF-space coordinate storage
**Source:** `src/components/LazyPage.tsx` lines 167–193 (the entire `newField` construction block)
**Apply to:** Font-backed field placement in `handleOverlayClick` Phase 4 extension
```typescript
// All coordinates stored as PDF-space points (bottom-left origin).
// CSS → PDF conversion via cssPixelToPageSpace() — no manual Y-flip.
pdfX:     pdfBottomLeft.x,
pdfY:     pdfBottomLeft.y,
pdfWidth:  defaultWidthPx  / effectiveScale,
pdfHeight: defaultHeightPx / effectiveScale,
```

### EXP-02 incremental concat
**Source:** `src/lib/exportPdf.ts` lines 182–189
**Apply to:** Phase 4 export path is unchanged — the new `drawSignatureText` call and `embedFont` calls are additions to the existing loop; the `saveIncremental → concat` path at the end is NOT touched.
```typescript
const incrementalBytes = await pdfDoc.saveIncremental(snapshot)
const result = new Uint8Array(srcBytes.length + incrementalBytes.length)
result.set(srcBytes, 0)
result.set(incrementalBytes, srcBytes.length)
return result
```

---

## Critical Phase 4 Constraints (must be checked at each task)

| Constraint | Source | Where enforced |
|------------|--------|----------------|
| `registerFontkit` BEFORE `embedFont` | RESEARCH Pitfall 1 | `exportPdf.ts` — hasFontBackedFields gate |
| `drawSignatureText` must NOT truncate | CONTEXT area 2 | `exportPdf.ts` — new helper, no `truncateToFit` call |
| `lockAspectRatio` by dataUrl presence, not type | RESEARCH Pitfall 2 | `PlacedFieldWidget.tsx` line 254 |
| `font-display: block` not `swap` | RESEARCH anti-patterns | `index.css` @font-face |
| `vi.mock('idb-keyval')` in tests that import savedItems code | RESEARCH Pitfall 4 | All test files touching fieldStore after Phase 4 |
| Font fetch mock in exportPdf tests | RESEARCH Pitfall 7 | `exportPdf.test.ts` beforeAll |
| Clear BOTH `armedTypedPayload` AND `armedFieldType` after drop | RESEARCH Pitfall 6 | `LazyPage.tsx` handleOverlayClick |
| `FONT_FILE_MAP` allowlist check before `fetch()` | RESEARCH Security | `fonts.ts` loadFontBytes |
| Self-hosted fonts only — zero third-party requests | CONTEXT area 5 | `index.css`, `fonts.ts`, `public/fonts/` |
| EXP-02 byte-identity preserved with font embedding | CONTEXT area 2 | `exportPdf.ts` — concat path unchanged |

---

## No Analog Found

None — all Phase 4 files have usable in-codebase analog patterns. Files without a direct analog (e.g., `savedSignatures.ts`, `fonts.ts`, `SavedItemCard.tsx`) have close role-match analogs in `exportPdf.ts` and `PlacedFieldWidget.tsx` respectively.

---

## Metadata

**Analog search scope:** `src/store/`, `src/lib/`, `src/components/`, `src/test/`, `src/index.css`, `src/App.tsx`, `public/`
**Files read:** 10 source files (fieldStore.ts, exportPdf.ts, SignatureDrawModal.tsx, PlacedFieldWidget.tsx, LazyPage.tsx, App.tsx, index.css, exportPdf.test.ts, signatureDraw.test.ts, fieldStore.test.ts)
**Pattern extraction date:** 2026-06-17
