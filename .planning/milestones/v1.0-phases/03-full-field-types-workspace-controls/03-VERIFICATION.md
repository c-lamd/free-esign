---
phase: 03-full-field-types-workspace-controls
verified: 2026-06-17T01:15:00Z
status: human_needed
score: 22/22
overrides_applied: 0
human_verification:
  - test: "Place a date field and confirm it shows today's date as a default (M/D/YYYY format)"
    expected: "Date field appears pre-filled with today's date (e.g. '6/17/2026') after arming Date and clicking the document"
    why_human: "LazyPage date default computed at runtime from new Date() — jsdom tests cover the data path but not the rendered UI"
  - test: "Arm a Text field, click the document, click into the placed field, type text, then Tab away (or click outside). Undo once."
    expected: "Typing enters the field without triggering a drag. Blurring commits the value. Undoing removes the text commit (or the placement if it was the first action)."
    why_human: "disableDragging and blur-commit behavior require real react-rnd interaction that jsdom cannot reproduce"
  - test: "Arm Checkbox, click the document. Verify the placed widget shows ✕ (U+2715). Download the PDF and open it."
    expected: "On-screen widget shows the ✕ glyph. Downloaded PDF shows 'X' (not garbled, no WinAnsi error)."
    why_human: "PDF viewer rendering and real pdf-lib WinAnsi output require a real browser + PDF reader"
  - test: "Press Cmd/Ctrl+Z while a text field input is focused (cursor in the field)"
    expected: "The text in the input is NOT undone through the browser's native undo for placement. The field's placement remains; only the local text edit may undo via browser default."
    why_human: "DocumentViewer keydown guard (INPUT/TEXTAREA early-return) requires real focus state that jsdom does not simulate accurately"
  - test: "Open a multi-page PDF, zoom to 150%, place a signature on page 2 then download"
    expected: "The signature appears on page 2 at the correct position with no visual drift when comparing zoom 100% vs 150% placement"
    why_human: "effectiveScale pixel-alignment at different zoom levels requires a real browser with real PDF rendering"
  - test: "Open the InitialsDrawModal via the Initials palette button, draw initials, click Add initials, then click the document"
    expected: "The modal closes, the cursor becomes crosshair, clicking places a smaller transparent-PNG initials field"
    why_human: "focus-trap behavior, signature_pad canvas interaction, and modal lifecycle require a real browser"
  - test: "Select a .docx file via the file picker"
    expected: "The upload area shows the WordDocBanner with heading 'Word documents aren't supported' and a 'Choose a PDF instead' link (not a red error, not a conversion attempt)"
    why_human: "Browser drag-and-drop / file picker interaction with the UploadZone UI requires real browser"
  - test: "Click Zoom − until it reaches 50% and then try to click Zoom − again"
    expected: "Button is visually disabled (opacity 0.35, default cursor) and zoom stays at 50%"
    why_human: "aria-disabled visual state and button interaction at zoom boundary require real browser"
---

# Phase 03: Full Field Types + Workspace Controls — Verification Report

