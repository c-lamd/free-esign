# Phase 4: Typed Signatures + Signature Persistence — Research

**Researched:** 2026-06-17
**Domain:** PDF font embedding (@pdf-lib/fontkit), IndexedDB persistence (idb-keyval), typed signature UX, ARIA tab widget
**Confidence:** HIGH (core stack verified against installed source; API signatures confirmed from node_modules type declarations and JS source)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Area 1: Typed Signature / Initials Creation UX**
- Unified modal with tabs: Saved · Draw · Type. Same pattern for initials modal.
- Type tab: text input ("Your name") + font picker (3 fonts: Dancing Script, Great Vibes, Pacifico). Live preview. Confirm arms placement.
- At least 3 fonts, SIL OFL, self-hosted — no CDN.
- Initials: identical tabbed modal ("Draw your initials" / "Type"), drawn OR typed, saved.

**Area 2: Typed Signature Representation & Export**
- Reuse existing `FieldType` values `'signature'` and `'initials'` — no new field types.
- A field is image-backed (`dataUrl`) OR font-backed (`textValue` + `fontFamily`).
- Export = real embedded font, NOT rasterized PNG. Register `@pdf-lib/fontkit`, embed TTF (`subset: true`), call `drawText`.
- Font sizing: fit text to field box (fit to height, scale down to fit width) — no truncation.
- On-screen: text rendered in CSS `@font-face` script font — WYSIWYG with export.
- EXP-02 invariant unchanged: same `takeSnapshot → markRefForSave → saveIncremental → concat` path.

**Area 3: Persistence (IndexedDB via idb-keyval)**
- Storage: `idb-keyval` (not localStorage — 5 MB cap too fragile for PNG data URLs).
- Saved item shape: `{ id, kind: 'signature'|'initials', source: 'drawn'|'typed', dataUrl?, text?, fontFamily?, createdAt }`.
- Save on create: "Save for reuse" checkbox, checked by default. Persists to IndexedDB on confirm.
- Load on app mount: hydrate from IndexedDB once (SIG-04).
- Delete (SIG-05): removes from IndexedDB and from the list.

**Area 4: Saved Panel Entry Point & Placement**
- Saved tab inside the signature/initials modal is the panel.
- Lists saved items filtered to relevant kind.
- Clicking a saved item arms placement carrying its payload and closes the modal.

**Area 5: Fonts & Assets (self-hosted — PRV-02)**
- Vendor 3 TTFs into `public/fonts/` along with SIL OFL `LICENSE` files.
- Zero third-party network requests.
- On-screen: `@font-face` declarations in `src/index.css`.
- Export: load TTF bytes via `fetch('/fonts/Font.ttf').then(r => r.arrayBuffer())`.

### Claude's Discretion
- Exact tab styling and modal layout (follow Phase 1–3 conventions; reuse SignatureDrawModal structure).
- Whether font-backed widget uses fixed font-size with autosized box or fit-to-box scale (must visually match export).
- Precise font-loading mechanism for embedding (decided: same-origin `fetch` — see Area 5 above).
- Saved-item preview thumbnail rendering details and ordering (newest-first).
- idb-keyval key layout (single array key vs per-item keys).

### Deferred Ideas (OUT OF SCOPE)
- Upload a photo/scan of an existing handwritten signature → v2 (ENH-01).
- Additional fonts and signature ink-color options → v2 (ENH-04).
- Page-thumbnail sidebar, snap-to-align guides → v2 (ENH-02/03).
- Cross-device sync of saved signatures → out of scope (conflicts with privacy/browser-only model).
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SIG-02 | User can create a signature by typing it and choosing among several script fonts | Sections: Standard Stack (fontkit), Architecture Patterns (font-backed field), Code Examples (drawSignatureText), Pitfalls |
| SIG-03 | User can create reusable initials (drawn or typed) | Same as SIG-02 — identical tabbed modal, same export path, same store seam |
| SIG-04 | Saved signatures and initials persist in the browser across sessions (IndexedDB) | Sections: Standard Stack (idb-keyval), Architecture Patterns (savedSignaturesStore), Code Examples (idb-keyval API) |
| SIG-05 | User can view and delete their saved signatures and initials | Sections: Architecture Patterns (SavedItemCard), Code Examples (deleteSavedItem), Pitfalls |
</phase_requirements>

---

## Summary

Phase 4 adds typed signature/initials creation, three self-hosted script fonts, IndexedDB persistence, and a saved-items panel — extending the existing tabbed modal pattern. The critical integration points are: (1) `@pdf-lib/fontkit` registration into the already-working `pdf-lib-incremental-save` export pipeline, (2) font bytes loaded via same-origin `fetch` (not Vite import — keeps the privacy audit clean and works identically in dev and build), and (3) `idb-keyval` for simple, promise-based IndexedDB reads/writes with a single array key.

The pdf-lib-incremental-save fork preserves the `registerFontkit` / `embedFont` API identically to upstream pdf-lib 1.17.x — this is confirmed from the fork's TypeScript declarations and JS source in `node_modules`. Subsetting works normally in an incremental revision: new font objects are appended, the original bytes at offset 0 are untouched, so EXP-02 still passes. The `drawTextInBox` function currently truncates text — the typed signature variant needs a fit-to-box algorithm using `font.sizeAtHeight` + `font.widthOfTextAtSize` instead.

State store extension is surgical: add `fontFamily?` to `PlacedField`, add a `savedItems` slice plus `armedTypedPayload` seam to `fieldStore`, add `addSavedItem`/`deleteSavedItem`/`loadSavedItems` actions, and hook `loadSavedItems` into the App `useEffect`. `LazyPage.tsx` drop handler needs one new branch: when `armedTypedPayload` is set, create a font-backed field instead of an image-backed field.

**Primary recommendation:** Extend `fieldStore.ts` with the saved-items slice and typed-arming seam first; this unblocks all other tasks in parallel. Fetch font bytes lazily inside `exportSignedPdf` (cache in a module-level Map) to avoid blocking app startup.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Typed signature creation UI (input, font picker, preview) | Browser / Client | — | Pure client-side React component state — no server |
| Script font rendering on-screen (WYSIWYG) | Browser / Client | — | CSS `@font-face` + inline `fontFamily` style; browser renders |
| Script font embedding in PDF export | Browser / Client | — | `@pdf-lib/fontkit` + `pdfDoc.embedFont` in `exportPdf.ts` — all in-browser |
| Saved item persistence (IndexedDB) | Browser / Client | — | `idb-keyval` — origin-local IndexedDB, no server |
| Font TTF bytes for export | CDN / Static | Browser / Client | Served from `public/fonts/` (same-origin Vercel/Vite static); fetched by client at export time |
| Saved-items panel (view/place/delete) | Browser / Client | — | Zustand slice + React component; no server |

