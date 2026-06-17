# Phase 5: Landing Page + Launch — Pattern Map

**Mapped:** 2026-06-17
**Files analyzed:** 10 new/modified files
**Analogs found:** 9 / 10 (1 has no existing analog — `src/config.ts`)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/components/LandingPage.tsx` + sub-sections | component | request-response | `src/components/UploadZone.tsx` | role-match (same: full-viewport layout, inline-style tokens, h1, CTA button) |
| `src/config.ts` | config | — | none | no analog |
| `src/store/documentStore.ts` | store | event-driven | itself (extend in-place) | exact |
| `src/App.tsx` | component | event-driven | itself (extend in-place) | exact |
| `src/components/TopBar.tsx` | component | request-response | itself (extend in-place) | exact |
| `index.html` | config | — | itself (extend in-place) | exact |
| `public/favicon.svg` | static asset | — | any inline SVG in components | partial |
| `vercel.json` | config | — | itself (extend in-place) | exact |
| `src/test/landingPage.test.tsx` | test | request-response | `src/test/signatureDraw.test.ts` | role-match (RTL render + fireEvent) |
| `src/test/privacyGuard.test.ts` | test | file-I/O | `src/test/documentStore.test.ts` (fs read shape) | partial |
| `src/test/documentStore.test.ts` | test | event-driven | itself (modify in-place) | exact |

---

## Pattern Assignments

### `src/components/LandingPage.tsx` (and sub-sections: LandingHeader, HeroSection, HowItWorksSection, PrivacySection, LandingFooter)

**Analog:** `src/components/UploadZone.tsx`

**Why:** Both are full-viewport layout components using inline styles with CSS custom-property tokens, an `h1` heading, `<button>` CTAs with `onMouseEnter`/`onBlur` focus rings, inline SVG icons with `aria-hidden`, and Zustand store selectors at the top.

**Imports pattern** (`UploadZone.tsx` lines 1–6):
```tsx
import { useState, useRef, useCallback } from 'react'
import { useDocumentStore } from '../store/documentStore'
```
Landing sub-sections only need `useDocumentStore` (for `startSigning`/`goToLanding`) and `BUY_ME_A_COFFEE_URL` from `../config`.

**Inline-style token pattern** (`UploadZone.tsx` lines 159–175 and 187–203):
```tsx
const zoneStyle: React.CSSProperties = {
  minHeight: 'calc(100dvh - 56px)',
  backgroundColor: 'var(--color-surface)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px 16px',
}
const browseButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'var(--color-accent)',
  color: '#FFFFFF',
  fontSize: '14px',
  fontWeight: 400,
  padding: '8px 16px',
  borderRadius: '6px',
  minHeight: '44px',
  border: 'none',
  fontFamily: 'inherit',
}
```
Landing CTAs use the same `--color-accent` button shape. Section cards use `--color-surface-elevated`, `--color-border`. Never invent new hex values — use only the eight tokens from `src/index.css`:
`--color-surface`, `--color-surface-elevated`, `--color-canvas`, `--color-accent`, `--color-destructive`, `--color-text-primary`, `--color-text-secondary`, `--color-border`.

**Heading pattern** (`UploadZone.tsx` lines 252–263):
```tsx
<h1
  style={{
    fontSize: '20px',
    fontWeight: 600,
    lineHeight: 1.2,
    color: 'var(--color-text-primary)',
    margin: '0 0 8px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  }}
>
  Drop your document here
</h1>
```
LandingPage `h1` follows the same style object shape; font size may be larger (e.g. `32px`) to suit the hero.

**Button focus-ring pattern** (`UploadZone.tsx` lines 282–296):
```tsx
onMouseEnter={(e) => {
  (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1D4ED8'
}}
onMouseLeave={(e) => {
  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--color-accent)'
}}
onFocus={(e) => {
  e.currentTarget.style.outline = '2px solid var(--color-accent)'
  e.currentTarget.style.outlineOffset = '2px'
}}
onBlur={(e) => {
  e.currentTarget.style.outline = 'none'
  e.currentTarget.style.backgroundColor = 'var(--color-accent)'
}}
```
All interactive elements (CTA buttons, wordmark button, BMC link) use this exact hover + focus-ring pattern. Cast `e.currentTarget` to the correct element type (`HTMLButtonElement` or `HTMLAnchorElement`).

**Inline SVG icon pattern** (`UploadZone.tsx` lines 222–249):
```tsx
<svg
  width="48" height="48" viewBox="0 0 48 48" fill="none"
  xmlns="http://www.w3.org/2000/svg"
  style={{ color: 'var(--color-text-secondary)' }}
  aria-hidden="true"
>
  <path d="..." stroke="currentColor" strokeWidth="2.5" ... />
</svg>
```
Privacy/lock icon in PrivacySection follows this shape. `aria-hidden="true"` on all decorative SVGs.

**Landmark / semantic HTML pattern** (`UploadZone.tsx` line 207, `TopBar.tsx` line 47):
```tsx
<div role="region" aria-label="Document upload area">   // UploadZone
<header style={{ ... }}>                                 // TopBar
```
LandingPage uses `<header>` (LandingHeader), `<main>` (content sections), `<footer>` (LandingFooter). Each section gets an `aria-label` or a heading that labels it. The landing `h1` must be present and unique on the page.

**CTA as `<button>`, not `<a>`** — enforced by Pitfall 5 in RESEARCH.md. CTAs call `setView('empty')` (a Zustand state change). Only the BMC link is an `<a>`. Example from `TopBar.tsx` line 165–198:
```tsx
<button
  onClick={handleOpenAnother}
  style={{ background: 'none', border: 'none', cursor: 'pointer', ... }}
  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-accent)' }}
  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-secondary)' }}
  onFocus={(e) => { e.currentTarget.style.outline = '2px solid var(--color-accent)'; e.currentTarget.style.outlineOffset = '2px' }}
  onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
  aria-label="Open another document"
