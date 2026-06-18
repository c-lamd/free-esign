---
phase: 04-typed-signatures-signature-persistence
verified: 2026-06-17T13:00:00Z
status: human_needed
score: 16/16 must-haves verified
overrides_applied: 0
human_verification:
  - test: "In the browser, open the signature modal, switch to the Type tab, type a name, select each of the 3 fonts, and confirm the live preview updates to render in the correct script font"
    expected: "Preview renders text visually in Dancing Script, Great Vibes, and Pacifico respectively — crisp, not pixelated (real @font-face, not fallback)"
    why_human: "CSS @font-face font rendering cannot be verified programmatically; WYSIWYG match between on-screen preview and export output requires visual inspection"
  - test: "After confirming a typed signature with 'Save for reuse' checked, close and fully reload the browser tab, then reopen the signature modal to the Saved tab"
    expected: "The previously created typed signature appears in the Saved tab and is placeable (SIG-04 cross-session persistence via IndexedDB)"
    why_human: "IndexedDB persistence across browser sessions cannot be verified in jsdom; requires a real browser"
  - test: "Delete a saved item from the Saved tab, then reload the browser tab and confirm it is gone"
    expected: "Deleted item does not reappear after reload (SIG-05 + IndexedDB delete)"
    why_human: "Same as above — requires a real browser with persistent IndexedDB"
  - test: "Place a typed signature (e.g. 'Jane Doe' in Dancing Script), download the PDF, and open it in a PDF viewer"
    expected: "The typed signature appears as crisp embedded vector text at all zoom levels — the glyph outlines scale cleanly, matching the on-screen font preview (WYSIWYG). Text is not a raster PNG."
    why_human: "PDF viewer glyph rendering and zoom quality require visual inspection; cannot verify vector vs raster from bytes alone"
  - test: "Open DevTools Network tab, open the signature modal, select Type, confirm a typed signature, and download. Observe all network requests."
    expected: "Only /fonts/*.ttf same-origin requests during the export — zero third-party CDN or font.gstatic.com requests (PRV-02)"
    why_human: "Network request origin filtering for font fetches requires a real browser DevTools session"
  - test: "Repeat the typed-signature flow using the initials modal — confirm Create initials modal shows Saved/Draw/Type tabs, typed initials arm correctly, and 'Save for reuse' persists initials separately from signatures"
    expected: "Saved tab in initials modal shows only initials items (kind='initials'); signature items do not appear there"
    why_human: "Kind-filtering of saved items in the UI requires visual browser verification"
---

# Phase 4: Typed Signatures + Signature Persistence — Verification Report