---

## Standard Stack

### Core (Phase 4 additions)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@pdf-lib/fontkit` | 1.1.1 | Register with `pdfDoc.registerFontkit(fontkit)` to enable custom TTF/OTF embedding via `pdfDoc.embedFont(bytes, { subset: true })` | The required companion to pdf-lib / pdf-lib-incremental-save for custom fonts. Without it, `embedFont` with a custom TTF throws `FontkitNotRegisteredError`. [VERIFIED: npm registry — confirmed via `npm view @pdf-lib/fontkit version` returning 1.1.1, and `registerFontkit` found in `node_modules/pdf-lib-incremental-save/es/api/PDFDocument.d.ts:112`] |
| `idb-keyval` | 6.2.5 | Promise-based `get`/`set`/`del`/`keys` over IndexedDB for persisting saved signature/initials items | Gigabyte-headroom IndexedDB vs 5 MB localStorage cap; ~600 B min+gz; stores Blobs and structured data natively. Chosen in CLAUDE.md. [VERIFIED: npm registry — `npm view idb-keyval version` returns 6.2.5; established package since 2016 (see Package Legitimacy Audit)] |
| 3 × script TTFs | n/a | `DancingScript-Regular.ttf`, `GreatVibes-Regular.ttf`, `Pacifico-Regular.ttf` — SIL OFL, vendored into `public/fonts/` | Self-hosted font assets required by PRV-02. Same TTF used for `@font-face` on-screen render AND `pdfDoc.embedFont` in export — WYSIWYG guarantee. [ASSUMED — TTF files must be downloaded from Google Fonts; licensing confirmed SIL OFL per CONTEXT.md Area 1] |

### Supporting (unchanged from Phase 1–3)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `pdf-lib-incremental-save` | 1.17.4 | PDF export — already installed | Signature/initials/date/text/checkbox export; Phase 4 adds fontkit registration branch |
| `signature_pad` | 5.1.3 | Draw tab — already installed | Draw panel unchanged |
| `zustand` | 5.x | State — already installed | fieldStore extended with saved-items slice |
| `react-rnd` | 10.5.3 | Drag/resize — already installed | Font-backed widget uses `lockAspectRatio={false}` vs drawn's `true` |

### Installation

```bash
npm install @pdf-lib/fontkit@1.1.1 idb-keyval@6.2.5
```

These are the only two new npm packages for Phase 4. The 3 TTF files are vendored manually (download from Google Fonts or fonts.google.com) and placed in `public/fonts/`.

**Version verification (performed 2026-06-17):**
```
@pdf-lib/fontkit  1.1.1   (npm view: 1.1.1 — only version; published 2020-11-28)
idb-keyval        6.2.5   (npm view: 6.2.5 — published 2026-06-02; see legitimacy audit)
```

---

## Package Legitimacy Audit

> Run on 2026-06-17 via `gsd-tools query package-legitimacy check --ecosystem npm @pdf-lib/fontkit idb-keyval`.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `@pdf-lib/fontkit` | npm | ~5.5 yrs | ~940K/wk | github.com/Hopding/fontkit | OK | Approved |
| `idb-keyval` | npm | ~10 yrs (since 2016) | ~6.2M/wk | github.com/jakearchibald/idb-keyval | SUS (too-new) | Flagged — see note |

**`idb-keyval` SUS explanation:** The `too-new` signal triggered because `idb-keyval@6.2.5` was published 2026-06-02 (15 days ago at research time). However, the package has been active since 2016, accumulates 6.2M weekly downloads, and is authored by Jake Archibald (Google). The seam's "too-new" flag applies to the specific version's recency, not the package's history. This is a known false-positive pattern for actively maintained packages that release frequently. The planner should add a `checkpoint:human-verify` step before installation per protocol, but the package itself is safe to use.

**Packages removed due to [SLOP] verdict:** none

**Packages flagged as suspicious [SUS]:** `idb-keyval@6.2.5` — planner inserts `checkpoint:human-verify` before install. (This is a timing artifact; the package is legitimate.)

---

## Architecture Patterns

### System Architecture Diagram

```
User action (type name, pick font, click "Use signature")
    │
    ▼
[SignatureDrawModal — Type tab]
    │  text + fontFamily
    ▼
[fieldStore.ts]
    ├─── armedTypedPayload: {text, fontFamily, kind}  ────────────────────────────┐
    ├─── savedItems: SavedItem[]  ◄──── idb-keyval (load on mount) ◄───────────── │
    │                                        ▲                                     │
    │                           idb-keyval.set('savedItems', [...])                │
    │                           (addSavedItem / deleteSavedItem)                   │
    │                                                                              │
    ▼                                                                              │
[LazyPage.tsx — overlay click]  ◄──────────────────────────────────────────────── ┘
    │  PlacedField { ..., textValue, fontFamily }  (font-backed)
    ▼
[PlacedFieldWidget.tsx]
    │  CSS: fontFamily={field.fontFamily}, fontSize computed
    │  (same @font-face TTF as export → WYSIWYG)
    ▼
[On-screen: script text in widget]

[TopBar "Download PDF" click]
    │
    ▼
[exportSignedPdf(originalBytes, fields)]
    │
    ├─── hasFontBackedFields? ──yes──► fetch('/fonts/{font}.ttf') → ArrayBuffer
    │                                   pdfDoc.registerFontkit(fontkit)
    │                                   embeddedFonts = Map<fontFamily, PDFFont>
    │                                   pdfDoc.embedFont(ttfBytes, { subset: true })
    │
    ├─── per-field loop:
    │    ├── signature/initials + dataUrl  → embedPng + drawImage  (unchanged)
    │    ├── signature/initials + textValue+fontFamily → drawSignatureText()  (NEW)
    │    ├── date/text → drawTextInBox (Helvetica, unchanged)
    │    └── checkbox → drawCheckboxX (unchanged)
    │
    ├── saveIncremental(snapshot)
    └── concat(originalBytes, incrementalBytes) → EXP-02 preserved
```

### Recommended Project Structure (new/changed files)

