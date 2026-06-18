---
phase: 03-full-field-types-workspace-controls
plan: 01
subsystem: ui
tags: [zustand, pdf-lib, typescript, undo-redo, field-types]

requires:
  - phase: 02-core-signing-loop
    provides: "exportSignedPdf EXP-02 incremental-save path, PlacedField type, fieldStore CRUD actions"

provides:
  - "FieldType union 'signature'|'initials'|'date'|'text'|'checkbox'"
  - "PlacedField.textValue optional string, PlacedField.dataUrl optional"
  - "armedFieldType + setArmedFieldType replacing placementMode/setPlacementMode"
  - "initialsDataUrl + initialsModalOpen state seam for Plan 04"
  - "history/historyIndex undo/redo snapshot stack, MAX_HISTORY=50"
  - "pushHistory/undo/redo actions; addField+deleteField push history; updateField does not"
  - "exportSignedPdf draws text/date via Helvetica drawText, checkbox via bold ASCII 'X'"
  - "dataUrl validation type-gated to signature/initials only (Pitfall 6 fix)"
  - "Helvetica + HelveticaBold embedded once per export (Pitfall 7 fix)"

affects:
  - 03-02-PLAN (FieldPalette, LazyPage armedFieldType drop handler, PlacedFieldWidget per-type render)
  - 03-03-PLAN (UndoRedoControls component wiring)
  - 03-04-PLAN (InitialsDrawModal consuming initialsDataUrl/initialsModalOpen seam)
  - 03-05-PLAN (ZoomControl, DocumentViewer integration)

tech-stack:
  added: []
  patterns:
    - "FieldType discriminated union: type discriminates which optional properties are populated"
    - "History snapshot stack: addField/deleteField push pre+post snapshots; updateField defers to callers"
    - "Font embedding once pattern: embed before the loop, reuse PDFFont objects per export"
    - "Type-gated dataUrl guard: only validate dataUrl when field.type is signature or initials"

key-files:
  created: []
  modified:
    - src/store/fieldStore.ts
    - src/lib/exportPdf.ts
    - src/test/fieldStore.test.ts
    - src/test/exportPdf.test.ts
    - src/components/SignatureDrawModal.tsx
    - src/test/signatureDraw.test.ts

key-decisions:
  - "History stores both pre-mutation and post-mutation snapshots per addField/deleteField so undo fully reverts (historyIndex moves to pre-mutation snapshot)"
  - "updateField does NOT push history internally — callers (drag stop, resize stop, text blur) push explicitly before updateField to avoid per-keystroke history flood"
  - "ASCII 'X' in checkbox PDF export (never U+2715 ✕) — WinAnsi cannot encode U+2715, throws at runtime"
  - "SignatureDrawModal migrated from setPlacementMode(true) to setArmedFieldType('signature') in Plan 01 to keep tests green (Rule 1 deviation)"

patterns-established:
  - "History push: both pre and post state added per mutation so undo/redo works bidirectionally"
  - "drawTextInBox: sizeAtHeight(0.75) + baseline centering via heightAtSize"
  - "drawCheckboxX: ASCII 'X' with widthOfTextAtSize centering; never U+2715"

requirements-completed: [FLD-02, FLD-03, FLD-04, FLD-08, FLD-09]

duration: 5min
completed: 2026-06-17
---

# Phase 03 Plan 01: Field Model Extension + Undo/Redo + New-Type Export Summary

**Extended PlacedField to 5-type union with undo/redo history stack (50 entries), and wired drawText/checkbox export through the existing EXP-02 incremental-save path**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-06-17T00:25:00Z
- **Completed:** 2026-06-17T00:30:00Z
- **Tasks:** 3 tasks (Tasks 1+2 combined into one commit, Task 3 separate)
- **Files modified:** 6

## Accomplishments

- PlacedField extended to 5-type union with optional `dataUrl` and `textValue`; `FieldType` exported
- `armedFieldType` + initials state seam replaces `placementMode`; undo/redo snapshot stack capped at 50
- exportSignedPdf draws text/date via Helvetica and checkbox via bold ASCII 'X', EXP-02 byte-identity verified for all new types

## Task Commits

1. **Tasks 1+2: PlacedField model + armedFieldType + undo/redo** - `a6f0128` (feat)
2. **Task 3: Per-type export draw branches** - `51668b9` (feat)