**Phase Goal:** Users can create signatures by typing their name in a script font, and can save any signature/initials to reuse across browser sessions without re-drawing.
**Verified:** 2026-06-17T13:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                                           | Status     | Evidence                                                                                                                                 |
|----|-----------------------------------------------------------------------------------------------------------------|------------|------------------------------------------------------------------------------------------------------------------------------------------|
| 1  | @pdf-lib/fontkit@1.1.1 and idb-keyval@6.2.5 are installed and exact-pinned                                     | VERIFIED   | `package.json` has `"@pdf-lib/fontkit": "1.1.1"` and `"idb-keyval": "6.2.5"` (no caret); confirmed by `node -e` check returning "deps pinned OK" |
| 2  | The 3 script TTFs and their OFL licenses exist in public/fonts/ at the correct paths                           | VERIFIED   | `ls public/fonts/` shows all 6 files: DancingScript-Regular.ttf, GreatVibes-Regular.ttf, Pacifico-Regular.ttf + 3 LICENSE.txt files      |
| 3  | @font-face declarations for all 3 fonts exist in src/index.css with font-display: block                        | VERIFIED   | src/index.css lines 14–36: exactly 3 `@font-face` blocks for "Dancing Script", "Great Vibes", "Pacifico"; each has `font-display: block` |
| 4  | PlacedField carries optional fontFamily; store exposes armedTypedPayload seam                                   | VERIFIED   | fieldStore.ts line 38: `fontFamily?: string`; lines 119, 129: `armedTypedPayload` state + `setArmedTypedPayload` action in FieldStore    |
| 5  | addSavedItem persists to IndexedDB and updates savedItems; deleteSavedItem removes from both; loadSavedItems hydrates | VERIFIED   | fieldStore.ts lines 308–332: optimistic state update then `addItem()`/`deleteItem()` from savedSignatures.ts; `loadAll()` on load; proven by 13 tests in savedItems.test.ts |
| 6  | The 256-baseline test suite stays green (idb-keyval mocked in tests importing fieldStore)                       | VERIFIED   | `npm test -- --run` produces 295/295 PASS; `vi.mock('idb-keyval')` present in savedItems.test.ts (line 15), fieldStore.test.ts, fieldPlacement.test.ts, signatureDraw.test.ts |
| 7  | A font-backed (typed) signature/initials field exports as real embedded vector text, never a rasterized PNG     | VERIFIED   | exportPdf.ts lines 250–254: `else if (field.textValue && field.fontFamily)` → `drawSignatureText`; no `embedPng` path for typed fields; EXP-02 test at line 347 passes |
| 8  | drawSignatureText scales text to fit BOTH box height and width without truncation                               | VERIFIED   | exportPdf.ts lines 115–134: fit-to-height first, then scale down if width overflows (`finalSize = sizeFromHeight * (maxWidth / textWidthAtTarget)`); `truncateToFit` NOT called; no-truncation test at exportPdf.test.ts line 384 passes |
| 9  | EXP-02 holds for a typed-signature export: first 512 bytes byte-identical to input                             | VERIFIED   | exportPdf.test.ts lines 347–365: explicit EXP-02 assertion on typed path (`outputFirst512 === inputFirst512`); test passes              |
| 10 | A placed typed signature/initials renders its text on screen in the matching @font-face script font (WYSIWYG)  | VERIFIED   | PlacedFieldWidget.tsx lines 206–233: `fontFamily: field.fontFamily` in inline style; same family name as @font-face declaration in index.css; wired to field.textValue as text node (not PNG) |
| 11 | A typed field resizes freely (lockAspectRatio false); a drawn field still locks aspect ratio                    | VERIFIED   | PlacedFieldWidget.tsx lines 302–304: `shouldLockAspectRatio = ((sig || initials) && !!field.dataUrl) || checkbox` — keyed on `!!field.dataUrl`, not type alone |
| 12 | Dropping a typed field uses armedTypedPayload and clears BOTH armedTypedPayload and armedFieldType afterward    | VERIFIED   | LazyPage.tsx lines 196–224: `fieldPayload = { textValue, fontFamily }` when `isTyped`; lines 223–224: `setArmedTypedPayload(null)` + `setArmedFieldType(null)` both called; 7 tests in fieldPlacement.test.ts prove it |
| 13 | Font bytes load same-origin via static FONT_FILE_MAP allowlist; unknown families throw before any fetch         | VERIFIED   | fonts.ts lines 25–61: `FONT_FILE_MAP` has exactly 3 keys; `if (!path) throw new Error('Unknown font family...')` at line 55 before any `fetch()`; allowlist test in exportPdf.test.ts line 463 passes |
| 14 | Both modals are tabbed (Saved/Draw/Type) with focus trap retained and Escape preserved                          | VERIFIED   | SignatureDrawModal.tsx: `role="tablist"` at line 894; focus trap query `'button, canvas[tabindex="0"], input, [role="radio"]'` at line 155; Escape handler at line 143. InitialsDrawModal.tsx mirrors identically |
| 15 | SavedItemCard renders drawn (img) and typed (text) branches with a delete control (role=radio, stopPropagation) | VERIFIED   | SavedItemCard.tsx lines 109–133: `item.dataUrl` → `<img>`; `item.text && item.fontFamily` → `<div>` with fontFamily; line 30: `e.stopPropagation()` on delete; line 83: `role="radio"`; 6 isolated tests in signatureDraw.test.ts |
| 16 | App.tsx hydrates savedItems from IndexedDB on mount via useEffect                                               | VERIFIED   | App.tsx lines 35–40: `const loadSavedItems = useFieldStore((s) => s.loadSavedItems)` + `useEffect(() => { loadSavedItems() }, [loadSavedItems])` |

**Score:** 16/16 truths verified

### Required Artifacts

