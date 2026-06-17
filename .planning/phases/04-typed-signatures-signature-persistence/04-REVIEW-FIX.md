---
phase: 04-typed-signatures-signature-persistence
fixed_at: 2026-06-17T13:10:00Z
review_path: .planning/phases/04-typed-signatures-signature-persistence/04-REVIEW.md
iteration: 1
findings_in_scope: 9
fixed: 9
skipped: 0
status: all_fixed
---

# Phase 4: Code Review Fix Report

**Fixed at:** 2026-06-17T13:10:00Z
**Source review:** `.planning/phases/04-typed-signatures-signature-persistence/04-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 9
- Fixed: 9
- Skipped: 0

## Fixed Issues

### WR-01: Focus trap silently escapes in both modals

**Files modified:** `src/components/SignatureDrawModal.tsx`, `src/components/InitialsDrawModal.tsx`
**Commit:** 1924fa3
**Applied fix:** Added `.filter((el) => !el.closest('[hidden]') && !el.closest('[aria-hidden="true"]'))` after the `Array.from(allFocusable)` call in both modals' focus-trap handlers. This excludes nodes inside hidden tab panels before computing `first`/`last`, ensuring the wrap logic only considers actually-focusable visible elements.

---

### WR-02: Duplicate HTML `id` from shared `saveForReuseRow` JSX variable

**Files modified:** `src/components/SignatureDrawModal.tsx`, `src/components/InitialsDrawModal.tsx`, `src/test/signatureDraw.test.ts`
**Commit:** ac8ab77
**Applied fix:** Replaced the shared `saveForReuseRow` JSX constant with a `renderSaveForReuseRow(panelKey: 'draw' | 'type')` render function that constructs a panel-specific `id` (`sig-save-for-reuse-draw` / `sig-save-for-reuse-type` in SignatureDrawModal; `ini-save-for-reuse-draw` / `ini-save-for-reuse-type` in InitialsDrawModal). Each call site passes its panel key. Updated the test that located the checkbox by `#sig-save-for-reuse` to use `#sig-save-for-reuse-type` (the Type panel checkbox it was clicking).

---

### WR-03: `SavedItemCard` exposes `role="radio"` with no keyboard activation handler

**Files modified:** `src/components/SavedItemCard.tsx`
**Commit:** 380cb60
**Applied fix:** Added an `onKeyDown` handler to the card `div` that calls `onSelect(item.id)` on `Enter` or `Space` (with `preventDefault` on Space to suppress page scroll). The handler is placed immediately after the existing `onClick`.

---

### WR-04: `fetch` response not checked for HTTP success

**Files modified:** `src/lib/fonts.ts`, `src/test/exportPdf.test.ts`
**Commit:** 1fa3b64
**Applied fix:** Replaced the chained `.then((r) => r.arrayBuffer())` with an explicit `response.ok` check before reading the buffer. A non-ok response now throws `Failed to fetch font "${fontFamily}": HTTP ${response.status}` without caching the failure, so a subsequent export attempt re-fetches. Updated the test-suite `fetch` mock to include `ok: true, status: 200`. Added a new test (`WR-04`) that verifies a 404 throws the correct error and does not cache the failure.

---

### WR-05: `img.naturalHeight === 0` produces `aspectRatio = Infinity`, then `defaultHeightPx = 0`

**Files modified:** `src/components/LazyPage.tsx`
**Commit:** 61af75f
**Applied fix:** Replaced the `|| fallback` idiom with an explicit guard: `img.naturalWidth > 0 && img.naturalHeight > 0 ? img.naturalWidth / img.naturalHeight : fallback`. This prevents `Infinity` (which is truthy and bypasses `||`) from propagating into the placed field's `pdfHeight`.

---

### IN-01: Font picker radiogroup has no arrow-key navigation

**Files modified:** `src/components/SignatureDrawModal.tsx`, `src/components/InitialsDrawModal.tsx`
**Commit:** f2a1697
**Applied fix:** Extended each font radio item's existing `onKeyDown` handler to also handle `ArrowRight`/`ArrowDown` (move to next font, wrap) and `ArrowLeft`/`ArrowUp` (move to previous font, wrap). The handler updates `selectedFont` state and moves DOM focus to the newly selected radio element, implementing the ARIA roving tabIndex pattern for radiogroups. The `FONTS.map` callback was updated from `(font)` to `(font, fontIdx)` to provide the index for wrap-around arithmetic.

---

### IN-02: `console.warn` statements surface in production

**Files modified:** `src/store/fieldStore.ts`
**Commit:** 8f4ac3e
**Applied fix:** All three `console.warn` calls (in `loadSavedItems`, `addSavedItem`, and `deleteSavedItem`) are now gated behind `if (import.meta.env.DEV)`. Vite tree-shakes this guard in production builds.

---

### IN-03: Embed loop condition looser than `hasFontBackedFields` guard

**Files modified:** `src/lib/exportPdf.ts`
**Commit:** 55ee94c
**Applied fix:** Added `field.textValue &&` to the embed loop condition, making it `field.textValue && field.fontFamily && !embeddedFonts.has(field.fontFamily)`. This mirrors the `hasFontBackedFields` guard and prevents embedding fonts for fields that have `fontFamily` but no `textValue` (which would never be drawn anyway).

---

### IN-04: `drawSignatureText` can compute `finalSize <= 0` for degenerate field dimensions

**Files modified:** `src/lib/exportPdf.ts`
**Commit:** 8e2ba51
**Applied fix:** Moved the `maxWidth = field.pdfWidth - padding` computation to before the height-based size calculation, and added `if (maxWidth <= 0) return` early exit. This prevents negative `finalSize` values when `pdfWidth <= 4pt`. The guard fires before any font metric calls, keeping the function a no-op for degenerate inputs.

---

## Skipped Issues

None — all findings were fixed.

---

_Fixed: 2026-06-17T13:10:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
