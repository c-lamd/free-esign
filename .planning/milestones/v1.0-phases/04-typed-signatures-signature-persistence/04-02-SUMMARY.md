---
phase: 04-typed-signatures-signature-persistence
plan: "02"
subsystem: typed-signature-export
tags: [pdf-export, fontkit, typed-signature, font-backed, exp-02, wysiwyg]
dependency_graph:
  requires: ["04-01"]
  provides: ["fonts.ts loader", "drawSignatureText", "font-backed export branch", "lockAspectRatio fix", "typed drop in LazyPage"]
  affects: ["src/lib/exportPdf.ts", "src/components/PlacedFieldWidget.tsx", "src/components/LazyPage.tsx"]
tech_stack:
  added: ["@pdf-lib/fontkit (registration + embedFont)", "fonts.ts FONT_FILE_MAP allowlist"]
  patterns: ["hasFontBackedFields gate mirrors hasTextFields gate", "embeddedFonts Map deduplication", "drawSignatureText fit-to-box (no truncation)", "lockAspectRatio keyed on dataUrl presence"]
key_files:
  created:
    - src/lib/fonts.ts
  modified:
    - src/lib/exportPdf.ts
    - src/components/PlacedFieldWidget.tsx
    - src/components/LazyPage.tsx
    - src/test/exportPdf.test.ts
    - src/test/fieldPlacement.test.ts
decisions:
  - "fonts.ts FONT_FILE_MAP is a static 3-key allowlist; unknown families throw BEFORE fetch (T-04-04 / PRV-02)"
  - "fetch mock in exportPdf.test.ts returns REAL Dancing Script TTF bytes — fontkit rejects minimal/fake TTFs during embedFont"
  - "_clearFontBytesCache() exported for tests so stale cached bytes don't bypass fresh fetch mocks"
  - "drawSignatureText: no truncateToFit — full text scales to fit BOTH height and width (CONTEXT Area 2)"
  - "lockAspectRatio now keys on !!field.dataUrl for sig/initials, not type alone — drawn locks, typed free"
  - "LazyPage isTyped flag controls 200x56 default size and skips PNG Image() aspect-ratio block for typed drops"
  - "Both setArmedTypedPayload(null) AND setArmedFieldType(null) called after typed drop (Pitfall 6)"
metrics:
  duration_minutes: 7
  tasks_completed: 3
  tasks_total: 3
  files_created: 1
  files_modified: 5
  completed_date: "2026-06-17"
---

# Phase 04 Plan 02: Typed-Signature Export Slice Summary

**One-liner:** Font-backed (typed) signature/initials export as real embedded @pdf-lib/fontkit TTF text via drawSignatureText fit-to-box algorithm; EXP-02 byte-identity proven for typed exports; lockAspectRatio keyed on dataUrl presence; LazyPage drops typed fields from armedTypedPayload clearing both armed states.

## What Was Built

### Task 1: fonts.ts + exportPdf.ts extension

Created `src/lib/fonts.ts`:
- `FONT_FILE_MAP`: static 3-key allowlist (`Dancing Script`, `Great Vibes`, `Pacifico`)
- Module-level `fontBytesCache: Map<string, Uint8Array>` (NOT React state)
- `loadFontBytes(fontFamily)`: throws before fetch on unknown family (T-04-04/PRV-02); caches bytes
- `_clearFontBytesCache()`: exported for test isolation between font mock scenarios

Extended `src/lib/exportPdf.ts`:
- Added imports: `fontkit from '@pdf-lib/fontkit'` and `{ loadFontBytes } from './fonts'`
- `hasFontBackedFields` gate: mirrors existing `hasTextFields` pattern; guards fontkit registration
- `pdfDoc.registerFontkit(fontkit)` called BEFORE any `embedFont` (RESEARCH Pitfall 1 guard)
- `embeddedFonts: Map<string, PDFFont>` — deduplicates: each unique `fontFamily` embedded exactly once with `{ subset: true }`
- `drawSignatureText(page, text, font, field)`: fits text to box height×0.85 then scales down if width overflows — NO truncation (CONTEXT Area 2); horizontally and vertically centered
- Per-field loop: `field.dataUrl` → existing image path unchanged (T-02-01 preserved); `field.textValue && field.fontFamily` → `drawSignatureText`; neither → throws
- `saveIncremental → concat` path completely unchanged (EXP-02 preserved)

Tests added to `src/test/exportPdf.test.ts`:
- `beforeAll` fetch mock returns REAL Dancing Script TTF bytes (fontkit parses real glyph tables)
- `afterEach` clears font byte cache for test isolation
- EXP-02 typed-sig: first-512-byte identity proven for font-backed export
- Typed-initials: SIG-03 same path verified
- No-truncation: long name in narrow box exports without error (width-scale-down branch)
- Deduplication: two fields same fontFamily embed once
- Mixed: drawn + typed fields coexist
- Allowlist: `loadFontBytes('Comic Sans MS')` rejects before fetch

### Task 2: PlacedFieldWidget font-backed branch + lockAspectRatio fix + LazyPage typed drop

