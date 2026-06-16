---
phase: 01-foundation-pdf-viewer
plan: "03"
subsystem: ui+lib
tags: [upload, drag-drop, file-validation, image-wrapping, pdf-lib, error-handling, tdd, security]

requires:
  - "01-01 (Zustand store shape, App view-router, Vitest jsdom test suite)"
  - "01-02 (Vitest infrastructure; no functional dependency)"

provides:
  - "src/lib/fileValidation.ts — validateFile(): MIME + extension whitelist, 100MB size cap (T-01-05, T-01-06)"
  - "src/lib/imageWrapper.ts — wrapImageAsPdf(): pdf-lib embedJpg/embedPng → Blob URL, no canvas rasterization (T-01-07)"
  - "src/components/UploadZone.tsx — full-screen drag-drop + Browse empty state per UI-SPEC"
  - "src/components/ErrorBanner.tsx — inline role=alert error card with retry (T-01-08 surface)"
  - "src/App.tsx — view-router updated: replaces inline EmptyState/ErrorState with real components"
  - "src/test/fileValidation.test.ts — 11 tests covering valid types, invalid types, size cap"
  - "src/test/imageWrapper.test.ts — 6 tests covering PNG, JPEG, corrupt input error handling"
  - "DOC-01: user opens PDF via drag-drop or file picker"
  - "DOC-02: user opens JPG or PNG; wrapped to single-page PDF Blob URL; uniform viewer pipeline"

affects:
  - "01-04 (DocumentViewer skeleton receives Blob URLs from the same pipeline; wrapping is transparent)"
  - "Phase 2 export (image PDFs created here feed the same pdf-lib overlay pipeline; DPI note documented)"

tech-stack:
  added: []
  patterns:
    - "validateFile: MIME AND extension whitelist (defense-in-depth ASVS L1 V5); size cap before arrayBuffer() (T-01-05 DoS)"
    - "wrapImageAsPdf: embedJpg/embedPng embed original bytes — no lossy canvas rasterization (CLAUDE.md document integrity)"
    - "UploadZone: handleFile shared handler for both drag-drop and file picker; image type → wrapImageAsPdf, PDF → createObjectURL"
    - "ErrorBanner: role=alert; Blob URL revoked before reset() to prevent memory leaks"
    - "DocumentViewer.onLoadError: already handles corrupt PDF via store.setError (T-01-08) — no new prop needed"
    - "TDD RED→GREEN: test commit first (dff1b05), implementation commit after (6153bb2)"

key-files:
  created:
    - src/lib/fileValidation.ts
    - src/lib/imageWrapper.ts
    - src/components/UploadZone.tsx
    - src/components/ErrorBanner.tsx
    - src/test/fileValidation.test.ts
    - src/test/imageWrapper.test.ts
  modified:
    - src/App.tsx
    - src/components/DocumentViewer.tsx

key-decisions:
  - "Defense-in-depth validation: both MIME type AND file extension must be in the whitelist — a PDF MIME with .exe extension is rejected (T-01-06)"
  - "100MB size cap checked BEFORE file.arrayBuffer() — prevents DoS from OOM on oversized files (T-01-05)"
  - "wrapImageAsPdf error is caught and re-thrown as a tagged Error — caller maps to copy contract corrupt-file message, no raw pdf-lib error surfaces to UI (T-01-07)"
  - "DocumentViewer already calls setError on onLoadError internally — no new prop needed in App; T-01-08 already mitigated by existing skeleton code"
  - "URL.revokeObjectURL called in ErrorBanner.handleRetry and TopBar.handleOpenAnother before reset() — prevents Blob URL memory leaks on repeated file opens"
  - "imageWrapper.test.ts mock signature: URL.createObjectURL takes (Blob | MediaSource) not just Blob — required for tsc -b type compatibility"
  - "Phase 2 DPI caveat documented in imageWrapper.ts code comment: image pixel dimensions treated as PDF points at 72 DPI; print-accurate placement requires DPI normalization in Phase 2 export"

metrics:
  duration: "~8 min"
  completed: "2026-06-16"
  tasks: 2
  files_created: 6
  files_modified: 2
  tests_added: 17
---

# Phase 01 Plan 03: Upload + Image Wrapping Summary

