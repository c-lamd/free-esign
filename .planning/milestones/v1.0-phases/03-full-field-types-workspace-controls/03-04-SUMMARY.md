---
phase: "03"
plan: "04"
subsystem: workspace-controls
tags: [undo-redo, initials, keyboard-shortcuts, history, fld-09, fld-02]
dependency_graph:
  requires: ["03-01", "03-02"]
  provides: [UndoRedoControls, InitialsDrawModal, undo-keyboard-shortcuts, undoRedo-test-suite]
  affects: [TopBar, DocumentViewer, App]
tech_stack:
  added: []
  patterns: [aria-disabled-not-html-disabled, single-keydown-handler, focus-trap-modal, history-snapshot-undo-redo]
key_files:
  created:
    - src/components/UndoRedoControls.tsx
    - src/components/InitialsDrawModal.tsx
    - src/test/undoRedo.test.ts
  modified:
    - src/components/TopBar.tsx
    - src/components/DocumentViewer.tsx
    - src/App.tsx
decisions:
  - "Undo/redo keyboard shortcuts extend DocumentViewer's single keydown handler (RESEARCH Section 4) — no second addEventListener; undo/redo branches placed before selectedFieldId gate so they fire regardless of selection"
  - "T-03-11: INPUT/TEXTAREA/contentEditable guard fires first in the shared handler, satisfying both Delete/Backspace and undo/redo shortcut security requirements"
  - "InitialsDrawModal 2:1 canvas aspect ratio (padding-top: 50%) suits initials strings like 'JD'"
  - "undoRedo.test.ts is a dedicated focused file; fieldStore.test.ts retains broad store coverage; no overlap conflict"
metrics:
  duration: "~8 minutes"
  completed: "2026-06-17T08:01:19Z"
  tasks_completed: 3
  files_changed: 6
---

# Phase 03 Plan 04: Undo/Redo Controls + InitialsDrawModal Summary

**One-liner:** Undo/Redo toolbar buttons + Cmd/Ctrl+Z keyboard shortcuts with input-focus guard, plus InitialsDrawModal that draws transparent-PNG initials and arms placement, all with focused FLD-09 test coverage.

## What Was Built

### Task 1: UndoRedoControls + keyboard shortcuts (commit 55b0404)

**`src/components/UndoRedoControls.tsx`** — new component:
- Two ghost icon buttons (counterclockwise/clockwise SVG arrows) with 44px minimum touch targets
- `canUndo = historyIndex > 0`, `canRedo = historyIndex < history.length - 1` derived from fieldStore
- `aria-disabled="true"` (not HTML disabled) at bounds — WCAG 2.5.5, focus stays reachable
- Per-state aria-labels: "Undo — nothing to undo" / "Redo — nothing to redo" at limits
- 2px `--color-accent` focus ring on focus/blur pattern

**`src/components/DocumentViewer.tsx`** — extended:
- Single keydown handler now hosts both Delete/Backspace (FLD-07) and undo/redo shortcuts (FLD-09)
- INPUT/TEXTAREA/contentEditable guard fires first — satisfies T-03-11 (shortcuts inert while typing)
- Undo/redo branches placed BEFORE the `!selectedFieldId` early return so they work regardless of selection
- Shortcuts: Cmd/Ctrl+Z = undo, Cmd/Ctrl+Shift+Z = redo, Ctrl+Y = redo
- `grep -c "addEventListener('keydown'" src/components/DocumentViewer.tsx` = 1 (verified)

**`src/components/TopBar.tsx`** — extended:
- `<UndoRedoControls />` rendered as leftmost item in the `view === 'loaded'` group
- Thin 1px separator between UndoRedo and FieldPalette groups
- Final TopBar order: `[Undo][Redo] | [Signature][Initials][Date][Text][Checkbox] | [Download PDF][Open another]`

### Task 2: InitialsDrawModal (commit fa5dc43)

**`src/components/InitialsDrawModal.tsx`** — new component, mirrors SignatureDrawModal:
- Gated on `initialsModalOpen` from fieldStore
- Title: "Draw your initials" (20px/600, aria-labelledby)
- Canvas hint: "Draw here" (visible when empty)
- Primary CTA: "Add initials" / disabled label "Add initials — draw initials first"
- Canvas aspect ratio 2:1 (`padding-top: 50%`) vs signature's 3:1 — suits short initials strings
- On confirm: `setInitialsDataUrl(dataUrl)` then `setArmedFieldType('initials')` — arms the existing LazyPage drop path
- Full parity: role="dialog", aria-modal, focus trap, Escape closes, transparent rgba(0,0,0,0) bg, devicePixelRatio scaling, `pad.off()` cleanup (T-03-12)

**`src/App.tsx`** — extended:
- `<InitialsDrawModal />` mounted unconditionally alongside `<SignatureDrawModal />`

### Task 3: FLD-09 redo-tail + initials-history tests (commit 670d449)

**`src/test/undoRedo.test.ts`** — new dedicated test file (8 tests across 3 describe blocks):
- `undoRedo — FLD-09 redo-tail truncation`: add f1+f2, undo, add f3 → redo no-op, fields=[f1,f3]; edge cases for redo at end and undo at baseline
- `undoRedo — FLD-02/FLD-09 initials field history integration`: type 'initials' with dataUrl undo removes, redo restores, dataUrl preserved; redo-tail truncation with initials variant
- `undoRedo — FLD-09 selection cleared on undo/redo`: selectedFieldId → null after undo, redo, and multi-step undo

**Full suite result:** 251 tests, 11 files, 0 failures.

## Acceptance Criteria Check

| Criterion | Status |
|-----------|--------|
| UndoRedoControls.tsx: two ghost buttons, canUndo/canRedo derivations, aria-disabled at limits | PASS |
| Single keydown listener in DocumentViewer (`grep -c` = 1) | PASS |
| No-selection early return does not block undo/redo keys | PASS (undo/redo branches before `!selectedFieldId` gate) |
| TopBar renders UndoRedoControls leftmost in loaded group | PASS |
| InitialsDrawModal: "Draw your initials" title, "Add initials" CTA, "Draw here" hint, 2:1 canvas | PASS |
| InitialsDrawModal: `setArmedFieldType('initials')` on confirm | PASS (`grep -n "setArmedFieldType('initials')"` matched) |
| App.tsx mounts InitialsDrawModal unconditionally | PASS |
| undoRedo.test.ts: redo-tail truncation, initials undo/redo, selection cleared | PASS |
| Full `npx vitest run` suite GREEN | PASS (251/251) |
| `npx tsc -b` clean | PASS |

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. All changes are UI components and client-side event handlers.

| Threat | Mitigation | Status |
|--------|-----------|--------|
| T-03-11: keydown guard vs input focus | INPUT/TEXTAREA guard fires before all shortcut branches in DocumentViewer | MITIGATED |
| T-03-12: InitialsDrawModal signature_pad leak | `pad.off()` on unmount in useEffect cleanup | MITIGATED |
| T-03-13: initialsDataUrl disclosure | In-memory only, cleared by resetFields on new document | MITIGATED |

## Self-Check: PASSED

Files verified:
- `src/components/UndoRedoControls.tsx` — exists
- `src/components/InitialsDrawModal.tsx` — exists
- `src/test/undoRedo.test.ts` — exists

Commits verified:
- 55b0404 — feat(03-04): UndoRedoControls + guarded undo/redo keyboard shortcuts
- fa5dc43 — feat(03-04): InitialsDrawModal — draw initials + arm placement
- 670d449 — test(03-04): FLD-09 redo-tail + initials-history tests in undoRedo.test.ts