| Artifact                                    | Expected                                                                    | Status   | Details                                                                                           |
|---------------------------------------------|-----------------------------------------------------------------------------|----------|---------------------------------------------------------------------------------------------------|
| `src/lib/fonts.ts`                          | FONT_FILE_MAP allowlist + loadFontBytes + module-level cache                | VERIFIED | 72 lines; `FONT_FILE_MAP` at line 25 (3 keys); cache at line 35; throw-before-fetch guard at line 55 |
| `src/lib/savedSignatures.ts`                | idb-keyval helpers keyed by 'savedSignatureItems'                           | VERIFIED | `IDB_KEY = 'savedSignatureItems'` at line 21; `loadAll`/`addItem`/`deleteItem` all present        |
| `src/store/fieldStore.ts`                   | fontFamily on PlacedField, SavedItem, savedItems slice, armedTypedPayload   | VERIFIED | Lines 38, 50–58, 119, 122, 129, 144–146, 180, 308–332                                            |
| `src/lib/exportPdf.ts`                      | registerFontkit + embedFont + drawSignatureText + font-backed branch        | VERIFIED | Lines 36 (fontkit import), 202 (registerFontkit), 200–215 (embeddedFonts Map), 115–134 (drawSignatureText), 250–254 (font-backed branch) |
| `src/components/PlacedFieldWidget.tsx`      | Font-backed render branch + dataUrl-keyed lockAspectRatio                   | VERIFIED | Lines 206–233 (typed branch); lines 302–304 (lockAspectRatio fix); line 74–80 (getWrapperAriaLabel) |
| `src/components/LazyPage.tsx`               | armedTypedPayload drop branch + 200×56 defaults + dual armed-state clear    | VERIFIED | Lines 55, 64, 135–137 (isTyped), 143–144 (200×56 default), 196–197 (fieldPayload), 223–224 (both clears) |
| `src/components/SignatureDrawModal.tsx`      | tabbed Saved/Draw/Type with role=tablist                                    | VERIFIED | 939 lines; `role="tablist"` at line 894; `setArmedTypedPayload` at line 36, 232; `maxLength={100}` at line 567 |
| `src/components/InitialsDrawModal.tsx`       | tabbed modal for initials (kind 'initials')                                 | VERIFIED | 944 lines; `role="tablist"` at line 899; `kind: 'initials'` in all item constructions; mirrors SignatureDrawModal |
| `src/components/SavedItemCard.tsx`           | thumbnail card with role=radio + drawn/typed branches + delete              | VERIFIED | `role="radio"` at line 83; drawn branch at line 111; typed branch at line 116; stopPropagation at line 30 |
| `src/App.tsx`                               | useEffect calling loadSavedItems on mount                                   | VERIFIED | Lines 35–40; `loadSavedItems` imported from fieldStore, called in useEffect with stable dep      |
| `public/fonts/DancingScript-Regular.ttf`    | Real TTF served same-origin                                                 | VERIFIED | File exists at correct path; exportPdf.test.ts reads it with `readFileSync` and fontkit parses it successfully |
| `public/fonts/GreatVibes-Regular.ttf`       | Real TTF served same-origin                                                 | VERIFIED | File exists                                                                                       |
| `public/fonts/Pacifico-Regular.ttf`         | Real TTF served same-origin                                                 | VERIFIED | File exists                                                                                       |
| `src/test/savedItems.test.ts`               | SIG-04/SIG-05 store tests with mocked idb-keyval                            | VERIFIED | 13 tests; `vi.mock('idb-keyval')` at line 15; covers addSavedItem, loadSavedItems, deleteSavedItem, setArmedTypedPayload, resetFields-preserves-savedItems |

### Key Link Verification

