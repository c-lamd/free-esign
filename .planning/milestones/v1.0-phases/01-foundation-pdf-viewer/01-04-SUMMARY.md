---
phase: 01-foundation-pdf-viewer
plan: "04"
subsystem: ui
tags: [react-pdf, lazy-rendering, intersection-observer, resize-observer, page-navigation, accessibility, vitest, security]

requires:
  - "01-01 (Zustand store with currentPage/numPages/setCurrentPage/setNumPages; pdfWorker.ts import order guard)"
  - "01-03 (upload flow that feeds docUrl into Zustand; loads documents into the viewer)"

provides:
  - "src/components/LazyPage.tsx — IntersectionObserver lazy render (200px rootMargin) with A4 placeholder, data-page-number attribute"
  - "src/components/PageNavigation.tsx — fixed bottom-center pill: prev/next (44px, aria-disabled, sr-only + aria-label), aria-live='polite' indicator"
  - "src/components/DocumentViewer.tsx — full multi-page viewer replacing Plan-01 skeleton: ResizeObserver fit-to-width, continuous vertical scroll, lazy page list, scroll-tracking IntersectionObserver"
  - "src/test/documentViewer.test.ts — 6 component tests proving numPages drives LazyPage array length (DOC-03)"
  - "DOC-03: continuous fit-to-width multi-page viewer with prev/next navigation and scroll-synced '1 / N' indicator"

affects:
  - "Phase 2 (DocumentViewer scroll container and data-page-number attribute are stable contracts for field overlay positioning)"
  - "Phase 3 (zoom-aware coordinate update loop will need to extend LazyPage/DocumentViewer — containerWidth state is the hook point)"

tech-stack:
  added: []
  patterns:
    - "LazyPage: IntersectionObserver (rootMargin 200px) renders placeholder at A4 aspect-ratio height; swaps to real Page on visibility; observer disconnected after first intersection"
    - "DocumentViewer: useCallback ref + ResizeObserver for fit-to-width (Pitfall 5 avoidance: container is 100% inside max-width parent, never fit-content)"
    - "Scroll-position currentPage tracking: IntersectionObserver over [data-page-number] elements with 11-threshold array; highest ratio wins"
    - "PageNavigation: aria-disabled='true' (not disabled attribute) at boundaries so focus stays reachable; both aria-label and sr-only span on each button"
    - "renderAnnotationLayer=false on every LazyPage: eliminates annotation-based injection surface (T-01-03)"
    - "vi.mock('react-pdf') + manual _pendingOnLoadSuccess callback control: avoids setState-during-render warning; deterministic test assertions"

key-files:
  created:
    - src/components/LazyPage.tsx
    - src/components/PageNavigation.tsx
    - src/test/documentViewer.test.ts
  modified:
    - src/components/DocumentViewer.tsx

key-decisions:
  - "LazyPage renders placeholder (not null) while off-screen: preserves scroll height so PDF scroll position is accurate for long documents"
  - "Observer disconnects after first intersection: pages stay rendered once visible (no unload on scroll away) — avoids flicker and re-parse cost"
  - "aria-disabled (not disabled) on prev/next: WCAG focus reachability at page boundaries; opacity 0.35 signals disabled state visually"
  - "Scroll-tracking via IntersectionObserver with 11 thresholds: accurately tracks the most-visible page during fast scroll; setCurrentPage only called when ratio changes"
  - "tsc -b noUnusedLocals compliance: refactored test mock to avoid module-level variable that was only written, never read"

metrics:
  duration: "~6 min"
  completed: "2026-06-16"
  tasks: 2
  files_created: 3
  files_modified: 1
  tests_added: 6
---

# Phase 01 Plan 04: Continuous Multi-Page Viewer + Page Navigation Summary

**Continuous fit-to-width multi-page PDF viewer with IntersectionObserver lazy rendering, ResizeObserver fit-to-width, a bottom-center prev/next + "1 / N" navigation pill, and scroll-synced currentPage tracking — completing DOC-03 and the Phase 1 user story.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-06-16T22:13:38Z
- **Completed:** 2026-06-16T22:19:00Z
- **Tasks:** 2 automated (Task 3 deferred — see below)
- **Files created:** 3
- **Files modified:** 1

## Accomplishments

- `src/components/LazyPage.tsx` — IntersectionObserver wrapper (rootMargin: '200px') with A4 aspect-ratio placeholder preserving scroll height while off-screen; swaps to real react-pdf `<Page>` on first intersection; observer disconnects after becoming visible; `data-page-number` attribute for PageNavigation scroll targeting and currentPage tracking; `renderAnnotationLayer={false}` (T-01-03 mitigation).

