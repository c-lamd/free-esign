---
phase: 03-full-field-types-workspace-controls
reviewed: 2026-06-17T00:00:00Z
depth: deep
files_reviewed: 16
files_reviewed_list:
  - src/store/fieldStore.ts
  - src/store/documentStore.ts
  - src/lib/exportPdf.ts
  - src/lib/fileValidation.ts
  - src/components/FieldPalette.tsx
  - src/components/ZoomControl.tsx
  - src/components/UndoRedoControls.tsx
  - src/components/InitialsDrawModal.tsx
  - src/components/WordDocBanner.tsx
  - src/components/LazyPage.tsx
  - src/components/PlacedFieldWidget.tsx
  - src/components/DocumentViewer.tsx
  - src/components/TopBar.tsx
  - src/components/PlacementModeOverlay.tsx
  - src/components/UploadZone.tsx
  - src/components/SignatureDrawModal.tsx
findings:
  critical: 1
  warning: 6
  info: 2
  total: 9
status: findings
---

# Phase 03: Code Review Report

**Reviewed:** 2026-06-17
**Depth:** deep
**Files Reviewed:** 16
**Status:** findings

## Summary

Phase 3 adds five field types, undo/redo history, per-type PDF drawing, zoom control, Word-doc detection, and the InitialsDrawModal. The EXP-02 zero-alteration export pipeline is correctly wired: `takeSnapshot` precedes drawing, `markRefForSave` is called before each page draw, fonts are embedded once outside the loop, and `saveIncremental` + `concat` keeps the original bytes at offset 0. The keyboard shortcut logic for undo/redo is correct and the INPUT/TEXTAREA guard fires first.

The critical finding is a logic error in the undo/redo history system: `LazyPage.handleOverlayClick` calls `pushHistory()` before `addField()`, but `addField` internally pushes two snapshots (pre + post) itself. The triple-push creates phantom undo steps that scale with the number of fields added — after placing N fields the undo button is enabled for an extra N phantom operations that produce no visible state change. The implementation comment on lines 196-201 acknowledges the internal double-push but proceeds anyway, producing the wrong behavior.

## Critical Issues

### CR-01: Double history-push per field drop creates phantom undo steps that scale with field count

**File:** `src/components/LazyPage.tsx:196-201`

**Issue:** `handleOverlayClick` calls `pushHistory()` immediately before `addField()`. The `addField` action already pushes two history entries internally (pre-mutation snapshot and post-mutation snapshot). The redundant `pushHistory()` call adds a third entry per field drop.

Traced state for adding a single field from clean state:
1. `pushHistory()`: `history=[[ ]]`, `historyIndex=0`
2. `addField(f1)`: reads `historyIndex=0`, slices at index 1, then pushes pre-state `[]` again and post-state `[f1]`: `history=[[], [], [f1]]`, `historyIndex=2`

Now for N fields added:
- 1 field: 3 entries, 1 phantom undo
- 2 fields: 6 entries, 3 phantom undos (the `addField` for f2 duplicates the `[f1]` snapshot twice)
- N fields: N×3 entries, growing phantom tails

After placing two fields, the undo stack depth is 6 but only 2 meaningful states exist (`[]`, `[f1]`, `[f1,f2]`). `canUndo` reports `true` for 3 extra operations that return an identical empty or single-field state. The Undo button remains enabled and active during these phantom steps, making the feature unreliable.

The code comment at line 196-201 explicitly notes that `addField` pushes history internally and states "We call pushHistory here to comply with the plan spec", which means the spec and the implementation are in conflict — the implementation is wrong.

**Fix:** Remove the `pushHistory()` call from `handleOverlayClick`. `addField` already handles the complete pre+post history snapshot pair, which is sufficient for one-step undo of a field placement:

```tsx
// REMOVE this line (LazyPage.tsx:200):
// pushHistory()

addField(newField)           // addField internally pushes pre + post snapshots
setSelectedFieldId(newField.id)
setArmedFieldType(null)
```