## Files Created/Modified

- `src/store/fieldStore.ts` — FieldType union, optional dataUrl/textValue, armedFieldType, initialsDataUrl/initialsModalOpen, history/historyIndex, pushHistory/undo/redo, addField+deleteField push history
- `src/lib/exportPdf.ts` — per-type dispatch, type-gated dataUrl guard, Helvetica+HelveticaBold embedded once, drawTextInBox/drawCheckboxX helpers
- `src/test/fieldStore.test.ts` — new-type acceptance tests, textValue persistence, armedFieldType/initials state, undo/redo/history cap/redo-truncation/no-op/selection-clear tests, updated resetFields
- `src/test/exportPdf.test.ts` — EXP-02 for text/checkbox/date, no-throw for non-image types, FLD-08 page-range test
- `src/components/SignatureDrawModal.tsx` — migrated setPlacementMode→setArmedFieldType('signature') (Rule 1 deviation)
- `src/test/signatureDraw.test.ts` — updated assertions placementMode→armedFieldType (Rule 1 deviation)

## Decisions Made

- History stores both pre and post mutation per addField/deleteField so undo correctly removes added fields and redo re-adds them. Invariant: `history[historyIndex]` is always the current state; `undo` restores `history[historyIndex-1]`.
- `updateField` does not push history internally — callers are responsible. This prevents per-keystroke history entries during text editing (commit on blur per CONTEXT.md Area 3).
- ASCII `'X'` used for checkbox PDF export. `✕` (U+2715) appears only in comments; WinAnsi cannot encode it (RESEARCH verified, RESEARCH Pitfall 1).
- `SignatureDrawModal` migrated in this plan (not Plan 02) to keep the full test suite green.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SignatureDrawModal called removed setPlacementMode — migrated to setArmedFieldType**
- **Found during:** Task 3 (full test suite run)
- **Issue:** `setPlacementMode` was removed from the store in Task 1. `SignatureDrawModal.tsx` still called `setPlacementMode(true)`, throwing `TypeError: setPlacementMode is not a function` and failing 4 `signatureDraw.test.ts` tests.
- **Fix:** Changed `setPlacementMode(true)` → `setArmedFieldType('signature')` in `SignatureDrawModal.tsx`. Updated 4 test assertions from `state.placementMode` → `state.armedFieldType` in `signatureDraw.test.ts`.
- **Files modified:** `src/components/SignatureDrawModal.tsx`, `src/test/signatureDraw.test.ts`
- **Verification:** All 224 tests pass after the fix.
- **Committed in:** `51668b9`

---

**Total deviations:** 1 auto-fixed (Rule 1 — Bug)
**Impact on plan:** Essential for test suite green. The plan said component migration happens in Plan 02, but the `setPlacementMode` removal broke `signatureDraw.test.ts` which tests an existing component. Fixing now avoids a broken test suite between plans. Plan 02 still owns the remaining component migrations (LazyPage, TopBar, PlacementModeOverlay).

## Issues Encountered

None beyond the deviation above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 02 (FieldPalette + LazyPage armedFieldType drop handler + PlacedFieldWidget per-type render) can now proceed — all store symbols it needs are exported.
- Plan 03 (UndoRedoControls) can consume `pushHistory`/`undo`/`redo` directly.
- Plan 04 (InitialsDrawModal) can consume `initialsDataUrl`/`initialsModalOpen` seam.
- Remaining component call sites for `placementMode` are in `LazyPage.tsx`, `PlacementModeOverlay.tsx`, `TopBar.tsx` — `tsc -b` will fail on those until Plan 02 lands. This is expected per the plan's verification note.

---
*Phase: 03-full-field-types-workspace-controls*
*Completed: 2026-06-17*

## Self-Check: PASSED

- FOUND: src/store/fieldStore.ts
- FOUND: src/lib/exportPdf.ts
- FOUND: .planning/phases/03-full-field-types-workspace-controls/03-01-SUMMARY.md
- FOUND commit: a6f0128 (feat(03-01): extend PlacedField model + armedFieldType migration + undo/redo history)
- FOUND commit: 51668b9 (feat(03-01): per-type export draw branches (text/date/checkbox) preserving EXP-02)