`src/components/PlacedFieldWidget.tsx`:
- Inside `sig || initials` block, branch on `field.dataUrl`:
  - `field.dataUrl` present → existing `<img>` drawn branch unchanged
  - `field.textValue && field.fontFamily` → font-backed `<div>` with `fontFamily: field.fontFamily` CSS (same @font-face TTF as export = WYSIWYG), computed `fontSize = Math.min(cssHeight * 0.85, cssWidth / (len * 0.6 + 0.5))`, `whiteSpace: 'nowrap'`, no `dangerouslySetInnerHTML` (T-04-06)
- Fixed `shouldLockAspectRatio`: `((sig || initials) && !!field.dataUrl) || checkbox` — drawn locks; typed resizes freely
- Added `getWrapperAriaLabel()`: typed fields get "Placed typed signature/initials — press Delete to remove"

`src/components/LazyPage.tsx`:
- Subscribe to `armedTypedPayload` and `setArmedTypedPayload` from fieldStore
- `isTyped` flag: `!!armedTypedPayload && (armedFieldType === 'signature' || 'initials')`
- dataUrl guards skip for typed drops (typed payload is sufficient)
- Defaults: typed → `200×56` CSS px (UI-SPEC); drawn → existing values + PNG aspect-ratio block
- PNG Image() aspect-ratio block guarded by `&& !isTyped` — skipped for typed drops
- `fieldPayload`: typed → `{ textValue, fontFamily }` (no dataUrl); drawn → `{ dataUrl: ... }`
- After `addField`: `setArmedTypedPayload(null)` + `setArmedFieldType(null)` (Pitfall 6)
- Added `armedTypedPayload` + `setArmedTypedPayload` to `useCallback` dependency array

### Task 3: fieldPlacement.test.ts typed-drop tests

Added `vi.mock('idb-keyval')` at module top (Pitfall 4 guard — fieldStore imports idb-keyval transitively).

Added `simulateTypedDrop()` helper: mirrors LazyPage typed branch at store level (no DOM rendering needed).

7 new typed-drop tests:
- Font-backed signature field shape: `textValue + fontFamily`, no `dataUrl`
- 200×56 PDF geometry (pdfWidth > pdfHeight, both positive)
- `armedTypedPayload` null after drop (Pitfall 6 regression guard)
- `armedFieldType` null after drop (both must be cleared)
- Typed initials drop: SIG-03 contract
- Both states null for initials drop
- CSS click coordinate round-trip through PDF space

## Test Results

- Baseline: 269 tests
- New tests added: 14 (7 exportPdf + 7 fieldPlacement)
- Final: 283/283 passing
- `npx tsc -b --noEmit`: clean

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript error: `new Uint8Array(r.arrayBuffer())` type mismatch in fonts.ts**
- **Found during:** Task 1 — `tsc -b --noEmit` compile check
- **Issue:** Chaining `new Uint8Array(await fetch(path).then(r => r.arrayBuffer()))` caused TS2769 overload error
- **Fix:** Split into two statements: `const buffer = await ...; const bytes = new Uint8Array(buffer)`
- **Files modified:** `src/lib/fonts.ts`
- **Commit:** included in 1f267b9 (Task 1)

### Design Choices (within plan spec)

**`_clearFontBytesCache()` exported for test isolation**
- The plan noted that the module-level cache could cause test interference between runs. Added a thin `_clearFontBytesCache()` helper (marked `@internal`) and called it in `afterEach`. This is a testability seam, not a production API.

**Real TTF bytes in fetch mock**
- Plan noted: "If embedFont requires valid TTF bytes to not throw, instead read a small real TTF fixture from src/test/fixtures/ and have the fetch mock return its bytes." We read `public/fonts/DancingScript-Regular.ttf` directly via Node's `readFileSync` in the test — fontkit needs real glyph tables. No minimal/fake bytes approach possible for fontkit.

**vi.mock('idb-keyval') added to fieldPlacement.test.ts**
- The plan specified: "Keep vi.mock('idb-keyval', ...) at module top if this file imports the store (it does transitively)." Added as required. Tests still pass (idb-keyval only called on async savedItem actions, not on the store actions exercised by this test file).

## Known Stubs

None — all typed-signature code is fully wired: fonts.ts loads real TTF bytes, exportPdf.ts embeds and draws real vector text, PlacedFieldWidget.tsx renders real @font-face text, LazyPage.tsx creates real font-backed PlacedField objects.

## Threat Flags

No new threat surfaces introduced beyond those already in the plan's threat model (T-04-04 through T-04-07 — all mitigated as designed).

## Self-Check

### Created/Modified Files Exist
- [x] `src/lib/fonts.ts` — created
- [x] `src/lib/exportPdf.ts` — modified
- [x] `src/components/PlacedFieldWidget.tsx` — modified
- [x] `src/components/LazyPage.tsx` — modified
- [x] `src/test/exportPdf.test.ts` — modified
- [x] `src/test/fieldPlacement.test.ts` — modified

### Commits Exist
- [x] 1f267b9 — Task 1 (fonts.ts + exportPdf.ts + export tests)
- [x] 672da45 — Task 2 (PlacedFieldWidget + LazyPage)
- [x] d7e6c88 — Task 3 (fieldPlacement typed-drop tests)

## Self-Check: PASSED
