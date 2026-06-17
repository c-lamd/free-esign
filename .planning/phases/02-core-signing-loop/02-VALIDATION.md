---
phase: 2
slug: core-signing-loop
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-16
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (jsdom) — already configured in vite.config.ts |
| **Quick run command** | `npx vitest run src/test/exportPdf.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5–15 seconds |

---

## Sampling Rate

- **After every task commit:** `npx vitest run src/test/exportPdf.test.ts` (EXP-02 is the critical path — must stay green at every commit)
- **After every plan wave:** `npx vitest run`
- **Phase gate:** Full suite green + manual EXP-03 verification (open exported PDF in a real reader; signature visible, original content unaltered) + DevTools zero-third-party audit
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| EXP-02 | First 512 bytes of output === first 512 bytes of input (byte-identity) | unit | `npx vitest run src/test/exportPdf.test.ts` | ❌ W0 | ⬜ pending |
| EXP-02 | Output length > input length (incremental revision appended) | unit | `npx vitest run src/test/exportPdf.test.ts` | ❌ W0 | ⬜ pending |
| EXP-01 | triggerDownload creates a Blob + anchor click (mocked) | unit | `npx vitest run src/test/exportPdf.test.ts` | ❌ W0 | ⬜ pending |
| FLD-01/05/06 | Click CSS point → PDF-space → CSS pixel round-trip within 0.001 | unit | `npx vitest run src/test/fieldPlacement.test.ts` | ❌ W0 | ⬜ pending |
| FLD-07 | Delete via × and Delete/Backspace removes field from store | unit | `npx vitest run src/test/fieldStore.test.ts` | ❌ W0 | ⬜ pending |
| SIG-01 | signature_pad isEmpty() false after stroke, true after clear (canvas mock) | unit | `npx vitest run src/test/signatureDraw.test.ts` | ❌ W0 | ⬜ pending |
| PRV-01/02 | No network requests during export/draw | manual | DevTools Network — zero external requests | N/A | ⬜ pending |
| EXP-03 | Image-sourced doc: exported PDF contains image + signature | manual | Open exported PDF, confirm both visible | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `npm uninstall pdf-lib && npm install pdf-lib-incremental-save@1.17.4` — update imports in `src/lib/imageWrapper.ts` (pdf-lib → pdf-lib-incremental-save)
- [ ] `src/test/fixtures/samplePdf.ts` — minimal valid 1-page PDF as a Base64 constant fixture
- [ ] `src/test/exportPdf.test.ts` — **CRITICAL**: EXP-02 byte-identity test (write FIRST, must pass before export code is done) + output-longer-than-input + download trigger mock
- [ ] `src/test/fieldPlacement.test.ts` — click → PDF-space → CSS round-trip
- [ ] `src/test/fieldStore.test.ts` — Zustand field store (add/update/delete/select)
- [ ] `src/test/signatureDraw.test.ts` — signature_pad isEmpty tracking (mock canvas 2d context in setup.ts)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Signed PDF opens correctly with original content intact + signature visible | EXP-02, EXP-03 | Requires a real PDF reader to confirm rendering and integrity | Sign a multi-page PDF, download, open in a browser/Acrobat; confirm original pages unchanged and the signature appears at the placed position |
| Draw → place → drag → resize → delete full loop | SIG-01, FLD-01/05/06/07 | Visual + pointer interaction | In `npm run dev`: draw a signature, place it, drag it, resize (aspect-locked), delete it; place a second one |
| Zero third-party network requests during draw + export | PRV-01, PRV-02 | Requires browser Network tab | Open DevTools Network, perform the full sign+download flow, confirm every request is same-origin (no CDN) |

---

## Validation Sign-Off

- [ ] EXP-02 byte-identity test exists and passes (the make-or-break test)
- [ ] All code-producing tasks have an `<automated>` verify or a Wave 0 dependency
- [ ] No 3 consecutive tasks without automated verify
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
