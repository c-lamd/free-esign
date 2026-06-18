---
phase: 01-foundation-pdf-viewer
plan: "02"
subsystem: lib
tags: [coordinate-mapper, pdfjs, typescript, pure-module, tdd, vitest]

requires:
  - "01-01 (Vitest jsdom config, pdfjs-dist hoisted via react-pdf)"

provides:
  - "src/lib/coordinateMapper.ts — pure cssPixel↔pdfSpace conversion wrapping pdfjs PageViewport"
  - "Exports: cssPixelToPageSpace, pageSpaceToCssPixel, PageSpace, CssSpace"
  - "Round-trip property test: 88 cases across scales {1,1.5,0.75} × rotations {0,90,180,270} × 7 points, all within 0.001"

affects:
  - "Phase 2 field placement (can import coordinateMapper.ts unchanged — hand-off contract proven)"

tech-stack:
  added: []
  patterns:
    - "Pure TypeScript module: no React/DOM/network imports — safe to unit-test in Vitest jsdom without browser setup"
    - "Structural (duck-typed) viewport parameter: accepts real pdfjs PageViewport or any compatible mock"
    - "TDD RED→GREEN: failing test committed first, implementation committed after suite green"
    - "Affine matrix mock mirrors pdfjs-dist applyTransform/applyInverseTransform exactly for property testing without the full pdfjs bundle"

key-files:
  created:
    - src/lib/coordinateMapper.ts
    - src/test/coordinateMapper.test.ts
  modified: []

key-decisions:
  - "Structural viewport typing: functions accept {convertToPdfPoint(...): number[]} and {convertToViewportPoint(...): number[]} duck types rather than importing the concrete pdfjs PageViewport class. Phase 2 can pass either a real PageViewport or a test mock."
  - "Affine mock over real pdfjs PageViewport in tests: pdfjs-dist build requires DOMMatrix (not available in Vitest jsdom); replicated the identical constructor math + applyTransform/applyInverseTransform from pdfjs-dist/build/pdf.mjs for equivalent coverage without the DOMMatrix dependency."
  - "No package install: pdfjs-dist is already hoisted by react-pdf; coordinateMapper.ts adds zero new dependencies."

metrics:
  duration: "~2 min"
  completed: "2026-06-16"
  tasks: 2
  files_created: 2
  files_modified: 0
  tests_added: 88
---

# Phase 01 Plan 02: Coordinate Mapper Summary

**Pure TypeScript cssPixel↔pdfSpace mapper wrapping pdfjs PageViewport affine math; 88 round-trip property tests pass within 0.001 tolerance across all scales (1/1.5/0.75) and rotations (0/90/180/270 degrees).**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-06-16T22:00:48Z
- **Completed:** 2026-06-16T22:02:00Z
- **Tasks:** 2 (Task 1: RED test; Task 2: GREEN implementation)
- **Files created:** 2

## Accomplishments

- Implemented `src/lib/coordinateMapper.ts` — 98-line pure TypeScript module exporting `PageSpace`, `CssSpace`, `cssPixelToPageSpace`, and `pageSpaceToCssPixel`
- `cssPixelToPageSpace`: delegates to `viewport.convertToPdfPoint(css.x, css.y)`, returns `{ x, y }` in PDF user space
- `pageSpaceToCssPixel`: delegates to `viewport.convertToViewportPoint(pdf.x, pdf.y)`, returns `{ x, y }` in CSS pixels
- Viewport parameter is duck-typed (structural) — accepts real pdfjs `PageViewport` or any compatible object; no pdfjs import in the module itself
- Module is provably pure: `grep -L "from 'react'" src/lib/coordinateMapper.ts` exits 0
- `src/test/coordinateMapper.test.ts` — 201-line property test suite with 88 cases covering the full scale×rotation×point matrix
- TDD sequence preserved: RED commit `ec7226b` first, GREEN commit `9394a87` after
- Full test suite: 94/94 pass (88 new + 6 existing documentStore tests); `tsc --noEmit` clean

## Task Commits

1. **Task 1: RED — round-trip property test** - `ec7226b` (test)
2. **Task 2: GREEN — pure Coordinate Mapper implementation** - `9394a87` (feat)

## Files Created

- `src/lib/coordinateMapper.ts` — Pure module, 98 lines, no React/DOM/network imports. Exports `PageSpace`, `CssSpace`, `cssPixelToPageSpace`, `pageSpaceToCssPixel`.
- `src/test/coordinateMapper.test.ts` — 201 lines, 88 test cases. Scale {1,1.5,0.75} × rotation {0,90,180,270} × 7 sample points (corners, interior, centre). Tolerance: `< 0.001`. Also includes directional unit tests for origin mapping.

## Decisions Made

1. **Structural viewport typing (duck typing):** The viewport parameter for each function is typed as a minimal structural interface (`{ convertToPdfPoint(x,y): number[] }` / `{ convertToViewportPoint(x,y): number[] }`) rather than importing the concrete pdfjs `PageViewport` class. This keeps the module pure (zero pdfjs import) and lets Phase 2 pass any compatible object.

2. **Affine mock in tests instead of real pdfjs PageViewport:** Importing `pdfjs-dist/build/pdf.mjs` in Vitest throws `ReferenceError: DOMMatrix is not defined` — pdfjs requires DOM globals not present in Node. The test mock replicates the identical constructor math and `applyTransform`/`applyInverseTransform` functions verbatim from `pdfjs-dist/build/pdf.mjs`, providing equivalent coverage of the actual affine math without the DOM dependency.

3. **No new package installs:** All required math lives in the mock (which duplicates pdfjs internals). The production module imports nothing — it just calls the two methods on whatever viewport object the caller passes.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written. The plan anticipated the pdfjs DOMMatrix issue and provided the affine-mock fallback as option B; option B was selected because the `PageViewport` class is not exported from the pdfjs-dist public API and the main build requires `DOMMatrix`.

## Known Stubs

None. The Coordinate Mapper is complete and fully tested. No placeholder values or wired-but-empty data flows.

## Threat Flags

None. Pure math module — no network endpoints, no auth paths, no file access, no schema changes. Threat register entry T-01-04 (coordinate math correctness) is fully mitigated by the 88-case round-trip property test.

## TDD Gate Compliance

- RED gate: `test(01-02): ...` commit `ec7226b` — PRESENT
- GREEN gate: `feat(01-02): ...` commit `9394a87` — PRESENT (after RED)
- REFACTOR gate: not required (implementation is already minimal; no cleanup needed)

## Self-Check: PASSED

- `src/lib/coordinateMapper.ts` exists: FOUND
- `src/test/coordinateMapper.test.ts` exists: FOUND
- coordinateMapper.ts has no React import: CONFIRMED (grep -L "from 'react'" exits 0)
- coordinateMapper.ts line count ≥ 25: CONFIRMED (98 lines)
- test contains `toBeLessThan(0.001)`: CONFIRMED
- RED commit `ec7226b`: PRESENT in git log
- GREEN commit `9394a87`: PRESENT in git log
- `npx vitest run src/test/coordinateMapper.test.ts`: 88/88 PASSED
- `npx vitest run` (full suite): 94/94 PASSED
- `npx tsc --noEmit`: CLEAN (0 errors)