**Full document-ingestion slice: MIME+extension validation with 100MB cap, drag-drop/browse UploadZone, pdf-lib image→PDF wrapping via embedJpg/embedPng (original bytes, no rasterization), inline ErrorBanner with retry, and "Open another" — delivering DOC-01 and DOC-02.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-06-16T15:05:00Z
- **Completed:** 2026-06-16T15:09:00Z
- **Tasks:** 2 (Task 1: TDD RED→GREEN for utilities; Task 2: UI components + App wiring)
- **Files created:** 6
- **Files modified:** 2

## Accomplishments

- `src/lib/fileValidation.ts` — pure `validateFile(file)` returning `FileValidationError` ('too-large' | 'unsupported-type' | null). Whitelists by BOTH MIME type (application/pdf, image/jpeg, image/png) AND file extension (.pdf, .jpg, .jpeg, .png) for defense-in-depth. 100MB size cap enforced BEFORE any `file.arrayBuffer()` call (DoS mitigation T-01-05, spoofing mitigation T-01-06).
- `src/lib/imageWrapper.ts` — `wrapImageAsPdf(file)` creates a single-page PDF with `PDFDocument.create()`, embeds original image bytes via `embedPng`/`embedJpg` (NO canvas rasterization — CLAUDE.md document integrity), sizes page to image pixel dimensions, saves and returns `URL.createObjectURL(blob)`. Entire body wrapped in try/catch with tagged errors (T-01-07). Phase 2 DPI caveat documented in code comments.
- `src/components/UploadZone.tsx` — full-screen zone (min-height: calc(100dvh - 56px)), 4 HTML5 drag events (dragenter/dragover/dragleave/drop), drag-over visual state (2px dashed accent border + rgba(255,255,255,0.4) tint), centered 480px content column, 48px upload SVG, "Drop your document here" heading, "or" subtext, "Browse files" accent button (min 44×44px) activating a visually-hidden file input (accept=".pdf,.jpg,.jpeg,.png"), "Your files never leave your browser." privacy line. `role="region"`, `aria-label="Document upload area"`, visible focus rings.
- `src/components/ErrorBanner.tsx` — inline role=alert card (not modal/toast), 4px destructive left border, white bg, 16px red warning SVG, "Could not open file" heading, dynamic `store.errorMessage` body, "Try another file" action that revokes Blob URL and calls `reset()`. 44px min touch target.
- `src/App.tsx` — replaced inline `EmptyState`/`ErrorState` with `<UploadZone />` and `<ErrorBanner />`. DocumentViewer already handles `onLoadError` internally via store.setError — no new prop needed.
- `src/components/DocumentViewer.tsx` — updated `onLoadError` message to match copy contract exactly (T-01-08).
- TDD sequence preserved: RED commit `dff1b05` first (tests for non-existent modules), GREEN commit `6153bb2` after (implementations), then Task 2 component commit `3ab547e`.
- All 111 tests pass (17 new + 94 existing); `tsc --noEmit` clean; `npm run build` succeeds.

## Task Commits

1. **Task 1 RED — failing tests for fileValidation + imageWrapper** - `dff1b05` (test)
2. **Task 1 GREEN — implement fileValidation + imageWrapper** - `6153bb2` (feat)
3. **Task 2 — UploadZone + ErrorBanner + App wiring** - `3ab547e` (feat)

## Files Created

- `src/lib/fileValidation.ts` — 60 lines, pure TS, no DOM. Exports `FileValidationError` type and `validateFile()`.
- `src/lib/imageWrapper.ts` — 75 lines. Exports `wrapImageAsPdf()`. pdf-lib embedJpg/embedPng, try/catch, tagged errors, DPI caveat comment.
- `src/components/UploadZone.tsx` — 235 lines. Full drag-drop zone + Browse button + hidden file input + copy contract text.
- `src/components/ErrorBanner.tsx` — 145 lines. Inline error card with role=alert, copy contract text, retry with Blob URL revocation.
- `src/test/fileValidation.test.ts` — 84 lines, 11 test cases covering valid types, invalid types, size boundary conditions.
- `src/test/imageWrapper.test.ts` — 105 lines, 6 test cases covering PNG, JPEG (.jpg and .jpeg), string return type, corrupt input rejection.

## Files Modified

- `src/App.tsx` — replaced inline EmptyState/ErrorState with imported UploadZone/ErrorBanner; cleaned up view-router.
- `src/components/DocumentViewer.tsx` — onLoadError message aligned to copy contract exactly.

