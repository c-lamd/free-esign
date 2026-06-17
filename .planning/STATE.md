---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: All 5 phases complete — ready for milestone audit → complete → cleanup
last_updated: "2026-06-17T20:59:05.458Z"
last_activity: 2026-06-17 -- Phase 05 Plan 01 complete (landing page, 305 tests green, build clean)
progress:
  total_phases: 5
  completed_phases: 5
  total_plans: 18
  completed_plans: 18
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-16)

**Core value:** Sign a PDF in your browser, for free, without your document ever leaving your device or being altered.
**Current focus:** Phase 04 complete (3/3 plans, verified, code-review-fixed, UI 87/100) — ready for Phase 05

## Current Position

Phase: 05 (Landing Page + Launch) — COMPLETE
Plan: 2 of 2 complete
Status: ALL 5 PHASES COMPLETE — 545 tests pass + 1 pre-launch skip, tsc clean, build clean, privacy guard sound. Live deploy + DNS + live audit + real BMC handle deferred to human (README §Deploy). Ready for milestone audit.
Last activity: 2026-06-17 -- Phase 05 complete (landing + privacy guard + deploy-ready; verified 7/8, UI 19/24, 7 review fixes)

Progress: [██████████] 100% (18/18 plans complete; 5/5 phases)

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 01 P01 | 16min | 3 tasks | 22 files |
| Phase 01 P03 | 8min | 2 tasks | 8 files |
| Phase 01 P04 | 6 | 2 tasks | 4 files |
| Phase 02 P01 | 12 | 3 tasks | 9 files |
| Phase 02 P02 | 14 | 3 tasks | 5 files |
| Phase 02 P03 | 4 | 3 tasks | 6 files |
| Phase 02 P04 | 4 | 2 tasks | 8 files |
| Phase 03 P01 | 5 | 3 tasks | 6 files |
| Phase 03 P02 | 5 | 3 tasks | 7 files |
| Phase 03 P05 | 3 | 2 tasks | 4 files |
| Phase 03 P03 | 12 | 3 tasks | 6 files |
| Phase 03 P04 | 8 | 3 tasks | 6 files |
| Phase 04 P01 | 10 | 3 tasks | 12 files |
| Phase 04 P02 | 7 | 3 tasks | 6 files |
| Phase 04-typed-signatures-signature-persistence P03 | 7 | 3 tasks | 5 files |
| Phase 05-landing-page-launch P01 | 4 | 3 tasks | 14 files |
| Phase 05-landing-page-launch P02 | 3 minutes | 2 tasks | 3 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: Coordinate Mapper folded into Phase 1 (foundational shared dependency; must exist and be tested before any field placement code)
- Roadmap: Zero-alteration export (EXP-02) proven in Phase 2, not deferred — hex-diff test is a Phase 2 success criterion
- Roadmap: PRV-01 + PRV-02 (self-hosted assets, no CDN requests) enforced from Phase 1 scaffolding
- Roadmap: pdf-lib-incremental-save viability must be confirmed during Phase 2 planning (research flag from SUMMARY.md)
- Roadmap: react-rnd + zoom-aware coordinate update loop needs prototype before Phase 3 planning is finalized (research flag from SUMMARY.md)
- [Phase ?]: pdfjs-dist 5.4.296 (not 4.x) pinned by react-pdf 10.4.1; worker filename is pdf.worker.min.mjs (.mjs not .js)
- [Phase ?]: public/ static copy for pdfjs worker avoids Vite content-hash 404s on redeployment
- [Phase ?]: pdfWorker.ts imported first in DocumentViewer.tsx to prevent react-pdf workerSrc overwrite (Pitfall 3)
- [Phase ?]: Defense-in-depth: MIME AND extension both whitelisted (T-01-06)
- [Phase ?]: wrapImageAsPdf uses embedJpg/embedPng: original image bytes embedded, no canvas rasterization (CLAUDE.md document integrity)
- [Phase ?]: Phase 2 DPI caveat: image px dimensions = PDF points at 72 DPI; export must handle DPI normalization
- [Phase ?]: IntersectionObserver with 11 thresholds tracks currentPage from scroll; LazyPage stays rendered after first visibility
- [Phase ?]: aria-disabled (not disabled) on prev/next ensures focus stays reachable at page boundaries (WCAG 2.5.5)
- [Phase ?]: pdf-lib-incremental-save@1.17.4 confirmed viable: saveIncremental() preserves original bytes at offset 0 (EXP-02 passes)
- [Phase ?]: aria-disabled (not HTML disabled) on Add signature button to keep focus reachable while empty (WCAG 2.5.5)
- [Phase ?]: SignatureDrawModal: transparent PNG (rgba(0,0,0,0) bg) ensures no white box artifact on PDF overlay
- [Phase ?]: Canvas 2d jsdom mock in setup.ts is idempotent via _gsdCanvasMocked guard on prototype
- [Phase ?]: PlacementModeOverlay rendered as fragment sibling before scroll div so sticky top:56px resolves to viewport (not scroll container)
- [Phase ?]: makeSimpleViewport rotation=0 only; rotated pages deferred to Phase 3 (full pdfjs affine required)
- [Phase ?]: lockAspectRatio=true (not numeric ratio) sufficient for v1 — field dims computed from PNG aspect so ratio is preserved
- [Phase 03-04]: Undo/redo keyboard shortcuts extend DocumentViewer single keydown handler; undo/redo branches placed before selectedFieldId gate
- [Phase 03-04]: T-03-11: INPUT/TEXTAREA guard fires first in shared handler for both delete and undo/redo shortcuts
- [Phase 03-04]: InitialsDrawModal uses 2:1 canvas aspect ratio; mirrors SignatureDrawModal gated on initialsModalOpen
- [Phase 05-landing-page-launch]: ASSET_LOADING_PATTERNS scoped to 6 constructs to avoid xmlns false-positives and BMC anchor false-positive; scan src/ not dist/
- [Phase 05-landing-page-launch]: Deploy checkpoint (vercel --prod + DNS + live network audit) deferred to human per CONTEXT.md and user authorization; repo is fully deploy-ready