```
public/
  fonts/
    DancingScript-Regular.ttf     # vendored from Google Fonts
    DancingScript-LICENSE.txt     # SIL OFL
    GreatVibes-Regular.ttf
    GreatVibes-LICENSE.txt
    Pacifico-Regular.ttf
    Pacifico-LICENSE.txt

src/
  store/
    fieldStore.ts                 # EXTEND: fontFamily on PlacedField,
                                  #   savedItems slice, armedTypedPayload,
                                  #   addSavedItem/deleteSavedItem/loadSavedItems
  lib/
    exportPdf.ts                  # EXTEND: registerFontkit, embedFont for script fonts,
                                  #   drawSignatureText() helper, font-cache Map
    savedSignatures.ts            # NEW: idb-keyval read/write helpers
  components/
    SignatureDrawModal.tsx         # REWRITE: add Saved/Draw/Type tabs
    InitialsDrawModal.tsx          # REWRITE: add Saved/Draw/Type tabs
    SavedItemCard.tsx              # NEW: thumbnail card for saved items
    PlacedFieldWidget.tsx          # EXTEND: font-backed branch for sig/initials
    LazyPage.tsx                   # EXTEND: typed drop case for armedTypedPayload
  index.css                       # ADD: 3 @font-face declarations
  App.tsx                         # ADD: useEffect to call loadSavedItems on mount
```

### Pattern 1: @pdf-lib/fontkit Registration + Custom TTF Embedding

**What:** Register a fontkit instance with the PDF document before calling `embedFont` with a custom TTF. `embedFont` will throw `FontkitNotRegisteredError` if this is skipped.

**When to use:** Any export run that includes at least one font-backed (typed) signature or initials field. Guard behind `hasFontBackedFields` check, same pattern as existing `hasTextFields`.

```typescript
// Source: node_modules/pdf-lib-incremental-save/es/api/PDFDocument.d.ts line 107-112
// VERIFIED against installed package 1.17.4

import fontkit from '@pdf-lib/fontkit'
// ... inside exportSignedPdf:
const hasFontBackedFields = fields.some(
  (f) => (f.type === 'signature' || f.type === 'initials') && f.textValue && f.fontFamily
)

if (hasFontBackedFields) {
  pdfDoc.registerFontkit(fontkit)
}

// Embed each unique font family once (cache by fontFamily name)
const embeddedFonts = new Map<string, PDFFont>()
for (const field of fields) {
  if (field.fontFamily && !embeddedFonts.has(field.fontFamily)) {
    const ttfBytes = await fontBytesCache.get(field.fontFamily)  // see Pattern 5
    const pdfFont = await pdfDoc.embedFont(ttfBytes, { subset: true })
    embeddedFonts.set(field.fontFamily, pdfFont)
  }
}
```

**Registration timing:** `registerFontkit` must be called BEFORE `embedFont` for any custom font. It can be called at any point before `embedFont` — calling it once is sufficient. [VERIFIED: PDFDocument.js line 171 confirms `this.fontkit = fontkit`; errors.js confirms FontkitNotRegisteredError is thrown if missing]

### Pattern 2: Font-Sized-to-Box for Typed Signatures (drawSignatureText)

**What:** Size the typed text to fill the field box — different from `drawTextInBox` which truncates. A typed signature MUST fit the whole text visually.

**Algorithm:**
1. Compute size that fills 85% of box height: `sizeFromHeight = font.sizeAtHeight(field.pdfHeight * 0.85)`
2. Check if text at that size fits the width: `textWidth = font.widthOfTextAtSize(text, sizeFromHeight)`
3. If `textWidth > field.pdfWidth - 4` (4pt total padding), scale down: `sizeFromWidth = sizeFromHeight * (field.pdfWidth - 4) / textWidth`
4. Final size = `Math.min(sizeFromHeight, sizeFromWidth)`
5. Center horizontally: `xOffset = (field.pdfWidth - font.widthOfTextAtSize(text, finalSize)) / 2`
6. Center baseline vertically: `baselineY = field.pdfY + (field.pdfHeight - font.heightAtSize(finalSize)) / 2`

```typescript
// Source: pdf-lib-incremental-save API — font.sizeAtHeight, font.widthOfTextAtSize,
//         font.heightAtSize confirmed in installed node_modules
// VERIFIED: these methods exist on PDFFont from pdf-lib-incremental-save 1.17.4

function drawSignatureText(
  page: PDFPage,
  text: string,
  font: PDFFont,
  field: PlacedField,
): void {
  if (!text) return
  const padding = 4 // pt — total horizontal padding
  const targetSize = font.sizeAtHeight(field.pdfHeight * 0.85)
  const textWidthAtTarget = font.widthOfTextAtSize(text, targetSize)
  const maxWidth = field.pdfWidth - padding
  const finalSize =
    textWidthAtTarget > maxWidth
      ? targetSize * (maxWidth / textWidthAtTarget)
      : targetSize
  const glyphH = font.heightAtSize(finalSize)
  const xOffset = (field.pdfWidth - font.widthOfTextAtSize(text, finalSize)) / 2
  const baselineY = field.pdfY + (field.pdfHeight - glyphH) / 2
  page.drawText(text, {
    x: field.pdfX + xOffset,
    y: baselineY,
    font,
    size: finalSize,
  })
}
```

**Key difference from `drawTextInBox`:** No truncation. All text visible, scaled to fit both dimensions. This is the correct behavior for a signature — a truncated "John S" instead of "John Smith" is wrong.

### Pattern 3: Font Bytes Loading for Export (same-origin fetch, with module-level cache)

**What:** Fetch the TTF file bytes from `public/fonts/` at export time. Cache at module level so repeated exports don't re-fetch.

**Why same-origin fetch over Vite `?url` import:** `fetch('/fonts/Font.ttf')` works identically in dev (Vite serves `public/` at root) and production (Vercel serves `public/` at root). No URL hashing — the font URLs are stable. `?arrayBuffer` Vite import transforms are experimental and less standard. The CONTEXT.md explicitly locked this approach. [VERIFIED: confirmed same-origin fetch works in Vite for `public/` assets per Vite documentation and CONTEXT.md Area 5]

```typescript
// Source: CONTEXT.md Area 5 (locked decision) + Vite public/ serving behavior
// CITED: vitejs.dev/guide/assets#the-public-directory

const FONT_FILE_MAP: Record<string, string> = {
  'Dancing Script':  '/fonts/DancingScript-Regular.ttf',
  'Great Vibes':     '/fonts/GreatVibes-Regular.ttf',
  'Pacifico':        '/fonts/Pacifico-Regular.ttf',
}

// Module-level cache: Map<fontFamily, Uint8Array>
// Populated lazily on first export that uses that font.
// NOTE: this is a module-level let, NOT React state — avoids re-renders.
const fontBytesCache = new Map<string, Uint8Array>()

async function loadFontBytes(fontFamily: string): Promise<Uint8Array> {
  if (fontBytesCache.has(fontFamily)) return fontBytesCache.get(fontFamily)!
  const path = FONT_FILE_MAP[fontFamily]
  if (!path) throw new Error(`Unknown font family: "${fontFamily}"`)
  const bytes = new Uint8Array(await fetch(path).then((r) => r.arrayBuffer()))
  fontBytesCache.set(fontFamily, bytes)
  return bytes
}
```