## Decisions Made

1. **Defense-in-depth file validation (MIME AND extension):** A file must pass BOTH the MIME type check and the extension check. This catches spoofed files (e.g., a malicious PDF named `malicious.exe` with type `application/pdf`) — the extension `.exe` is not in the whitelist so it's rejected.

2. **Size cap before arrayBuffer():** `file.size > MAX_FILE_SIZE` is checked before any async byte read, preventing the browser from allocating 100+ MB of RAM for an oversized file before rejecting it. This is the primary DoS protection (T-01-05).

3. **Tagged errors from wrapImageAsPdf:** The function wraps all pdf-lib failures in a new `Error` with a descriptive prefix, preventing raw pdf-lib error messages (which may contain internal paths or stack details) from surfacing in the UI. The caller maps any thrown error to the copy contract "corrupt or password-protected" message.

4. **No new DocumentViewer prop needed for T-01-08:** The existing DocumentViewer skeleton (01-01) already calls `setError` via the store in its `onLoadError` handler. App.tsx simply renders `<DocumentViewer />` as before — the corrupt PDF path is already handled by the existing code, just with the wrong copy (fixed in this plan).

5. **Blob URL revocation in ErrorBanner:** When the user clicks "Try another file" from the error state, if a Blob URL was already created (e.g., for a valid-but-corrupt PDF that passed validation but failed at render), `URL.revokeObjectURL` is called before `reset()` to free the memory. The same revocation already existed in `TopBar.handleOpenAnother` for the loaded-state path.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] imageWrapper test mock signature incompatible with tsc -b**
- **Found during:** Task 2 verification (`npm run build`)
- **Issue:** `vi.fn((_blob: Blob) => ...)` mock had parameter type `Blob` but `URL.createObjectURL` expects `Blob | MediaSource` — TypeScript error TS2345 in `tsc -b` which checks test files
- **Fix:** Changed mock parameter type to `_obj: Blob | MediaSource` in both the `Object.defineProperty` value and `vi.spyOn` implementation
- **Files modified:** `src/test/imageWrapper.test.ts`
- **Commit:** included in `3ab547e`

**2. [Rule 2 - Missing critical functionality] onLoadError copy contract alignment**
- **Found during:** Task 2 (reviewing DocumentViewer before wiring App.tsx)
- **Issue:** Existing `DocumentViewer.onLoadError` handler forwarded the raw pdf-lib error message to `setError`, which would show an internal error string in the ErrorBanner instead of the copy-contract message
- **Fix:** Changed to always use the exact copy-contract string: "This file couldn't be read. It may be corrupt or password-protected. Try another file."
- **Files modified:** `src/components/DocumentViewer.tsx`
- **Commit:** included in `3ab547e`

## Known Stubs

- `src/components/DocumentViewer.tsx` still renders only page 1 (no multi-page navigation). This is an intentional skeleton stub from Plan 01-01, unchanged by this plan. Plan 01-04 replaces it with the full multi-page viewer.

## Threat Flags

None. No new network endpoints, auth paths, or external data flows introduced. All document processing is entirely in-browser. The security mitigations listed in the threat register (T-01-05 through T-01-08) are all implemented and verified.

## Self-Check: PASSED

- `src/lib/fileValidation.ts` exists: FOUND
- `src/lib/imageWrapper.ts` exists: FOUND
- `src/components/UploadZone.tsx` exists: FOUND
- `src/components/ErrorBanner.tsx` exists: FOUND
- `src/test/fileValidation.test.ts` exists: FOUND
- `src/test/imageWrapper.test.ts` exists: FOUND
- RED commit `dff1b05`: PRESENT in git log
- GREEN commit `6153bb2`: PRESENT in git log
- UI commit `3ab547e`: PRESENT in git log
- `npx vitest run src/test/fileValidation.test.ts src/test/imageWrapper.test.ts`: 17/17 PASSED
- `npx vitest run` (full suite): 111/111 PASSED
- `npx tsc --noEmit`: CLEAN (0 errors)
- `npm run build`: SUCCEEDED
- DOC-01 (open PDF via drag-drop/picker): DELIVERED — UploadZone handles both paths
- DOC-02 (open image → wrapped PDF): DELIVERED — wrapImageAsPdf via embedJpg/embedPng