### New Decisions (04-01)

- savedItems excluded from initialFieldState — resetFields() preserves saved items (document-independent SIG-04 persistence)
- Optimistic update pattern for addSavedItem/deleteSavedItem: Zustand state updated first, IndexedDB write is best-effort/non-blocking
- idb-keyval@6.2.5 checkpoint pre-approved per user authorization (package is legitimate, SUS flag was timing artifact)
- TTF fonts downloaded from fonts.gstatic.com (Dancing Script v29, Great Vibes v21, Pacifico v23) — real OFL binaries
- IDB_KEY exported from savedSignatures.ts for test assertions on the correct key name

### New Decisions (04-02)

- fonts.ts FONT_FILE_MAP is a static 3-key allowlist; unknown families throw BEFORE fetch (T-04-04/PRV-02 path-traversal guard)
- fetch mock in exportPdf.test.ts returns REAL Dancing Script TTF bytes — fontkit rejects minimal/fake bytes during embedFont
- _clearFontBytesCache() exported as test seam for cache isolation between typed-sig test runs
- drawSignatureText: no truncateToFit — full text scales to fit BOTH height and width (CONTEXT Area 2 / SIG-02/SIG-03)
- lockAspectRatio now keys on !!field.dataUrl for sig/initials: drawn (dataUrl present) locks; typed (font-backed, no dataUrl) resizes freely
- LazyPage isTyped flag controls 200x56 default size and skips PNG Image() aspect-ratio block for typed drops
- Both setArmedTypedPayload(null) AND setArmedFieldType(null) called after typed drop (RESEARCH Pitfall 6 guard)
- EXP-02 first-512-byte identity holds for typed-signature export (saveIncremental→concat path unchanged)

### Pending Todos

- Human verify Phase 2 signing loop (see 02-04-SUMMARY.md deferred checkpoint section)

### Blockers/Concerns

None currently.

### New Decisions (03-02)

- FieldPalette Signature button calls openModal() (draw-then-arm flow); Date/Text/Checkbox toggle armedFieldType directly; Initials calls openInitialsModal
- pushHistory() called in LazyPage handleOverlayClick BEFORE addField per plan spec (addField also pushes internally)
- onMouseDown stopPropagation + disableDragging={isEditing} on react-rnd input: belt-and-suspenders drag prevention while typing
- placementMode fully removed from all component code; armedFieldType is the sole placement signal
- downloadWiring.test.ts aria-label updated 'signature' → 'field': TopBar now serves all 5 field types (Rule 1 fix)

### New Decisions (03-03)

- effectiveScale = (containerWidth / originalWidth) * zoom; dims.scale remains zoom-free fit-to-width baseline (RESEARCH A2)
- Page width = containerWidth * zoom with no scale prop — react-pdf width×scale multiplies so omitting scale avoids double-zoom (RESEARCH Pitfall 5)
- ZoomControl positioned at right: calc(50% + 85px) to sit left of PageNavigation pill without overlap
- scrollIntoView guarded with typeof check for jsdom test environment compatibility (Rule 1 fix)
- zoom-invariance tests scale CSS click coordinate proportionally with zoom to represent same physical document point

### New Decisions (03-05)

- Word-doc check inserted BEFORE generic unsupported-type in validateFile; either MIME or extension alone is sufficient (defense-in-depth T-03-05)
- Extension extracted once in validateFile and reused for both word-doc and ALLOWED_EXTENSIONS checks
- wordDocMode local state in UploadZone swaps upload content with WordDocBanner; setError is NOT called for Word files
- role=status (not role=alert) for WordDocBanner per UI-SPEC — guidance not urgent error