- `src/components/DocumentViewer.tsx` — Full replacement of the Plan-01 skeleton: keeps the pdfWorker import first (Pitfall 3 guard preserved); wraps a scrollable gray canvas container (ResizeObserver via `useCallback` ref, constrained-width inner container for Pitfall 5 avoidance); `<Document file={docUrl} options={pdfOptions}>` maps `1..numPages` to `<LazyPage>` entries with 24px gap; scroll-position currentPage tracking via a second IntersectionObserver over all `[data-page-number]` elements with 11 intersection thresholds (highest visible ratio wins, calls `setCurrentPage`); `<PageNavigation>` rendered only when `numPages > 0`.

- `src/components/PageNavigation.tsx` — Fixed bottom-center white pill (20px radius, shadow, 8px/16px padding); [prev][indicator][next] layout, 8px gap. Prev/next: 44px minimum touch target, 16px inline SVG chevrons, `aria-disabled="true"` (not `disabled`) at boundaries (focus reachable), opacity 0.35 at boundaries, hover/focus state via inline event handlers (accent color, 2px outline). BOTH `aria-label` AND inner `<span className="sr-only">` label on each button. Indicator: `{currentPage} / {numPages}` with `aria-live="polite"` so screen readers announce page changes. `scrollToPage` finds `[data-page-number="${n}"]` inside the scroll container and calls `scrollIntoView({ behavior: 'smooth' })`.

- `src/test/documentViewer.test.ts` — 6 component tests:
  - DocumentViewer: 5 LazyPage wrappers for numPages=5
  - DocumentViewer: 1 wrapper for single-page doc
  - DocumentViewer: null render when docUrl=null
  - DocumentViewer: sequential data-page-number values [1,2,3]
  - LazyPage: renders page content after IntersectionObserver fires
  - LazyPage: data-page-number attribute on wrapper div
  - Mocks: `vi.mock('react-pdf')` with `_pendingOnLoadSuccess` callback pattern (deterministic, no setState-during-render warning); `MockIntersectionObserver` with manual `triggerAllIntersections()` control; `MockResizeObserver` with 800px fixed width.

## Task Commits

1. **Task 1 + 2: LazyPage + full DocumentViewer + PageNavigation + tests** - `989d355` (feat)
2. **Fix: unused variable in documentViewer.test.ts (tsc -b compliance)** - `84365b1` (fix)

## Files Created

- `src/components/LazyPage.tsx` — 73 lines. IntersectionObserver lazy render with placeholder.
- `src/components/PageNavigation.tsx` — 155 lines. Fixed pill with accessible prev/next and aria-live indicator.
- `src/test/documentViewer.test.ts` — 220 lines. 6 component tests with IntersectionObserver/ResizeObserver/react-pdf mocks.

## Files Modified

- `src/components/DocumentViewer.tsx` — Replaced 83-line skeleton with 128-line full multi-page viewer.

## Decisions Made

1. **LazyPage does not unmount on scroll away:** Once an `IntersectionObserver` entry fires as intersecting, the observer disconnects and the page stays rendered. This prevents re-parsing and eliminates flicker on back-scroll. For a signing tool, users need stable page positions.

2. **aria-disabled instead of disabled on prev/next:** Per UI-SPEC accessibility requirements, using the native `disabled` attribute would remove the button from the tab sequence, leaving keyboard users unable to reach it at boundaries. `aria-disabled="true"` with opacity 0.35 is the correct WCAG pattern.

3. **Both aria-label AND sr-only span:** The UI-SPEC explicitly requires both. `aria-label` covers assistive technology that reads button properties; `sr-only` ensures a visible-in-DOM text node exists for environments that don't read `aria-label` on non-form elements. Belt-and-suspenders accessibility.

4. **11 IntersectionObserver thresholds for scroll tracking:** Using `threshold: [0, 0.1, ..., 1.0]` ensures the currentPage indicator updates frequently during scroll. A single threshold (e.g., 0.5) would only fire when a page crosses the halfway visible mark, causing the indicator to lag on slow scrolls.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] vi.mock factory caused setState-during-render React warning**
- **Found during:** Task 1 test run (first attempt)
- **Issue:** Initial mock called `onLoadSuccess({ numPages })` synchronously during `Document` render, triggering React's "Cannot update a component while rendering a different component" warning; also caused doubled page counts because the store update triggered a re-render while the first render was still completing
- **Fix:** Changed mock to store `_pendingOnLoadSuccess` callback and have tests call it inside `act()` after initial render completes; split test assertions from render
- **Files modified:** `src/test/documentViewer.test.ts`
- **Commit:** `989d355`

