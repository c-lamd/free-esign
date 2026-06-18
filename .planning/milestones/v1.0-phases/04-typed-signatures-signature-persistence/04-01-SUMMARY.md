---
phase: 04-typed-signatures-signature-persistence
plan: "01"
subsystem: store/persistence/assets
tags: [idb-keyval, zustand, fonts, @font-face, savedItems, armedTypedPayload, tdd]
dependency_graph:
  requires: []
  provides:
    - src/store/fieldStore.ts#SavedItem
    - src/store/fieldStore.ts#fontFamily-on-PlacedField
    - src/store/fieldStore.ts#armedTypedPayload
    - src/store/fieldStore.ts#savedItems-slice
    - src/lib/savedSignatures.ts#loadAll/addItem/deleteItem
    - public/fonts/DancingScript-Regular.ttf
    - public/fonts/GreatVibes-Regular.ttf
    - public/fonts/Pacifico-Regular.ttf
    - src/index.css#@font-face-declarations
  affects:
    - src/test/fieldStore.test.ts (idb-keyval mock added)
tech_stack:
  added:
    - "@pdf-lib/fontkit@1.1.1 (PDF font embedding companion)"
    - "idb-keyval@6.2.5 (IndexedDB key-value persistence)"
    - "Dancing Script TTF (vendored, SIL OFL)"
    - "Great Vibes TTF (vendored, SIL OFL)"
    - "Pacifico TTF (vendored, SIL OFL)"
  patterns:
    - "Zustand async action pattern: optimistic state update then persist to IndexedDB"
    - "savedItems excluded from initialFieldState to survive resetFields() (document-independent persistence)"
    - "vi.mock('idb-keyval') at module level for jsdom test isolation"
key_files:
  created:
    - src/lib/savedSignatures.ts
    - src/test/savedItems.test.ts
    - public/fonts/DancingScript-Regular.ttf
    - public/fonts/GreatVibes-Regular.ttf
    - public/fonts/Pacifico-Regular.ttf
    - public/fonts/DancingScript-LICENSE.txt
    - public/fonts/GreatVibes-LICENSE.txt
    - public/fonts/Pacifico-LICENSE.txt
  modified:
    - package.json
    - package-lock.json
    - src/store/fieldStore.ts
    - src/test/fieldStore.test.ts
    - src/index.css
decisions:
  - "savedItems excluded from initialFieldState (not reset on document change — SIG-04 persistence)"
  - "Optimistic update pattern for addSavedItem/deleteSavedItem: update Zustand state first, then persist; failure is non-blocking"
  - "TTF fonts downloaded from fonts.gstatic.com (Dancing Script v29, Great Vibes v21, Pacifico v23) — real OFL binaries, not placeholders"
  - "idb-keyval@6.2.5 checkpoint pre-approved by user per <preapproved_checkpoint> directive"
  - "IDB_KEY exported from savedSignatures.ts for test assertions on the correct key"
metrics:
  duration: "~10 min"
  completed: "2026-06-17"
  tasks_completed: 3
  files_changed: 12
---

# Phase 4 Plan 01: Foundation — Deps, Fonts, Store Extension Summary

**One-liner:** idb-keyval + @pdf-lib/fontkit installed; 3 script TTFs vendored; fieldStore extended with SavedItem type, savedItems slice, armedTypedPayload seam, and async IndexedDB actions.

## What Was Built

### Task 1: idb-keyval@6.2.5 legitimacy checkpoint (auto-approved)

The plan included a `checkpoint:human-verify` gate for `idb-keyval@6.2.5` (flagged SUS/too-new by the legitimacy gate — a timing artifact of a recent patch release). Per the `<preapproved_checkpoint>` directive in the execution prompt, this checkpoint was auto-approved. The package is the canonical IndexedDB key-value wrapper by Jake Archibald (Google), ~6.2M weekly downloads, active since 2016, and is explicitly pinned in CLAUDE.md.

### Task 2: Install deps, vendor fonts, add @font-face declarations

- **`@pdf-lib/fontkit@1.1.1`** and **`idb-keyval@6.2.5`** installed and exact-pinned (no caret) in `package.json`.
- **Three script TTFs** downloaded from `fonts.gstatic.com` (same origin as Google Fonts API response) and vendored into `public/fonts/`:
  - `DancingScript-Regular.ttf` (v29, 76KB)
  - `GreatVibes-Regular.ttf` (v21, 363KB)
  - `Pacifico-Regular.ttf` (v23, 251KB)
