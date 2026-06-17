---
phase: 4
slug: typed-signatures-signature-persistence
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-17
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.9 (jsdom env, canvas mock in `src/test/setup.ts`) |
| **Config file** | `vite.config.ts` (test block) |
| **Quick run command** | `npm test -- --run` |
| **Full suite command** | `npm test -- --run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** `npm test -- --run`
- **After every plan wave:** `npm test -- --run`
- **Before `/gsd-verify-work`:** Full suite green (256 baseline + new tests)
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Requirement | Behavior | Test Type | Automated Command | File | Status |
|-------------|----------|-----------|-------------------|------|--------|
| SIG-02 | Typed signature exports with embedded script font (not PNG); export does not throw | unit | `npm test -- --run src/test/exportPdf.test.ts` | extend | ⬜ pending |
| SIG-02 | `drawSignatureText` sizes text to fit box (height AND width) without truncation | unit | `npm test -- --run src/test/exportPdf.test.ts` | extend | ⬜ pending |
| SIG-02 | Type tab: CTA disabled when input empty, enabled when text present; font picker selects | unit (render) | `npm test -- --run src/test/signatureDraw.test.ts` | extend | ⬜ pending |
| SIG-02 | Draw tab still works (regression): stroke → confirm → armedFieldType='signature' | unit (render) | `npm test -- --run src/test/signatureDraw.test.ts` | exists | ⬜ pending |
| SIG-03 | Typed initials use the same font-embedded export path; export holds | unit | `npm test -- --run src/test/exportPdf.test.ts` | extend | ⬜ pending |
| SIG-04 | Saved items load (hydrate) from IndexedDB on app mount | unit (mock idb-keyval) | `npm test -- --run src/test/savedItems.test.ts` | NEW | ⬜ pending |
| SIG-04 | addSavedItem writes to idb-keyval AND updates store state | unit (mock idb-keyval) | `npm test -- --run src/test/savedItems.test.ts` | NEW | ⬜ pending |
| SIG-05 | deleteSavedItem removes from idb-keyval AND store state | unit (mock idb-keyval) | `npm test -- --run src/test/savedItems.test.ts` | NEW | ⬜ pending |
| EXP-02 | First 512 bytes byte-identical for a typed-signature (font-backed) export | unit | `npm test -- --run src/test/exportPdf.test.ts` | extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/test/savedItems.test.ts` — NEW: SIG-04 / SIG-05, with `vi.mock('idb-keyval', ...)`
- [ ] Typed-signature export tests added to `src/test/exportPdf.test.ts` — need a test TTF fixture OR mock `fetch` to return minimal TTF bytes
- [ ] Type-tab rendering tests added to `src/test/signatureDraw.test.ts`
- [ ] `vi.mock('idb-keyval')` wherever a test imports the saved-items store after the idb-keyval import is added

*No new framework install — Vitest + jsdom already configured (256 tests green at baseline).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Typed signature renders in the chosen script font on screen AND matches the exported PDF glyphs (WYSIWYG) | SIG-02 | Real font rasterization/embedding fidelity needs a browser + PDF viewer | In browser: type a name, pick each of the 3 fonts, place, download; open PDF and confirm glyphs match the on-screen preview |
| Saved signatures/initials persist after closing and reopening the browser | SIG-04 | True cross-session IndexedDB persistence can't be asserted in jsdom | In browser: save a signature, fully close + reopen the tab, confirm it appears in the Saved tab and is placeable |
| Self-hosted fonts load with zero third-party network requests | SIG-02 / PRV-02 | Network audit needs DevTools | DevTools Network tab: confirm font files load from own origin only, no CDN |
| Saved-item delete removes the thumbnail and it stays gone after reload | SIG-05 | Visual + persistence | In browser: delete a saved item, reload, confirm it's gone |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or are listed under Manual-Only
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all NEW test files + idb-keyval mock
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter (after Nyquist audit)

**Approval:** pending