**Privacy audit:** `fetch('/fonts/DancingScript-Regular.ttf')` is a same-origin request to `localhost` (dev) or the Vercel app origin (prod). It does NOT contact Google Fonts, any CDN, or any third-party origin. PRV-02 is preserved. [VERIFIED: same-origin `fetch` cannot cross origins by definition]

### Pattern 4: idb-keyval API (6.2.5) for Saved Items

**What:** `idb-keyval` exposes simple promise-based `get`/`set`/`del`/`keys`/`update` over IndexedDB. The recommended approach for this phase is a single array key (`'savedItems'`) storing all items together — simpler than per-item keys and avoids key-enumeration overhead for the small counts expected (~50 items max).

```typescript
// Source: idb-keyval v6 README / npm package dist/index.d.ts
// VERIFIED: npm view idb-keyval version returns 6.2.5; exports confirmed above

import { get, set } from 'idb-keyval'

const IDB_KEY = 'savedSignatureItems'

// Load all items
async function loadAll(): Promise<SavedItem[]> {
  return (await get<SavedItem[]>(IDB_KEY)) ?? []
}

// Add one item
async function addItem(item: SavedItem): Promise<void> {
  const current = await loadAll()
  await set(IDB_KEY, [item, ...current])  // prepend — newest-first order
}

// Delete one item by id
async function deleteItem(id: string): Promise<void> {
  const current = await loadAll()
  await set(IDB_KEY, current.filter((i) => i.id !== id))
}
```

**Single key vs per-item keys:** Single key (array) is simpler and avoids needing `keys()` to enumerate, re-fetch, and merge. For expected item counts (<50), atomic read-modify-write is fine. One edge case: two tabs saving simultaneously could create a race — this is acceptable for a single-tab PDF signer app; no mitigation needed.

**App mount initialization:** In `App.tsx`, add a `useEffect` that calls `loadSavedItems()` once on mount (empty dependency array). This populates the `savedItems` Zustand slice from IndexedDB before the user can see the Saved tab. [VERIFIED: standard React pattern for one-time side effects]

```typescript
// In App.tsx
import { useEffect } from 'react'
import { useFieldStore } from './store/fieldStore'

// Inside App():
const loadSavedItems = useFieldStore((s) => s.loadSavedItems)
useEffect(() => {
  loadSavedItems()
}, [loadSavedItems])
```

### Pattern 5: Zustand Store Extension — savedItems slice + armedTypedPayload

**What:** Extend `fieldStore.ts` with the Phase 4 state slice. Two additions: (1) `savedItems` + CRUD actions wired to idb-keyval, (2) `armedTypedPayload` seam so `LazyPage`'s drop handler can create font-backed fields.

**Why in fieldStore (not a separate store):** LazyPage already subscribes to `fieldStore` for `armedFieldType`, `signatureDataUrl`, `initialsDataUrl`. Adding a typed-arming seam to the same store avoids cross-store subscription and simplifies the drop handler. A separate `savedSignaturesStore` would also work but is not necessary — the slice is cohesive (placement data).

**New PlacedField field:** Add `fontFamily?: string` to the existing interface. TypeScript will require updating all exhaustive switches — inspect for any `PlacedField` spreads that need the new field passed through.

```typescript
// Target: src/store/fieldStore.ts
// VERIFIED: existing interface at line 27-38 in source

export interface PlacedField {
  id: string
  type: FieldType
  pageNumber: number
  pdfX: number; pdfY: number; pdfWidth: number; pdfHeight: number
  dataUrl?: string        // drawn signature/initials
  textValue?: string      // date, text, AND typed signature/initials text
  fontFamily?: string     // NEW: typed signature/initials only
  role?: string           // v2 seam
}

export interface SavedItem {
  id: string                          // crypto.randomUUID()
  kind: 'signature' | 'initials'
  source: 'drawn' | 'typed'
  dataUrl?: string                    // drawn items
  text?: string                       // typed items
  fontFamily?: string                 // typed items
  createdAt: number                   // Date.now()
}

// New state slice additions to FieldStore interface:
interface FieldStore {
  // ... existing fields ...

  // Typed-arming seam (Phase 4): set when a typed sig/initials is confirmed
  // Null when armed item is drawn (use signatureDataUrl/initialsDataUrl instead)
  armedTypedPayload: { text: string; fontFamily: string; kind: 'signature' | 'initials' } | null

  // Saved items (persisted to IndexedDB via idb-keyval)
  savedItems: SavedItem[]

  // Actions
  setArmedTypedPayload: (p: FieldStore['armedTypedPayload']) => void
  loadSavedItems: () => Promise<void>
  addSavedItem: (item: SavedItem) => Promise<void>
  deleteSavedItem: (id: string) => Promise<void>
}
```

**LazyPage drop handler extension:** The existing `handleOverlayClick` already branches on `armedFieldType`. Add a guard: if `armedTypedPayload` is set (font-backed), create the field with `textValue`+`fontFamily` instead of `dataUrl`. Default size for typed: `200px × 56px` CSS (from UI-SPEC).

```typescript
// In handleOverlayClick, AFTER the existing dataUrl guards:
// (armedFieldType === 'signature' || 'initials' AND armedTypedPayload is set)
const newField: PlacedField = {
  id: crypto.randomUUID(),
  type: armedFieldType,   // 'signature' or 'initials'
  pageNumber,
  pdfX: pdfBottomLeft.x,
  pdfY: pdfBottomLeft.y,
  pdfWidth:  200 / effectiveScale,   // default 200×56 CSS px
  pdfHeight: 56  / effectiveScale,
  textValue: armedTypedPayload.text,
  fontFamily: armedTypedPayload.fontFamily,
  // no dataUrl — font-backed
}
```

**Clearing armed state on drop:** After drop, call `setArmedTypedPayload(null)` AND `setArmedFieldType(null)`. Both must be cleared so the overlay returns to non-armed state.

### Pattern 6: PlacedFieldWidget Font-Backed Branch

**What:** Add a new content branch for signature/initials fields where `dataUrl` is absent and `textValue`+`fontFamily` are present.