- **SIL OFL license files** created for all three fonts.
- **Three `@font-face` declarations** added to `src/index.css` after the `:root` token block, with `font-display: block` (not `swap` — prevents FOUT flash in signature preview).

### Task 3: fieldStore extension + savedSignatures.ts + savedItems.test.ts (TDD)

**RED:** `src/test/savedItems.test.ts` written first with 13 failing tests covering addSavedItem, loadSavedItems, deleteSavedItem, setArmedTypedPayload, and the resetFields-preserves-savedItems invariant.

**GREEN:** Implementation built to make all tests pass:

- **`src/lib/savedSignatures.ts`** (new): Pure I/O utility wrapping `idb-keyval` under key `'savedSignatureItems'`. Exports `loadAll()`, `addItem()`, `deleteItem()`. No React imports. `IDB_KEY` exported for test assertions.

- **`src/store/fieldStore.ts`** (modified):
  - `fontFamily?: string` added to `PlacedField` (optional — no existing spreads need changes)
  - `SavedItem` interface exported (id, kind, source, dataUrl?, text?, fontFamily?, createdAt)
  - `armedTypedPayload` state added to `FieldStore` (typed-arming seam for Plans 02/03)
  - `savedItems: SavedItem[]` slice added (initial `[]`)
  - `savedItems` intentionally excluded from `initialFieldState` so `resetFields()` preserves it
  - `setArmedTypedPayload`, `loadSavedItems`, `addSavedItem`, `deleteSavedItem` actions added
  - Optimistic update pattern: state updated immediately, IndexedDB write is best-effort/non-blocking

- **`src/test/fieldStore.test.ts`** (modified): `vi.mock('idb-keyval')` added at module level so the 256-test baseline stays green now that `fieldStore.ts` transitively imports `idb-keyval`.

**Test results:** 269/269 pass (256 baseline + 13 new savedItems tests).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] beforeEach test isolation for savedItems**
- **Found during:** Task 3 GREEN phase
- **Issue:** `resetFields()` intentionally preserves `savedItems` (the feature), but test `beforeEach` calling only `resetFields()` meant items from prior tests leaked into later tests, causing the `resetFields leaves savedItems untouched` test to see 2 items instead of 1.
- **Fix:** Added `useFieldStore.setState({ savedItems: [] })` in `savedItems.test.ts` `beforeEach`, alongside `resetFields()`. This directly clears savedItems for test isolation without changing the production behavior.
- **Files modified:** `src/test/savedItems.test.ts`

### Auto-approved Checkpoint

**Task 1: idb-keyval@6.2.5 package legitimacy gate**
- **Status:** Auto-approved per `<preapproved_checkpoint>` in execution prompt
- **Reason:** Package has existed since 2016, ~6.2M weekly downloads, authored by Jake Archibald (Google). The SUS flag was a timing artifact of the 6.2.5 patch being published 15 days before research time. Package is pinned in CLAUDE.md.

## Known Stubs

None — this plan builds the data layer only (store shape, persistence helpers, font assets). No UI components are added. The `savedItems` slice is empty on mount and will be populated by `loadSavedItems()` which Plans 02/03 wire into App.tsx.

## Threat Flags

No new threat surface beyond what was documented in the plan's threat model. All T-04-xx items addressed:
- T-04-SC: Exact-pinned deps; idb-keyval legitimacy checkpoint auto-approved.
- T-04-01: fontFamily stores string name only — never bytes (security comment in SavedItem JSDoc).
- T-04-02: IndexedDB is origin-local; consistent with privacy model.
- T-04-03: No executable content in SavedItem fields; export validation unchanged.

## Self-Check: PASSED

- `src/lib/savedSignatures.ts`: exists, contains `savedSignatureItems` key
- `src/store/fieldStore.ts`: contains `armedTypedPayload`, `SavedItem`, `savedItems`, `fontFamily`
- `src/index.css`: contains 3 `@font-face` declarations with `font-display: block`
- `public/fonts/`: all 6 files exist (3 TTFs + 3 LICENSE)
- `package.json`: `@pdf-lib/fontkit: "1.1.1"`, `idb-keyval: "6.2.5"` (exact-pinned)
- TypeScript: `tsc -b --noEmit` clean
- Tests: 269/269 pass
- Commits: e299812 (chore), 12ed908 (test/RED), 7112a43 (feat/GREEN)
