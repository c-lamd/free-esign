---
phase: 05-landing-page-launch
reviewed: 2026-06-17T00:00:00Z
depth: deep
files_reviewed: 17
files_reviewed_list:
  - src/store/documentStore.ts
  - src/App.tsx
  - src/config.ts
  - src/components/LandingPage.tsx
  - src/components/HeroSection.tsx
  - src/components/HowItWorksSection.tsx
  - src/components/PrivacySection.tsx
  - src/components/LandingHeader.tsx
  - src/components/LandingFooter.tsx
  - src/components/TopBar.tsx
  - src/test/privacyGuard.test.ts
  - src/test/documentStore.test.ts
  - src/test/landingPage.test.tsx
  - index.html
  - public/favicon.svg
  - vercel.json
  - README.md
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-06-17
**Depth:** deep
**Files Reviewed:** 17
**Status:** issues_found

## Summary

Phase 5 adds a landing page (LandingHeader, HeroSection, HowItWorksSection, PrivacySection, LandingFooter), wires a `'landing'` ViewState into documentStore, and adds the PRV-03 privacy guard test. The privacy-critical path — PRV-03 test soundness, BMC link construction, favicon/index.html cleanliness, and vercel.json rewrite — is implemented correctly. No third-party scripts, no external asset loads, and the BMC link is a plain `<a>` with correct `rel="noopener noreferrer"`.

The primary finding is a state-management bug introduced by the new `goToLanding()` action: it changes only `view` and does not coordinate with `fieldStore`. A user who places fields on document A, clicks the wordmark back to landing, then opens document B will see document A's fields overlaid on document B. This is a behavioral correctness defect that ships in Phase 5.

The privacy guard itself is sound within its documented scope but has a documented gap worth noting.

---

## Warnings

### WR-01: `goToLanding()` does not reset fieldStore — previous document's fields leak onto next document

**File:** `src/store/documentStore.ts:69` / `src/components/TopBar.tsx:63`

**Issue:** `goToLanding` only sets `view: 'landing'`; it leaves `fieldStore` (placed fields, undo history, armedFieldType, pageDimensions, etc.) completely untouched. When the user navigates: loaded doc-A → clicks wordmark → landing → "Sign a document" → UploadZone → uploads doc-B, the `fieldStore` still holds all fields from doc-A. `LazyPage` reads `fieldStore.fields` unconditionally, so doc-A's signature and field widgets render over doc-B's pages at whatever coordinates they were placed on doc-A. The pre-existing `handleOpenAnother → reset()` path has the same omission, but `goToLanding` is entirely new in Phase 5 and adds a second unguarded path to the same defect.

**Fix:** Call `fieldStore.resetFields()` alongside the view change. The cleanest approach is to make `goToLanding` a composite action — either orchestrate it at the call site or chain it inside the store:

```ts
// Option A: call site (TopBar.tsx)
function handleGoToLanding() {
  useFieldStore.getState().resetFields()
  goToLanding()
}

// Option B: documentStore action (requires importing fieldStore — avoid cross-store imports)
// Prefer Option A or a dedicated orchestrator hook.
```

The same fix should be applied to `handleOpenAnother` in `TopBar.tsx` and to `ErrorBanner`'s `reset()` call — both are pre-existing omissions exposed by the same root cause.

---

### WR-02: `documentStore.test.ts:10` — test named "has initial state of landing view" does not test initial construction state; it silently tests `goToLanding()` post-reset

**File:** `src/test/documentStore.test.ts:10-22`

**Issue:** `beforeEach` calls `reset()`, which sets `view: 'empty'` and nulls out all data fields. The test then calls `goToLanding()` and asserts that all data fields are null. Every assertion passes because `reset()` cleared the fields — **not** `goToLanding()`. The function `goToLanding()` only sets `view: 'landing'`; it does **not** clear `docUrl`, `originalPdfBytes`, `numPages`, etc. If this test is trusted as evidence that `goToLanding` produces a fully-clean state, it gives false assurance: a user calling `loadDocument()` followed by `goToLanding()` will still have `docUrl` and `originalPdfBytes` set in the store, which is exactly the WR-01 root cause. Additionally, no test anywhere verifies that the store's **constructor**-initial state is `view: 'landing'` (without first calling any action).

**Fix:**
```ts
it('has initial state of landing view', () => {
  // Test actual initial construction state, not post-reset post-goToLanding state.
  // Access the store directly without calling any action; Vitest module isolation
  // guarantees a fresh store per describe block if the module is reset properly.
  const state = useDocumentStore.getState()
  expect(state.view).toBe('landing')
})

it('goToLanding does NOT clear document data (only changes view)', () => {
  const store = useDocumentStore.getState()
  store.loadDocument('blob:some-url')
  store.setOriginalPdfBytes(new ArrayBuffer(8))
  store.goToLanding()
  const state = useDocumentStore.getState()
  expect(state.view).toBe('landing')
  // goToLanding does not clear document state — callers are responsible for that:
  expect(state.docUrl).toBe('blob:some-url')
  expect(state.originalPdfBytes).not.toBeNull()
})
```