>
  Open another
</button>
```

---

### `src/config.ts` (new constants module)

**Analog:** none in the codebase. Pattern from RESEARCH.md Pattern 5:
```typescript
/**
 * Buy Me a Coffee support link.
 * Replace PLACEHOLDER with your actual BMC handle before deploying.
 * This is a plain navigation <a> href — no script is loaded.
 */
export const BUY_ME_A_COFFEE_URL = 'https://www.buymeacoffee.com/PLACEHOLDER'
```
This is a bare named export — no class, no default export, no object wrapper. Used only as `href` on an `<a>` element in `LandingFooter.tsx`.

---

### `src/store/documentStore.ts` (modify in-place)

**Analog:** itself. Current state to extend:

**Current ViewState + initial view** (lines 3, 57):
```typescript
export type ViewState = 'empty' | 'loading' | 'error' | 'loaded'
// ...
view: 'empty',
```
**Change to:**
```typescript
export type ViewState = 'landing' | 'empty' | 'loading' | 'error' | 'loaded'
// ...
view: 'landing',
```

**Current action pattern** (lines 67–68) — copy this shape for the two new actions:
```typescript
setView: (view) => set({ view }),
loadDocument: (url) => set({ docUrl: url, view: 'loading', errorMessage: null }),
```
**New actions (same shape):**
```typescript
startSigning: () => set({ view: 'empty' }),
goToLanding: () => set({ view: 'landing' }),
```

**Current reset** (lines 81–92) — must stay returning `'empty'`, not `'landing'`:
```typescript
reset: () =>
  set({
    view: 'empty',
    docUrl: null,
    numPages: null,
    currentPage: 1,
    errorMessage: null,
    originalPdfBytes: null,
    fileName: null,
    exportError: null,
    zoom: 1.0,
  }),