### New Decisions (03-01)

- History stores pre+post snapshots per addField/deleteField so undo/redo works bidirectionally (both remove and restore fields)
- updateField does NOT push history — callers (drag, resize, blur) push explicitly to prevent per-keystroke flood
- ASCII 'X' for checkbox PDF export; U+2715 (✕) throws WinAnsi encode error at runtime (VERIFIED)
- SignatureDrawModal migrated setPlacementMode→setArmedFieldType('signature') in Plan 01 to keep test suite green

### New Decisions (02-04)

- wrapImageAsPdfWithBytes added as sibling to wrapImageAsPdf; shared buildWrappedPdf helper; existing callers and tests unchanged
- exportError + fileName slices added to documentStore (reset clears both); ExportErrorBanner self-gates on exportError null
- Post-download: no document/field reset — app stays on document (LOCKED CONTEXT.md enforced)

### New Decisions (05-01)

- 'landing' added to ViewState as initial view; goToLanding()/startSigning() are named actions (not setView aliases); reset() unchanged — stays returning 'empty' (signing-session intent, locked)
- BUY_ME_A_COFFEE_URL is a plain string constant in src/config.ts — plain anchor href only, no BMC script/widget (LND-03)
- LandingPage has its own LandingHeader; TopBar renders only when view !== 'landing'; both modals gated under view !== 'landing' (Pitfall 7)
- TopBar FreeESign wordmark converted from static span to ghost button calling goToLanding(); aria-label="FreeESign — return to home"
- public/favicon.svg self-hosted SVG pen icon replaces broken /vite.svg 404 reference in index.html

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Human verify | Phase 2 end-of-phase browser verification (02-04-SUMMARY.md) | Pending | 02-04 |
| Human verify | Phase 3 browser checks (8 items in 03-VERIFICATION.md): zoom pixel-alignment 50→200%, inline edit no-drag, undo/redo shortcut focus guard, exported field visual fidelity | Pending | 03 (autonomous) |
| Refinement | Undo/redo: redo-after-drag/resize/text-edit does not re-apply the moved position (pushHistory stores pre-mutation only). Undo works; placement+deletion redo are correct (FLD-09 criterion met). Fix later via commit-post-mutation snapshot if desired. | Open | 03 (code review CR-01) |
| Human verify | Phase 4 browser checks (6 items in 04-VERIFICATION.md): typed-sig WYSIWYG vs PDF glyphs, cross-session IndexedDB persist + delete, PDF vector-text crispness at zoom, zero third-party requests on font load/export, Saved-tab kind filtering | Pending | 04 (autonomous) |
| UI advisory | Phase 4 UI audit (87/100) minor items in 04-UI-REVIEW.md: font-load-failure inline note (system-ui fallback works; note not implemented — near-impossible for same-origin bundled fonts), SavedItemCard 32px delete touch target, delete sr-only double-announce | Open | 04 (UI review) |
| Human deploy | Phase 5 deploy: run `vercel --prod` from repo root — requires Vercel account and CLI. See README §Deploy Step 4. | Pending | 05-02 |
| Human deploy | Attach free-esign.com + configure DNS in Vercel dashboard. See README §Deploy Step 5. | Pending | 05-02 |
| Human verify | Post-deploy DevTools network audit: full signing workflow (open PDF → place fields → download), confirm zero third-party requests. See README §Deploy Step 6. (PRV-03 live proof) | Pending | 05-02 |
| Human verify | Verify BMC link opens real BMC page after replacing PLACEHOLDER in src/config.ts. See README §Deploy Step 7. (LND-03) | Pending | 05-02 |
| UI advisory | Phase 5 UI audit (19/24) residual minors in 05-UI-REVIEW.md: index.html `<title>` differs from spec (actual phrasing is better — update spec if intentional); hover/active hex (#1D4ED8/#1E40AF) are spec-declared but unregistered tokens. Top-3 (wordmark type=button, step h3, mobile clamp padding) already fixed. | Open | 05 (UI review) |

### Correction (03 code review)

- CR-01 fix **superseded** the 03-01/03-02 decisions "History stores pre+post snapshots per addField/deleteField" and "pushHistory() in LazyPage before addField". Final model: `history` seeded `[[]]` at index 0; `addField`/`deleteField` push exactly ONE post-mutation snapshot; the redundant LazyPage pushHistory was removed. Net: N drops = N undo steps to empty, no phantom undos.

## Session Continuity

Last session: 2026-06-17T20:59:05.453Z
Stopped at: Phase 5 Plan 02 complete — all automatable tasks done; deploy checkpoint deferred to human
Resume file: None