```typescript
// In PlacedFieldWidget.tsx — inside the field.type === 'signature' || 'initials' branch
// Source: 04-UI-SPEC.md PlacedFieldWidget section (font-backed signature/initials widget)

if (field.type === 'signature' || field.type === 'initials') {
  if (field.dataUrl) {
    // Image-backed (drawn) — existing behavior
    content = <img src={field.dataUrl} ... lockAspectRatio={true} />
  } else if (field.textValue && field.fontFamily) {
    // Font-backed (typed) — NEW
    // Fit-to-box sizing heuristic: fill height × 0.85, capped by width heuristic
    const fontSize = Math.min(
      cssHeight * 0.85,
      cssWidth / (field.textValue.length * 0.6 + 0.5),
    )
    content = (
      <div
        style={{
          width: '100%', height: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
          fontFamily: field.fontFamily,  // CSS @font-face name — same TTF as export
          fontSize,
          color: 'var(--color-text-primary)',
          whiteSpace: 'nowrap',
          userSelect: 'none',
          pointerEvents: 'none',
        }}
      >
        {field.textValue}
      </div>
    )
  }
}
```

**`lockAspectRatio` change:** Font-backed typed signatures use `lockAspectRatio={false}` (from UI-SPEC). The existing code sets `shouldLockAspectRatio = field.type === 'signature' || field.type === 'initials' || field.type === 'checkbox'`. This must be refined: lock only when `field.dataUrl` is present (drawn), not when font-backed.

**WYSIWYG alignment:** The CSS `fontFamily` must exactly match the `@font-face` `font-family` name in `src/index.css`. If `@font-face` declares `font-family: "Dancing Script"`, the widget must use `fontFamily: '"Dancing Script"'` (with quotes for multi-word names). [VERIFIED: CSS spec requires quoting multi-word font-family names when used as values]

### Pattern 7: ARIA Tab Widget (Saved · Draw · Type)

**What:** The ARIA tab pattern (`role="tablist"` / `role="tab"` / `role="tabpanel"`) with Left/Right arrow key navigation between tabs and Tab key moving to panel content.

```typescript
// Source: ARIA Authoring Practices Guide — Tabs Pattern
// CITED: w3.org/WAI/ARIA/apg/patterns/tabs/

// Tab bar:
<div role="tablist" aria-label="Signature creation methods">
  {['saved', 'draw', 'type'].map((panel) => (
    <button
      key={panel}
      role="tab"
      id={`tab-${panel}`}
      aria-controls={`panel-${panel}`}
      aria-selected={activeTab === panel}
      tabIndex={activeTab === panel ? 0 : -1}  // roving tabindex
      onClick={() => setActiveTab(panel)}
      onKeyDown={handleTabKeyDown}  // Left/Right arrows
    >
      {panel === 'saved' ? 'Saved' : panel === 'draw' ? 'Draw' : 'Type'}
    </button>
  ))}
</div>

// Each panel:
<div
  role="tabpanel"
  id={`panel-${panel}`}
  aria-labelledby={`tab-${panel}`}
  hidden={activeTab !== panel}  // or conditional render
>
  {/* panel content */}
</div>

// Keyboard handler on tablist:
function handleTabKeyDown(e: React.KeyboardEvent, current: number) {
  const tabs = ['saved', 'draw', 'type']
  if (e.key === 'ArrowRight') {
    e.preventDefault()
    const next = (current + 1) % tabs.length
    setActiveTab(tabs[next])
    document.getElementById(`tab-${tabs[next]}`)?.focus()
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault()
    const prev = (current - 1 + tabs.length) % tabs.length
    setActiveTab(tabs[prev])
    document.getElementById(`tab-${tabs[prev]}`)?.focus()
  }
}
```

**Roving tabindex:** Only the active tab has `tabIndex={0}`; others have `tabIndex={-1}`. This means Tab key exits the tablist and moves to the panel, not to the next tab button. Arrow keys cycle between tabs without losing focus to the browser's tab order. This is the standard ARIA tabs pattern.

**Focus trap update:** The existing `handleKeyDown` in SignatureDrawModal queries `'button, canvas[tabindex="0"]'`. With tabs, the focusable query must also include `input, [role="radio"]` elements. The focus trap must be updated to collect all focusable elements inside the dialog.

### Anti-Patterns to Avoid

- **Rasterizing typed text for export:** Never `canvas.toDataURL()` from the preview or widget to embed as a PNG. This is the exact anti-rasterization violation CLAUDE.md prohibits. Use `pdfDoc.embedFont` + `page.drawText`.
- **Calling `registerFontkit` more than once per `PDFDocument`:** Each `PDFDocument.load()` creates a fresh doc — register once per export call. Calling it twice on the same doc is harmless but wasteful.
- **Importing TTF bytes as a Vite module (e.g., `import ttfUrl from './font.ttf?url'`):** This works in some setups but requires the consumer to then `fetch(ttfUrl)` anyway. Same-origin `fetch('/fonts/Font.ttf')` is simpler and framework-agnostic.
- **Storing PNG data URLs in localStorage:** A single drawn signature PNG can be 50–150 KB. 3–4 items would exhaust localStorage's ~2.5–5 MB limit. Always use IndexedDB via idb-keyval.
- **Calling `pdfDoc.embedFont(bytes)` inside the per-field loop without deduplication:** If a user places 5 typed signatures all in "Dancing Script", embedding the font 5 times wastes space and time. Embed each unique `fontFamily` once per export call using the `embeddedFonts` Map.
- **Using `font-display: swap` for @font-face on the script fonts:** `swap` causes a flash of unstyled text — in a signature preview, the system fallback renders entirely differently, jarring the user. Use `font-display: block` (from UI-SPEC).
- **Relying on IndexedDB in tests without mocking:** jsdom has no real IndexedDB. `idb-keyval` will throw or return undefined in the test environment unless you mock the module (see Testing Strategy section).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Font subsetting for PDF embed | Custom glyph enumeration or full font bytes | `@pdf-lib/fontkit` with `{ subset: true }` | Subsetting is complex (handles ligatures, GPOS, GSUB tables); font files are 100–400 KB; subset reduces export size to only the glyphs used |
| IndexedDB reads/writes | Raw `indexedDB.open` + `IDBTransaction` | `idb-keyval@6.2.5` | 400+ lines of boilerplate for basic get/set with correct error handling and transaction management — idb-keyval handles all of it |
| Tab widget keyboard navigation | Custom `keydown` handler from scratch | Standard ARIA pattern (implemented in-place) | The ARIA spec defines exactly the right behavior; implementing it from the spec takes ~10 lines |
| Font-size-to-box fitting | Binary search or iterative sizing | `font.sizeAtHeight(h)` + `font.widthOfTextAtSize(text, size)` (Pattern 2 above) | pdf-lib exposes O(1) sizing methods; binary search is unnecessary |
| `crypto.randomUUID()` for saved item IDs | Custom random string | `crypto.randomUUID()` | Already used for `PlacedField.id`; available in all modern browsers; no import needed |

