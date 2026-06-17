---
phase: 03-full-field-types-workspace-controls
fixed_at: 2026-06-17T01:28:59Z
review_path: .planning/phases/03-full-field-types-workspace-controls/03-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 03: Code Review Fix Report

**Fixed at:** 2026-06-17T01:28:59Z
**Source review:** `.planning/phases/03-full-field-types-workspace-controls/03-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 8 (CR-01, WR-01 through WR-05, IN-01, IN-02; WR-06 was intentionally skipped per fix_scope)
- Fixed: 8
- Skipped: 0
- Final test count: 256 passed (up from 251 — 5 new tests added; zero regressions)

## Fixed Issues

### CR-01: Double history-push per field drop creates phantom undo steps

**Files modified:** `src/store/fieldStore.ts`, `src/components/LazyPage.tsx`, `src/test/fieldStore.test.ts`, `src/test/undoRedo.test.ts`
**Commit:** `a87c352`
**Applied fix:**

Two-part change to achieve exactly N undos for N field drops:

1. **`fieldStore.ts`** — Redesigned history model to single-push (one entry per user action):
   - Added `appendSnapshot()` helper that truncates the redo tail and appends one snapshot
   - Changed initial state from `history: []` / `historyIndex: -1` to `history: [[]]` / `historyIndex: 0` (seeded with empty baseline state)
   - `addField` now pushes only the post-mutation state (was: pre + post = 2 entries)
   - `deleteField` now pushes only the post-mutation state (was: pre + post = 2 entries)
   - `pushHistory` refactored to use `appendSnapshot` helper (semantics unchanged — still stores pre-drag state before `updateField`)

2. **`LazyPage.tsx`** — Removed the redundant `pushHistory()` call from `handleOverlayClick` (addField owns its own history entry). Removed `pushHistory` from the `useCallback` deps array and the store subscription.

3. **`fieldStore.test.ts`** — Updated the `resetFields` test to expect `history: [[]]` and `historyIndex: 0`.

4. **`undoRedo.test.ts`** — Added three new CR-01 regression tests: 1 add → 1 undo, 2 adds → exactly 2 undos (no phantom same-state steps), 5 adds → exactly 5 undos.

**Logic note — requires human verification:** The undo/redo semantics are correct for add/delete. For drag/resize/text-blur (pushHistory + updateField pattern), redo after drag does not restore the dragged position (the post-drag state is never stored); this is an inherent limitation of the current `pushHistory`-then-`updateField` pattern and is not tested. If redo of drag is required in a future phase, a `commitHistory` call after `updateField` would be needed.

---

### WR-03: Text overflow in PDF export

**Files modified:** `src/lib/exportPdf.ts`, `src/test/exportPdf.test.ts`
**Commit:** `875bb63`
**Applied fix:** Added `truncateToFit()` helper function using binary search on `widthOfTextAtSize()` to find the longest text prefix that fits within `(field.pdfWidth - 2)` points (subtracting the 2pt left padding). `drawTextInBox` now calls `truncateToFit` before `page.drawText`, ensuring drawn text cannot escape the field boundary and overwrite adjacent original PDF content. The checkbox helper `drawCheckboxX` was not changed (it draws a single character, already centered within the box).

Added a WR-03 regression test: exports a 200-char text field in a 60pt-wide box (without truncation it would overflow ~10× the box width), verifies no exception is thrown and EXP-02 byte identity holds.

---

### WR-04: handleInputBlur pushes history even when unchanged

**Files modified:** `src/components/PlacedFieldWidget.tsx`
**Commit:** `d3e74d2`
**Applied fix:** Added an early return in `handleInputBlur` when `localValue === (field.textValue ?? '')`. No history push, no `updateField` call — blurring without editing is now a no-op on the undo stack.

---

### WR-02: Fonts embedded unconditionally

**Files modified:** `src/lib/exportPdf.ts`
**Commit:** `7fa3f1e`
**Applied fix:** Added `hasTextFields` guard before the `embedFont` calls. Both `helvetica` and `helveticaBold` are `null` when no `date`, `text`, or `checkbox` fields are present. The two draw-dispatch sites (`drawTextInBox` and `drawCheckboxX`) use non-null assertion operators (`!`) which are safe because they are only reached when `hasTextFields` is true (TypeScript type narrowing via the `field.type` check in the loop condition). EXP-02 and all existing export tests pass unchanged.

---

### WR-01: setZoom out-of-range guard

**Files modified:** `src/store/documentStore.ts`, `src/test/documentStore.test.ts`
**Commit:** `4a5c3a2`
**Applied fix:** `setZoom` now calls `ZOOM_STEPS.includes(zoom as ZoomStep)` before `set()` and returns early if the value is not a valid step. This prevents stuck zoom buttons if `zoom` somehow holds an out-of-range value (where `indexOf` returns -1 in ZoomControl). Added a WR-01 regression test that verifies `setZoom(0.6)` leaves zoom unchanged at 1.0.

---

### WR-05: Invalid aria-selected on role=generic / role=img

**Files modified:** `src/components/PlacedFieldWidget.tsx`
**Commit:** `4656cc8`
**Applied fix:** Replaced `aria-selected={isSelected}` with `data-selected={isSelected ? 'true' : undefined}` on the wrapper `div`. The `aria-selected` attribute is only valid on widget roles (`option`, `row`, `gridcell`, `tab`, `treeitem`); the wrapper has no explicit role (defaults to generic) or `role=img` for checkbox fields, neither of which accepts `aria-selected`. The `data-selected` attribute preserves CSS-based selection styling while avoiding the ARIA violation. The existing `aria-label` already conveys selection context to assistive technology.

---

### IN-02: Fit button touch target below 44px

**Files modified:** `src/components/ZoomControl.tsx`
**Commit:** `1cd6a24`
**Applied fix:** Removed the `minWidth: 'unset'` override from the Fit button's style object. The button now inherits `minWidth: '44px'` from `buttonBase`, meeting the WCAG 2.5.5 44px minimum touch target established by the rest of the UI. The compact appearance is maintained through the existing `padding: '0 6px'`.

---

### IN-01: Duplicate delete sr-only announcement

**Files modified:** `src/components/PlacedFieldWidget.tsx`
**Commit:** `fa4a9d8`
**Applied fix:** Removed the `DELETE_SR_ONLY` constant and the inner sr-only `<span>` from the delete button. The `aria-label` on the `<button>` element alone provides a complete accessible name (`"Delete signature"` etc.) — the inner span with identical content caused double announcement on some screen readers. The visible `×` character remains.

---

## Skipped Issues

None — all 8 in-scope findings were fixed.

**WR-06 (not in fix scope):** The `eslint-disable react-hooks/exhaustive-deps` suppression in `SignatureDrawModal.tsx` and `InitialsDrawModal.tsx` was intentionally excluded per the fix scope instruction ("skip WR-06 unless trivial and safe"). The stale-closure risk is currently theoretical; addressing it would require refactoring both modals to move the Escape handler into a `useEffect`.

---

_Fixed: 2026-06-17T01:28:59Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
