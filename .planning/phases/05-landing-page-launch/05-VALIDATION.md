---
phase: 5
slug: landing-page-launch
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-17
---

# Phase 5 — Validation Strategy

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
- **Before `/gsd-verify-work`:** Full suite green (296 baseline ± initial-view test update + new tests)
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Requirement | Behavior | Test Type | Automated Command | File | Status |
|-------------|----------|-----------|-------------------|------|--------|
| LND-01 | LandingPage renders when view==='landing'; hero h1 present | unit | `npm test -- --run src/test/landingPage.test.tsx` | NEW | ⬜ pending |
| LND-02 | Privacy section heading + "never leaves your browser" statement present | unit | `npm test -- --run src/test/landingPage.test.tsx` | NEW | ⬜ pending |
| LND-02 | How-it-works renders 3 steps | unit | `npm test -- --run src/test/landingPage.test.tsx` | NEW | ⬜ pending |
| LND-03 | BMC link href correct + rel="noopener noreferrer"; NO `<script>`/iframe in landing | unit | `npm test -- --run src/test/landingPage.test.tsx` | NEW | ⬜ pending |
| LND-04 | `vercel.json` has outputDirectory dist (+ catch-all rewrite); no analytics keys | unit | `npm test -- --run src/test/privacyGuard.test.ts` | NEW | ⬜ pending |
| LND-04 | `npm run build` produces self-contained dist/index.html | smoke | `npm run build` | manual/CI | ⬜ pending |
| PRV-03 | No external `<script src=https://>` / `<link href=https://>` / `url(https://)` / `fetch(https://)` in src/ + index.html (xmlns SVG namespaces allowlisted; BMC anchor href allowed) | unit | `npm test -- --run src/test/privacyGuard.test.ts` | NEW | ⬜ pending |
| ViewState | Initial view is 'landing' (update existing test) | unit | `npm test -- --run src/test/documentStore.test.ts` | UPDATE (line 12) | ⬜ pending |
| ViewState | CTA → setView('empty'); goToLanding() → 'landing'; reset() still → 'empty' | unit | `npm test -- --run src/test/documentStore.test.ts` | extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/test/landingPage.test.tsx` — NEW: LND-01/02/03 + view transitions
- [ ] `src/test/privacyGuard.test.ts` — NEW: scan **src/ + index.html source** (NOT dist — bundled JS has ~25 false-positive https strings) for asset-loading external origins; scope to `<script src=`, `<link href=`, `url(`, `fetch(`, `<iframe`; allowlist `xmlns="http://www.w3.org/..."` SVG namespaces and the BMC navigation `<a href>`; assert vercel.json has no analytics keys
- [ ] `src/test/documentStore.test.ts` — UPDATE line 12 initial-view assertion to 'landing'; add goToLanding() test (reset()→'empty' stays unchanged)

*No new framework install — Vitest + jsdom already configured (296 tests green at baseline).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live site at free-esign.com serves the landing + app | LND-04 | Real deploy needs the user's Vercel account + domain DNS | Run `vercel --prod`, attach free-esign.com, visit the live URL |
| Full-workflow DevTools network audit shows ZERO third-party requests (open PDF → place fields → download) on the deployed site | PRV-03 (success criterion 3) | Live network capture needs a browser on the real deployment | DevTools Network tab on free-esign.com; confirm only same-origin requests across the whole signing flow |
| Hero reads as genuinely personal/candid; visual warmth on-brand | LND-01 | Subjective editorial/visual judgment | Read the deployed hero; confirm voice + layout |
| BMC link opens the correct tip page | LND-03 | Depends on the user's real BMC handle | Replace placeholder URL, click, confirm it lands on the user's BMC page |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or are listed under Manual-Only
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers the new test files + the initial-view test update
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter (after Nyquist audit)

**Approval:** pending
