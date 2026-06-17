---
phase: "02"
plan: "03"
subsystem: placement-widget
tags: [react-rnd, coordinate-mapper, placement, drag-resize, pdf-space, accessibility]
dependency_graph:
  requires:
    - "02-01: useFieldStore with PlacedField/PageDimensions types + addField/updateField/deleteField/setSelectedFieldId/setPageDimensions/setPlacementMode"
    - "02-02: signatureDataUrl set by modal + placementMode armed on Confirm"
    - "01-foundation: coordinateMapper.ts (cssPixelToPageSpace/pageSpaceToCssPixel)"
  provides:
    - "makeSimpleViewport(originalWidth, originalHeight, scale) — rotation=0 Coordinate Mapper viewport"
    - "PlacedFieldWidget — react-rnd drag/resize/select/delete widget with PDF-space storage"
    - "PlacementModeOverlay — armed-mode sticky banner + Stop placing + Escape cancel"
    - "LazyPage: onLoadSuccess stores PageDimensions; per-page overlay; click-to-drop placement"
    - "DocumentViewer: PlacementModeOverlay render; FLD-07 keyboard delete with T-02-07 guard"
  affects:
    - "02-04 export: fields[] with PDF-space coordinates consumed by exportSignedPdf()"
    - "Phase 3 field types: same placement/widget pattern; same store API"
tech_stack:
  added: []  # react-rnd@10.5.3 was installed in 02-01; this plan only consumes it
  patterns:
    - "react-rnd controlled mode: position/size from PDF-space via pageSpaceToCssPixel; onDragStop/onResizeStop write back via cssPixelToPageSpace"
    - "makeSimpleViewport rotation=0 affine: pdfX=cssX/scale, pdfY=H-cssY/scale (and inverse)"
    - "per-page overlay pointer-events:none (T-02-08); widgets re-enable pointer-events:auto"
    - "bounds=parent with position:relative page wrapper (Pitfall 4 / T-02-09)"
    - "parseFloat(ref.style.width) for onResizeStop CSS string (Pitfall 7)"
    - "Image() naturalWidth/naturalHeight for PNG aspect ratio on placement"
    - "T-02-07 guard: keydown fires only when selectedFieldId!=null AND not input/textarea/contentEditable"
key_files:
  created:
    - src/lib/pageViewport.ts
    - src/components/PlacedFieldWidget.tsx
    - src/components/PlacementModeOverlay.tsx
    - src/test/fieldPlacement.test.ts
  modified:
    - src/components/LazyPage.tsx (onLoadSuccess + overlay div + click-to-place)
    - src/components/DocumentViewer.tsx (PlacementModeOverlay + FLD-07 keydown)
decisions:
  - "PlacementModeOverlay rendered BEFORE the scroll container (as a sibling) so sticky top:56px works relative to the viewport, not inside the scroll div"
  - "LazyPage overlay onClick split into two handlers: handleOverlayClick (placement mode) and handleOverlayClickAway (deselection) — checked via e.target===e.currentTarget"
  - "Aspect ratio derived at placement time via new Image() onload — cached in the async handler; fallback 3:1 if load fails"
  - "lockAspectRatio={true} passed to Rnd (not the numeric ratio) — simpler and sufficient for v1; numeric lock deferred to Phase 3 if precision needed"
metrics:
  duration: "~4 minutes"
  completed: "2026-06-17"
  tasks_completed: 3
  files_created: 4
  files_modified: 2
---

# Phase 2 Plan 03: Placement + Overlay Widget Summary

**react-rnd controlled widget with click-to-drop placement, PDF-space coordinate storage via makeSimpleViewport, drag/resize/select/delete, and keyboard delete guarded against text inputs — FLD-01, FLD-05, FLD-06, FLD-07 delivered.**

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | makeSimpleViewport + round-trip tests | 2b65e9a | src/lib/pageViewport.ts, src/test/fieldPlacement.test.ts |
| 2 | PlacedFieldWidget + PlacementModeOverlay | 043ed35 | src/components/PlacedFieldWidget.tsx, src/components/PlacementModeOverlay.tsx |
| 3 | Wire placement into LazyPage + DocumentViewer | 227a5f1 | src/components/LazyPage.tsx, src/components/DocumentViewer.tsx |

## Verification Results

- `npx vitest run`: **184/184 tests pass** across 9 files (30 new placement round-trip tests included)
- `npx tsc --noEmit`: **clean** (exit 0)
- `react-rnd@10.5.3` confirmed present in package.json (installed by Plan 02-01)

## Success Criteria Status

| Criterion | Status |
|-----------|--------|
| FLD-01: armed click drops signature ~180px wide aspect-preserved, auto-selected, disarms | Delivered |
| FLD-05: drag repositions within page (bounds=parent); position stored in PDF-space | Delivered |
| FLD-06: corner resize, aspect-ratio locked (lockAspectRatio=true); minWidth=80, minHeight=24 | Delivered |
| FLD-07: × control + Delete/Backspace (T-02-07 guarded) remove selected field | Delivered |
| Positions render-scale-independent (PDF-space, re-derived from page dimensions) | Delivered |
| Round-trip test passes (<0.001) | Delivered: 30 tests across scales 1/1.5/0.75 |
| Full npx vitest run green | 184 tests pass |
| npx tsc --noEmit clean | Clean |