Alternatively, if the intent is to rely solely on explicit `pushHistory()` calls, remove the internal history push from `addField` and `deleteField` and update all callers consistently. The simpler fix is the one-line removal above.

## Warnings

### WR-01: zoom field typed as `number` instead of `ZoomStep` — stuck buttons if invalid value set

**File:** `src/store/documentStore.ts:42`

**Issue:** The `zoom` field in `DocumentStore` is typed as `number`. `ZoomControl.handleZoomOut` and `handleZoomIn` use `ZOOM_STEPS.indexOf(zoom as ...)` to find the current index. If `zoom` holds a value not in `ZOOM_STEPS` (e.g. `0.6`), `indexOf` returns `-1`. `handleZoomOut` then silently no-ops (the `idx > 0` branch is false), but `isAtMin = 0.6 <= 0.5 = false` so the button renders as enabled. The zoom-out button is clickable but permanently stuck. No current code path produces this, but `setZoom(z: number)` is unvalidated.

**Fix:**
```ts
// documentStore.ts — change zoom field type
import { ZOOM_STEPS } from './documentStore'
type ZoomStep = (typeof ZOOM_STEPS)[number]

// In DocumentStore interface:
zoom: ZoomStep

// In setZoom action:
setZoom: (z: ZoomStep) => set({ zoom: z }),
```
Or at minimum add a runtime guard in `setZoom`:
```ts
setZoom: (z: number) => {
  if (!ZOOM_STEPS.includes(z as ZoomStep)) return
  set({ zoom: z })
},
```

### WR-02: Helvetica and HelveticaBold embedded unconditionally — unnecessary bytes in signature-only exports

**File:** `src/lib/exportPdf.ts:102-103`

**Issue:** Both `StandardFonts.Helvetica` and `StandardFonts.HelveticaBold` are embedded before the field loop regardless of whether any `date`, `text`, or `checkbox` fields are present. A document that contains only `signature` and `initials` fields gets two unused font objects appended to the incremental revision, unnecessarily inflating the output.

**Fix:**
```ts
const hasTextFields = fields.some(
  (f) => f.type === 'date' || f.type === 'text' || f.type === 'checkbox'
)
const helvetica = hasTextFields
  ? await pdfDoc.embedFont(StandardFonts.Helvetica)
  : null
const helveticaBold = hasTextFields
  ? await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  : null
```
Then update the draw dispatches to use `helvetica!` / `helveticaBold!` (guarded by the type check that requires them).

### WR-03: `drawTextInBox` does not clip text to field width — long strings overflow into adjacent PDF content

**File:** `src/lib/exportPdf.ts:42-54`

**Issue:** `page.drawText()` in pdf-lib has no `maxWidth` or clipping path. A user who types a string wider than the field (which is visually hidden by `overflow: hidden` in the UI) will see the full unclipped string rendered in the PDF, potentially overwriting adjacent text or images. This is a functional correctness issue: the exported PDF does not match what the user saw in the editor.

**Fix:** Truncate the text to the portion that fits within `field.pdfWidth - 2` points before drawing:
```ts
function truncateToFit(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text
  let lo = 0, hi = text.length
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2)
    if (font.widthOfTextAtSize(text.slice(0, mid), size) <= maxWidth) lo = mid
    else hi = mid - 1
  }
  return text.slice(0, lo)
}
```
Call before `page.drawText`.

### WR-04: `handleInputBlur` pushes a history entry even when text is unchanged

**File:** `src/components/PlacedFieldWidget.tsx:163-167`

**Issue:** Every time a `date` or `text` field input is focused and then blurred — even without any editing — `pushHistory()` and `updateField()` are called unconditionally. This creates phantom undo entries for no-op edits and causes the Undo button to become enabled after a user simply clicks on a field and then clicks away. Combined with the CR-01 double-push issue, this further inflates the history stack and degrades Undo reliability.