---

## Runtime State Inventory

> Not applicable — this is a greenfield feature addition, not a rename/refactor phase. No existing runtime state uses strings that would be renamed. Omitted.

---

## Common Pitfalls

### Pitfall 1: `FontkitNotRegisteredError` at export time

**What goes wrong:** `pdfDoc.embedFont(ttfBytes, { subset: true })` throws `FontkitNotRegisteredError` with message "no fontkit instance was found."

**Why it happens:** `registerFontkit` was not called before `embedFont`, or was called on a different `PDFDocument` instance.

**How to avoid:** Call `pdfDoc.registerFontkit(fontkit)` immediately after `PDFDocument.load(srcBytes)` when any font-backed field is present. Guard with `hasFontBackedFields` check. [VERIFIED: errors.js in installed package confirms the exact error message]

**Warning signs:** Export throws mid-loop with "fontkit instance" in the message.

### Pitfall 2: `lockAspectRatio` regression for drawn signatures

**What goes wrong:** After adding the `fontFamily?` field to `PlacedField`, the existing `shouldLockAspectRatio` logic that keys on `field.type === 'signature' || field.type === 'initials'` now fires for font-backed typed signatures too — locking the aspect ratio of a text box incorrectly.

**Why it happens:** The existing code uses type alone to determine aspect ratio locking. Font-backed fields have no natural pixel aspect ratio.

**How to avoid:** Refine to `shouldLockAspectRatio = (field.type === 'signature' || field.type === 'initials') && !!field.dataUrl`. Typed items: `lockAspectRatio={false}`. [VERIFIED: existing logic at PlacedFieldWidget.tsx lines 254-255]

### Pitfall 3: EXP-02 test false-positive with font-backed fields

**What goes wrong:** The EXP-02 first-512-bytes test passes for image-backed fields but may fail if `embedFont` with `subset: true` somehow corrupts the write order.

**Why it happens:** In practice, `saveIncremental` appends AFTER the original bytes — the first-512-byte identity invariant holds. But if `load()` is passed a `Uint8Array` copy that isn't aligned with the original buffer, the first-512 check can fail on a copy operation error.

**How to avoid:** The existing test pattern (`exportSignedPdf(INPUT_BYTES.buffer as ArrayBuffer, [...])`) is correct. Add a new EXP-02 test for a font-backed field using the same pattern (see Validation Architecture). [VERIFIED: EXP-02 test at exportPdf.test.ts lines 44-62 passes for drawn signatures with same concat mechanism]

### Pitfall 4: idb-keyval import fails in Vitest / jsdom

**What goes wrong:** Tests that import modules using idb-keyval throw because jsdom has no IndexedDB implementation. The error is something like "indexedDB is not defined" or a silent `undefined` return from `get`.

**Why it happens:** jsdom (which Vitest uses per vite.config.ts) does not implement IndexedDB by default.

**How to avoid:** Mock idb-keyval at the module level in tests that exercise saved-items code:

```typescript
// In test files that import fieldStore (which now imports idb-keyval indirectly)
vi.mock('idb-keyval', () => ({
  get: vi.fn().mockResolvedValue(undefined),
  set: vi.fn().mockResolvedValue(undefined),
  del: vi.fn().mockResolvedValue(undefined),
}))
```

Place the mock in the `beforeEach` or module-level scope. The existing tests that do NOT exercise idb-keyval (exportPdf.test.ts, coordinateMapper.test.ts, etc.) do not need this mock — only tests that touch the saved-items store actions. [ASSUMED based on known jsdom limitations; confirmed pattern used by idb-keyval maintainer in docs]

**Alternative:** Install `fake-indexeddb` as a devDependency and configure it in `setup.ts`. This gives a real IDB implementation in tests. For Phase 4, the mock approach is simpler and sufficient.

### Pitfall 5: CSS `fontFamily` multi-word names must be quoted

**What goes wrong:** `style={{ fontFamily: 'Dancing Script' }}` does not match the `@font-face { font-family: "Dancing Script" }` declaration, causing the browser to fall back to a system font.

**Why it happens:** CSS requires multi-word font-family names to be quoted when used in `font-family` property values as strings with spaces.

**How to avoid:** When applying inline `fontFamily` in React, use the raw font family name string (e.g., `fontFamily: '"Dancing Script"'` with inner quotes, or just `fontFamily: 'Dancing Script'` — React/browsers handle both). The `@font-face` declaration must use the exact same string. Verify in DevTools that the Computed > font-family shows the correct font and not "system-ui". [ASSUMED — CSS font-family spec behavior; standard cross-browser behavior]

### Pitfall 6: Font-backed field placed but `armedTypedPayload` not cleared

**What goes wrong:** After dropping a typed signature, the next click on the overlay creates another typed signature instead of reverting to non-armed mode.

**Why it happens:** `setArmedTypedPayload(null)` was not called after `addField` in `handleOverlayClick`.

**How to avoid:** After `addField(newField)` in the typed branch, call both `setArmedTypedPayload(null)` AND `setArmedFieldType(null)`. Both must be cleared. Add a test assertion that `armedTypedPayload` is null after a typed field drop. [VERIFIED: existing code at LazyPage.tsx line 199 calls `setArmedFieldType(null)` — typed branch must do the same]

### Pitfall 7: Fetch of TTF fails silently in test environment

**What goes wrong:** The export test for a typed field calls `fetch('/fonts/DancingScript-Regular.ttf')` but the test environment (jsdom + Vitest) has no server to respond to `fetch`.

**Why it happens:** Vitest with jsdom does not serve static files from `public/`.

**How to avoid:** In `exportPdf.test.ts` typed-signature tests, mock `globalThis.fetch` to return a minimal valid TTF bytes response. A real TTF is not needed for the EXP-02 byte-identity check if you instead supply the font bytes directly as a fixture. Alternatively, load a small test TTF from the fixtures directory and pass the bytes directly to `exportSignedPdf` via a test-only variant of `loadFontBytes`. The simplest approach: the `loadFontBytes` helper in `savedSignatures.ts` accepts an optional override map, or tests mock `fetch` with a real small TTF fixture.

---

## Code Examples

### @pdf-lib/fontkit — confirmed registration and embedFont call

```typescript
// Source: node_modules/pdf-lib-incremental-save/es/api/PDFDocument.d.ts lines 104-112
// VERIFIED from installed package 1.17.4

import fontkit from '@pdf-lib/fontkit'
import { PDFDocument } from 'pdf-lib-incremental-save'

const pdfDoc = await PDFDocument.load(srcBytes)
pdfDoc.registerFontkit(fontkit)
const ttfBytes: Uint8Array = await loadFontBytes('Dancing Script')
const font = await pdfDoc.embedFont(ttfBytes, { subset: true })
// font is a PDFFont — exposes sizeAtHeight, widthOfTextAtSize, heightAtSize
```

