---
phase: "02"
plan: "04"
subsystem: download-wiring
tags: [download, export, EXP-01, EXP-03, ExportErrorBanner, TopBar, UploadZone, imageWrapper]
dependency_graph:
  requires:
    - "02-01: exportSignedPdf / triggerDownload / signedFilename / originalPdfBytes in documentStore"
    - "02-02: SignatureDrawModal (placementMode arming)"
    - "02-03: useFieldStore fields[] with PDF-space coordinates"
  provides:
    - "Download PDF button in TopBar (EXP-01): disabled guard / download handler / signedFilename"
    - "ExportErrorBanner: inline role=alert dismissible banner for export failures (T-02-02)"
    - "originalPdfBytes retention in UploadZone for PDF and image paths (EXP-03)"
    - "fileName + exportError slices in documentStore (reset clears both)"
    - "wrapImageAsPdfWithBytes: new sibling to wrapImageAsPdf returning {url, bytes}"
  affects:
    - "Phase 3+: documentStore.fileName, exportError, originalPdfBytes available to future plans"
tech_stack:
  added: []
  patterns:
    - "EXP-03 image path: wrapImageAsPdfWithBytes returns {url, bytes}; UploadZone stores bytes.buffer as originalPdfBytes"
    - "aria-disabled (not HTML disabled) on Download PDF — keeps focus reachable (WCAG 2.5.5)"
    - "try/catch around exportSignedPdf → setExportError on failure (T-02-02)"
    - "ExportErrorBanner self-gates on exportError: if (!exportError) return null"
key_files:
  created:
    - src/components/ExportErrorBanner.tsx
    - src/test/downloadWiring.test.ts
  modified:
    - src/lib/imageWrapper.ts (added wrapImageAsPdfWithBytes + shared buildWrappedPdf helper)
    - src/store/documentStore.ts (added fileName + setFileName + exportError + setExportError; reset clears both)
    - src/components/UploadZone.tsx (wires setOriginalPdfBytes + setFileName; image path uses wrapImageAsPdfWithBytes)
    - src/components/TopBar.tsx (Download PDF button with accent style, disabled guard, download handler)
    - src/App.tsx (mounts ExportErrorBanner below TopBar)
    - src/test/documentStore.test.ts (extended to cover new fields and reset behavior)
decisions:
  - "wrapImageAsPdfWithBytes added as a sibling function (not modifying wrapImageAsPdf signature) — keeps imageWrapper.test.ts unchanged and existing callers unaffected"
  - "fileName stored in documentStore (not fieldStore) since it belongs to the document context, not the field layer"
  - "exportError slice in documentStore (not local TopBar state) so ExportErrorBanner can self-gate without prop drilling"
  - "ExportErrorBanner mounts unconditionally in App.tsx (self-gates on exportError null) — same pattern as SignatureDrawModal"
  - "Post-download: no reset of document or fields (LOCKED CONTEXT.md: app stays on document after download)"
metrics:
  duration: "~4 minutes"
  completed: "2026-06-17"
  tasks_completed: 2
  files_created: 2
  files_modified: 6
---

# Phase 2 Plan 04: Download Wiring + Image Export Summary

**One-liner:** Download PDF button wired in TopBar to exportSignedPdf + triggerDownload + signedFilename, with originalPdfBytes retained for both PDF and image sources (EXP-03), inline ExportErrorBanner on failure, disabled guard at zero fields (T-02-10) — closing the Phase 2 signing loop.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Retain original/wrapped PDF bytes + fileName on file open | 2457a04 | imageWrapper.ts, documentStore.ts, UploadZone.tsx, documentStore.test.ts |
| 2 | ExportErrorBanner + Download PDF button wiring + download test | 9c3250e | ExportErrorBanner.tsx, TopBar.tsx, App.tsx, downloadWiring.test.ts |

## Verification Results

- `npx vitest run`: **201/201 tests pass** across 10 files (14 new downloadWiring tests included)
- `npm run build`: **exits 0** (tsc -b clean + vite build)

## Success Criteria Status

| Criterion | Status |
|-----------|--------|
| EXP-01: Download PDF downloads {original-name}-signed.pdf with placed signatures | Delivered |
| EXP-03: image-sourced documents export as PDF containing image + signature | Delivered (wrapped bytes stored as originalPdfBytes) |
| Download disabled until ≥1 field placed (aria-disabled + handler guard) | Delivered (T-02-10) |
| Export failure surfaces ExportErrorBanner with exact UI-SPEC copy | Delivered (T-02-02) |
| App stays on document after download — no reset | Delivered |
| signedFilename: '{name}-signed.pdf' | Delivered (exercised in test) |
| Full test suite green | 201/201 |
| npm run build exits 0 | Clean |

## Key Implementation Details

### imageWrapper.ts — wrapImageAsPdfWithBytes

Added `wrapImageAsPdfWithBytes(file)` returning `{ url: string; bytes: Uint8Array }`.
Both `wrapImageAsPdf` (unchanged) and `wrapImageAsPdfWithBytes` delegate to a private
`buildWrappedPdf(file, arrayBuffer)` helper — no code duplication, no behavior change
for existing callers. `imageWrapper.test.ts` remains green without modification.

### documentStore.ts — new slices

- `fileName: string | null` / `setFileName(name)` — set by UploadZone on file open
- `exportError: string | null` / `setExportError(msg)` — set by download handler on failure
- Both cleared by `reset()` to ensure "Open another" resets everything

### UploadZone.tsx — byte retention

