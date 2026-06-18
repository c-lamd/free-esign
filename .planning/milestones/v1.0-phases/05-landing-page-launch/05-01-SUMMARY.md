---
phase: "05-landing-page-launch"
plan: "01"
subsystem: "landing-page"
tags: ["landing", "view-machine", "privacy", "favicon", "bmc"]
dependency_graph:
  requires: ["04-typed-signatures-signature-persistence"]
  provides: ["LND-01", "LND-02", "LND-03", "landing-view-machine"]
  affects: ["src/store/documentStore.ts", "src/App.tsx", "src/components/TopBar.tsx"]
tech_stack:
  added: []
  patterns:
    - "ViewState machine extended with 'landing' as initial view"
    - "Inline-style token objects with var(--color-*) throughout landing components"
    - "Ghost button pattern for wordmark navigation"
    - "Plain <a> anchor for BMC (no script/widget)"
key_files:
  created:
    - src/config.ts
    - src/components/LandingPage.tsx
    - src/components/LandingHeader.tsx
    - src/components/HeroSection.tsx
    - src/components/HowItWorksSection.tsx
    - src/components/PrivacySection.tsx
    - src/components/LandingFooter.tsx
    - public/favicon.svg
    - src/test/landingPage.test.tsx
  modified:
    - src/store/documentStore.ts
    - src/App.tsx
    - src/components/TopBar.tsx
    - src/test/documentStore.test.ts
    - index.html
decisions:
  - "BUY_ME_A_COFFEE_URL is a plain string constant in src/config.ts — plain anchor href only, no script"
  - "goToLanding()/startSigning() are separate named actions (not setView aliases) per plan spec"
  - "reset() unchanged — stays returning 'empty' (signing-session intent, locked decision)"
  - "LandingPage has its own LandingHeader; TopBar only renders on view !== 'landing'"
  - "Both modals gated inside view !== 'landing' block (Pitfall 7 avoided)"
  - "favicon.svg is a minimal self-hosted SVG pen icon with accent blue background"
metrics:
  duration: "4 minutes"
  completed: "2026-06-17"
  tasks_completed: 3
  files_changed: 14
---

# Phase 05 Plan 01: Landing Page + View Machine Summary

Landing page wired as the new initial app view: boot → candid privacy-first landing → CTA → signing tool → wordmark → landing. All 305 tests pass; build clean.

## What Was Built

### Task 1: ViewState machine + BUY_ME_A_COFFEE_URL (feat/25418fe)

Extended `documentStore.ts` to add `'landing'` as the new initial ViewState and two named actions:
- `goToLanding()` → sets `view: 'landing'`
- `startSigning()` → sets `view: 'empty'`
- `reset()` unchanged — still returns `view: 'empty'` (locked decision: "Open another" stays in the tool)

Created `src/config.ts` exporting `BUY_ME_A_COFFEE_URL = 'https://www.buymeacoffee.com/PLACEHOLDER'` as a plain named constant with a doc comment directing the user to replace PLACEHOLDER before deploy.

Updated `documentStore.test.ts`: renamed the initial-view test to `'has initial state of landing view'`, added explicit `goToLanding()` call before the assertion (since `beforeEach` calls `reset()` → `'empty'`), and added `goToLanding` and `startSigning` tests. The `reset returns to empty state` test is unchanged.

### Task 2: LandingPage + 5 section components + landingPage tests (feat/021f4d1)

Six new components following the UI-SPEC Component Inventory exactly, using only `var(--color-*)` tokens:

- **LandingPage.tsx**: LandingHeader + `<main role="main">` (Hero + HowItWorks + Privacy) + LandingFooter
- **LandingHeader.tsx**: 56px sticky header; FreeESign wordmark (plain text — not a link); "Sign a document" ghost `<button>` calling `startSigning`
- **HeroSection.tsx**: decorative script flourish (`aria-hidden`); hero h1 with exact candid copy; two body paragraphs; accent CTA "Start signing — it's free"; reassurance line
- **HowItWorksSection.tsx**: three step cards with neutral 40px numbered circles (not accent), step titles, and descriptions per the Copywriting Contract
- **PrivacySection.tsx**: inline SVG lock icon (`aria-hidden`); privacy h2; body copy; three "✓"-prefixed facts (text-secondary, not accent); repeat CTA
- **LandingFooter.tsx**: wordmark + tagline + BMC `<a>` with `rel="noopener noreferrer"` + footer note; `{/* TODO: replace BUY_ME_A_COFFEE_URL placeholder */}` comment; NO script/widget

`src/test/landingPage.test.tsx` (7 tests): h1 presence, exact candid copy, privacy heading, 3 step titles, BMC link rel + href, no script/iframe, CTA click → view `'empty'`.

### Task 3: App wiring + TopBar wordmark + favicon + meta (feat/7a4ec81)

- **App.tsx**: `view === 'landing'` renders `<LandingPage />`; `view !== 'landing'` gates all tool chrome + both modals in a `<>` fragment; JSDoc comment updated to include `'landing'` in state machine description
- **TopBar.tsx**: FreeESign `<span>` replaced with a `<button>` calling `goToLanding()`, ghost-button pattern with hover/focus/blur states, `aria-label="FreeESign — return to home"`
- **public/favicon.svg**: self-hosted minimal SVG pen icon with accent blue background; no external references
- **index.html**: favicon `href` changed from `/vite.svg` (broken 404) to `/favicon.svg`; `<meta name="description">` added; `lang="en"` already present

## Deviations from Plan

None — plan executed exactly as written.

The only minor adaptation: the test for CTA click used `getAllByRole` instead of `getByRole` because both the hero CTA and privacy section CTA share the same `aria-label`. This is correct behavior (two buttons with the same aria-label), not a bug — the test picks the first one (hero CTA).

## Known Stubs

- `BUY_ME_A_COFFEE_URL` in `src/config.ts` is set to `'https://www.buymeacoffee.com/PLACEHOLDER'`. The link renders in the footer with this placeholder value. The user must replace `PLACEHOLDER` with their actual BMC handle before deploying to production. This is documented with a `{/* TODO */}` comment in `LandingFooter.tsx` and a doc comment in `config.ts`. The plan explicitly intends this as a placeholder (LND-03 / Area 3 locked decision).

## Threat Flags

No new threat surface beyond what the plan's `<threat_model>` covers:
- T-05-01 (reverse-tabnabbing): mitigated — `rel="noopener noreferrer"` on BMC anchor, tested
- T-05-02 (BMC widget/script injection): mitigated — plain `<a>` only, no script; tested (no script/iframe assertion)
- T-05-03 (favicon/favicon external ref): mitigated — self-hosted `public/favicon.svg`, no external href in index.html

## Self-Check: PASSED

Files verified:
- FOUND: /home/clamd/Projects/misc/free-esign/src/config.ts
- FOUND: /home/clamd/Projects/misc/free-esign/src/components/LandingPage.tsx
- FOUND: /home/clamd/Projects/misc/free-esign/src/components/LandingHeader.tsx
- FOUND: /home/clamd/Projects/misc/free-esign/src/components/HeroSection.tsx
- FOUND: /home/clamd/Projects/misc/free-esign/src/components/HowItWorksSection.tsx
- FOUND: /home/clamd/Projects/misc/free-esign/src/components/PrivacySection.tsx
- FOUND: /home/clamd/Projects/misc/free-esign/src/components/LandingFooter.tsx
- FOUND: /home/clamd/Projects/misc/free-esign/public/favicon.svg
- FOUND: /home/clamd/Projects/misc/free-esign/src/test/landingPage.test.tsx

Commits verified:
- FOUND: 25418fe (Task 1)
- FOUND: 021f4d1 (Task 2)
- FOUND: 7a4ec81 (Task 3)

Test suite: 305 tests pass (296 baseline + 9 new)
Build: `npm run build` succeeds, emits dist/index.html