**Fix:**
```ts
function handleInputBlur() {
  setIsEditing(false)
  if (localValue === (field.textValue ?? '')) return  // no change — skip history
  pushHistory()
  updateField(field.id, { textValue: localValue })
}
```

### WR-05: `aria-selected` on `role=generic` (div) and `role=img` is an ARIA violation

**File:** `src/components/PlacedFieldWidget.tsx:285`

**Issue:** The outer wrapper `div` uses `aria-selected={isSelected}`. The `aria-selected` state is only defined for widget roles including `option`, `row`, `gridcell`, `tab`, and `treeitem` (ARIA 1.2 spec). For non-checkbox fields the wrapper has no explicit role (defaults to generic), and for checkbox fields it has `role="img"`. Neither accepts `aria-selected`. Screen readers will either ignore the attribute or announce it in undefined ways.

**Fix:** Remove `aria-selected` from the wrapper `div`. Use a `data-selected` attribute for CSS-based selection styling, and expose selection state to AT via the existing `aria-label` (which already says "press Delete to remove", implying the field is already selected). If programmatic selection announcement is needed, use an `aria-live` region in the page overlay instead.

### WR-06: `handleKeyDown` in both draw modals suppresses `react-hooks/exhaustive-deps` with missing `handleDiscard`/`handleClose` dependencies

**File:** `src/components/SignatureDrawModal.tsx:118` and `src/components/InitialsDrawModal.tsx:127`

**Issue:** The `useCallback` for `handleKeyDown` lists only `[hasStrokes]` in its deps array, with an `eslint-disable-next-line react-hooks/exhaustive-deps` suppression. `handleDiscard` and `handleClose` are called from inside `handleKeyDown` but are not in the deps. Both functions are defined as plain function declarations (not `useCallback`), so a new function reference is created on every render. The stale closure is currently harmless because `handleClose` only calls `closeModal/closeInitialsModal` (stable Zustand actions) and reads `triggerRef` (a ref). However, the suppression hides the warning and the pattern will silently break if anything referencing a captured state variable is added to `handleClose`.

**Fix:** Move the Escape handler into a dedicated `useEffect` that depends on `armedFieldType`/`initialsModalOpen` to avoid the closure issue entirely, or memoize `handleDiscard` and `handleClose` with `useCallback` and include them in the deps array (removing the suppress comment).

## Info

### IN-01: `DELETE_SR_ONLY` duplicates `DELETE_ARIA_LABEL` verbatim — double announcement to screen readers

**File:** `src/components/PlacedFieldWidget.tsx:76-82`

**Issue:** The delete button has both `aria-label={DELETE_ARIA_LABEL[field.type]}` and an inner `<span>` containing `DELETE_SR_ONLY[field.type]`. Both records contain identical strings (e.g., `"Delete signature"`). Screen readers compute the accessible name from `aria-label` and will announce `DELETE_ARIA_LABEL`. Some screen readers also read visible text (or sr-only text) in addition, resulting in "Delete signature Delete signature".

**Fix:** Remove the `DELETE_SR_ONLY` constant and the inner sr-only `<span>`. The `aria-label` attribute alone provides a complete accessible name for the button. If visible text is desired for sighted users with a screen magnifier, use a Tooltip instead.

### IN-02: `Fit` button overrides `minWidth` to `unset`, shrinking touch target below 44px

**File:** `src/components/ZoomControl.tsx:201`

**Issue:** The Fit button sets `minWidth: 'unset'` to override the base `buttonBase` style. The text "Fit" is approximately 26px wide, making the effective touch target smaller than the 44px minimum established by the rest of the UI (WCAG 2.5.5, cited in ZoomControl's own JSDoc).

**Fix:** Remove the `minWidth: 'unset'` override so the button inherits `minWidth: '44px'` from `buttonBase`, or set `padding: '0 16px'` instead to keep the button compact while preserving touch target size.

---

_Reviewed: 2026-06-17_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