- **PDF path:** `file.arrayBuffer()` → `setOriginalPdfBytes(bytes)` → `URL.createObjectURL(file)` → `loadDocument(url)` (Pitfall 5: Blob URL cannot recover bytes)
- **Image path (EXP-03):** `wrapImageAsPdfWithBytes(file)` → `setOriginalPdfBytes(bytes.buffer)` + `loadDocument(url)`

### TopBar.tsx — Download PDF button

Button placed between "Add signature" and "Open another" (UI-SPEC slot order).
- Accent style: `#2563EB` bg, white text, 8px/16px padding, 6px radius, min 44px height
- Hover `#1D4ED8`, active `#1E40AF`, focus ring 2px accent
- `aria-disabled="true"` + opacity 0.45 when `fields.length === 0`; handler returns early
- Download handler: `setExportError(null)` → `exportSignedPdf(originalPdfBytes, fields)` → `triggerDownload(out, signedFilename(fileName ?? 'document.pdf'))` on success; `setExportError('Could not...')` on catch

### ExportErrorBanner.tsx

Inline sticky banner (top: 56px, z-index: 15), `role="alert" aria-live="assertive"`.
Left border `--color-destructive` (same visual language as ErrorBanner).
Exact copy: "Could not export the signed PDF. Try downloading again."
Dismiss control (×) calls `setExportError(null)`. Self-gates: returns null when `exportError` is null.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as specified.

### Decisions Made During Execution

**1. wrapImageAsPdfWithBytes as a new sibling function**
- **Issue:** Plan suggested either "add a sibling `wrapImageAsPdfBytes`" or "have wrapImageAsPdf return `{ url, bytes }`". Modifying `wrapImageAsPdf`'s return type would break `imageWrapper.test.ts` and existing callers.
- **Fix:** Added `wrapImageAsPdfWithBytes` as a new export. A private `buildWrappedPdf` helper is shared internally. `wrapImageAsPdf` is unchanged.
- **Impact:** Zero test regressions; clean separation of concerns.

**2. exportError slice in documentStore (not TopBar local state)**
- **Issue:** If `exportError` lived in TopBar local state, `ExportErrorBanner` (sibling component) would need prop drilling or context.
- **Fix:** `exportError` + `setExportError` added to documentStore; included in `reset()`.
- **Impact:** ExportErrorBanner self-gates cleanly (`if (!exportError) return null`); no prop drilling.

## Known Stubs

None — all export, download, and error handling is fully implemented. No placeholder data flows to rendering.

## Deferred Checkpoint: Human Verify (end-of-phase)

Per `human_verify_mode: end-of-phase` in config.json, the `checkpoint:human-verify` task is deferred to the end of Phase 2. The automated tasks are complete; the following manual verification must be run by the user before closing Phase 2.

**Run `npm run dev` and open the app, then verify:**

1. **Full PDF flow:** open a multi-page PDF → "Add signature" → draw → confirm → click a page to drop → drag → resize corner (stays aspect-locked) → delete via × or Delete key → confirm field stays locked after browser resize.

2. **Download + integrity (EXP-01/EXP-02):** place a signature → click "Download PDF" → file named `{originalname}-signed.pdf` downloads → open in PDF reader → confirm original pages unchanged + signature at placed position → app stays on document (no reset).

3. **Image source (EXP-03):** open a JPG or PNG → place a signature → Download PDF → open result → confirm it is a PDF containing the original image + the signature.

4. **Disabled guard:** with zero fields, "Download PDF" is visibly disabled (opacity 0.45) and does nothing when clicked.

5. **Network audit (PRV-01/PRV-02):** DevTools → Network → full draw + place + download flow → confirm EVERY request is same-origin (no CDN, analytics, fonts, or workers from third-party origins).

**Resume signal:** "approved" when all five checks pass.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes beyond the plan threat model. All processing is in-browser:

- `exportSignedPdf` — pure in-memory; no fetch/XHR
- `triggerDownload` — Blob → objectURL → anchor click; no network
- `wrapImageAsPdfWithBytes` — same security profile as `wrapImageAsPdf` (T-01-07 error handling preserved)

All threat mitigations applied per plan threat model:

| ID | Status |
|----|--------|
| T-02-02 | Mitigated: download handler wraps exportSignedPdf in try/catch; surfaces ExportErrorBanner with exact copy |
| T-02-10 | Mitigated: aria-disabled when fields.length === 0 AND handler returns early on zero fields/null bytes |
| T-02-11 | Accepted: bytes stay in Zustand; export fully client-side; PRV-01/PRV-02 verified at human-verify checkpoint |

## Self-Check: PASSED

Files created:
- `src/components/ExportErrorBanner.tsx` — FOUND
- `src/test/downloadWiring.test.ts` — FOUND

Files modified:
- `src/lib/imageWrapper.ts` — FOUND
- `src/store/documentStore.ts` — FOUND
- `src/components/UploadZone.tsx` — FOUND
- `src/components/TopBar.tsx` — FOUND
- `src/App.tsx` — FOUND
- `src/test/documentStore.test.ts` — FOUND

Commits:
- `2457a04` — FOUND (Task 1: retain original/wrapped PDF bytes)
- `9c3250e` — FOUND (Task 2: ExportErrorBanner + Download PDF wiring)

Test suite: 201/201 tests — all passing
Build: `npm run build` — exits 0 (tsc -b clean + vite build)

---
*Phase: 02-core-signing-loop*
*Completed: 2026-06-17*