---

### WR-03: Privacy guard `fetch()` pattern does not match template-literal or variable-based external URLs

**File:** `src/test/privacyGuard.test.ts:64`

**Issue:** The `fetch external` regex is:
```
/fetch\s*\(\s*["']https?:\/\//i
```
This only matches `fetch("https://...")` or `fetch('https://...')`. It does **not** catch:
- Template literals: `` fetch(`https://external.com/${path}`) ``
- Variable indirection: `const url = 'https://external.com'; fetch(url)`
- `new URL(...)`: `fetch(new URL('https://external.com'))`

The comment in the test file acknowledges the `fetch("https://..."` pattern specifically but does not document the template-literal gap. In the current codebase, the only `fetch()` call in production source is `fetch(path)` in `src/lib/fonts.ts` where `path` is drawn from a static allowlist — so no real external URL can be passed. The gap is therefore theoretical given the current code, but it is a soundness limitation of the guard as a static-analysis backstop.

**Fix:** Extend the pattern to also catch the backtick form, which is more likely to appear in future code than the variable form:

```ts
{ name: 'fetch external', re: /fetch\s*\(\s*["'`]https?:\/\//i },
```

Add a comment noting that variable-based URLs (e.g. `fetch(url)`) require a separate review step and cannot be caught with simple regex.

---

## Info

### IN-01: `<main role="main">` in LandingPage.tsx is redundant

**File:** `src/components/LandingPage.tsx:17`

**Issue:** The `<main>` element has an implicit ARIA landmark role of `main`. Adding `role="main"` explicitly is redundant per the ARIA specification (it is not invalid, but it duplicates information). All major screen readers and browsers already expose `<main>` as a `main` landmark.

**Fix:** Remove `role="main"`:
```tsx
<main>
```

---

### IN-02: HeroSection and PrivacySection buttons missing `type="button"`

**File:** `src/components/HeroSection.tsx:82`, `src/components/PrivacySection.tsx:130`, `src/components/LandingHeader.tsx:40`

**Issue:** The CTA buttons in HeroSection, PrivacySection, and LandingHeader omit `type="button"`. Per the HTML spec, a button element outside a `<form>` defaults to `type="submit"` in some older parsers, though modern browsers treat untyped buttons outside forms as plain buttons. The risk is nil in the current markup (no form ancestor), but explicit typing is the correct defensive pattern and is already used in UploadZone (`type="button"`). This is inconsistent with the pre-existing UploadZone button.

**Fix:** Add `type="button"` to all three buttons.

---

### IN-03: `BUY_ME_A_COFFEE_URL` placeholder ships with no build-time guard

**File:** `src/config.ts:6`, `src/components/LandingFooter.tsx:46`

**Issue:** `BUY_ME_A_COFFEE_URL` is set to `'https://www.buymeacoffee.com/PLACEHOLDER'`. The TODO comment on `LandingFooter.tsx:46` notes this must be replaced before deploy, but there is no CI check, build-time assertion, or test that fails if the placeholder string is present. The `landingPage.test.tsx:57` BMC test only asserts `href` starts with `buymeacoffee.com/` — it would pass with the PLACEHOLDER value. A developer can ship a broken support link silently.

**Fix:** Add a test that fails if `PLACEHOLDER` is still in the URL:
```ts
it('BUY_ME_A_COFFEE_URL is not the deploy placeholder', () => {
  expect(BUY_ME_A_COFFEE_URL).not.toMatch(/PLACEHOLDER/)
})
```

Alternatively, make the CI step that runs `npm run build` check for the string.

---

### IN-04: `collectFiles` in privacyGuard.test.ts has no error handling for filesystem failures

**File:** `src/test/privacyGuard.test.ts:33-46`

**Issue:** `collectFiles` calls `readdirSync` and `statSync` without try/catch. If a file has unexpected permissions or is a broken symlink, the function throws synchronously during Vitest's test-collection phase (before any `it()` block runs). The failure manifests as a cryptic suite-level error rather than a clear test failure, making it harder to diagnose. In a normal dev environment this is benign, but it is a robustness gap for CI environments that may have stricter filesystem permissions (e.g., mounted read-only layers in Docker).

**Fix:** Wrap the body with a try/catch and re-throw with a descriptive message, or use the `{ withFileTypes: true }` option on `readdirSync` with a guard:
```ts
function collectFiles(dir: string, exts: string[]): string[] {
  const result: string[] = []
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch (err) {
    throw new Error(`collectFiles: cannot read directory ${dir}: ${String(err)}`)
  }
  for (const entry of entries) {
    // ... rest unchanged
  }
  return result
}
```

---

_Reviewed: 2026-06-17_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
