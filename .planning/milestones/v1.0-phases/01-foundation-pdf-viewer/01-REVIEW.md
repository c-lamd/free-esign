---
phase: 01-foundation-pdf-viewer
reviewed: 2026-06-16T15:30:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - src/App.tsx
  - src/main.tsx
  - src/store/documentStore.ts
  - src/lib/pdfWorker.ts
  - src/lib/coordinateMapper.ts
  - src/lib/fileValidation.ts
  - src/lib/imageWrapper.ts
  - src/components/DocumentViewer.tsx
  - src/components/LazyPage.tsx
  - src/components/PageNavigation.tsx
  - src/components/UploadZone.tsx
  - src/components/ErrorBanner.tsx
  - src/components/TopBar.tsx
  - src/components/LoadingSpinner.tsx
  - vite.config.ts
  - src/index.css
findings:
  critical: 2
  warning: 4
  info: 3
  total: 9
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-06-16T15:30:00Z
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

The scaffold is well-structured: the state machine is clean, validation is correct (size checked before byte read, MIME + extension whitelist), PRV-02 (self-hosted worker/cmaps/fonts) is implemented properly, and the ResizeObserver/IntersectionObserver cleanup is correct under React 19 callback ref semantics. Two blockers require fixes before the app is usable: image files produce no loading feedback (UX freeze), and the pdf.js worker is manually committed with no automated copy step (silently breaks on every pdfjs-dist upgrade). Four warnings cover a revoke/render race in TopBar, a missing `setView('loading')` before async work, a redundant import, and an unused CSS bundle. Three info items cover minor maintenance hazards.

---

## Critical Issues

### CR-01: No loading state shown while wrapping image files

**File:** `src/components/UploadZone.tsx:50-60`

**Issue:** The comment at line 50 says "transition to loading state immediately," but `loadDocument` is only called *after* `await wrapImageAsPdf(file)` resolves. For a large PNG or JPEG, `file.arrayBuffer()` + `PDFDocument.create()` + `pdfDoc.save()` can take several seconds. During that entire period the app stays in `empty` view (UploadZone visible, no spinner), giving the user no feedback and no way to tell if anything happened.

`wrapImageAsPdf` in `imageWrapper.ts` reads the full ArrayBuffer, creates an in-memory PDF document, and serializes it — all synchronous-style inside the pdf-lib await chain. For a 20 MB image this is noticeable.

**Fix:** Call `setView('loading')` (exposed as a store action) before entering the async path:

```tsx
// UploadZone.tsx — inside handleFile, after validation passes:
if (file.type === 'image/jpeg' || file.type === 'image/png') {
  setView('loading')          // <-- show spinner immediately
  try {
    const blobUrl = await wrapImageAsPdf(file)
    loadDocument(blobUrl)     // transitions to 'loading' again (harmless) then 'loaded'
  } catch {
    setError("This file couldn't be read…")
  }
}
```

`setView` must be added to the destructuring at the top of `UploadZone` and imported from the store. Alternatively, call `loadDocument` with a temporary sentinel URL before the wrap and replace it on success — but the `setView` approach is cleaner since `loadDocument` also resets `errorMessage`.

---

### CR-02: pdf.js worker manually committed; not automated in vite.config.ts

**File:** `vite.config.ts:18-25`, `public/pdf.worker.min.mjs`

**Issue:** CMaps and standard fonts are correctly auto-copied from `node_modules/pdfjs-dist` via `viteStaticCopy` on every build, keeping them in sync with the installed package. The pdf.js worker (`public/pdf.worker.min.mjs`) is a manually committed static file — it is NOT listed in `viteStaticCopy` targets.

This creates a silent version-mismatch failure mode: `npm install` or a pnpm/yarn upgrade of `pdfjs-dist` (direct or transitive through `react-pdf`) will update the package but leave the committed worker at the old version. pdf.js validates that the worker major/minor version matches the main thread module at runtime, and prints a prominent error to the console and falls back to a main-thread worker (which blocks the UI). The current state happens to work because the file sizes match `node_modules/pdfjs-dist/build/pdf.worker.min.mjs`, but no enforcement exists.

**Fix:** Add the worker to `viteStaticCopy` targets and remove the committed `public/pdf.worker.min.mjs`:

```ts
// vite.config.ts
const workerFile = normalizePath(
  path.join(pdfjsDistPath, 'build', 'pdf.worker.min.mjs'),
)

viteStaticCopy({
  targets: [
    { src: cMapsDir, dest: '' },
    { src: standardFontsDir, dest: '' },
    { src: workerFile, dest: '' },   // <-- add this
  ],
}),
```

Then delete `public/pdf.worker.min.mjs` and add it to `.gitignore` under `public/` or exclude it from version control.

---

## Warnings

### WR-01: Revoking Blob URL before DocumentViewer unmounts (TopBar race)

**File:** `src/components/TopBar.tsx:10-13`

**Issue:** `handleOpenAnother` calls `URL.revokeObjectURL(docUrl)` and then `reset()` in sequence. `reset()` is a synchronous Zustand `set` call that queues a React re-render, but the render (which unmounts `DocumentViewer`) has not happened yet when the URL is revoked. react-pdf's `Document` component may still hold a reference to the URL internally (e.g., if an ongoing fetch or the worker has not yet acknowledged the document). If the revoke races with pdf.js's internal reference tracking, pdf.js fires an internal fetch error which calls `onLoadError`, which calls `setError(...)` — transitioning `view` to `error` from what is now `empty` after reset, landing the user on the ErrorBanner instead of the UploadZone.

The symmetric problem exists in `ErrorBanner.handleRetry()` (line 28), but there the PDF is already known-bad so a transient error on revoke has no visible effect.

