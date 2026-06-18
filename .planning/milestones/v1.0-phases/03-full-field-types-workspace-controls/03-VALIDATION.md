---
phase: 3
slug: full-field-types-workspace-controls
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-17
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.9 (jsdom env, canvas mock in `src/test/setup.ts`) |
| **Config file** | `vite.config.ts` (vitest config co-located) |
| **Quick run command** | `npm test -- --run` |
| **Full suite command** | `npm test -- --run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --run`
- **After every plan wave:** Run `npm test -- --run` (Vitest has no separate CI suite)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

> Requirement-level map from RESEARCH.md §Validation Architecture. Task IDs are filled in during execution/Nyquist audit once plans exist. All cases EXTEND existing `src/test/*.test.ts` files — no new framework config or Wave 0 files needed.

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| DOC-04 | Zoom-invariance: same click → same PDF coords at zoom 1.0 and 1.5 | unit | `npm test -- --run src/test/coordinateMapper.test.ts` | ✅ extend | ⬜ pending |
| DOC-04 | ZoomControl step arithmetic: zoomIn/zoomOut advance ZOOM_STEPS, clamp 50–200% | unit | `npm test -- --run src/test/documentStore.test.ts` | ✅ extend | ⬜ pending |
| DOC-05 | `.docx` (ext + MIME) → `word-doc` validation result | unit | `npm test -- --run src/test/fileValidation.test.ts` | ✅ extend | ⬜ pending |
| DOC-05 | `.doc` / `application/msword` → `word-doc` validation result | unit | `npm test -- --run src/test/fileValidation.test.ts` | ✅ extend | ⬜ pending |
| FLD-02 | addField type='initials'/'date'/'text'/'checkbox' accepted in store | unit | `npm test -- --run src/test/fieldStore.test.ts` | ✅ extend | ⬜ pending |
| FLD-03 | Date field textValue defaults to M/D/YYYY at creation | unit | `npm test -- --run src/test/fieldStore.test.ts` | ✅ extend | ⬜ pending |
| FLD-04 | updateField textValue persists through store round-trip | unit | `npm test -- --run src/test/fieldStore.test.ts` | ✅ extend | ⬜ pending |
| FLD-08 | Export: field on page 2 draws on pages[1], not pages[0] | unit | `npm test -- --run src/test/exportPdf.test.ts` | ✅ extend | ⬜ pending |
| FLD-09 | pushHistory + undo reverts fields[]; redo advances; cap at MAX_HISTORY; new action truncates redo tail | unit | `npm test -- --run src/test/fieldStore.test.ts` | ✅ extend | ⬜ pending |
| EXP-02 | Text / checkbox / date field export: first 512 bytes byte-identical to original | unit | `npm test -- --run src/test/exportPdf.test.ts` | ✅ extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.* No new test files, fixtures, or framework install needed — all new cases extend existing `src/test/*.test.ts`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Placed fields stay pixel-aligned to underlying page content while zooming 50→200% | DOC-04 | Visual pixel alignment can't be asserted in jsdom (no real raster) | In browser: place a field, zoom across all steps, confirm field stays locked to the same spot on the page content |
| Inline text/date editing inside react-rnd doesn't trigger drag while typing | FLD-04 | Pointer/drag interaction needs a real DOM | In browser: place a text field, type into it, confirm the widget doesn't move and the value commits on blur |
| Undo/redo keyboard shortcuts don't fire while typing in a field input | FLD-09 | Real focus + keydown routing | In browser: focus a text field, press Cmd/Ctrl+Z, confirm it edits text (not undo of placement) |
| Checkbox/text/date visually render correctly in the exported PDF | EXP-02 | Visual fidelity of drawn glyphs needs a PDF viewer | Open exported PDF, confirm X mark / typed text / date render at correct position and size |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or are listed under Manual-Only
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (none required)
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter (after Nyquist audit)

**Approval:** pending
