---
phase: 1
slug: foundation-pdf-viewer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-16
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (latest, jsdom environment) |
| **Config file** | `vite.config.ts` (`test:` block) — none exists yet (Wave 0 installs) |
| **Quick run command** | `npx vitest run src/test/coordinateMapper.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5–15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/test/coordinateMapper.test.ts` (fastest pure-TS test)
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green + manual DevTools Network audit (zero third-party requests)
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| DOC-01 | Drag-drop + picker accept .pdf/.jpg/.jpeg/.png, reject others | unit | `npx vitest run src/test/fileValidation.test.ts` | ❌ W0 | ⬜ pending |
| DOC-02 | JPG/PNG wrapped to a valid PDF Blob URL via pdf-lib | unit | `npx vitest run src/test/imageWrapper.test.ts` | ❌ W0 | ⬜ pending |
| DOC-03 | `numPages` from onLoadSuccess drives page-list length | unit/component | `npx vitest run src/test/documentViewer.test.ts` | ❌ W0 | ⬜ pending |
| Coord Mapper | Round-trip cssPixel → pdfSpace → cssPixel within 0.001 at any scale/rotation | unit (property) | `npx vitest run src/test/coordinateMapper.test.ts` | ❌ W0 | ⬜ pending |
| PRV-01 | No fetch/XHR to external origins during PDF load | manual | DevTools Network after loading a PDF; zero third-party requests | N/A | ⬜ pending |
| PRV-02 | Zero third-party network requests after document load | manual/e2e | DevTools Network tab audit, filter third-party | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vite.config.ts` — add `test: { globals: true, environment: 'jsdom', setupFiles: ['src/test/setup.ts'] }` block
- [ ] `src/test/setup.ts` — `import '@testing-library/jest-dom'`
- [ ] `src/test/coordinateMapper.test.ts` — round-trip property tests (covers phase success criterion 5)
- [ ] `src/test/imageWrapper.test.ts` — verifies pdf-lib wrapping returns a valid Blob URL
- [ ] `src/test/fileValidation.test.ts` — verifies MIME/extension validation rejects unsupported types

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Zero third-party network requests after document load | PRV-01, PRV-02 | Requires a real browser Network tab; architectural guarantee not unit-testable | Run dev/preview build, open a multi-page PDF and an image, open DevTools → Network, confirm every request origin is the app's own origin (worker, CMaps, standard fonts all served locally) |
| First page renders on screen after open | DOC-01 (success criterion 1) | Visual render via canvas | Open a PDF by drag-drop and by browse; confirm first page paints |
| Forward/backward page navigation through a multi-page PDF | DOC-03 | Visual/scroll behavior | Scroll + prev/next through all pages of a multi-page PDF |

---

## Validation Sign-Off

- [ ] All testable tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
