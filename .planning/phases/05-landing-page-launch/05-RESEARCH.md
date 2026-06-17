# Phase 5: Landing Page + Launch — Research

**Researched:** 2026-06-17
**Domain:** React 19 + Vitest landing page, Zustand view-state extension, Vercel SPA deploy, privacy-guard testing
**Confidence:** HIGH — all findings grounded in direct codebase inspection

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Area 1: Landing Integration & Routing**
- No router. Add `'landing'` to ViewState, make it the initial view. CTA transitions `view → 'empty'`. The FreeESign wordmark in TopBar returns to `'landing'`. `reset()` / "Open another" stay → `'empty'` (not back to landing).
- Landing is a new top-level component `LandingPage.tsx` rendered when `view === 'landing'`. TopBar may render a minimal variant on landing view.

**Area 2: Landing Content & Voice (LND-01, LND-02)**
- Hero: first-person, candid. Three how-it-works steps (open / place / download). Privacy explainer prominent and plain. Single primary CTA into the tool, repeated once near the bottom.

**Area 3: Buy Me a Coffee (LND-03)**
- Plain anchor link ONLY — no BMC widget/button script. `BUY_ME_A_COFFEE_URL` constant with placeholder. Footer placement.

**Area 4: Privacy Posture (PRV-03)**
- No analytics, tracking, error reporting, third-party scripts, third-party fonts/CDNs. Automated guard: test/script scanning source (and/or `dist/`) for external `http(s)://` origins in asset-loading constructs. Allow BMC anchor href (navigation, not loaded asset). Full live DevTools audit is deferred (human step).

**Area 5: Deploy Config (LND-04)**
- `vercel.json`: keep `outputDirectory: dist`; add catch-all rewrite to `index.html`; NO Vercel analytics/speed-insights. Build: `npm run build` must succeed. Runbook doc in DEPLOY section.

### Claude's Discretion
- Exact hero copy wording, section ordering, visual layout (reuse Phase 1–4 tokens).
- Whether TopBar shows a reduced variant on landing vs landing carrying its own header.
- The precise automated privacy-guard mechanism (source grep test vs dist scan) — pick the reliable one.
- Favicon/OG-meta polish.

### Deferred Ideas (OUT OF SCOPE)
- Actual production deploy (`vercel --prod`)
- Domain attachment + DNS for free-esign.com
- Live DevTools network audit on deployed site
- Real Buy Me a Coffee handle
- OG/social preview image, custom analytics-free uptime monitoring
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LND-01 | Landing page with personal, candid hero | Hero content + LandingPage component; view-machine 'landing' initial state |
| LND-02 | How it works + prominent "files never leave browser" statement | HowItWorksSection + PrivacySection components per 05-UI-SPEC.md |
| LND-03 | Optional "Buy Me a Coffee" support link | Plain `<a>` with BUY_ME_A_COFFEE_URL constant in src/config.ts |
| LND-04 | Deployed publicly on Vercel at free-esign.com | vercel.json catch-all rewrite + build verification + deploy runbook |
| PRV-03 | No third-party analytics, tracking, or error reporting | Privacy guard test in src/test/privacyGuard.test.ts; source-scan strategy |
</phase_requirements>

---

## Summary

Phase 5 is a frontend-only, zero-new-dependencies phase. The signing tool (Phases 1–4) is complete and passing 296 tests. This phase wraps it in a landing page by extending the Zustand view state machine with a new `'landing'` view as the initial state, adding four new UI components (LandingPage, LandingHeader, HeroSection, HowItWorksSection, PrivacySection, LandingFooter — all documented precisely in 05-UI-SPEC.md), updating App.tsx and TopBar.tsx, and adding a privacy guard test.

The codebase is in excellent shape for this phase: all CSS design tokens are already in `src/index.css`, script fonts are self-hosted at `/fonts/`, the build succeeds cleanly, and direct inspection confirms zero external `https://` URLs exist in any source file's asset-loading positions. The privacy guard test is therefore writing a detector for regressions, not cleaning up existing violations.

Two concrete pitfalls require careful navigation: (1) `xmlns="http://www.w3.org/2000/svg"` appears in six existing component files and the built JS bundle; the privacy guard regex must exclude this pattern or it will produce false positives on every SVG icon in the codebase. (2) The `dist/` bundle scan approach is unreliable because bundled dependencies inject dozens of `https://` strings into template literals and string constants — the source-scan approach is the correct choice. (3) `index.html` currently references `/vite.svg` as the favicon, but no such file exists in `public/` — this is a broken reference that must be fixed in Phase 5 by replacing it with a self-hosted favicon.

