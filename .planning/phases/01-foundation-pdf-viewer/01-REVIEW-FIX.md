---
phase: 01-foundation-pdf-viewer
fixed_at: 2026-06-16T15:31:00Z
review_path: .planning/phases/01-foundation-pdf-viewer/01-REVIEW.md
iteration: 1
findings_in_scope: 9
fixed: 8
skipped: 1
status: partial
---

# Phase 01: Code Review Fix Report

**Fixed at:** 2026-06-16T15:31:00Z
**Source review:** `.planning/phases/01-foundation-pdf-viewer/01-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 9
- Fixed: 8
- Skipped: 1

---

## Fixed Issues

### CR-01: No loading state shown while wrapping image files

**Files modified:** `src/components/UploadZone.tsx`
**Commit:** 740479c
**Applied fix:** Added `const setView = useDocumentStore((s) => s.setView)` to the
component's store subscriptions, called `setView('loading')` immediately before the
`await wrapImageAsPdf(file)` call, and added `setView` to the `useCallback` dependency
array. The error path is unchanged — `setError()` transitions view to `error` on catch.

---

### CR-02: pdf.js worker manually committed; not automated in vite.config.ts

**Files modified:** `vite.config.ts`, `.gitignore`
**Commit:** 8ceec84
**Applied fix:** Added a `workerFile` constant pointing to
`node_modules/pdfjs-dist/build/pdf.worker.min.mjs` and added it as a third
`viteStaticCopy` target alongside cmaps and standard_fonts. Removed the manually-committed
`public/pdf.worker.min.mjs` via `git rm --cached` and added it to `.gitignore` with an
explanatory comment. Build verification confirmed the worker lands at `dist/pdf.worker.min.mjs`
(the path referenced by `pdfWorker.ts`), preserving PRV-02.

---

### WR-01: Revoking Blob URL before DocumentViewer unmounts (TopBar race)

**Files modified:** `src/components/DocumentViewer.tsx`, `src/components/TopBar.tsx`,
`src/components/ErrorBanner.tsx`
**Commit:** f4e2b3b
**Applied fix:** Added a `useEffect` cleanup in `DocumentViewer` keyed on `docUrl` that
calls `URL.revokeObjectURL(url)` when the component unmounts or `docUrl` changes. Removed
the eager `URL.revokeObjectURL(docUrl)` calls from `TopBar.handleOpenAnother()` and
`ErrorBanner.handleRetry()` — both now just call `reset()`. Also removed the `docUrl`
store subscription from both components since it is no longer needed there.

---

### WR-02: pdfWorker side-effect import is fragile — not anchored in the entry point

**Files modified:** `src/main.tsx`
**Commit:** 8baf8e5
**Applied fix:** Added `import './lib/pdfWorker'` as the first import line in `main.tsx`,
with a comment explaining the ordering requirement and PRV-02 constraint. This guarantees
`GlobalWorkerOptions.workerSrc` is set at app initialisation before any react-pdf usage.

---

### WR-03: Redundant duplicate import of `pdfWorker` module

**Files modified:** `src/components/DocumentViewer.tsx`
**Commit:** 8baf8e5
**Applied fix:** Removed the bare side-effect import `import '../lib/pdfWorker'` (line 3)
from `DocumentViewer.tsx`. The named `import { pdfOptions } from '../lib/pdfWorker'`
remains, and the side-effect is now anchored unconditionally in `main.tsx` (WR-02).

---

### WR-04: `AnnotationLayer.css` imported while annotation layer is disabled

**Files modified:** `src/components/DocumentViewer.tsx`
**Commit:** 8baf8e5
**Applied fix:** Removed `import 'react-pdf/dist/Page/AnnotationLayer.css'` and replaced
it with a comment explaining the intent: re-add alongside a security review when
annotations are enabled in a future phase.

---

### IN-01: `setView` exposed in store but unused — invites direct view manipulation

**Note:** This finding is superseded by CR-01. The CR-01 fix legitimately uses `setView`
in `UploadZone` to show the loading spinner before async image wrapping. `setView` is
now a necessary, purposeful store action. No change made to the store interface.

**Status:** Not applicable — `setView` is actively used after CR-01 fix.

---

### IN-03: `LoadingSpinner` injects `@keyframes spin` via inline `<style>`

**Files modified:** `src/components/LoadingSpinner.tsx`
**Commit:** f72b014
**Applied fix:** Removed the `<style>` child element from the SVG and the `style` prop
with `animation: 'spin 1s linear infinite'`. Added `className="animate-spin"` to the SVG
element. Tailwind v4 ships `@keyframes spin` and `--animate-spin: spin 1s linear infinite`
natively in its theme, so no additions to `index.css` are needed.

---

## Skipped Issues

### IN-02: Worker file version management undocumented

**File:** `public/pdf.worker.min.mjs`
**Reason:** Superseded by CR-02. CR-02 automated the worker copy via `viteStaticCopy`,
which eliminates the manual version-management concern entirely. The `public/pdf.worker.min.mjs`
file has been removed from version control. No documentation change is needed.

---

## Verification Results

All three checks ran after all fixes were applied:

| Check | Command | Result |
|-------|---------|--------|
| TypeScript | `npx tsc --noEmit` | Clean (0 errors) |
| Tests | `npx vitest run` | 117/117 passed, 5 test files |
| Build | `npm run build` | Exit 0; `dist/pdf.worker.min.mjs` present at dist root |

---

_Fixed: 2026-06-16T15:31:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

---

## Follow-up correction (orchestrator, post-fix verification)

CR-02's first fix was **incomplete**: `viteStaticCopy` was given absolute (and later
glob/relative) paths from `require.resolve`, which made it reconstruct the full
`node_modules/pdfjs-dist/...` tree **under** `dist/` (e.g. `dist/node_modules/pdfjs-dist/cmaps/`)
instead of placing assets at `dist/cmaps/`, `dist/standard_fonts/`, and `dist/pdf.worker.min.mjs`.
The build still produced a worker at the dist root **only** because a committed
`public/pdf.worker.min.mjs` was being auto-copied by Vite — masking the bug. With the runtime
URLs (`/pdf.worker.min.mjs`, `/cmaps/`, `/standard_fonts/`) all pointing at the dist root, cmaps
and standard fonts would have **404'd at runtime**, and the worker would have 404'd once the
committed copy was removed — a real PRV-02 regression.

**Resolution (commit `c65119b`):** replaced `viteStaticCopy` with `scripts/copy-pdf-assets.mjs`,
wired to `prepare`/`predev`/`prebuild`. It copies the worker + `cmaps/` + `standard_fonts/` from
the installed `pdfjs-dist` into `public/`, which Vite serves at the site root in **both** dev and
build. Verified: clean `dist/` now contains `pdf.worker.min.mjs`, `cmaps/` (169 files),
`standard_fonts/` (16 files) at the root and **no** `dist/node_modules/`. `vite-plugin-static-copy`
was removed from devDependencies. tsc clean, 117/117 tests pass, build exit 0.
