---
quick_id: 260618-d3j
description: "Fix perpetual-loading deadlock: loadDocument must mount DocumentViewer"
date: 2026-06-18
status: complete
severity: critical
commit: 25831d2
---

# Quick Task 260618-d3j Summary

## Outcome

Fixed the critical deadlock that left every uploaded PDF/image stuck on a
perpetual loading spinner. The core value flow (upload → render → place → download)
now works, confirmed in a real browser.

## Root cause

`documentStore.loadDocument(url)` set `view: 'loading'`. `App.tsx` mounts
`<DocumentViewer>` only when `view === 'loaded'`, rendering a bare
`<LoadingSpinner>` for `'loading'`. The only `'loading' → 'loaded'` transition is
`setNumPages`, fired by `<Document onLoadSuccess>` **inside DocumentViewer** — the
very component the `'loading'` view excludes from the tree. So `<Document>` never
mounted, `onLoadSuccess`/`onLoadError` never fired, and the view was stuck forever.

## Change

- **`src/store/documentStore.ts`** — `loadDocument` now sets `view: 'loaded'`
  (+ a defensive comment documenting the deadlock). DocumentViewer's own
  `<Document loading={<LoadingSpinner/>}>` covers parse time. The top-level
  `'loading'` view is retained for the async image-wrap gap only.
- **`src/test/documentStore.test.ts`** — corrected the test that asserted the
  buggy `'loading'` transition; it now asserts `'loaded'` with a regression note.
- **`src/test/uploadFlow.test.tsx`** (new) — renders the REAL `<App>` router and
  drives `loadDocument`, asserting the react-pdf `<Document>` mounts and the loop
  reaches `'loaded'` with page wrappers. This is the integration layer every prior
  test bypassed by force-setting `view: 'loaded'`.

## Verification

- `npx vitest run` → **547 passed (15 files)**.
- **Teeth proof:** temporarily reverting only the `loadDocument` line back to
  `'loading'` makes `uploadFlow.test.tsx` FAIL (`expected null not to be null` —
  the viewer never mounts); restoring `'loaded'` makes it pass.
- **Real browser smoke (Playwright + chromium):** built `dist`, served via
  `vite preview`, uploaded a real generated PDF through the actual UI. Result:
  react-pdf rasterized the page to a 900×1164 `<canvas>`; worker served
  `200 text/javascript` (no SPA-rewrite-to-HTML); zero console errors. Screenshot
  shows the document rendered in the viewer with the field toolbar active.

## Notes / process

- This **closes the deferred Phase-2 "human verify signing loop" item** — that
  verification was never performed, which is exactly why the deadlock shipped in
  v1.0. The new `uploadFlow.test.tsx` is a permanent guard so it cannot regress
  silently again.
- Also fixes a latent corrupt-PDF hang: `onLoadError` previously could not fire
  either (Document never mounted), so invalid files hung instead of showing the
  error banner. They now route to the friendly ErrorBanner.
- Playwright was used from a throwaway `/tmp` project; no test-tooling deps were
  added to the repo.
