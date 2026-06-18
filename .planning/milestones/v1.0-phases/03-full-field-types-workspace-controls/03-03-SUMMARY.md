---
phase: 03-full-field-types-workspace-controls
plan: 03
subsystem: ui
tags: [zustand, react, typescript, zoom, coordinate-mapper, accessibility]

requires:
  - phase: 03-full-field-types-workspace-controls
    plan: 02
    provides: "LazyPage effectiveScale base, PlacedFieldWidget viewport prop, documentStore with setCurrentPage"

provides:
  - "ZOOM_STEPS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0] as const exported from documentStore"
  - "zoom: number (default 1.0) + setZoom action in documentStore; reset() includes zoom: 1.0"
  - "ZoomControl component: fixed bottom pill with −/readout/+/Fit, aria-disabled at limits, aria-live readout"
  - "effectiveScale = (containerWidth / dims.originalWidth) * zoom threaded through LazyPage Page width, overlay viewport, drop-geometry divisor"
  - "dims.scale remains zoom-free fit-to-width baseline (RESEARCH A2) — never mutated on zoom"
  - "Page rendered as width = containerWidth * zoom (NO scale prop)"
  - "zoom-invariance test suite: 4 tests proving identical PDF coords/widths at any zoom level (DOC-04)"

affects:
  - src/store/documentStore.ts
  - src/components/ZoomControl.tsx
  - src/components/LazyPage.tsx
  - src/components/DocumentViewer.tsx
  - src/test/documentStore.test.ts
  - src/test/coordinateMapper.test.ts

tech-stack:
  added: []
  patterns:
    - "effectiveScale = (containerWidth / originalWidth) * zoom; dims.scale stays zoom-free"
    - "width={containerWidth * zoom} on react-pdf Page; no scale prop (avoids width*scale multiplication)"
    - "zoom-invariant PDF coords: same document point → identical PDF X/Y regardless of zoom"
    - "ZoomControl positioned using right: calc(50% + 85px) to clear PageNavigation pill"
    - "scrollIntoView guarded with typeof check for jsdom compatibility"

key-files:
  created:
    - src/components/ZoomControl.tsx
  modified:
    - src/store/documentStore.ts
    - src/components/LazyPage.tsx
    - src/components/DocumentViewer.tsx
    - src/test/documentStore.test.ts
    - src/test/coordinateMapper.test.ts

decisions:
  - "effectiveScale computed on-the-fly in LazyPage; dims.scale is the zoom=1.0 baseline, never updated on zoom (RESEARCH A2)"
  - "Page width = containerWidth * zoom with no scale prop — react-pdf multiplies width*scale so passing both would double-zoom (RESEARCH Pitfall 5)"
  - "ZoomControl gated on numPages > 0 (same as PageNavigation); renders null when no document loaded"
  - "Page-anchor on zoom uses requestAnimationFrame + scrollIntoView guard (typeof check) for jsdom compatibility"
  - "ZoomControl positioned at right: calc(50% + 85px) to sit left of PageNavigation pill with a visual gap"
  - "zoom-invariance tests scale the CSS click coordinate proportionally with zoom to represent the same physical document point"

metrics:
  duration: "~12 minutes"
  completed: "2026-06-17"
  tasks: 3
  files: 6
---

# Phase 03 Plan 03: Document Zoom (DOC-04) Summary

User-controlled document zoom (50–200%, discrete steps) with zero field drift — closing DOC-04.

## What Was Built

**documentStore zoom state + ZOOM_STEPS:**
Added `zoom: number` (default 1.0) + `setZoom(z: number)` to the `DocumentStore` interface and store. `reset()` includes `zoom: 1.0` to restore fit-to-width baseline on document close. Exported `ZOOM_STEPS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0] as const` from the module for shared use by ZoomControl.

**ZoomControl component (`src/components/ZoomControl.tsx`):**
A floating bottom pill — same chrome as PageNavigation (surface-elevated bg, 20px radius, shadow, padding 8px 16px, z-index 50) — containing [−] [readout] [+] [Fit] left-to-right. Zoom-out/in buttons use `aria-disabled="true"` (not HTML disabled) at the 50%/200% limits so focus stays reachable (WCAG 2.5.5). Percentage readout has `aria-live="polite"` + `aria-atomic="true"`. Fit resets to 1.0. Positioned using `right: calc(50% + 85px)` to sit to the left of PageNavigation without overlap.

