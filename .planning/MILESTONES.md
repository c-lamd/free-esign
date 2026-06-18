# Milestones

## v1.0 Private In-Browser PDF Signing (MVP) (Shipped: 2026-06-18)

**Phases completed:** 5 phases, 18 plans, 36 tasks

**Key accomplishments:**

- Vite 8 + React 19 SPA scaffold with self-hosted pdf.js pipeline; picking a PDF renders page 1 via react-pdf with the worker, CMaps, and standard fonts all served from the app's own origin.
- Pure TypeScript cssPixel↔pdfSpace mapper wrapping pdfjs PageViewport affine math; 88 round-trip property tests pass within 0.001 tolerance across all scales (1/1.5/0.75) and rotations (0/90/180/270 degrees).
- Full document-ingestion slice: MIME+extension validation with 100MB cap, drag-drop/browse UploadZone, pdf-lib image→PDF wrapping via embedJpg/embedPng (original bytes, no rasterization), inline ErrorBanner with retry, and "Open another" — delivering DOC-01 and DOC-02.
- Continuous fit-to-width multi-page PDF viewer with IntersectionObserver lazy rendering, ResizeObserver fit-to-width, a bottom-center prev/next + "1 / N" navigation pill, and scroll-synced currentPage tracking — completing DOC-03 and the Phase 1 user story.
- Incremental PDF save via pdf-lib-incremental-save@1.17.4 proven to preserve original bytes at offset 0 (EXP-02 automated byte-identity test passing), with PlacedField contract and Zustand field store locked for downstream plans.
- signature_pad canvas modal with transparent-PNG export, focus trap, aria-disabled Add signature button, and TopBar trigger — SIG-01 delivered.
- react-rnd controlled widget with click-to-drop placement, PDF-space coordinate storage via makeSimpleViewport, drag/resize/select/delete, and keyboard delete guarded against text inputs — FLD-01, FLD-05, FLD-06, FLD-07 delivered.
- Download PDF button wired in TopBar to exportSignedPdf + triggerDownload + signedFilename, with originalPdfBytes retained for both PDF and image sources (EXP-03), inline ExportErrorBanner on failure, disabled guard at zero fields (T-02-10) — closing the Phase 2 signing loop.
- Extended PlacedField to 5-type union with undo/redo history stack (50 entries), and wired drawText/checkbox export through the existing EXP-02 incremental-save path
- FieldPalette with 5 armed-state buttons wired to armedFieldType; per-type PlacedFieldWidget rendering (img/input/checkbox); inline text/date editing with blur-commit history; placementMode fully removed
- Undo/Redo toolbar buttons + Cmd/Ctrl+Z keyboard shortcuts with input-focus guard, plus InitialsDrawModal that draws transparent-PNG initials and arms placement, all with focused FLD-09 test coverage.
- Word-doc (.doc/.docx) detection in fileValidation with a friendly "export to PDF first" banner — no silent conversion (DOC-05).
- idb-keyval + @pdf-lib/fontkit installed; 3 script TTFs vendored; fieldStore extended with SavedItem type, savedItems slice, armedTypedPayload seam, and async IndexedDB actions.
- Font-backed (typed) signature/initials export as real embedded @pdf-lib/fontkit TTF text via drawSignatureText fit-to-box algorithm; EXP-02 byte-identity proven for typed exports; lockAspectRatio keyed on dataUrl presence; LazyPage drops typed fields from armedTypedPayload clearing both armed states.
- Tabbed Saved/Draw/Type modals for both signature and initials (role=tablist, roving focus, ARIA); SavedItemCard thumbnail component; App.tsx mount hydration; Type-tab and SavedItemCard isolated tests added.
- Personal candid landing page (hero + how-it-works + prominent privacy statement + Buy-Me-a-Coffee link) gated as the initial view; favicon fixed; meta added (LND-01/02/03).
- Automated privacy guard (PRV-03): a source-scanning test that fails on any external asset-loading URL; vercel.json SPA rewrite + no analytics; deploy runbook in README — build self-contained with zero external origins.

**Quality:** 545 automated tests pass (1 intentional pre-launch skip), TypeScript clean, build clean. Per-phase: 24 code-review findings fixed across phases 3–5; UI audits 89/87/19-of-24; integration check 0 orphaned / 0 missing / 0 broken seams.

**Known deferred items at close: 4** (see STATE.md Deferred Items) — all human-only: live `vercel --prod` deploy + free-esign.com DNS (LND-04), live DevTools zero-third-party network audit (PRV-03 final proof), real Buy-Me-a-Coffee handle (LND-03), and per-phase browser visual/persistence verifications. Repo is fully deploy-ready (README §Deploy). One advisory: redo-after-drag doesn't re-apply the move (undo + placement/deletion redo are correct).

---