| From                              | To                          | Via                                         | Status   | Details                                                                                                                |
|-----------------------------------|-----------------------------|---------------------------------------------|----------|------------------------------------------------------------------------------------------------------------------------|
| `src/store/fieldStore.ts`         | `src/lib/savedSignatures.ts` | `addSavedItem`/`deleteSavedItem`/`loadSavedItems` call helpers | VERIFIED | fieldStore.ts line 22: `import { loadAll, addItem, deleteItem } from '../lib/savedSignatures'`; used at lines 296, 311, 325 |
| `src/lib/savedSignatures.ts`      | `idb-keyval`                | `import { get, set } from 'idb-keyval'`     | VERIFIED | savedSignatures.ts line 16; `get`/`set` used in `loadAll`, `addItem`, `deleteItem`                                    |
| `src/lib/exportPdf.ts`            | `src/lib/fonts.ts`          | `loadFontBytes` import for embedFont        | VERIFIED | exportPdf.ts line 41: `import { loadFontBytes } from './fonts'`; used at line 211                                     |
| `src/lib/exportPdf.ts`            | `@pdf-lib/fontkit`          | `registerFontkit(fontkit)` before embedFont | VERIFIED | exportPdf.ts line 36: `import fontkit from '@pdf-lib/fontkit'`; line 202: `pdfDoc.registerFontkit(fontkit)` inside `hasFontBackedFields` gate |
| `src/components/LazyPage.tsx`     | `src/store/fieldStore.ts`   | `armedTypedPayload` + `setArmedTypedPayload` subscription | VERIFIED | LazyPage.tsx lines 55, 64: subscribed; lines 135–137, 196–197, 223: used; line 238: in useCallback dep array          |
| `src/App.tsx`                     | `src/store/fieldStore.ts`   | `useEffect → loadSavedItems` on mount       | VERIFIED | App.tsx lines 35–40: `useFieldStore` subscription + `useEffect` call                                                  |
| `src/components/SignatureDrawModal.tsx` | `src/store/fieldStore.ts` | `setArmedTypedPayload` + `addSavedItem` + `savedItems` | VERIFIED | SignatureDrawModal.tsx lines 36–39: all three selectors; lines 232, 215: used in confirm handlers                     |
| `src/components/SavedItemCard.tsx` | `src/store/fieldStore.ts`  | `onDelete` → `deleteSavedItem`              | VERIFIED | SavedItemCard receives `onDelete` prop; SignatureDrawModal passes `deleteSavedItem` at line 816; stopPropagation at line 30 |

### Data-Flow Trace (Level 4)

| Artifact                          | Data Variable   | Source                                             | Produces Real Data | Status   |
|-----------------------------------|-----------------|----------------------------------------------------|--------------------|----------|
| `SignatureDrawModal.tsx` Saved tab | `savedItems`   | `useFieldStore((s) => s.savedItems)` (line 39) ← `loadSavedItems()` in App.tsx ← idb-keyval `get('savedSignatureItems')` | Yes — real IndexedDB read in production; mocked in tests | FLOWING  |
| `SavedItemCard.tsx`               | `item.dataUrl` / `item.text` | Passed from savedItems state via parent | Yes — comes from real SavedItem objects stored/loaded from IndexedDB | FLOWING  |
| `PlacedFieldWidget.tsx`           | `field.textValue`, `field.fontFamily` | `fields` slice in fieldStore; populated by `addField` in LazyPage on typed drop | Yes — set from `armedTypedPayload` at LazyPage line 197 | FLOWING  |
| `exportPdf.ts` typed branch       | `field.textValue`, `field.fontFamily`, font bytes | `embeddedFonts.get(fontFamily)` from `loadFontBytes` (real TTF fetch) | Yes — real font embed from same-origin TTF | FLOWING  |

### Behavioral Spot-Checks

| Behavior                              | Command                                                     | Result                           | Status |
|---------------------------------------|-------------------------------------------------------------|----------------------------------|--------|
| TypeScript compiles cleanly           | `npx tsc -b --noEmit`                                       | No output (exit 0)               | PASS   |
| Full test suite                       | `npm test -- --run`                                         | 295/295 passed in 1.70s          | PASS   |
| EXP-02 typed-sig test exists and runs | Enumerated via test file line 347; verified in suite output | Part of 295 passing tests        | PASS   |
| Allowlist throws before fetch         | fonts.ts line 55; test at exportPdf.test.ts line 463        | Part of 295 passing tests        | PASS   |
| savedItems.test.ts (13 tests)         | All 13 SIG-04/SIG-05 store tests in the suite               | Part of 295 passing tests        | PASS   |
| 3 real TTF files parseable by fontkit | `readFileSync(DancingScript-Regular.ttf)` in test beforeAll | fontkit parses successfully (EXP-02 typed test passes) | PASS   |

### Probe Execution

Step 7c: SKIPPED — no `scripts/*/tests/probe-*.sh` files declared or found. No PLAN/SUMMARY probe declarations.

### Requirements Coverage