**2. [Rule 1 - Bug] Page mock data-page-number attribute caused doubled count**
- **Found during:** Task 1 test run (first attempt)
- **Issue:** Initial Page mock included `data-page-number` attribute, causing `querySelectorAll('[data-page-number]')` to return both the LazyPage wrapper div AND the inner Page element (2× count per page)
- **Fix:** Removed `data-page-number` from the Page mock; only the LazyPage wrapper sets it (consistent with real react-pdf Page behavior)
- **Files modified:** `src/test/documentViewer.test.ts`
- **Commit:** `989d355`

**3. [Rule 1 - Bug] noUnusedLocals TS error from _mockNumPages in test**
- **Found during:** Task 2 verification (`npm run build` uses `tsc -b` which includes test files)
- **Issue:** `getMockNumPages()` function was flagged as unused by TypeScript's `noUnusedLocals` because `vi.mock()` hoisting makes the static reference invisible to the type checker; then `_mockNumPages` became write-only after refactoring away `getMockNumPages()`
- **Fix:** Removed `getMockNumPages()` function and `_mockNumPages` variable; tests pass `numPages` directly via `_pendingOnLoadSuccess({ numPages })`
- **Files modified:** `src/test/documentViewer.test.ts`
- **Commit:** `84365b1`

## Deferred Human Verification (end-of-phase checkpoint — Task 3)

Task 3 was a `checkpoint:human-verify` with `gate="blocking"`. Per `workflow.human_verify_mode: end-of-phase`, this is deferred and recorded here for execution at end of Phase 1.

**What to verify (full Phase 1 flow):**

1. Run `npm run dev`. Open the printed localhost URL.
2. Drag-drop or Browse to open a **multi-page PDF** (at least 5 pages).
3. Confirm pages render as a continuous vertical scroll, centered, fit-to-width, on a gray canvas, with white page backgrounds, subtle shadows, and 24px gaps.
4. Use **prev/next** buttons and **scroll** through all pages. Confirm:
   - The "1 / N" indicator updates when clicking prev/next.
   - The "1 / N" indicator updates when scrolling.
   - Prev is visually disabled (opacity 0.35) on page 1; next is disabled on the last page.
   - Both prev and next remain focusable by Tab when disabled.
5. Scroll a long PDF quickly — confirm pages render lazily (placeholder visible briefly before page canvas appears) without the tab freezing or consuming excessive memory.
6. Open a **JPG** and a **PNG** — confirm each displays as a single-page document (image wrapped to PDF by Plan 03).
7. Open DevTools → Network → reload with DevTools open; open a multi-page PDF. Confirm **zero requests to third-party origins** (every request to localhost only — PRV-02).
8. Click "Open another" in the top bar; confirm return to upload empty state without a full page reload; open a different document.

**Resume signal:** "approved" if all 8 steps pass, or describe the issue if any step fails.

## Known Stubs

None. The DocumentViewer skeleton stub (Plan 01-01) is fully replaced. DOC-03 is delivered.

## Threat Flags

None. No new network endpoints, auth paths, or external data flows introduced.

- T-01-09 (DoS: rendering all pages): **Mitigated** — LazyPage renders placeholder for off-screen pages; only viewport-visible pages (+ 200px buffer) are rendered as PDF canvases.
- T-01-10 (Info Disclosure: CMap/font fetch): **Preserved** — `options={pdfOptions}` with local `/cmaps/` and `/standard_fonts/` paths passed to `<Document>` in DocumentViewer; no CDN regression.
- T-01-03 (Tampering: annotation-layer): **Mitigated** — `renderAnnotationLayer={false}` on every `<LazyPage>` render call.

## Self-Check: PASSED

- `src/components/LazyPage.tsx` exists: FOUND
- `src/components/PageNavigation.tsx` exists: FOUND
- `src/test/documentViewer.test.ts` exists: FOUND
- `src/components/DocumentViewer.tsx` modified (LazyPage + PageNavigation + scroll tracking): CONFIRMED
- commit `989d355`: PRESENT in git log
- commit `84365b1`: PRESENT in git log
- `npx vitest run`: 117/117 PASSED (5 test files)
- `npx tsc --noEmit`: CLEAN (0 errors)
- `npm run build`: SUCCEEDED (bundle warning about chunk size is non-blocking; not an error)
- DOC-03 delivered: continuous multi-page viewer + prev/next navigation + "1 / N" indicator