**effectiveScale threading in LazyPage:**
- Subscribes to `zoom` from documentStore.
- Computes `effectiveScale = (containerWidth / dims.originalWidth) * zoom` at three points: (1) viewport for `handleOverlayClick` placement, (2) `pdfWidth/pdfHeight` division on drop, and (3) per-field viewport for `PlacedFieldWidget`.
- `<Page width={containerWidth ? containerWidth * zoom : undefined}>` — NO `scale` prop (react-pdf multiplies width×scale; omitting scale keeps the render at exactly containerWidth×zoom).
- `dims.scale` (stored by `onLoadSuccess`) remains the zoom-free fit-to-width baseline — never updated on zoom.

**DocumentViewer wiring:**
- Imports and renders `<ZoomControl />` below the existing `<PageNavigation>` conditional.
- Subscribes to `zoom` and `currentPage` for the page-anchor effect.
- Page-anchor: `useEffect` keyed on `[zoom, currentPage]` fires a `requestAnimationFrame` → `scrollIntoView({ block: 'nearest' })` on the current page element after zoom changes, keeping the previously visible page in view.

**Zoom-invariance tests (`src/test/coordinateMapper.test.ts`):**
Added 4 tests in the `zoom-invariance` describe block using `makeSimpleViewport` directly:
1. Same physical document fraction → identical pdfX/pdfY at zoom 1.0 vs 1.5 (5-decimal tolerance)
2. Same physical fraction → identical pdfX/pdfY at zoom 1.0 vs 2.0
3. PDF-space field width (cssSize/effectiveScale) identical at zoom 1.0 vs 1.5
4. PDF-space field width identical at zoom 0.5 vs 1.75

## Test Results

- `documentStore.test.ts`: 15 tests passing (+6 new: initial zoom, setZoom, reset-to-1.0, ZOOM_STEPS value, clamp-up, clamp-down)
- `coordinateMapper.test.ts`: 92 tests passing (+4 new zoom-invariance tests)
- Full suite: 243 tests, 0 failures (was 233 before plan 03-03)
- `npx tsc -b`: clean

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] scrollIntoView not available in jsdom**
- **Found during:** Task 2 final test run
- **Issue:** The page-anchor `useEffect` called `pageEl.scrollIntoView()` unconditionally. jsdom (the test environment) does not implement `scrollIntoView`, causing 2 uncaught exceptions in the `documentViewer.test.ts` suite even though all tests passed.
- **Fix:** Added `typeof pageEl.scrollIntoView === 'function'` guard before calling it.
- **Files modified:** `src/components/DocumentViewer.tsx`
- **Commit:** f3b4b37

**2. [Rule 1 - Bug] Zoom-invariance test 4 computed wrong at-zoom CSS width**
- **Found during:** Task 3 RED phase
- **Issue:** Initial test for zoom 0.5 vs 1.75 used `baseCssWidth / effectiveScale` at zoom 0.5 instead of `(baseCssWidth * 0.5) / effectiveScale`. A field's CSS pixels scale WITH zoom, so at zoom 0.5 the field is `baseCssWidth * 0.5` pixels wide on screen.
- **Fix:** Corrected to `(baseCssWidth * Z) / (fitScale * Z)` = `baseCssWidth / fitScale` (constant) for both zoom levels.
- **Files modified:** `src/test/coordinateMapper.test.ts`
- **Commit:** 540b452

## Known Stubs

None — all zoom functionality is fully wired. ZoomControl reads real zoom state, LazyPage applies effectiveScale to real page render and field viewport.

## Threat Surface Scan

No new network endpoints, auth paths, or file access patterns introduced. The `zoom` multiplier is bounded to `[0.5, 2.0]` by ZOOM_STEPS clamping (T-03-10). Stored PDF coords are never mutated on zoom (T-03-09 mitigated by invariance tests). No new threat surface outside the plan's threat model.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| ZoomControl.tsx exists | FOUND |
| documentStore.ts exists | FOUND |
| LazyPage.tsx exists | FOUND |
| DocumentViewer.tsx exists | FOUND |
| documentStore.test.ts exists | FOUND |
| coordinateMapper.test.ts exists | FOUND |
| 03-03-SUMMARY.md exists | FOUND |
| Commit 5625106 (Task 1) | FOUND |
| Commit f3b4b37 (Task 2) | FOUND |
| Commit 540b452 (Task 3) | FOUND |
| ZOOM_STEPS in documentStore | FOUND |
| zoom: 1.0 in reset() | FOUND |
| effectiveScale in LazyPage | FOUND |
| No scale= prop on Page | CONFIRMED |
| Full test suite (243 tests) | PASSING |
| tsc -b | CLEAN |