**Primary recommendation:** Implement the source-scan privacy guard (scan `src/`, `index.html`, and `public/fonts/` only; exclude `src/test/`), make `'landing'` the initial view, implement the five new components per the approved 05-UI-SPEC.md, and fix the favicon before deploying.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Landing page view | Browser / Client | — | Pure client-side React component; no server rendering |
| View state machine | Browser / Client (Zustand) | — | Already in documentStore.ts; extend in-place |
| Privacy guard | Build / Test | — | Vitest source scan; runs in CI before deploy |
| Vercel configuration | CDN / Static | — | vercel.json controls routing; no backend |
| Favicon + meta | CDN / Static | — | Static assets served from public/ |
| BMC link | Browser / Client | — | Plain `<a>` navigation; zero network overhead |

---

## Standard Stack

### Core (no new packages)
[VERIFIED: direct codebase inspection] All packages listed below are already installed and confirmed in `package.json`.

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| React 19 + Vite | 19.2.0 / 8.0.16 | Component rendering + build | Already installed |
| TypeScript | ~5.8.3 | Type safety | Already installed |
| Zustand | ^5.0.0 | View state machine | Already installed |
| Tailwind v4 | ^4.3.1 | Utility CSS | Already installed |
| Vitest | ^4.1.0 | Testing (privacy guard test) | Already installed |
| @testing-library/react | ^16.3.0 | LandingPage render tests | Already installed |

**No new npm packages are installed in Phase 5.** [VERIFIED: 05-CONTEXT.md decision + package.json read]

### Package Legitimacy Audit

> No new packages are introduced in Phase 5. The `## Package Legitimacy Audit` table is not applicable.

**Packages removed due to [SLOP] verdict:** none (no new packages)
**Packages flagged as suspicious [SUS]:** none (no new packages)

---

## Architecture Patterns

### System Architecture Diagram

```
User opens free-esign.com
         │
         ▼
  Zustand documentStore
  initial view: 'landing'
         │
         ▼
  App.tsx dispatch
  ┌──────────────────────────────────┐
  │  view === 'landing'              │
  │  └── <LandingPage />             │──→ CTA click → setView('empty')
  │       ├── LandingHeader          │──→ "Sign a document" → setView('empty')
  │       ├── HeroSection            │
  │       ├── HowItWorksSection      │
  │       ├── PrivacySection         │
  │       └── LandingFooter          │──→ BMC link → external (user-initiated only)
  │                                  │
  │  view !== 'landing'              │
  │  └── <TopBar /> (wordmark btn)   │──→ wordmark click → goToLanding()
  │  └── <UploadZone />             (view='empty')
  │  └── <LoadingSpinner />         (view='loading')
  │  └── <ErrorBanner />            (view='error')
  │  └── <DocumentViewer />         (view='loaded')
  └──────────────────────────────────┘
         │
         ▼
  Vite build → dist/
  Vercel serves dist/ at free-esign.com
  vercel.json: catch-all rewrites /* → /index.html
```

### Recommended Project Structure (additions only)

```
src/
├── config.ts              # NEW — BUY_ME_A_COFFEE_URL constant
├── components/
│   ├── LandingPage.tsx    # NEW — top-level landing composed of sub-sections
│   ├── LandingHeader.tsx  # NEW — minimal sticky header (wordmark + Sign a document link)
│   ├── HeroSection.tsx    # NEW — h1 + paragraphs + CTA + reassurance
│   ├── HowItWorksSection.tsx  # NEW — three-step explainer
│   ├── PrivacySection.tsx # NEW — privacy card with icon + facts + repeat CTA
│   └── LandingFooter.tsx  # NEW — wordmark + tagline + BMC link + note
│   └── TopBar.tsx         # MODIFIED — wordmark becomes button with goToLanding()
├── store/
│   └── documentStore.ts   # MODIFIED — add 'landing' to ViewState; change initial view; add goToLanding()
├── App.tsx                # MODIFIED — add view==='landing' branch; gate TopBar/tool rendering
test/
├── privacyGuard.test.ts   # NEW — source scan for external asset-loading URLs
├── landingPage.test.tsx   # NEW — render + interaction tests for LandingPage
└── documentStore.test.ts  # MODIFIED — update 'has initial state' assertion to 'landing'

public/
└── favicon.svg            # NEW — replace broken /vite.svg reference
index.html                 # MODIFIED — fix favicon + add meta description + lang="en" (already set)
vercel.json                # MODIFIED — add catch-all SPA rewrite
```

### Pattern 1: View State Machine Extension

**What:** Add `'landing'` to the `ViewState` union type and change the initial value. Add two new actions: `startSigning()` (aliases `setView('empty')`) and `goToLanding()` (aliases `setView('landing')`). Keep `reset()` returning `'empty'`.

**When to use:** Anytime a new top-level view is added without a router.

[VERIFIED: direct codebase read of `src/store/documentStore.ts`]

```typescript
// src/store/documentStore.ts — diff
export type ViewState = 'landing' | 'empty' | 'loading' | 'error' | 'loaded'

// In DocumentStore interface:
startSigning: () => void
goToLanding: () => void

// In create():
view: 'landing',   // changed from 'empty'

// New actions:
startSigning: () => set({ view: 'empty' }),
goToLanding: () => set({ view: 'landing' }),

// reset() stays → 'empty' (not 'landing') — signing session context
reset: () => set({ view: 'empty', docUrl: null, ... })
```