**Fix:** Defer the revoke until after the DocumentViewer has unmounted. The cleanest approach is to revoke inside a `useEffect` cleanup in `DocumentViewer` tied to `docUrl`:

```tsx
// DocumentViewer.tsx
useEffect(() => {
  const url = docUrl
  return () => {
    if (url) URL.revokeObjectURL(url)
  }
}, [docUrl])
```

Then remove both `URL.revokeObjectURL` calls from `TopBar` and `ErrorBanner` — the effect cleanup fires when `docUrl` changes (reset sets it to `null`, triggering cleanup with the previous value) or when the component unmounts.

---

### WR-02: pdfWorker side-effect import is fragile — not anchored in the entry point

**File:** `src/main.tsx`, `src/components/DocumentViewer.tsx:3-4`

**Issue:** The critical `GlobalWorkerOptions.workerSrc` assignment lives as a module side-effect in `pdfWorker.ts`, which is imported from `DocumentViewer.tsx` (not `main.tsx`). The comment is correct that within `DocumentViewer.tsx`'s own module graph the import ordering is safe. However, if any future code path imports `react-pdf` (or a module that does) *before* `DocumentViewer` is first evaluated — e.g., a lazy-loaded component, a test helper, or a new route — `GlobalWorkerOptions.workerSrc` will be unset when pdf.js tries to spawn its worker. This silently falls back to the pdf.js inline worker (a large chunk), bypassing the self-hosted constraint (PRV-02).

The fix is a one-line addition to `main.tsx`:

```tsx
// main.tsx — FIRST import, before React and App
import './lib/pdfWorker'
import { StrictMode } from 'react'
// ...rest unchanged
```

This guarantees the side-effect runs at app initialization regardless of which component renders first.

---

### WR-03: Redundant duplicate import of `pdfWorker` module

**File:** `src/components/DocumentViewer.tsx:3-4`

**Issue:** `pdfWorker` is imported twice on consecutive lines:

```ts
import '../lib/pdfWorker'         // line 3 — side-effect-only import
import { pdfOptions } from '../lib/pdfWorker'  // line 4 — named import
```

ES module caching ensures the module executes only once, so there is no behavioral difference, but the bare side-effect import on line 3 is dead code — line 4's named import already triggers the same side-effect. When WR-02 is fixed (anchoring the import in `main.tsx`), line 3 AND line 4 in `DocumentViewer` should be collapsed into just the `pdfOptions` named import.

**Fix:** Remove line 3; keep line 4. After WR-02 fix, line 4 can stay as `import { pdfOptions } from '../lib/pdfWorker'` (the side-effect will have already run from `main.tsx`).

---

### WR-04: `AnnotationLayer.css` imported while annotation layer is disabled

**File:** `src/components/DocumentViewer.tsx:7`

**Issue:** Line 7 imports `react-pdf/dist/Page/AnnotationLayer.css`, but `renderAnnotationLayer={false}` is correctly set on every `<Page>` in `LazyPage.tsx`. The CSS is bundled and shipped for zero benefit. More importantly, this import is cited in react-pdf documentation as the "enable annotation layer" step — leaving it creates a documentation mismatch for future developers who might remove `renderAnnotationLayer={false}` while reading the import as confirmation that annotations are on.

**Fix:** Remove line 7 from `DocumentViewer.tsx`:

```diff
- import 'react-pdf/dist/Page/AnnotationLayer.css'
```

If annotations are enabled in Phase 2+, re-add the import at that point alongside the security review of the annotation attack surface.

---

## Info

### IN-01: `setView` exposed in store but unused — invites direct view manipulation

**File:** `src/store/documentStore.ts:12,27`

**Issue:** `setView` is exported on the `DocumentStore` interface and implemented in the store. It allows any component to directly set the view state without updating `docUrl`, `numPages`, or `errorMessage`, which can create inconsistent state (e.g., setting `view: 'loaded'` while `numPages` is still `null` causes `DocumentViewer` to render with an empty `pageNumbers` array and no load triggered). No component currently uses `setView` directly — all view transitions go through `loadDocument`, `setNumPages`, `setError`, or `reset`, which are the correct atomic actions.

**Fix:** Remove `setView` from the interface and implementation unless a future use case requires it. If the CR-01 fix needs to show loading during image wrap, call `setView('loading')` locally in `UploadZone` until a cleaner action is added, or add a dedicated `startImageWrap()` action that atomically sets the loading state.

---

### IN-02: Worker file version management undocumented

**File:** `public/pdf.worker.min.mjs`

**Issue:** There is no comment, README entry, or script documenting that this file must match `pdfjs-dist`. After CR-02 is resolved (automated copy), this becomes moot. Until then, any developer who does `npm install` will not know to re-copy the worker.

**Fix:** Add a comment to `vite.config.ts` near the pdfjs path resolution, or a `package.json` `postinstall` script, explaining the worker must match the installed pdfjs-dist. Superseded by fixing CR-02.

---

### IN-03: `LoadingSpinner` injects `@keyframes spin` via inline `<style>`

**File:** `src/components/LoadingSpinner.tsx:18`

**Issue:** The animation is defined via an inline `<style>` tag inside the SVG element. This works, but in React 19 with concurrent rendering, the same keyframe name (`spin`) could conflict if `LoadingSpinner` is rendered in multiple concurrent subtrees. Tailwind v4 is already in scope; a CSS animation utility or a class in `index.css` would be more maintainable.

**Fix:** Move the keyframe to `src/index.css` and apply it as a Tailwind CSS custom animation or a plain CSS class:

```css
/* index.css */
@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
.animate-spin {
  animation: spin 1s linear infinite;
}
```

Then use `className="animate-spin"` on the SVG (Tailwind v4 ships `animate-spin` by default, so this may already be available).

---

_Reviewed: 2026-06-16T15:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