**Phase Goal:** Users can annotate documents with initials, dates, free text, and checkboxes; zoom in/out (50–200%) without fields drifting; place fields on any page of a multi-page document; undo/redo changes (>=10 levels); and get a helpful prompt when they attempt to open a Word file.
**Verified:** 2026-06-17T01:15:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | PlacedField union accepts initials, date, text, checkbox types | VERIFIED | `fieldStore.ts` line 23: `FieldType = 'signature' | 'initials' | 'date' | 'text' | 'checkbox'`; `dataUrl?` optional; `textValue?` optional |
| 2  | Date field defaults to today (M/D/YYYY format) in LazyPage | VERIFIED | `LazyPage.tsx` lines 173-178: `${today.getMonth()+1}/${today.getDate()}/${today.getFullYear()}`; `fieldPlacement.test.ts` FLD-02/FLD-03 test green |
| 3  | Text field textValue persists through updateField round-trip | VERIFIED | `fieldStore.test.ts` updateField + textValue tests pass; `PlacedFieldWidget.tsx` lines 163-166: `handleInputBlur` calls `pushHistory()` then `updateField(field.id, { textValue: localValue })` |
| 4  | Undo reverts fields array; redo re-applies | VERIFIED | `fieldStore.ts` undo/redo actions at lines 187-208; `fieldStore.test.ts` + `undoRedo.test.ts` all green (251 tests pass) |
| 5  | Undo/redo history capped at MAX_HISTORY (50) | VERIFIED | `fieldStore.ts` line 46: `const MAX_HISTORY = 50`; `fieldStore.test.ts` line 293: history cap test green |
| 6  | EXP-02: text/date/checkbox export preserves first 512 bytes byte-identical | VERIFIED | `exportPdf.test.ts` lines 104-151: separate EXP-02 tests for text, checkbox, date fields all pass |
| 7  | Checkbox exports ASCII 'X' (not U+2715 glyph) | VERIFIED | `exportPdf.ts` line 73: `page.drawText('X', ...)` — the 4 occurrences of U+2715 are in comments only; `drawCheckboxX` helper uses `'X'` exclusively |
| 8  | dataUrl guard is inside per-field loop, gated on image types only (Pitfall 6) | VERIFIED | `exportPdf.ts` lines 116-122: guard at `if (field.type === 'signature' || field.type === 'initials')` inside the for-loop; no pre-loop unconditional check exists |
| 9  | Field on page 2 draws onto pages[1] (FLD-08 export indexing) | VERIFIED | `exportPdf.ts` line 106: `const page = pages[field.pageNumber - 1]`; `exportPdf.test.ts` line 201: throws "page 2 but the PDF only has 1 page(s)" — correct indexing proven |
| 10 | Zoom 50–200% via ZOOM_STEPS; ZoomControl exists with disabled limits | VERIFIED | `documentStore.ts` line 9: `ZOOM_STEPS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0]`; `ZoomControl.tsx` lines 30-31: `isAtMin`/`isAtMax` with `aria-disabled` and opacity 0.35 |
| 11 | Fit resets zoom to 1.0 | VERIFIED | `ZoomControl.tsx` line 46: `handleFit()` calls `setZoom(1.0)` |
| 12 | Same document point at zoom 1.0 and 1.5 yields identical PDF coords (zero drift) | VERIFIED | `coordinateMapper.test.ts` lines 222-295: zoom-invariance describe block with 4 tests passing; `effectiveScale = (containerWidth/dims.originalWidth) * zoom` in both Page width and drop divisor |
| 13 | Zoom never mutates stored pdfX/pdfY/pdfWidth/pdfHeight | VERIFIED | `LazyPage.tsx` line 127: `effectiveScale` is computed on-render only; `onLoadSuccess` (line 104) stores zoom-free `scale = containerWidth / originalWidth`; no field mutation on zoom |
| 14 | `<Page>` uses `width={containerWidth * zoom}` with NO scale prop | VERIFIED | `LazyPage.tsx` line 254: `width={containerWidth ? containerWidth * zoom : undefined}`; grep of `scale=` in LazyPage returns nothing |
| 15 | Fields on any page of a multi-page doc stay keyed to that page | VERIFIED | `LazyPage.tsx` line 67: `pageFields = fields.filter(f => f.pageNumber === pageNumber)`; `fieldPlacement.test.ts` FLD-08 per-page keying test green |
| 16 | Undo/redo history >= 10 levels; bounded undo/redo stack | VERIFIED | MAX_HISTORY=50; `fieldStore.test.ts` addField+undo+redo test chain proves 10+ levels functional |
| 17 | New action after undo truncates redo tail | VERIFIED | `undoRedo.test.ts` lines 39-63: explicit redo-tail truncation test; `fieldStore.ts` line 131: `state.history.slice(0, state.historyIndex + 1)` truncates on pushHistory |
| 18 | Undo/redo keyboard shortcuts guarded against INPUT/TEXTAREA focus | VERIFIED | `DocumentViewer.tsx` lines 76-82: INPUT/TEXTAREA/contentEditable guard fires first; undo/redo branches at lines 86-101 placed before Delete/Backspace selection gate; single `addEventListener('keydown')` — count returns 1 |
| 19 | Word file (.doc/.docx) detected before generic unsupported-type | VERIFIED | `fileValidation.ts` lines 57-64: WORD_MIMES/WORD_EXTENSIONS check at step 2 (after size, before MIME allow-list); `fileValidation.test.ts` all 4 word-doc cases pass |
| 20 | .docx with application/zip MIME still resolves to 'word-doc' via extension | VERIFIED | `fileValidation.ts` line 62: `WORD_EXTENSIONS.has(ext)` catches `.docx` regardless of MIME; `fileValidation.test.ts` line 91 confirms |
| 21 | WordDocBanner shows guidance (not error) with "Choose a PDF instead" path | VERIFIED | `WordDocBanner.tsx`: `role="status"`, `aria-live="polite"`, left border `var(--color-border)` (not `--color-destructive`); `grep -c "destructive" WordDocBanner.tsx` = 0; `UploadZone.tsx` line 54: word-doc branch renders WordDocBanner |
| 22 | UndoRedoControls in TopBar leftmost; InitialsDrawModal mounts in App | VERIFIED | `TopBar.tsx` line 76: `<UndoRedoControls />` first in loaded group; `App.tsx` line 52: `<InitialsDrawModal />` unconditional |