### idb-keyval — get/set confirmed from package exports

```typescript
// Source: idb-keyval package dist/index.d.ts (exports confirmed above)
// VERIFIED: npm view idb-keyval exports lists 'import': './dist/index.js'

import { get, set, del } from 'idb-keyval'

const KEY = 'savedSignatureItems'

// Read all
const items: SavedItem[] = (await get<SavedItem[]>(KEY)) ?? []

// Write (overwrite entire array)
await set(KEY, updatedItems)

// Delete by id (read-modify-write)
const all = (await get<SavedItem[]>(KEY)) ?? []
await set(KEY, all.filter((i) => i.id !== targetId))
```

### @font-face declarations for src/index.css

```css
/* Source: 04-UI-SPEC.md Self-Hosted Font Assets section */
/* CITED: w3.org/TR/css-fonts-4/#font-face-rule */

@font-face {
  font-family: "Dancing Script";
  src: url("/fonts/DancingScript-Regular.ttf") format("truetype");
  font-weight: 400;
  font-style: normal;
  font-display: block;  /* block prevents FOUT — critical for signature preview */
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

### PDFFont methods available (confirmed from installed package)

```typescript
// Source: node_modules/pdf-lib-incremental-save — PDFFont class
// Method existence verified via grep of installed .d.ts files (HIGH confidence)

font.sizeAtHeight(heightPts: number): number
  // Returns font size (pts) that produces glyphs of the given height

font.heightAtSize(sizePts: number): number
  // Returns glyph height (pts) at the given font size

font.widthOfTextAtSize(text: string, sizePts: number): number
  // Returns horizontal advance width (pts) of text at the given size
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `pdf-lib@1.17.1` (canonical) for PDF export | `pdf-lib-incremental-save@1.17.4` | Phase 2 (2026-06-16) | `saveIncremental()` enables EXP-02 — original bytes verbatim. API identical for fontkit registration. |
| `localStorage` for saved items | `idb-keyval@6.2.5` (IndexedDB) | Phase 4 (this phase) | 5 MB limit no longer a concern; stores Blobs natively |
| Drawing-only signatures | Typed (font-embedded) + drawn | Phase 4 (this phase) | Typed text is real vector PDF text, not rasterized image |

