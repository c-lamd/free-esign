---
phase: "02"
plan: "01"
subsystem: export-engine
tags: [pdf-export, incremental-save, field-store, tdd, zero-alteration]
dependency_graph:
  requires: [Phase 01 foundation — coordinateMapper, documentStore, imageWrapper]
  provides: [exportSignedPdf, triggerDownload, signedFilename, useFieldStore, PlacedField, PageDimensions, originalPdfBytes in documentStore]
  affects: [Plans 02-02, 02-03, 02-04 — all consume PlacedField and exportSignedPdf contracts]
tech_stack:
  added: [pdf-lib-incremental-save@1.17.4, signature_pad@5.1.3, react-rnd@10.5.3]
  patterns: [incremental-PDF-update, RED-GREEN-TDD, tagged-error-propagation, immutable-zustand-Map-replacement]
key_files:
  created:
    - src/lib/exportPdf.ts
    - src/store/fieldStore.ts
    - src/test/exportPdf.test.ts
    - src/test/fieldStore.test.ts
    - src/test/fixtures/samplePdf.ts
  modified:
    - src/lib/imageWrapper.ts (import swap: pdf-lib → pdf-lib-incremental-save)
    - src/store/documentStore.ts (added originalPdfBytes + setOriginalPdfBytes)
    - package.json (exact-pinned versions for 3 new deps, pdf-lib removed)
    - package-lock.json
decisions:
  - "pdf-lib-incremental-save@1.17.4 confirmed viable: saveIncremental() genuinely preserves original bytes at offset 0 (EXP-02 automated test passes)"
  - "fieldStore.ts created in Task 2 (not Task 3) to unblock exportPdf.ts import chain — Rule 3 deviation"
  - "signedFilename strips the last extension (not all dots) so 'a.b.pdf' → 'a.b-signed.pdf'"
metrics:
  duration: "~12 minutes"
  completed: "2026-06-16"
  tasks_completed: 3
  files_created: 5
  files_modified: 4
---

# Phase 2 Plan 01: Export Engine + Field Model Summary

**One-liner:** Incremental PDF save via pdf-lib-incremental-save@1.17.4 proven to preserve original bytes at offset 0 (EXP-02 automated byte-identity test passing), with PlacedField contract and Zustand field store locked for downstream plans.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Phase-2 dep installs + imageWrapper import swap + fixture | 68e75d7 | package.json, imageWrapper.ts, samplePdf.ts |
| 2 (RED) | EXP-02 byte-identity test (failing) | 8dcd05a | src/test/exportPdf.test.ts |
| 2 (GREEN) | exportPdf module + fieldStore types | 74a5cc4 | src/lib/exportPdf.ts, src/store/fieldStore.ts |
| 3 | fieldStore unit tests + documentStore extension | af46c23 | src/test/fieldStore.test.ts, src/store/documentStore.ts |

## EXP-02 Proof

The make-or-break assertion passes:

```
Array.from(output.slice(0, 512)).toEqual(Array.from(input.slice(0, 512)))  ✓
output.length > input.length  ✓
```

The mechanism: `exportSignedPdf` calls `PDFDocument.load(srcBytes)`, `takeSnapshot()`, marks modified page refs, draws PNG overlays, calls `saveIncremental(snapshot)` to produce only the delta bytes, then concatenates `[srcBytes, incrementalBytes]`. The original bytes are at offset 0, unchanged — the first 512 bytes test passes because nothing touches them.

## TDD Gate Compliance

- RED commit: `test(02-01): add failing EXP-02 byte-identity test` (8dcd05a) — test file imported non-existent module, failed with `Failed to resolve import`
- GREEN commit: `feat(02-01): implement exportSignedPdf incremental export` (74a5cc4) — all 9 tests passed
- REFACTOR: not needed (implementation was clean on first pass)

## Verification Results

- `npx vitest run`: 142 tests across 7 files — all pass
- `npx tsc --noEmit`: clean (exit 0)
- `grep -rn "from 'pdf-lib'" src`: no results (original pdf-lib fully removed)
- `grep pdf-lib-incremental-save package.json`: `"pdf-lib-incremental-save": "1.17.4"` (exact pin, no caret)
- `grep '"pdf-lib"' package.json`: no results (original removed)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created fieldStore.ts in Task 2 to unblock exportPdf.ts import**

- **Found during:** Task 2 GREEN implementation
- **Issue:** `src/lib/exportPdf.ts` imports `PlacedField` from `../store/fieldStore`, but fieldStore.ts was planned for Task 3. The import would have caused a build error in vitest before any GREEN test could run.
- **Fix:** Created the complete `fieldStore.ts` (including both types and the full Zustand store) as part of Task 2's GREEN step. This resolved the import without deferring or creating a partial stub.
- **Impact:** Task 3 became: write fieldStore.test.ts + extend documentStore (fieldStore.ts was already complete). No behavior difference.
- **Files modified:** src/store/fieldStore.ts (created during Task 2, not Task 3)
- **Commits:** 74a5cc4

## Known Stubs

None — all exported functions are fully implemented. No placeholder data flows to rendering.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. Processing is entirely in-browser. PRV-01/PRV-02 maintained:
- `exportSignedPdf` — pure in-memory; no fetch/XHR
- `triggerDownload` — Blob → objectURL → anchor click; no network
- `useFieldStore` — Zustand in-memory; no localStorage, no IndexedDB in Phase 2

All threat mitigations applied per plan threat model:

| ID | Status |
|----|--------|
| T-02-01 | Mitigated: dataUrl validated with `startsWith('data:image/png;base64,')` before embedPng |
| T-02-02 | Mitigated: entire export body wrapped in try/catch; re-thrown as tagged `Error('Could not export the signed PDF: ...')` |
| T-02-03 | Accepted: no network calls; pure browser processing |
| T-02-SC | Mitigated: pdf-lib-incremental-save@1.17.4 pinned exact (no caret); lockfile committed |

## Self-Check: PASSED

All 5 created files found on disk. All 4 task commits found in git log.