```
Do not change `reset`. Add `startSigning` and `goToLanding` to the `DocumentStore` interface and the `create()` body.

---

### `src/App.tsx` (modify in-place)

**Analog:** itself. Current view-switch pattern (lines 50–61):
```tsx
<TopBar />
<ExportErrorBanner />
{view === 'empty' && <UploadZone />}
{view === 'loading' && <LoadingSpinner />}
{view === 'error' && <ErrorBanner />}
{view === 'loaded' && <DocumentViewer />}
<SignatureDrawModal />
<InitialsDrawModal />
```
**Replace with** (per RESEARCH.md Pattern 2):
```tsx
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
```
The JSDoc comment at lines 13–32 must be updated to include `'landing'` in the state machine description.

---

### `src/components/TopBar.tsx` (modify in-place)

**Analog:** itself. Current wordmark (lines 61–71):
```tsx
<span
  style={{
    fontSize: '24px',
    fontWeight: 600,
    lineHeight: 1.1,
    color: 'var(--color-text-primary)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  }}
>
  FreeESign
</span>
```
**Replace with a `<button>`** using the ghost-button pattern from lines 165–198 (`Open another`):
```tsx
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

---

### `index.html` (modify in-place)

**Current broken favicon line** (confirmed by RESEARCH.md — `public/vite.svg` does not exist):
```html
<link rel="icon" type="image/svg+xml" href="/vite.svg" />
```
**Replace with** (Option B from RESEARCH.md Pattern 6):
```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<meta name="description" content="Sign PDFs and images in your browser. No uploads, no accounts, no tracking. Free for everyone." />
```
`lang="en"` is already present. `<title>` already reads `FreeESign — ...`. No OG meta in Phase 5 (deferred). Do not add any `<script src="https://...">` or `<link href="https://...">` — this would break PRV-03.

---

### `public/favicon.svg` (new file)

**Analog:** any inline SVG in `src/components/` (e.g. the upload-arrow SVG in `UploadZone.tsx` lines 222–249). Pattern: self-contained SVG, `xmlns="http://www.w3.org/2000/svg"`, no external references, no `<image>` with external `href`.

Minimal example:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <text y="24" font-size="24">✍</text>
</svg>
```
Or a simple pen-path shape using `stroke="currentColor"` convention. No external fonts, no CDN references.

---

### `vercel.json` (modify in-place)

**Current content** (confirmed in RESEARCH.md):
```json
{ "outputDirectory": "dist" }
```
**Replace with** (RESEARCH.md Pattern 7):
```json
{
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```
Do not add `"analytics"`, `"speedInsights"`, `"headers"` that load third-party scripts, or any middleware. The catch-all rewrite is the only addition.

---

### `src/test/landingPage.test.tsx` (new test)

**Analog:** `src/test/signatureDraw.test.ts`

**Why:** Same pattern — RTL `render` + `React.createElement`, `screen.getByRole`/`getByText`, `fireEvent.click`, `act`, store state assertion via `useDocumentStore.getState()`, `beforeEach` reset.

**Imports + render shape** (`signatureDraw.test.ts` lines 19–21, 115–128):
```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, fireEvent, act, cleanup } from '@testing-library/react'
import React from 'react'
// ...
it('renders role="dialog" with aria-modal and aria-labelledby', async () => {
  useFieldStore.getState().openSignatureModal()
  await act(async () => {
    const result = render(React.createElement(SignatureDrawModal))
    container = result.container
  })
  expect(screen.getByRole('dialog')).toBeInTheDocument()
})
```

**Landing test shape to follow:**
```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import React from 'react'
import { useDocumentStore } from '../store/documentStore'

describe('LandingPage', () => {
  beforeEach(() => {
    useDocumentStore.getState().goToLanding()
  })

  it('renders when view === landing', async () => {
    const { LandingPage } = await import('../components/LandingPage')
    await act(async () => { render(React.createElement(LandingPage)) })
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })

  it('CTA click transitions view to empty', async () => {
    const { LandingPage } = await import('../components/LandingPage')
    await act(async () => { render(React.createElement(LandingPage)) })
    const cta = screen.getByRole('button', { name: /sign a document|get started|start signing/i })
    fireEvent.click(cta)
    expect(useDocumentStore.getState().view).toBe('empty')
  })
})
```
Use `screen.getByRole` (by landmark/heading/button) over `getByTestId`. Always `await act(async () => { ... })` around renders that trigger async effects.

---

### `src/test/privacyGuard.test.ts` (new test)

**Analog:** `src/test/documentStore.test.ts` for the overall `describe/it/expect` shape. The file-reading pattern is new — uses Node.js `fs` APIs available in Vitest's Node environment.

**fs-read shape** (no analog in codebase; from RESEARCH.md Pattern 4):
```typescript
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '../..')
const content = readFileSync(filePath, 'utf-8')
```
`import.meta.dirname` is available in Vitest (ESM). `ROOT` points two levels up from `src/test/` to the project root.

**Critical: `xmlns` false-positive trap.** Six existing components contain `xmlns="http://www.w3.org/2000/svg"`. A naive `/https?:\/\//` regex would fail on all of them. The privacy guard regexes must be **scoped to asset-loading constructs only**:

```typescript
const ASSET_LOADING_PATTERNS = [
  { name: 'script src',            re: /<script[^>]+src=["']https?:\/\//i },
  { name: 'link href',             re: /<link[^>]+href=["']https?:\/\//i },
  { name: 'img src external',      re: /<img[^>]+src=["']https?:\/\//i },
  { name: 'iframe src external',   re: /<iframe[^>]+src=["']https?:\/\//i },
  { name: 'font-face external url',re: /url\(\s*["']?https?:\/\//i },
  { name: 'fetch external',        re: /fetch\s*\(\s*["']https?:\/\//i },
]
```

**Why each pattern is safe from false positives:**
- `<script[^>]+src=` — does not match `xmlns=` or `<a href=`
- `<link[^>]+href=` — does not match `<a href=` (anchor BMC link is safe)
- `url(https://` — does not match `xmlns="http://..."`
- `fetch("https://` — does not match bare string constants like `BUY_ME_A_COFFEE_URL = 'https://...'`

**Files to scan** (skip `src/test/` — test mocks contain `blob:http://localhost/`):
```typescript
function collectFiles(dir: string, exts: string[]): string[] {
  for (const entry of readdirSync(dir)) {
    // skip: test (mock URLs), node_modules, dist (false positives from bundled deps)
    if (['test', 'node_modules', 'dist'].includes(entry)) continue
    // ...recurse or push
  }
}
// Scan: index.html + src/**/*.{ts,tsx,css} (excluding src/test/)
```

---

### `src/test/documentStore.test.ts` (modify in-place)

**Two precise changes only:**

**Change 1 — line 10–12** (initial view assertion):
```typescript
// BEFORE:
it('has initial state of empty view', () => {
  const state = useDocumentStore.getState()
  expect(state.view).toBe('empty')

// AFTER:
it('has initial state of landing view', () => {
  const state = useDocumentStore.getState()
  expect(state.view).toBe('landing')
```

**Change 2 — add new test after line 21** (new `goToLanding` action):
```typescript
it('goToLanding sets view to landing', () => {
  const store = useDocumentStore.getState()
  store.setView('empty')
  store.goToLanding()
  expect(useDocumentStore.getState().view).toBe('landing')
})
```

**Do NOT change** lines 49–67 (`reset returns to empty state`). `reset()` must return `'empty'` — this test is correct and must stay green.

**Note on `beforeEach`** (lines 5–8): the existing `beforeEach` calls `reset()`, which now returns `'empty'` — that is fine and correct. The new `'has initial state of landing view'` test asserts `store.getState().view` after `goToLanding()` is called explicitly, not relying on `beforeEach`.

Wait — re-read: the initial-state test asserts `getState()` after `beforeEach` which calls `reset()` → `'empty'`. But the test's intent is to verify the *initial* view (what you see on first load). The correct fix is to call `goToLanding()` before the assertion in that one test, or to change `beforeEach` to call `goToLanding()` instead of `reset()`. RESEARCH.md (Pitfall 2) says: rename the test and change `toBe('empty')` to `toBe('landing')`. Since `beforeEach` calls `reset()` which is now `'empty'`, the test for initial landing state must explicitly call `goToLanding()` first:

```typescript
it('has initial state of landing view', () => {
  useDocumentStore.getState().goToLanding()
  const state = useDocumentStore.getState()
  expect(state.view).toBe('landing')
  // remaining assertions unchanged
})
```

---

## Shared Patterns

### CSS Token Vocabulary
**Source:** `src/index.css` lines 4–11 (`:root` block)
**Apply to:** All new `src/components/Landing*.tsx` and `HeroSection.tsx`, etc.

```css
--color-surface: #F9FAFB;
--color-surface-elevated: #FFFFFF;
--color-canvas: #E5E7EB;
--color-accent: #2563EB;
--color-destructive: #DC2626;
--color-text-primary: #111827;
--color-text-secondary: #6B7280;
--color-border: #D1D5DB;
```
Never hardcode hex values in component inline styles — always reference via `var(--color-*)`.

### Ghost Button Pattern (wordmark + "Open another" shape)
**Source:** `src/components/TopBar.tsx` lines 165–198
**Apply to:** LandingHeader "Sign a document" button, wordmark button in TopBar
```tsx
style={{ background: 'none', border: 'none', cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }}
onFocus={(e) => { e.currentTarget.style.outline = '2px solid var(--color-accent)'; e.currentTarget.style.outlineOffset = '2px' }}
onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
```

### Primary CTA Button Pattern (accent fill)
**Source:** `src/components/UploadZone.tsx` lines 187–203 + `TopBar.tsx` lines 106–163
**Apply to:** LandingPage "Start signing" CTA, LandingHeader "Sign a document" link-style button (if styled as accent)
```tsx
style={{ backgroundColor: 'var(--color-accent)', color: '#FFFFFF', borderRadius: '6px', minHeight: '44px', border: 'none' }}
onMouseEnter → '#1D4ED8'
onMouseLeave → 'var(--color-accent)'
onFocus → outline: '2px solid var(--color-accent)', outlineOffset: '2px'
```

### Zustand Selector Pattern
**Source:** `src/components/TopBar.tsx` lines 8–13
**Apply to:** All new Landing components that call store actions
```tsx
const view = useDocumentStore((s) => s.view)
const reset = useDocumentStore((s) => s.reset)
// One selector per action — never destructure the whole store
```

### Self-Hosted Assets Only (PRV-03)
**Source:** `src/index.css` @font-face declarations (all use `/fonts/` relative paths)
**Apply to:** Every new file in Phase 5
- Fonts: `/fonts/DancingScript-Regular.ttf` etc. (already self-hosted)
- Icons: inline SVG only, no CDN icon fonts
- Favicon: `public/favicon.svg` (local path `/favicon.svg`)
- Analytics: none
- BMC: `<a href="...">` navigation only, never `<script src="...">`

---

## No Analog Found

| File | Role | Reason |
|---|---|---|
| `src/config.ts` | config | No existing constants/config module in `src/`. First one. Use bare named export pattern (single line per constant). |

---

## Metadata

**Analog search scope:** `src/components/`, `src/store/`, `src/test/`, `src/index.css`, `index.html`, `vercel.json`
**Files read:** `documentStore.ts`, `App.tsx`, `TopBar.tsx`, `UploadZone.tsx`, `signatureDraw.test.ts`, `documentStore.test.ts`, `index.css` (token lines)
**Pattern extraction date:** 2026-06-17