| Requirement | Source Plan | Description                                                        | Status    | Evidence                                                                                                    |
|-------------|-------------|--------------------------------------------------------------------|-----------|-------------------------------------------------------------------------------------------------------------|
| SIG-02      | 04-02, 04-03 | User can create a signature by typing and choosing among script fonts | SATISFIED | Type panel in SignatureDrawModal with 3-font picker; confirmed by typed-export tests; `drawSignatureText` embeds real TTF text |
| SIG-03      | 04-02, 04-03 | User can create reusable initials (drawn or typed)                 | SATISFIED | InitialsDrawModal mirrors SignatureDrawModal; typed initials use same export path (SIG-03 test at exportPdf.test.ts line 367) |
| SIG-04      | 04-01, 04-03 | Saved signatures and initials persist in the browser across sessions (IndexedDB) | SATISFIED (human verification needed for cross-session) | `savedSignatures.ts` wraps idb-keyval; `loadSavedItems` called on app mount; 13 store tests pass with mocked idb-keyval |
| SIG-05      | 04-01, 04-03 | User can view and delete their saved signatures and initials       | SATISFIED | Saved tab in both modals renders SavedItemCard grid; `deleteSavedItem` wired to card delete button; store test verifies removal |

No orphaned requirements: all 4 requirement IDs declared in PLAN frontmatter have implementation evidence.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | No TBD/FIXME/XXX markers found in Phase 4 files | — | — |

Anti-pattern scan on all Phase 4 modified files: no unreferenced `TBD`, `FIXME`, `XXX`, `PLACEHOLDER`, or empty-implementation stubs detected. `return null` appears only as modal guard (`if (!modalOpen) return null`) which is correct behavior, not a stub. Hardcoded `[]` initial states are all overwritten by real async actions before render.

### Human Verification Required

The 6 items in the frontmatter `human_verification` section require browser testing that cannot be exercised programmatically:

**1. Typed signature font rendering (WYSIWYG)**

**Test:** Open the signature modal → Type tab → enter a name → switch between Dancing Script, Great Vibes, and Pacifico.
**Expected:** Live preview renders crisp text in the selected script font; no fallback/system font substitution.
**Why human:** CSS @font-face glyph rendering quality and font fallback detection require visual inspection.

**2. Cross-session IndexedDB persistence (SIG-04)**

**Test:** Save a typed signature with "Save for reuse" checked → fully close and reopen the browser tab → open Saved tab.
**Expected:** Previously saved item appears in the Saved tab and is placeable.
**Why human:** jsdom has no real IndexedDB; Vitest tests use mocks. Cross-session persistence requires a live browser.

**3. Cross-session delete persistence (SIG-05)**

**Test:** Delete a saved item → reload the browser tab → confirm it is gone.
**Expected:** Deleted item does not reappear after reload.
**Why human:** Same as above.

**4. Vector text quality in exported PDF**

**Test:** Place a typed signature (e.g. "Jane Doe" in Dancing Script) → download → open in PDF viewer → zoom in.
**Expected:** Text is crisp vector at all zoom levels (not a raster PNG).
**Why human:** PDF viewer rendering and zoom quality require visual inspection; byte-identity alone does not prove vector vs raster quality.

**5. No third-party network requests (PRV-02)**

**Test:** DevTools Network tab open → open modal → confirm typed signature → download. Observe all requests.
**Expected:** Only same-origin `/fonts/*.ttf` requests. Zero font.gstatic.com or CDN requests.
**Why human:** Network origin filtering for font fetches requires a real browser DevTools session.

**6. Initials modal kind-filtering**

**Test:** Create a typed signature and a typed initials item → open each modal's Saved tab.
**Expected:** Signature modal Saved tab shows only `kind='signature'` items; initials modal shows only `kind='initials'` items. Items do not cross-contaminate.
**Why human:** Kind-filtering in the Saved tab UI requires visual browser verification.

### Gaps Summary

No gaps. All 16 must-haves are VERIFIED. All 4 requirement IDs (SIG-02, SIG-03, SIG-04, SIG-05) are SATISFIED. The `saveIncremental → concat` path in `exportPdf.ts` is unchanged (lines 270–278). The date/text/checkbox branches in the per-field loop are also unchanged. TypeScript compiles with zero errors. 295/295 tests pass.

Status is `human_needed` solely because 6 browser-level behaviors (font rendering quality, real IndexedDB persistence, PDF vector text quality, network request verification, and UI kind-filtering) require a live browser session that cannot be exercised in jsdom.

---

_Verified: 2026-06-17_
_Verifier: Claude (gsd-verifier)_