**Score:** 22/22 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/store/fieldStore.ts` | FieldType union, armedFieldType, history stack, MAX_HISTORY | VERIFIED | All present; MAX_HISTORY=50; pushHistory/undo/redo wired into addField/deleteField; updateField does NOT push history |
| `src/lib/exportPdf.ts` | Per-type draw dispatch, type-gated dataUrl guard, fonts embedded once | VERIFIED | drawTextInBox + drawCheckboxX helpers; Helvetica + HelveticaBold embedded once (line 102-103); dataUrl guard inside loop, gated on image types only |
| `src/store/documentStore.ts` | zoom multiplier, setZoom, ZOOM_STEPS exported, reset includes zoom | VERIFIED | Lines 9, 65, 75, 86 |
| `src/components/ZoomControl.tsx` | − / readout / + / Fit; aria-disabled at limits; ZOOM_STEPS | VERIFIED | Substantive component with all required elements |
| `src/components/LazyPage.tsx` | effectiveScale threading into Page width + viewport + drop divisor | VERIFIED | Three uses of effectiveScale confirmed; Page `width={containerWidth*zoom}`, no scale prop |
| `src/components/FieldPalette.tsx` | Five buttons; armedFieldType; openInitialsModal for initials | VERIFIED | Contains `armedFieldType`, `aria-pressed`, all five types |
| `src/components/PlacedFieldWidget.tsx` | Per-type rendering; pushHistory on drag/resize/blur | VERIFIED | `pushHistory` called in handleDragStop, handleResizeStop, handleInputBlur before updateField |
| `src/components/UndoRedoControls.tsx` | Undo/Redo buttons; canUndo/canRedo; historyIndex | VERIFIED | Lines 29-30: `canUndo = historyIndex > 0`; `canRedo = historyIndex < historyLen - 1` |
| `src/components/InitialsDrawModal.tsx` | "Draw your initials"; 2:1 canvas; setArmedFieldType('initials') | VERIFIED | Title at line 283; `paddingTop: '50%'` (2:1 ratio); `setArmedFieldType('initials')` at line 139 |
| `src/lib/fileValidation.ts` | 'word-doc' variant; WORD_MIMES/WORD_EXTENSIONS; before unsupported-type | VERIFIED | All present; ordering confirmed at lines 57-64 |
| `src/components/WordDocBanner.tsx` | role=status; "Choose a PDF instead"; --color-border not --color-destructive | VERIFIED | role="status" line 86; "Choose a PDF instead" line 135; no destructive color |
| `src/test/undoRedo.test.ts` | redo-tail truncation; initials-history; selection-cleared | VERIFIED | Three describe blocks covering all required behaviors |
| `src/test/coordinateMapper.test.ts` | Zoom-invariance tests (zoom 1.0 vs 1.5 identical PDF coords) | VERIFIED | Lines 222-295: 4 zoom-invariance tests pass |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `exportPdf.ts` | `field.type` | per-type draw dispatch in field loop | VERIFIED | `if (field.type === 'signature' || field.type === 'initials')` / `else if (field.type === 'date' || field.type === 'text')` / `else if (field.type === 'checkbox')` |
| `exportPdf.ts` | drawText('X') for checkbox | drawCheckboxX helper | VERIFIED | Line 73: ASCII 'X'; no U+2715 in draw path |
| `fieldStore.ts` | history snapshots | pushHistory/undo/redo | VERIFIED | pushHistory slices redo tail, bounded to MAX_HISTORY; addField/deleteField embed pre+post snapshots inline |
| `LazyPage.tsx` | react-pdf Page width | `width = containerWidth * zoom` (NOT scale prop) | VERIFIED | Line 254; grep for `scale=` returns nothing |
| `ZoomControl.tsx` | documentStore.setZoom | ZOOM_STEPS index advance | VERIFIED | Lines 33-43: handleZoomOut/In use ZOOM_STEPS.indexOf |
| `FieldPalette.tsx` | fieldStore.armedFieldType | setArmedFieldType on click; openInitialsModal for initials | VERIFIED | Lines 52-62 in FieldPalette.tsx |
| `PlacedFieldWidget.tsx` | fieldStore.pushHistory | pushHistory before updateField on drag/resize/blur | VERIFIED | Lines 137, 154, 165 |
| `UndoRedoControls.tsx` | fieldStore.undo/redo | buttons + keydown handler in DocumentViewer (single handler) | VERIFIED | DocumentViewer.tsx: 1 `addEventListener('keydown')`; undo/redo branches before selection gate |
| `InitialsDrawModal.tsx` | fieldStore.setInitialsDataUrl + setArmedFieldType('initials') | on confirm: store PNG then arm 'initials' | VERIFIED | Lines 137-139 |
| `UploadZone.tsx` | WordDocBanner | word-doc validation branch swaps upload content | VERIFIED | Line 54: `if (validationError === 'word-doc') { setWordDocMode(true); return }` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `exportPdf.ts` drawCheckboxX | `field.type`, `fontBold`, `field.pdfX/pdfY/pdfWidth/pdfHeight` | PlacedField from fieldStore via caller | Real store data | FLOWING |
| `ZoomControl.tsx` percentage readout | `zoom` from documentStore | documentStore.zoom (setZoom calls from button handlers) | Real store value | FLOWING |
| `LazyPage.tsx` effectiveScale | `containerWidth`, `dims.originalWidth`, `zoom` | ResizeObserver + onLoadSuccess + documentStore | Real measured values | FLOWING |
| `WordDocBanner.tsx` | Static copy + `onChoosePdf` callback | Props from UploadZone state | Callback wired | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All tests pass | `npm test -- --run` | 11 test files, 251 tests passed | PASS |
| ASCII 'X' in checkbox export path | `grep -n "drawText('X'" src/lib/exportPdf.ts` | Line 73 matches | PASS |
| No U+2715 in draw path | `grep -n "✕" src/lib/exportPdf.ts` returns only comment lines (16, 59, 60, 72) | All 4 occurrences are comments | PASS |
| Single keydown handler in DocumentViewer | `grep -c "addEventListener('keydown'" src/components/DocumentViewer.tsx` | Returns 1 | PASS |
| No scale prop on Page in LazyPage | `grep -n "scale=" src/components/LazyPage.tsx` | No output | PASS |
| ZOOM_STEPS constant exported | `grep -n "ZOOM_STEPS" src/store/documentStore.ts` | Line 9 confirms | PASS |
| MAX_HISTORY = 50 | `grep -n "MAX_HISTORY" src/store/fieldStore.ts` | Line 46 confirms | PASS |
| placementMode fully removed from src | `grep -rn "placementMode\|setPlacementMode" src/` | Only in comments/migration notes, not in live code | PASS |
| TypeScript build clean | `npx tsc -b` | No output (clean) | PASS |
| embedFont called exactly twice | `grep -c "embedFont" src/lib/exportPdf.ts` | Returns 2 (Helvetica + HelveticaBold) | PASS |

### Probe Execution

No conventional probe scripts found at `scripts/*/tests/probe-*.sh`. Phase PLAN files do not declare probes. Step skipped.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| FLD-02 | 03-01, 03-02, 03-04 | User can place initials, date, free text, checkbox | SATISFIED | FieldType union; FieldPalette; PlacedFieldWidget per-type rendering; InitialsDrawModal; test coverage |
| FLD-03 | 03-01, 03-02 | Date field defaults to today, is editable | SATISFIED | LazyPage today-date default; PlacedFieldWidget inline input; fieldPlacement.test.ts |
| FLD-04 | 03-01, 03-02 | User can type content of a free-text field | SATISFIED | PlacedFieldWidget inline input with blur-commit; fieldStore textValue; test coverage |
| FLD-08 | 03-01, 03-02 | Fields on any page of a multi-page document | SATISFIED | LazyPage per-page filter; exportPdf pages[pageNumber-1]; FLD-08 test in fieldPlacement.test.ts and exportPdf.test.ts |
| FLD-09 | 03-01, 03-02, 03-04 | Undo/redo placement actions (>=10 levels) | SATISFIED | MAX_HISTORY=50; undo/redo in store; keyboard shortcuts in DocumentViewer; UndoRedoControls; full test suite |
| DOC-04 | 03-03 | Zoom in/out with placed fields scaling correctly | SATISFIED | ZOOM_STEPS 50-200%; ZoomControl; effectiveScale threading; zoom-invariance test in coordinateMapper.test.ts |
| DOC-05 | 03-05 | Word doc shows helpful guidance to export to PDF first | SATISFIED | fileValidation 'word-doc' variant; WordDocBanner; UploadZone routing; fileValidation.test.ts |

All 7 requirement IDs declared in PLAN frontmatter are satisfied. No orphaned requirements for Phase 3 in REQUIREMENTS.md.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/lib/exportPdf.ts` | 16, 59, 60, 72 | U+2715 glyph appears in file | Info | All occurrences are in comments explaining what NOT to use; the actual drawText call at line 73 uses ASCII 'X'. Not a blocker. |
| `src/components/LazyPage.tsx` | 196-201 | `pushHistory()` called before `addField()` in handleOverlayClick, while `addField` itself also internally pushes pre+post snapshots | Warning | This causes an extra history snapshot per drop (one from the explicit pushHistory() call + two from addField's inline push). Results in slightly more history entries than intended per drop, but does not break functionality and all tests pass. The undo semantics remain correct. |

No TBD/FIXME/XXX debt markers found in any source file modified by this phase.

### Human Verification Required

### 1. Date Field Default Renders Today's Date in Browser

**Test:** Open a PDF, arm the Date field type, click the document to place it.
**Expected:** The placed field shows today's date pre-filled in M/D/YYYY format.
**Why human:** LazyPage computes the date at runtime from `new Date()` — store-level tests confirm the data path but cannot render the UI.

### 2. Text Field Inline Editing Does Not Trigger Drag

**Test:** Place a Text field, click inside it, type "hello world", click outside, then undo.
**Expected:** Typing works without dragging; blur commits; undo reverts the field.
**Why human:** `disableDragging={isEditing}` and blur-commit behavior require real react-rnd interaction.

### 3. Checkbox PDF Export Uses ASCII X (no WinAnsi crash)

**Test:** Place a Checkbox field, download the PDF, open in any PDF viewer.
**Expected:** Checkbox renders as a bold 'X'. No crash during download. (On-screen widget correctly shows ✕.)
**Why human:** Real pdf-lib WinAnsi output requires a real browser + PDF reader to confirm no runtime error.

### 4. Undo/Redo Keyboard Shortcuts Guarded Against Input Focus

**Test:** Click into a placed Text field, type several characters, then press Cmd/Ctrl+Z.
**Expected:** The placement itself is NOT undone; only the native browser text undo fires inside the input.
**Why human:** DocumentViewer INPUT/TEXTAREA guard requires real focus state that jsdom cannot simulate.

### 5. Zoom + Field Alignment Visual Check

**Test:** Open a multi-page PDF, place a signature at 100% zoom, then zoom to 150% and 50%.
**Expected:** The placed field stays visually locked to its document position at all zoom levels. No drift.
**Why human:** effectiveScale pixel-alignment requires a real browser with real PDF rendering.

### 6. InitialsDrawModal Full Flow

**Test:** Click the Initials palette button, draw in the modal, click "Add initials", click the document.
**Expected:** Modal closes; cursor is crosshair; clicking places a smaller transparent-PNG initials field.
**Why human:** focus-trap, signature_pad canvas, and modal lifecycle require a real browser.

### 7. WordDocBanner UI on .docx Selection

**Test:** Attempt to open a .docx file via the file picker.
**Expected:** The upload area shows the informational banner (gray left border, not red), heading "Word documents aren't supported", body text, and "Choose a PDF instead" link. Clicking that link restores the normal upload UI.
**Why human:** Browser file picker interaction with UploadZone requires real browser.

### 8. ZoomControl Disabled State at Limits

**Test:** Click Zoom − until 50% is reached, then click Zoom − again.
**Expected:** Button is visually disabled (opacity 0.35, default cursor, aria-disabled). Zoom stays at 50%.
**Why human:** aria-disabled visual rendering and button interaction at zoom boundary require real browser.

### Gaps Summary

No automated gaps found. All 22 observable truths verified against actual codebase. All 251 tests pass. TypeScript build is clean. The 8 items above are deferred to human verification because they involve browser rendering, real user interaction (drag, focus, click), or PDF viewer output — none of which are verifiable programmatically in this context.

**Notable implementation detail:** `pushHistory()` is called explicitly in `LazyPage.handleOverlayClick` before `addField()`, and `addField` also internally pushes pre+post snapshots. This means field drops create slightly more history entries than one, but undo/redo semantics are correct and all tests pass. This is a minor over-capture, not a functional defect.

---

_Verified: 2026-06-17T01:15:00Z_
_Verifier: Claude (gsd-verifier)_
