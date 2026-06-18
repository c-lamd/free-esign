---
phase: 05-landing-page-launch
fixed_at: 2026-06-17T14:15:00Z
review_path: .planning/phases/05-landing-page-launch/05-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 05: Code Review Fix Report

**Fixed at:** 2026-06-17
**Source review:** .planning/phases/05-landing-page-launch/05-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 7
- Fixed: 7
- Skipped: 0

## Fixed Issues

### WR-01: goToLanding does not reset fieldStore — previous document's fields leak onto next document

**Files modified:** `src/components/TopBar.tsx`, `src/components/ErrorBanner.tsx`, `src/test/fieldStore.test.ts`
**Commit:** 95d6a58
**Applied fix:** Added `useFieldStore.getState().resetFields()` calls before `goToLanding()` in the wordmark button click handler in TopBar, before `reset()` in `handleOpenAnother()` in TopBar, and before `reset()` in `handleRetry()` in ErrorBanner. Added import of `useFieldStore` to ErrorBanner. Added two new tests in fieldStore.test.ts: one proving fields from document A are cleared after resetFields() (simulating document B load), and one proving savedItems survive resetFields() (document-independent IndexedDB persistence, SIG-04/SIG-05 requirement).

---

### WR-02: documentStore.test.ts — test named "has initial state of landing view" silently tests goToLanding() post-reset, not construction state

**Files modified:** `src/test/documentStore.test.ts`
**Commit:** f449b16
**Applied fix:** Renamed the misleading test to "store initialises with view === landing (construction-time default)" with a comment explaining the Zustand singleton limitation. Replaced the weaker "goToLanding sets view to landing" test with a new test that explicitly asserts goToLanding only changes view and does NOT clear docUrl/originalPdfBytes/numPages — documenting the caller-responsibility contract that makes the WR-01 fix meaningful. The test now accurately reflects that callers (TopBar etc.) are responsible for clearing document and field state on navigation.

---

### WR-03: Privacy guard fetch() pattern does not match template-literal form

**Files modified:** `src/test/privacyGuard.test.ts`
**Commit:** 6d82bad
**Applied fix:** Extended the `fetch external` regex from `/fetch\s*\(\s*["']https?:\/\//i` to `/fetch\s*\(\s*["'\`]https?:\/\//i` — adding the backtick to catch template-literal form `fetch(\`https://...\`)`. Added a comment above the pattern documenting that variable-based URLs (e.g. `fetch(url)`) require a separate manual review step and cannot be caught with simple regex. Guard verified to still pass on all current source files.

---

### IN-01: `<main role="main">` in LandingPage.tsx is redundant

**Files modified:** `src/components/LandingPage.tsx`
**Commit:** 110a5c0
**Applied fix:** Removed `role="main"` from the `<main>` element. The `<main>` element has an implicit ARIA landmark role of `main` per specification; the explicit attribute was redundant.

---

### IN-02: HeroSection and PrivacySection buttons missing type="button"

**Files modified:** `src/components/HeroSection.tsx`, `src/components/PrivacySection.tsx`, `src/components/LandingHeader.tsx`
**Commit:** 5931d26
**Applied fix:** Added `type="button"` to the CTA button in HeroSection (line 82), PrivacySection (line 130), and LandingHeader (line 40). Consistent with the pre-existing UploadZone button.

---

### IN-03: BUY_ME_A_COFFEE_URL placeholder ships with no build-time guard

**Files modified:** `src/test/landingPage.test.tsx`, `src/config.ts`
**Commit:** c7d5462
**Applied fix:** Extended the existing BMC link test to also assert `target="_blank"` alongside `rel` and `href` (well-formed link assertion). Added a prominently skipped `it.skip()` test named "BUY_ME_A_COFFEE_URL does not contain PLACEHOLDER (un-skip before launch)" — this test will fail when un-skipped if the placeholder has not been replaced, making the pre-launch checklist enforceable. Added a `*** BEFORE LAUNCH ***` comment in config.ts directing developers to replace the placeholder and un-skip the test. No test that fails on the current intentional placeholder was added per the fix scope constraint.

---

### IN-04: collectFiles in privacyGuard.test.ts has no error handling for filesystem failures

**Files modified:** `src/test/privacyGuard.test.ts`
**Commit:** 4410392
**Applied fix:** Wrapped `readdirSync(dir)` in a try/catch that re-throws with a descriptive message including the directory path. Wrapped `statSync(full)` in a separate try/catch that re-throws with the full file path (catches broken symlinks and permission-denied entries). Errors now produce a clear message at collection time rather than a cryptic suite-level throw.

---

## Verification Results

All three post-fix checks passed:

- `npm test -- --run`: **545 passed | 1 skipped** (1 skipped = IN-03 pre-launch TODO, intentional; 2 new tests added from WR-01; no regressions from baseline 543)
- `npx tsc -b --noEmit`: **clean (no output)**
- `npm run build`: **successful** (dist built, 276 modules transformed)

---

_Fixed: 2026-06-17_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