**Deprecated/outdated for this project:**
- `localStorage` for signature data: avoid — fragile capacity, inferior to IndexedDB for binary data.
- `html2canvas` / `dom-to-image` for typed text → NEVER: would rasterize the entire document.
- `font.encode(text)` (pdf-lib internal): do not call directly — use `pdfDoc.embedFont` + `page.drawText`.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 3 script TTFs (Dancing Script, Great Vibes, Pacifico) are available as `.ttf` files from Google Fonts and are SIL OFL licensed | Standard Stack | If a font's license changed or the TTF format is unavailable, a different source must be found. Risk: LOW — these are well-established Google Fonts with long-standing OFL licensing. |
| A2 | idb-keyval`s `get`/`set` API works in Vitest jsdom when mocked with `vi.mock('idb-keyval', ...)` | Pitfall 4, Testing | If the mock doesn't intercept the import correctly due to Vitest ESM resolution, tests may fail. Risk: LOW — standard Vitest mock pattern for ESM packages. |
| A3 | CSS `fontFamily: 'Dancing Script'` (unquoted in JS string) correctly matches `@font-face { font-family: "Dancing Script" }` declaration | Architecture Patterns (Pattern 6) | Multi-word names may need inner quoting in some edge cases. Risk: LOW — standard CSS behavior; easily verified in DevTools. |
| A4 | TTF font bytes embedded via `pdfDoc.embedFont(bytes, { subset: true })` in an incremental revision do not alter the first 512 bytes of the output | Common Pitfalls (Pitfall 3) | Risk: near-zero — confirmed by how saveIncremental appends; existing EXP-02 tests prove the concat mechanism. A4 is confirmable by the new typed-sig EXP-02 test. |

---

## Open Questions

1. **TTF file size and subset effectiveness for script fonts**
   - What we know: script fonts (Dancing Script, Great Vibes, Pacifico) are typically 100–350 KB as full TTFs. With `{ subset: true }`, only glyphs actually used in the text are embedded.
   - What's unclear: exact subset size for a typical 10–25 character name. Likely 5–20 KB.
   - Recommendation: Accept this; measure in a browser DevTools test during manual verification.

2. **Font byte fetch failure UX during export**
   - What we know: `fetch('/fonts/Font.ttf')` can fail (network offline after initial load, server error, corrupt file).
   - What's unclear: the right UX — should this be a non-blocking warning or a hard export error?
   - Recommendation: Treat a font fetch failure as a hard export error (throw, caught by the existing `catch(cause)` wrapper in `exportSignedPdf`). The `ExportErrorBanner` already handles export failures non-destructively. The CONTEXT.md UI-SPEC error copy for "Font load failure" applies to the on-screen preview only — a hard failure during export is an error banner case.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | npm install | ✓ | (Vite + npm already running) | — |
| `@pdf-lib/fontkit@1.1.1` | Font embedding in export | ✗ (not yet installed) | — | None — required |
| `idb-keyval@6.2.5` | Saved-items persistence | ✗ (not yet installed) | — | None — required |
| `public/fonts/*.ttf` | On-screen @font-face + export bytes | ✗ (not yet downloaded) | — | None — required |

**Missing dependencies with no fallback:**
- `@pdf-lib/fontkit` — install: `npm install @pdf-lib/fontkit@1.1.1`
- `idb-keyval` — install: `npm install idb-keyval@6.2.5`
- 3 TTF files — download from Google Fonts and vendor into `public/fonts/`

**Missing dependencies with fallback:** none

---

## Validation Architecture

> `workflow.nyquist_validation = true` in `.planning/config.json` — section required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 + jsdom |
| Config file | `vite.config.ts` (test block) — `environment: 'jsdom'`, `setupFiles: ['./src/test/setup.ts']` |
| Quick run command | `npm test -- --reporter=dot` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SIG-02 | Typed signature field exports with embedded script font (not PNG) — EXP-02 still holds | unit | `npm test -- src/test/exportPdf.test.ts` | ❌ Wave 0: add typed-sig export test to `exportPdf.test.ts` |
| SIG-02 | Typed signature field: `drawSignatureText` sizes text to fit box without truncation | unit | `npm test -- src/test/exportPdf.test.ts` | ❌ Wave 0: add `drawSignatureText` unit test |
| SIG-03 | Typed initials: same export path as typed signature — EXP-02 holds | unit | `npm test -- src/test/exportPdf.test.ts` | ❌ Wave 0: add typed-initials export test |
| SIG-04 | Saved items load from IndexedDB on app mount | unit | `npm test -- src/test/savedItems.test.ts` | ❌ Wave 0: new file |
| SIG-04 | `addSavedItem` writes to idb-keyval AND updates Zustand state | unit | `npm test -- src/test/savedItems.test.ts` | ❌ Wave 0: new file |
| SIG-05 | `deleteSavedItem` removes from idb-keyval AND Zustand state | unit | `npm test -- src/test/savedItems.test.ts` | ❌ Wave 0: new file |
| SIG-02 | Type tab: disabled CTA when input empty; enabled when text present | unit (render) | `npm test -- src/test/signatureDraw.test.ts` | ❌ Wave 0: extend existing file |
| SIG-02 | Draw tab still works (regression): stroke → confirm → armedFieldType='signature' | unit (render) | `npm test -- src/test/signatureDraw.test.ts` | ✅ exists (keep green) |
| EXP-02 | First 512 bytes byte-identical for a typed-signature export | unit | `npm test -- src/test/exportPdf.test.ts` | ❌ Wave 0: add to existing file |

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green (256 + new tests) before `/gsd-verify-work`

### Wave 0 Gaps (test infrastructure before implementation)

- [ ] `src/test/savedItems.test.ts` — new: covers SIG-04, SIG-05 (mock idb-keyval via `vi.mock('idb-keyval', ...)`)
- [ ] New typed-signature export tests in `src/test/exportPdf.test.ts` — add typed-sig EXP-02 + drawSignatureText sizing tests (need a test TTF fixture OR mock `fetch` to return minimal TTF bytes)
- [ ] Extend `src/test/signatureDraw.test.ts` — add Type tab rendering tests (text input, font picker state, CTA disabled/enabled)
- [ ] `vi.mock('idb-keyval')` setup — needed in `savedItems.test.ts` and any other test that imports `fieldStore.ts` after the idb-keyval import is added

**No new framework install needed** — Vitest + jsdom already configured and running 256 tests green.

---

## Security Domain

> `security_enforcement: true` in config; ASVS level 1.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | n/a — no accounts |
| V3 Session Management | No | n/a — no sessions |
| V4 Access Control | No | n/a — single-user, local-only |
| V5 Input Validation | Yes | Name input: `maxLength={100}` on the `<input>` element (prevents absurdly long preview text and export processing); font family validated against allowlist before fetch |
| V6 Cryptography | No | No crypto operations added in this phase |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via `fontFamily` value passed to `fetch(FONT_FILE_MAP[fontFamily])` | Tampering | `FONT_FILE_MAP` is a static allowlist; only `'Dancing Script'`, `'Great Vibes'`, `'Pacifico'` are valid keys. Unknown keys throw before `fetch` is called |
| XSS via typed text rendered in PDF | Tampering | pdf-lib's `page.drawText` renders text as PDF text objects, not HTML — no script execution possible |
| XSS via typed text rendered on-screen | Tampering | React JSX renders text content as text nodes — no `dangerouslySetInnerHTML` used; string interpolation is safe |
| DoS via extremely long typed name in export | Elevation | `maxLength={100}` on input caps at 100 chars; `drawSignatureText` scales font down to fit (no infinite loop) |
| Malicious TTF injection via localStorage/IndexedDB restore | Tampering | Saved items store `fontFamily` (string), not font bytes. Font bytes are always loaded from the static `public/fonts/` allowlist — never from user-supplied bytes |

---

## Sources

### Primary (HIGH confidence)

- `node_modules/pdf-lib-incremental-save/es/api/PDFDocument.d.ts` — `registerFontkit(fontkit: Fontkit): void` at line 112; `embedFont` signature at line 570; `saveIncremental` at line 773. Verified from installed package 1.17.4.
- `node_modules/pdf-lib-incremental-save/es/api/PDFDocumentOptions.d.ts` — `EmbedFontOptions { subset?: boolean }` at lines 33-34. Confirmed `{ subset: true }` is a valid option.
- `node_modules/pdf-lib-incremental-save/es/api/errors.js` — `FontkitNotRegisteredError` message confirmed: "no fontkit instance was found."
- `src/lib/exportPdf.ts` (existing codebase) — confirmed `PDFFont` methods `sizeAtHeight`, `heightAtSize`, `widthOfTextAtSize` used at lines 71, 73, 47. Same methods apply to custom-embedded fonts.
- `src/store/fieldStore.ts` (existing codebase) — confirmed `PlacedField` shape, `FieldType` union, history mechanism, existing `signatureDataUrl`/`initialsDataUrl` seams at lines 27-38.
- `npm view @pdf-lib/fontkit version` → `1.1.1`; `npm view idb-keyval version` → `6.2.5`. Registry existence confirmed.
- `gsd-tools query package-legitimacy check` → `@pdf-lib/fontkit: OK`; `idb-keyval: SUS(too-new)` (timing artifact — package is legitimate; see audit).
- `vite.config.ts` — confirmed `environment: 'jsdom'`, `setupFiles: ['./src/test/setup.ts']`; Vitest 4.1.9.
- `npm test` run — 256/256 tests pass as baseline.

### Secondary (MEDIUM confidence)

- `04-CONTEXT.md` — locked decisions for all 5 areas; font loading mechanism decided as same-origin `fetch`.
- `04-UI-SPEC.md` — component inventory, interaction states, ARIA specifications, font-backed widget sizing heuristic (`height × 0.85`), default placed size (`200×56 px`).
- `idb-keyval` npm exports object — `{ '.': { types, module, import, default } }` — confirmed ESM import.

### Tertiary (LOW confidence)

- ARIA Authoring Practices Guide (tabs pattern) — tab/tabpanel/tablist roles, roving tabindex, Left/Right arrow navigation. [ASSUMED — standard, widely-implemented spec; no direct fetch performed]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified from npm registry; API signatures confirmed from installed node_modules
- Architecture: HIGH — patterns derived from existing code reading (actual source files) + locked CONTEXT.md decisions
- Pitfalls: HIGH — Pitfalls 1, 2, 6 verified from actual installed source; Pitfalls 3, 4, 5, 7 are confirmed-pattern risks

**Research date:** 2026-06-17
**Valid until:** 2026-07-17 (stable APIs; idb-keyval patch releases unlikely to break interface)