### Pattern 2: App.tsx View Dispatch

**What:** The landing page replaces the TopBar on the landing view. TopBar renders only when `view !== 'landing'`.

[VERIFIED: direct codebase read of `src/App.tsx`]

```tsx
// src/App.tsx — updated render
function App() {
  const view = useDocumentStore((s) => s.view)
  const loadSavedItems = useFieldStore((s) => s.loadSavedItems)

  useEffect(() => { loadSavedItems() }, [loadSavedItems])

  return (
    <div style={{ fontFamily: '...', minHeight: '100dvh', backgroundColor: 'var(--color-surface)' }}>
      {view === 'landing' && <LandingPage />}
      {view !== 'landing' && (
        <>
          <TopBar />
          <ExportErrorBanner />
          {view === 'empty' && <UploadZone />}
          {view === 'loading' && <LoadingSpinner />}
          {view === 'error' && <ErrorBanner />}
          {view === 'loaded' && <DocumentViewer />}
          <SignatureDrawModal />
          <InitialsDrawModal />
        </>
      )}
    </div>
  )
}
```

**Note:** LandingPage includes its own LandingHeader — no TopBar on landing. The modals mount only in tool views (correct: they can't be triggered from landing).

### Pattern 3: TopBar Wordmark as Navigation Button

**What:** The existing wordmark `<span>` becomes a `<button>` that calls `goToLanding()` when the tool is active.

[VERIFIED: direct codebase read of `src/components/TopBar.tsx`]

```tsx
// src/components/TopBar.tsx — wordmark becomes a button
const goToLanding = useDocumentStore((s) => s.goToLanding)

<button
  onClick={goToLanding}
  aria-label="FreeESign — return to home"
  style={{
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '24px',
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    padding: 0,
    fontFamily: 'inherit',
    outline: 'none',
  }}
  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-accent)' }}
  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-primary)' }}
  onFocus={(e) => { e.currentTarget.style.outline = '2px solid var(--color-accent)'; e.currentTarget.style.outlineOffset = '2px' }}
  onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
>
  FreeESign
</button>
```

### Pattern 4: Privacy Guard Test (PRV-03) — Source Scan Strategy

**Critical design decision: scan `src/` source files, NOT `dist/` bundle.**

[VERIFIED: direct inspection of built `dist/assets/index-*.js`]

The built JS bundle contains dozens of `https://` strings that are false positives:
- `http://www.w3.org/2000/svg` (xmlns in React internals and our SVG components)
- `https://github.com/wojtekmaj/react-pdf#support-for-annotations` (string in react-pdf)
- `https://react.dev/errors/` (React error URLs in template literals)
- `http://example.com` (placeholder strings in bundled deps)
- `http://${e}` (template literals in bundled code)

None of these are actual asset-loading constructs. Scanning `dist/` for raw `https://` is unreliable for this codebase.

**Source-scan strategy — what to scan and what regex to use:**

Files to scan (confirmed by direct inspection):
1. `index.html` — check `<script src=...>`, `<link href=...>` 
2. `src/**/*.css` — check `@font-face { src: url(https://...` and `url("https://...`
3. `src/**/*.ts`, `src/**/*.tsx` — check `fetch('https://`, `fetch("https://` (actual network calls)
4. EXCLUDE: `src/test/**` — test files contain `blob:http://localhost/` mock URLs

**Patterns that are asset-loading and MUST be caught:**
```
# HTML asset-loading attributes:
<script[^>]+src=["']https?://
<link[^>]+href=["']https?://
<img[^>]+src=["']https?://
<iframe[^>]+src=["']https?://

# CSS external font loading:
url\(["']?https?://

# JS/TS actual network calls:
fetch\(["']https?://
new XMLHttpRequest.*open\(['"](GET|POST)['"],\s*['"]https?://
```

**Patterns that must NOT be flagged (allowlist):**
```
# SVG namespace declarations (xmlns is not a network request):
xmlns="http://www.w3.org/2000/svg"
xmlns="http://www.w3.org/1999/xlink"
xmlns="http://www.w3.org/1998/Math/MathML"

# Navigation anchor href (user-initiated, not an asset load):
href=["']https?://   (inside <a> elements — permitted)

# The BMC URL in src/config.ts as a string constant (not a fetch or script src):
BUY_ME_A_COFFEE_URL = "https://www.buymeacoffee.com/..."
```

**Concrete test implementation:**

```typescript
// src/test/privacyGuard.test.ts
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '../..')

function collectFiles(dir: string, exts: string[]): string[] {
  const result: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      // skip test directory — test mocks contain blob:http://localhost/
      if (entry === 'test' || entry === 'node_modules' || entry === 'dist') continue
      result.push(...collectFiles(full, exts))
    } else if (exts.some((e) => entry.endsWith(e))) {
      result.push(full)
    }
  }
  return result
}

// Regexes that detect actual asset-loading external URLs
// These are constructs that cause the browser to make a network request
const ASSET_LOADING_PATTERNS: Array<{ name: string; re: RegExp }> = [
  // <script src="https://...">  or <link href="https://...">
  { name: 'script src', re: /<script[^>]+src=["']https?:\/\//i },
  { name: 'link href (stylesheet/preload)', re: /<link[^>]+href=["']https?:\/\//i },
  { name: 'img src external', re: /<img[^>]+src=["']https?:\/\//i },
  { name: 'iframe src external', re: /<iframe[^>]+src=["']https?:\/\//i },
  // CSS @font-face external src
  { name: 'font-face external url', re: /url\(\s*["']?https?:\/\//i },
  // JS/TS fetch() with external URL
  { name: 'fetch external', re: /fetch\s*\(\s*["']https?:\/\//i },
]

describe('PRV-03: zero third-party asset-loading requests', () => {
  const htmlFiles = [join(ROOT, 'index.html')]
  const srcFiles = collectFiles(join(ROOT, 'src'), ['.ts', '.tsx', '.css'])
  const allFiles = [...htmlFiles, ...srcFiles]

  for (const file of allFiles) {
    const content = readFileSync(file, 'utf-8')
    const relPath = file.replace(ROOT + '/', '')

    for (const { name, re } of ASSET_LOADING_PATTERNS) {
      it(`${relPath}: no "${name}" external URL`, () => {
        expect(
          re.test(content),
          `Found external asset-loading URL matching "${name}" in ${relPath}`,
        ).toBe(false)
      })
    }
  }
})
```

**Why this works:**
- `<link href="https://...">` is caught but `<a href="https://...">` is NOT (the link pattern requires it to be a `<link>` tag, not an anchor).
- `url("https://...")` catches @font-face CDN references. Does NOT fire on `xmlns` because xmlns is not `url(`.
- `fetch("https://...")` catches the actual network-call pattern. Does NOT fire on `xmlns`, string constants like `BUY_ME_A_COFFEE_URL = "https://..."`, or href attributes.
- The `BUY_ME_A_COFFEE_URL` constant in `src/config.ts` is a plain string assignment — none of the patterns match a bare string assignment.

**False-positive verification (confirmed clean):**
- `xmlns="http://www.w3.org/2000/svg"` — does not match any pattern (not script/link/img/iframe/url()/fetch)
- `href="https://www.buymeacoffee.com/..."` in an `<a>` tag — `<link>` pattern does not match `<a>` tags
- `'/fonts/DancingScript-Regular.ttf'` — relative path, not https://

### Pattern 5: BUY_ME_A_COFFEE_URL Config Constant

```typescript
// src/config.ts (new file)
/**
 * Buy Me a Coffee support link.
 * Replace PLACEHOLDER with your actual BMC handle before deploying.
 * This is a plain navigation <a> href — no script is loaded.
 */
export const BUY_ME_A_COFFEE_URL = 'https://www.buymeacoffee.com/PLACEHOLDER'
```

Used in `LandingFooter.tsx` only as an `href` on an `<a>` element. No fetch, no script.

### Pattern 6: Favicon Fix

[VERIFIED: `index.html` references `/vite.svg` but `public/vite.svg` does NOT exist]

The current favicon reference is a broken link. Fix:

```html
<!-- index.html — replace broken vite.svg reference -->
<!-- BEFORE: -->
<link rel="icon" type="image/svg+xml" href="/vite.svg" />

<!-- AFTER (option A — inline data URI, zero additional file): -->
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><text y='24' font-size='24'>✍</text></svg>" />

<!-- AFTER (option B — add public/favicon.svg): -->
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
```

Option B is cleaner — add a minimal `public/favicon.svg` (an inline SVG pen/signature icon, no external references). Option A works immediately without a new file. Either satisfies PRV-03.

**Recommended:** Option B — a local `public/favicon.svg` file is more explicit and easier for the user to replace.

### Pattern 7: vercel.json SPA Rewrite

[VERIFIED: current `vercel.json` is `{ "outputDirectory": "dist" }` only]

```json
{
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

**Why the catch-all is correct:** The app has no router and only one HTML file, so all paths should serve `index.html`. Without the rewrite, navigating to `https://free-esign.com/sign` would return a 404 from Vercel instead of loading the SPA. This is standard Vercel SPA configuration. [ASSUMED — Vercel SPA routing behavior from training knowledge; standard practice for all Vercel-hosted SPAs]

**What to NOT add:**
- No `"analytics"` field
- No `"speedInsights"` field  
- No middleware entries
- No `headers` that load third-party scripts

### Anti-Patterns to Avoid

- **Scanning `dist/` for raw `https://`:** Produces dozens of false positives from bundled React internals, react-pdf strings, and xmlns declarations. Use source scan instead.
- **Using `<link rel="icon" href="https://...">` for favicon:** Would violate PRV-03. Always use a local path or data URI.
- **Adding BMC `<script>` widget:** BMC's embed button loads their JavaScript onto the page, making a third-party network request on page load — violates PRV-03. Use only `<a href>`.
- **Adding Vercel Analytics or Speed Insights:** These inject client-side scripts that phone home to Vercel's analytics servers — violates PRV-03. Do not add.
- **Calling `goToLanding()` from `reset()`:** `reset()` must stay → `'empty'`. This is a locked decision. Clicking "Open another" in a signing session returns to the upload zone, not the landing page.
- **Registering `LandingPage` in the `view !== 'landing'` block:** The modals (`SignatureDrawModal`, `InitialsDrawModal`) are tool-only and must not mount on the landing view.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSS design tokens | New CSS variables | Existing `:root` tokens in `src/index.css` | 8 tokens already cover all landing colors |
| Script fonts | New @font-face | Existing `public/fonts/` + `src/index.css` @font-face | Dancing Script, Great Vibes, Pacifico already self-hosted |
| Privacy icons (lock/shield) | Icon CDN | Inline SVG (same pattern as existing components) | 6 existing components already use inline SVG with xmlns |
| View routing | react-router-dom | Zustand `setView` / `goToLanding` / `startSigning` | Locked decision; CLAUDE.md says skip router for single-page tool |

---

## Common Pitfalls

### Pitfall 1: `xmlns` false positives in privacy guard
**What goes wrong:** A regex like `/https?:\/\//` on all source files matches `xmlns="http://www.w3.org/2000/svg"` in six existing components, causing the privacy guard to fail despite the codebase being clean.
**Why it happens:** `xmlns` contains a URL-like string but makes zero network requests.
**How to avoid:** Use the asset-loading-specific regexes in Pattern 4. Scope regexes to `<script src=`, `<link href=`, `url(`, `fetch(` — not raw string matching.
**Warning signs:** Privacy guard test fails on `LoadingSpinner.tsx`, `ExportErrorBanner.tsx`, `WordDocBanner.tsx`, `UndoRedoControls.tsx`, `UploadZone.tsx`, or `ErrorBanner.tsx` — all contain `xmlns="http://www.w3.org/2000/svg"`.

### Pitfall 2: `documentStore.test.ts` breaks when initial view changes to 'landing'
**What goes wrong:** `'has initial state of empty view'` asserts `expect(state.view).toBe('empty')` at line 12. After changing the initial value to `'landing'`, this test fails.
**Why it happens:** The test was written with the old initial value.
**How to avoid:** Update this ONE test: rename it to `'has initial state of landing view'` and change `toBe('empty')` to `toBe('landing')`. `'reset returns to empty state'` at line 49 is CORRECT and must NOT change — `reset()` must return `'empty'`.
**Warning signs:** `vitest run` reports `expected 'landing' to be 'empty'` in `documentStore.test.ts`.

### Pitfall 3: `dist/` scan produces false positives from bundled dependencies
**What goes wrong:** Scanning `dist/assets/index-*.js` for `https?://` returns ~25+ matches including React error URLs, react-pdf GitHub links, and template literals in iconv-lite.
**Why it happens:** Vite bundles all npm dependencies into a single JS file. These string constants are not network requests.
**How to avoid:** Scan `src/` source files instead of `dist/`. See Pattern 4.
**Warning signs:** Privacy guard fails with matches in the JS bundle pointing to `react.dev/errors/`, `github.com/wojtekmaj/react-pdf`, or `foo.bar` strings.

### Pitfall 4: Broken favicon `/vite.svg` carried into production
**What goes wrong:** The current `index.html` references `/vite.svg` as the favicon. `public/vite.svg` does NOT exist. The browser will get a 404 for the favicon on every page load.
**Why it happens:** The Vite template creates `public/vite.svg` by default, but this project removed it during earlier phases without updating `index.html`.
**How to avoid:** Replace the favicon reference in `index.html` with `/favicon.svg` and add a `public/favicon.svg`. Phase 5 must fix this.
**Warning signs:** Browser devtools shows a 404 for `/vite.svg` on every page load.

### Pitfall 5: LandingHeader "Sign a document" rendered as `<a>` instead of `<button>`
**What goes wrong:** If the "Sign a document" CTA in LandingHeader is an `<a>` with an `href`, it triggers a navigation (URL change) rather than a Zustand state transition. With no router, this could cause a page refresh or a broken route.
**Why it happens:** It looks like a link visually.
**How to avoid:** Use `<button>` for both CTA elements and the "Sign a document" header link — they all call `setView('empty')` (a state change, not a URL change). The BMC link is the only `<a>` element that navigates away. Per 05-UI-SPEC.md accessibility requirements.

### Pitfall 6: `privacyGuard.test.ts` scans `src/test/` files
**What goes wrong:** Test files contain `blob:http://localhost/mock-url` in vi.mock setups for URL.createObjectURL. Scanning test files with the `img src`, `fetch`, or URL patterns could match these mock strings.
**Why it happens:** The privacy guard is meant to catch production code, not test mocks.
**How to avoid:** The `collectFiles` function in Pattern 4 explicitly skips directories named `'test'`. Confirm this exclusion is in place.

### Pitfall 7: `App.tsx` renders modals on landing view
**What goes wrong:** If `<SignatureDrawModal />` and `<InitialsDrawModal />` are moved outside the `view !== 'landing'` gate, they mount on the landing page. They self-gate on their own open flags, so they render nothing, but they import from tool stores unnecessarily on the landing page.
**Why it happens:** Pattern 2 gates all tool components under `view !== 'landing'`.
**How to avoid:** Keep `SignatureDrawModal` and `InitialsDrawModal` inside the `view !== 'landing'` conditional block as shown in Pattern 2.

---

## Code Examples

### LandingFooter BMC link (from 05-UI-SPEC.md)

```tsx
// Source: 05-UI-SPEC.md § LandingFooter
import { BUY_ME_A_COFFEE_URL } from '../config'

<a
  href={BUY_ME_A_COFFEE_URL}
  target="_blank"
  rel="noopener noreferrer"
  aria-label="Support FreeESign — Buy Me a Coffee (opens in new tab)"
  style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: '14px' }}
  onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--color-text-primary)'; (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'underline' }}
  onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--color-text-secondary)'; (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'none' }}
  onFocus={(e) => { e.currentTarget.style.outline = '2px solid var(--color-accent)'; e.currentTarget.style.outlineOffset = '2px'; e.currentTarget.style.borderRadius = '2px' }}
  onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
>
  Buy me a coffee ☕
</a>
```

### index.html final state

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>FreeESign — Free, Private PDF Signing</title>
    <meta name="description" content="Sign PDFs and images in your browser. No uploads, no accounts, no tracking. Free for everyone." />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Note: `<html lang="en">` is already set. No OG meta in v1 (deferred per CONTEXT.md).

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `view: 'empty'` as initial state | `view: 'landing'` as initial state | User sees landing page on first load; tool reached via CTA |
| TopBar wordmark is `<span>` (static) | TopBar wordmark is `<button>` calling `goToLanding()` | Users in the tool can return to landing |
| `/vite.svg` favicon reference (broken) | `/favicon.svg` local file (working) | Browser no longer 404s on the favicon |
| No meta description | `<meta name="description" ...>` | Better search engine snippet |
| `vercel.json` with only `outputDirectory` | Add catch-all SPA rewrite | Any path serves the app; no 404 on direct links |

---

## Runtime State Inventory

> Phase 5 is a greenfield landing page addition — no rename/refactor involved.
> No runtime state migration is required.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | None — no stored data references the view state machine | None |
| Live service config | None — no external services | None |
| OS-registered state | None | None |
| Secrets/env vars | None — BUY_ME_A_COFFEE_URL is a source constant, not an env var | None |
| Build artifacts | `dist/` from current build is stale (no landing page); Vercel deploy will rebuild | `npm run build` in Phase 5 plan |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | `npm run build`, `vitest run` | ✓ | Confirmed (build ran) | — |
| Vite 8 | Build | ✓ | 8.0.16 (confirmed from build output) | — |
| Vitest 4 | Tests | ✓ | 4.1.9 (confirmed from test output) | — |
| `vercel` CLI | LND-04 deploy | Deferred | — | User runs manually |
| free-esign.com DNS | LND-04 domain | Deferred | — | User configures manually |

**Missing dependencies with no fallback:** `vercel` CLI and domain DNS — these are deferred to human (per CONTEXT.md Deferred). Nothing blocks local implementation.

**Missing dependencies with fallback:** None.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 |
| Config file | `vite.config.ts` (`test: { globals: true, environment: 'jsdom', setupFiles: ['./src/test/setup.ts'] }`) |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LND-01 | Hero h1 text is present | unit | `npm test -- --reporter=verbose src/test/landingPage.test.tsx` | ❌ Wave 0 |
| LND-01 | LandingPage renders when `view === 'landing'` | unit | same | ❌ Wave 0 |
| LND-02 | Privacy section heading is present | unit | same | ❌ Wave 0 |
| LND-02 | How it works section renders 3 steps | unit | same | ❌ Wave 0 |
| LND-03 | BMC link has correct href and rel="noopener noreferrer" | unit | same | ❌ Wave 0 |
| LND-03 | BMC link has no `<script>` sibling | unit | same | ❌ Wave 0 |
| LND-04 | `npm run build` produces `dist/index.html` | smoke | `npm run build` | ✅ (manual step) |
| LND-04 | `vercel.json` contains catch-all rewrite | unit | `npm test -- --reporter=verbose src/test/privacyGuard.test.ts` | ❌ Wave 0 |
| PRV-03 | No `<script src="https://...">` in sources | unit | `npm test` | ❌ Wave 0 |
| PRV-03 | No `<link href="https://...">` in sources | unit | `npm test` | ❌ Wave 0 |
| PRV-03 | No `url("https://...")` in CSS @font-face | unit | `npm test` | ❌ Wave 0 |
| PRV-03 | No `fetch("https://...")` in source JS/TS | unit | `npm test` | ❌ Wave 0 |
| ViewState | Initial view is `'landing'` (not `'empty'`) | unit | `npm test` | ❌ needs update (documentStore.test.ts line 12) |
| ViewState | CTA click transitions view to `'empty'` | unit | `npm test -- src/test/landingPage.test.tsx` | ❌ Wave 0 |
| ViewState | `reset()` returns to `'empty'` (not `'landing'`) | unit | `npm test` | ✅ (documentStore.test.ts line 49 — correct, no change) |
| ViewState | `goToLanding()` sets view to `'landing'` | unit | `npm test` | ❌ Wave 0 (add to documentStore.test.ts) |

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test` (full 296+ suite)
- **Phase gate:** Full suite green + `npm run build` clean before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/test/landingPage.test.tsx` — covers LND-01, LND-02, LND-03, view transitions
- [ ] `src/test/privacyGuard.test.ts` — covers PRV-03 (all asset-loading URL patterns)
- [ ] `src/test/documentStore.test.ts` line 12: update `'has initial state of empty view'` → `'has initial state of landing view'`; change `toBe('empty')` → `toBe('landing')`
- [ ] Add `goToLanding()` test to `src/test/documentStore.test.ts`

**Existing tests that require NO changes:**
- `documentStore.test.ts` line 49 (`'reset returns to empty state'`): `reset()` → `'empty'` is still correct.
- `downloadWiring.test.ts`: uses `useDocumentStore.getState().reset()` as setup (line 84, 134, 231) to clear state, then sets `view: 'loaded'` manually. Does not assert initial view. No change needed.
- All other 294 tests: do not reference initial view or `'landing'`. No changes needed.

### LandingPage Test Structure

```typescript
// src/test/landingPage.test.tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import React from 'react'
import { useDocumentStore } from '../store/documentStore'

describe('LandingPage', () => {
  beforeEach(() => {
    useDocumentStore.getState().goToLanding()  // reset to landing view
  })

  it('renders when view === landing', async () => {
    const { LandingPage } = await import('../components/LandingPage')
    await act(async () => { render(React.createElement(LandingPage)) })
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })

  it('hero h1 contains the candid copy', async () => { /* ... */ })

  it('privacy section heading is present', async () => {
    // "Your document never leaves your browser"
  })

  it('CTA click transitions view to empty', async () => {
    // fireEvent.click on "Start signing — it's free"
    // expect(useDocumentStore.getState().view).toBe('empty')
  })

  it('BMC link has rel="noopener noreferrer"', async () => { /* ... */ })

  it('BMC link href starts with https://www.buymeacoffee.com/', async () => { /* ... */ })

  it('no <script> tag inside landing page', async () => {
    // container should not contain <script>
  })
})
```

---

## Security Domain

> `security_enforcement: true` (absent = enabled per config.json)

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No login/auth on landing |
| V3 Session Management | No | No sessions; Zustand state is ephemeral |
| V4 Access Control | No | No protected resources on landing |
| V5 Input Validation | No | No user input forms on landing page (CTA buttons only) |
| V6 Cryptography | No | No cryptographic operations |

**Primary security concern:** PRV-03 — no third-party scripts that could exfiltrate document metadata. Addressed via source-scan privacy guard (see Pattern 4) and architectural decisions (plain `<a>` link, no BMC widget, no analytics).

### Known Threat Patterns for Static Landing Page

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Third-party script injection via CDN dependency | Information Disclosure | No external scripts; self-hosted only (PRV-03 guard) |
| Analytics tracking pixel in CSS background-image | Information Disclosure | `url("https://...")` pattern caught by privacy guard |
| Accidental Vercel Analytics opt-in | Information Disclosure | No `@vercel/analytics` package; vercel.json has no analytics field |
| BMC widget script (if accidentally added) | Information Disclosure | Privacy guard catches `<script src="https://...">`; pattern catches cdn.buymeacoffee.com/widget |

---

## Project Constraints (from CLAUDE.md)

The following directives from `CLAUDE.md` directly apply to Phase 5:

| Directive | Impact on Phase 5 |
|-----------|-------------------|
| "Zero alteration of the uploaded document" | Not affected — landing page adds no export logic |
| "Client-side only — no document upload, no accounts, no tracking" | Landing page must not add analytics, tracking, or server calls (PRV-03) |
| "Vercel-hostable and cheap-to-free to run — static/client-side app" | `vercel.json` catch-all rewrite pattern; no server-side functions |
| "Skip react-router-dom for a single-page tool — all state in Zustand" | Locked decision — view state machine extension, no router |
| "No Vercel Analytics / Speed Insights — those inject third-party requests" | Must not add `@vercel/analytics` or Speed Insights to the project |
| "Vite + React (not Next.js)" | No migration; pure client-side React + Vite throughout |
| "pdf-lib-incremental-save" | Not relevant to Phase 5 (no export changes) |
| "Buy Me a Coffee Integration" (noted in stack) | Plain `<a>` link only per locked decision |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Vercel serves `dist/` at root; all `public/` assets (fonts, worker) land in `dist/` root and are served at same-origin paths | Environment Availability | Path 404s for `/fonts/`, `/pdf.worker.min.mjs` on deploy — verified by build output showing these in `dist/` |
| A2 | `vercel.json` catch-all rewrite `{ source: "/(.*)", destination: "/index.html" }` is the correct Vercel v2 rewrites syntax | Pattern 7 | SPA routing fails on direct deep links — well-established Vercel SPA pattern |
| A3 | Vite `base` defaults to `'/'` (no explicit config needed for root domain) | Pattern 7 / Architecture | Assets would load from wrong path on non-root deployment — but `free-esign.com` is root; no subpath |

All three assumptions are LOW risk. A1 is confirmed by the build output. A2 is standard Vercel practice. A3 is confirmed by the build output showing `/assets/...` paths in `dist/index.html`.

---

## Open Questions

1. **Favicon design**
   - What we know: A new `public/favicon.svg` is needed to replace the broken `/vite.svg` reference.
   - What's unclear: The exact visual design (pen icon? signature "F"? letter mark?).
   - Recommendation: Use a simple inline SVG with the "✍" or a pen path — unambiguous, zero external dependency. The executor can refine the design. The planner should create a task to produce `public/favicon.svg`.

2. **privacyGuard `vercel.json` check**
   - What we know: The CONTEXT.md mentions checking vercel.json for analytics fields.
   - What's unclear: Whether the privacy guard test should also assert that `vercel.json` has no `analytics` or `speedInsights` keys.
   - Recommendation: Add a simple JSON parse assertion to `privacyGuard.test.ts`: read `vercel.json`, parse it, assert no `analytics` key and no `speedInsights` key. This is a 3-line addition.

---

## Sources

### Primary (HIGH confidence — direct codebase inspection)
- `/home/clamd/Projects/misc/free-esign/src/store/documentStore.ts` — ViewState type, initial view ('empty'), actions
- `/home/clamd/Projects/misc/free-esign/src/App.tsx` — current render structure
- `/home/clamd/Projects/misc/free-esign/src/components/TopBar.tsx` — wordmark as static span
- `/home/clamd/Projects/misc/free-esign/src/test/documentStore.test.ts` — lines 10–12 ('has initial state of empty view'), line 49–59 (reset test)
- `/home/clamd/Projects/misc/free-esign/src/index.css` — confirmed `/fonts/` relative paths in all @font-face declarations
- `/home/clamd/Projects/misc/free-esign/index.html` — confirmed broken `/vite.svg` favicon, confirmed `lang="en"`
- `/home/clamd/Projects/misc/free-esign/vercel.json` — confirmed only `outputDirectory: dist`
- `/home/clamd/Projects/misc/free-esign/package.json` — confirmed no new packages needed
- `npm run build` — confirmed build succeeds, dist structure, `/vite.svg` not in `public/`
- `npm test` — confirmed 296 tests pass (baseline)
- `dist/assets/index-*.js` grep — confirmed false-positive problem with dist scanning for `https://`
- Grep of all `src/` files for `https://` — confirmed zero external URLs in asset-loading positions

### Secondary (HIGH confidence — planning artifacts reviewed)
- `.planning/phases/05-landing-page-launch/05-CONTEXT.md` — all locked decisions
- `.planning/phases/05-landing-page-launch/05-UI-SPEC.md` — component inventory, copywriting contract, accessibility requirements, PRV-03 contract
- `.planning/REQUIREMENTS.md` — LND-01..04, PRV-03 requirement text
- `.planning/STATE.md` — confirmed Phase 4 complete, 296 tests green

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all verified in `package.json` and build output
- Architecture (view machine extension): HIGH — current code read directly; changes are minimal and well-scoped
- Privacy guard design: HIGH — confirmed by direct grep of source and dist; false-positive analysis is empirical
- Pitfalls: HIGH — all confirmed by direct code inspection (xmlns false positive, broken favicon, initial view test)
- Deploy config: MEDIUM — Vercel SPA rewrite is standard but not live-tested (deferred)

**Research date:** 2026-06-17
**Valid until:** 2026-07-17 (stable tech stack; no fast-moving dependencies)