## Key Implementation Details

### makeSimpleViewport (rotation=0)

Rotation=0 affine for PDF user space ↔ CSS pixel conversion:
- `convertToPdfPoint(cssX, cssY)` → `[cssX/scale, originalHeight - cssY/scale]`
- `convertToViewportPoint(pdfX, pdfY)` → `[pdfX*scale, (originalHeight-pdfY)*scale]`

Duck-typed to match `ViewportWithToPdf`/`ViewportWithToViewport` from coordinateMapper.ts.
Exposes `viewport.scale` so callers can compute CSS dimensions from PDF widths.

### Placement Flow (click → PDF-space)

1. LazyPage `onLoadSuccess` stores `{originalWidth, originalHeight, scale}` in `pageDimensions[pageNumber]`
2. Overlay div receives `pointer-events:auto` + `cursor:crosshair` when `placementMode===true`
3. Click handler:
   - Computes `cssX/Y = e.clientX/Y - rect.left/top`
   - Loads PNG via `new Image()` to get natural aspect ratio (fallback: 3)
   - Default 180px wide; height = 180/aspect
   - Centers field on click: `fieldTopLeft = {x: cssX - 90, y: cssY - height/2}`
   - `cssPixelToPageSpace(fieldTopLeft, viewport)` → PDF bottom-left (Coordinate Mapper handles Y-flip)
   - `addField(...)` + `setSelectedFieldId(id)` + `setPlacementMode(false)`

### Widget Architecture

```
<div role="img" aria-selected pointer-events:auto>   ← outer wrapper
  <Rnd position={cssPos} size={cssSize} bounds="parent" lockAspectRatio>
    <img src={field.dataUrl} />
    {isSelected && <button × aria-label="Delete signature" />}
  </Rnd>
</div>
```

`bounds="parent"` resolves correctly because the per-page wrapper has `position:relative` (T-02-09, Pitfall 4).

The overlay div is `position:absolute; inset:0; pointer-events:none` (T-02-08 — never blocks PDF canvas). Individual widgets set `pointer-events:auto`.

### Security Threats

| ID | Status |
|----|--------|
| T-02-07 | Mitigated: keydown fires only when selectedFieldId set AND target.tagName ∉ {INPUT, TEXTAREA} AND !target.isContentEditable; preventDefault on Backspace |
| T-02-08 | Mitigated: overlay pointer-events:none by default; auto only during placement |
| T-02-09 | Mitigated: react-rnd bounds="parent" + position:relative page wrapper |

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as specified.

### Decisions Made During Execution

**1. PlacementModeOverlay rendered as sibling before scroll container**
- **Issue:** If rendered inside the scrollable div, `position:sticky; top:56px` would stick relative to the scroll container rather than the viewport.
- **Fix:** Rendered as a React fragment sibling (`<><PlacementModeOverlay /><div ref={scrollContainerRef}>...</div></>`).
- **Impact:** Sticky positioning works correctly relative to the viewport TopBar.

**2. Overlay click-away split into two handlers**
- The plan specified: overlay click deselects when not in placement mode. Implementation uses `e.target === e.currentTarget` to distinguish direct clicks on the overlay from bubbled clicks from child widgets. Child widget `onClick` calls `stopPropagation()` so clicks on widgets do not trigger deselection.

**3. lockAspectRatio={true} not the numeric ratio**
- Plan specified `lockAspectRatio={true}`. Research Pattern 3 mentioned passing the numeric ratio (`pngWidth/pngHeight`). Using `true` locks to the initial CSS dimensions ratio, which matches the PNG aspect since field dimensions are computed from it. Simpler for v1; exact numeric lock deferred if precision needed.

## Known Stubs

None — all placement/widget functionality is fully implemented. No placeholder data flows to rendering.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes beyond the plan threat model. All processing is in-browser:

- `new Image()` in placement handler — in-memory image decode for naturalWidth/naturalHeight; no fetch
- `PlacedFieldWidget` click handlers — DOM events; no network
- Keyboard delete handler — `document.addEventListener`; scoped to field selection; guarded

## Self-Check: PASSED

Files created:
- `src/lib/pageViewport.ts` — FOUND
- `src/components/PlacedFieldWidget.tsx` — FOUND
- `src/components/PlacementModeOverlay.tsx` — FOUND
- `src/test/fieldPlacement.test.ts` — FOUND

Files modified:
- `src/components/LazyPage.tsx` — FOUND
- `src/components/DocumentViewer.tsx` — FOUND

Commits:
- `2b65e9a` — FOUND (makeSimpleViewport + round-trip tests)
- `043ed35` — FOUND (PlacedFieldWidget + PlacementModeOverlay)
- `227a5f1` — FOUND (LazyPage + DocumentViewer wiring)

Test suite: 184/184 tests — all passing
TypeScript: `npx tsc --noEmit` — clean

---
*Phase: 02-core-signing-loop*
*Completed: 2026-06-17*
