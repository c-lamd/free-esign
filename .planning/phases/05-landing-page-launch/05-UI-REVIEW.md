---
phase: 5
slug: landing-page-launch
audited: 2026-06-17
baseline: 05-UI-SPEC.md (approved)
screenshots: not captured (no dev server detected)
---

# Phase 5 — UI Review

**Audited:** 2026-06-17
**Baseline:** 05-UI-SPEC.md (approved contract)
**Screenshots:** Not captured — no dev server at localhost:3000 or localhost:5173. Audit is code-only.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Design-Token Adherence | 3/4 | Hardcoded #FFFFFF, #1D4ED8, #1E40AF in CTA hover/active states — permitted-per-spec but break the "no hardcoded hex" principle |
| 2. Visual Hierarchy & Layout | 4/4 | 720px container, 36px h1, section alternation, focal point, and step rhythm all match the spec exactly |
| 3. Copywriting | 3/4 | All contracted copy matches; page `<title>` diverges from spec; BMC PLACEHOLDER not masked; step titles use `<p>` not semantic heading elements |
| 4. Accessibility | 2/4 | TopBar wordmark `<button>` missing `type="button"`; `<main>` missing `role="main"`; step titles demoted from h3 to `<p>` breaking heading hierarchy |
| 5. Consistency with Phase 1–4 | 4/4 | Inline-style token pattern, wordmark, ghost button, focus ring approach all consistent |
| 6. Responsiveness | 3/4 | Touch targets and 720px container correct; hero padding uses single value (no mobile 48px breakpoint); no CSS media queries at all |

**Overall: 19/24**

---

## Top 3 Priority Fixes

1. **TopBar wordmark `<button>` missing `type="button"`** — Without `type="button"`, any button inside a `<form>` submits the form. More critically: the prior code review flagged this as fixed, but TopBar.tsx line 65 has no `type` attribute. This is a regression against the "code review fixed: missing type=button on CTAs" claim in the scope note. Fix: add `type="button"` to the TopBar wordmark button at line 65 of TopBar.tsx.

2. **`<main>` lacks `role="main"` and `<section>` elements lack `aria-labelledby` link on `<main>` itself** — LandingPage.tsx renders `<main>` without `role="main"`. The spec declares `<main role="main">`. While `<main>` implies the landmark role implicitly in HTML5, the prior code review reportedly removed a _redundant_ `role="main"`, suggesting it was present and then removed. Verify the implicit landmark is correctly exposed. Separately: the `<main>` has no `aria-label` or `aria-labelledby`, which is fine per spec, but confirm screen-reader landmark navigation works as intended. Low severity on its own; combined with the heading-hierarchy issue below it degrades the accessible outline.

3. **Step titles use `<p>` instead of a heading element — heading hierarchy broken** — HowItWorksSection.tsx renders step titles ("Open your document", "Place your signature", "Download the signed file") as `<p>` elements styled at 20px/600. The page heading hierarchy is h1 (hero) → h2 (section headings). Step titles visually look like headings but are invisible to screen-reader heading navigation. The spec does not explicitly mandate h3 for step titles ("confirm they do not appear before the h2" is the spec note, implying h3 is acceptable), but using `<p>` for visually heading-weight content is a missed accessibility opportunity and misrepresents the document outline. Fix: use `<h3>` for step titles in HowItWorksSection; they appear after h2#how-it-works-heading, so hierarchy is valid.

---

## Detailed Findings

### Pillar 1: Design-Token Adherence (3/4)

**All CSS custom property tokens are used correctly throughout.** No CSS custom properties are introduced beyond the 8 inherited tokens. Spacing matches the declared scale (4/8/16/24/32/48/64px values throughout). The 720px container and 36px hero h1 are implemented exactly. Font weights are 400 and 600 only.

**WARNING — Hardcoded hex values for CTA hover/active states:**

- HeroSection.tsx:91 — `color: '#FFFFFF'` (white text on accent button)
- HeroSection.tsx:104 — `backgroundColor: '#1D4ED8'` (hover state)
- HeroSection.tsx:111 — `backgroundColor: '#1E40AF'` (active state)
- PrivacySection.tsx:139 — `color: '#FFFFFF'`
- PrivacySection.tsx:153, 160, 163 — same #1D4ED8/#1E40AF values

The spec explicitly declares these values for hover (#1D4ED8, blue-700) and active (#1E40AF, blue-800) states, and `#FFFFFF` for CTA text. These are authored values from the spec, not token violations per se, but the project pattern of using only `var(--color-*)` tokens is broken. If the accent token ever changes, the hover/active states will diverge. These values are not registered as tokens in `src/index.css`.

Recommendation: either accept as-is (they are spec-declared values, not off-spec colors) or register `--color-accent-hover` and `--color-accent-active` tokens to maintain the token-only pattern.

**NOTE — index.html `<title>` diverges from spec:**

- Spec declares: `"FreeESign — Free, Private PDF Signing"`
- Actual (index.html:7): `"FreeESign — Sign documents privately in your browser"`

The actual title is arguably better copy, but it deviates from the approved contract. This is a copywriting/token-adherence overlap finding. Score impact: minor, already absorbed in Copywriting pillar.

**PASS — No external font CDN or stylesheet references.** PRV-03 guard is implemented in `src/test/privacyGuard.test.ts` and covers the correct patterns. The vercel.json tests for no `analytics`/`speedInsights` keys and the catch-all SPA rewrite are present.

**PASS — No hardcoded colors outside CTA states.** All backgrounds, text, and border colors use `var(--color-*)` tokens.

---

### Pillar 2: Visual Hierarchy & Layout (4/4)

**PASS — Hero focal point is strong.** Stacking order is: decorative flourish (accent color, draws eye) → h1 (36px/600, dominant) → supporting paragraphs (16px/400, secondary) → accent CTA button → reassurance line. This is the correct hierarchy for a marketing hero.

**PASS — Section rhythm alternates correctly.** HeroSection: `--color-surface` (gray-50). HowItWorksSection: `--color-surface-elevated` (white). PrivacySection: `--color-surface` (gray-50). LandingFooter: `--color-surface-elevated` (white). Matches the spec's alternating-section pattern.

**PASS — 720px container applied consistently** across LandingHeader, HeroSection, HowItWorksSection, PrivacySection, and LandingFooter.

**PASS — CTA prominence is correct.** Accent background, 48px min-height, 200px min-width. Appears once in hero and once in privacy section as the bottom repeat — single-focus pattern per spec.

**PASS — Step cards are visually coherent.** Numbered circle (40px, neutral), title, description — flex layout with 16px gap matches spec.

**PASS — Lock SVG icon is inline, 32px × 32px, aria-hidden, color via currentColor on `--color-text-secondary`.** Matches spec exactly.

---

### Pillar 3: Copywriting (3/4)

**PASS — Hero h1:** "I built this because I couldn't find a PDF signer that was actually free." — exact match.

**PASS — Hero paragraphs:** Both paragraphs match the contracted copy exactly (HeroSection.tsx:63–79).

**PASS — CTA labels:** "Start signing — it's free" (hero) and "Start signing" (privacy repeat) — exact matches.

**PASS — CTA aria-labels:** `"Start signing — opens the document uploader"` on both buttons — exact match.

**PASS — Reassurance line:** "No account needed. No uploads. Works in your browser." — exact match.

**PASS — How It Works section heading:** "How it works" — exact match.

**PASS — All three step titles and descriptions:** match contracted copy exactly.

**PASS — Privacy section heading and body:** exact matches.

**PASS — All three privacy facts:** exact matches.

**PASS — Footer wordmark, tagline, BMC text, BMC aria-label, footer note:** all exact matches.

**PASS — LandingHeader "Sign a document" button label and aria-label:** exact match.

**PASS — TopBar wordmark aria-label:** `"FreeESign — return to home"` — exact match.

**WARNING — `<title>` diverges from spec:**

- Spec: `"FreeESign — Free, Private PDF Signing"`
- Actual: `"FreeESign — Sign documents privately in your browser"`

The deviation is minor in user impact (the tab title and search-engine snippet differ), but this is a copy contract violation. The actual phrasing is more natural, so this may be an intentional improvement; if so, update the spec.

**WARNING — BMC PLACEHOLDER not masked in UI:**

The `BUY_ME_A_COFFEE_URL` constant contains `"PLACEHOLDER"` (config.ts:9). The spec states the link should be rendered with a `<!-- TODO: replace BUY_ME_A_COFFEE_URL -->` comment, and that the link must not be conditionally hidden. LandingFooter.tsx:46 has this comment. The link renders with `href="https://www.buymeacoffee.com/PLACEHOLDER"`. The test that asserts no PLACEHOLDER is intentionally skipped (`it.skip` at landingPage.test.tsx:67). This is correct pre-launch behavior per the spec. No user-facing copy is wrong; it is a deployment checklist item, not a blocking defect.

---

### Pillar 4: Accessibility (2/4)

**BLOCKER — TopBar wordmark `<button>` missing `type="button"`:**

TopBar.tsx:65 renders `<button onClick={...} aria-label="FreeESign — return to home">` with no `type` attribute. The default button type in HTML is `"submit"`, which causes form submission if this button ever appears inside a `<form>` ancestor. More importantly, the scope note for this audit states "A code review already fixed: missing type=button on CTAs" — but this fix is absent from the TopBar wordmark button. The LandingHeader "Sign a document" button (LandingHeader.tsx:40) correctly has `type="button"`. The HeroSection CTA (HeroSection.tsx:82) correctly has `type="button"`. The PrivacySection CTA (PrivacySection.tsx:131) correctly has `type="button"`. Only the TopBar wordmark is missing it.

Fix: add `type="button"` to the button at TopBar.tsx:65.

**WARNING — `<main>` rendered without `role="main"`:**

LandingPage.tsx:17 renders `<main>` (no role attribute). The spec declares `<main role="main">`. HTML5 semantics make the `<main>` element implicitly carry the `main` landmark role, so assistive technologies should still expose it correctly. However, the explicit `role="main"` was in the spec contract, the prior review noted removing a "redundant role=main", and the current code has neither. For belt-and-suspenders compliance with the spec's stated requirement, the attribute should be present.

**WARNING — Step titles use `<p>` not `<h3>`, breaking the heading outline:**

HowItWorksSection.tsx:93 — step titles ("Open your document", etc.) are `<p>` elements. The spec's heading hierarchy is h1 (hero) → h2 (section headings). Step titles are visually heading-weight (20px/600) but are invisible to heading navigation in screen readers. The spec notes step titles "if they use `<h3>` that is fine; confirm they do not appear before the h2 in DOM order" — they appear after h2#how-it-works-heading, so h3 is valid here. Using `<p>` is not semantically wrong, but it is a missed accessibility opportunity on a public marketing page.

**PASS — Landmark regions:**

- `<header>` in LandingHeader.tsx:8 — correct.
- `<main>` in LandingPage.tsx:17 — present (implicit landmark role).
- `<footer role="contentinfo">` in LandingFooter.tsx:5 — correct, explicit role.
- All `<section>` elements have `aria-labelledby` pointing to their h2 id: `hero-heading`, `how-it-works-heading`, `privacy-heading`. Correct.

**PASS — Heading hierarchy:**

One h1 (HeroSection.tsx:38, id="hero-heading"). Two h2 elements (HowItWorksSection h2#how-it-works-heading, PrivacySection h2#privacy-heading). No h2 appears before the h1 in DOM order. No h3 used (step titles are `<p>` — see warning above).

**PASS — Decorative elements aria-hidden:**

- Script flourish: `aria-hidden="true"` (HeroSection.tsx:23).
- Step number circles: `aria-hidden="true"` (HowItWorksSection.tsx:73).
- Lock SVG: `aria-hidden="true"` (PrivacySection.tsx:41).
- Privacy fact checkmark spans: `aria-hidden="true"` (PrivacySection.tsx:116).

**PASS — CTA buttons are `<button>` elements with `type="button"` (landing page CTAs):**

HeroSection CTA: `type="button"` at line 82. PrivacySection CTA: `type="button"` at line 131. LandingHeader: `type="button"` at line 41. All correct.

**PASS — BMC link is a genuine `<a>` with `rel="noopener noreferrer"` and the correct aria-label disclosing new-tab behavior** (LandingFooter.tsx:47–52).

**PASS — Focus ring pattern is implemented on all interactive elements** via onFocus/onBlur handlers setting `outline: 2px solid var(--color-accent); outline-offset: 2px`. Present in LandingHeader, HeroSection, PrivacySection, LandingFooter, and TopBar.

**PASS — Touch targets:**

- LandingHeader "Sign a document" button: `minHeight: 44px; padding: 12px 0` — meets 44px minimum.
- Hero CTA: `minHeight: 48px; minWidth: 200px` — exceeds minimum.
- Privacy CTA: `minHeight: 48px; minWidth: 200px` — exceeds minimum.
- BMC link: `minHeight: 44px; lineHeight: 44px` — meets minimum.

**PASS — `<html lang="en">` is set** (index.html:2).

**PASS — No `aria-live` regions needed.** View transitions are immediate DOM replacements; no announcement required per spec.

---

### Pillar 5: Consistency with Phase 1–4 (4/4)

**PASS — Inline-style token pattern is consistent.** All components use inline style objects with `var(--color-*)` references, matching the Phase 1–4 established pattern.

**PASS — "FreeESign" wordmark is at 24px/600** in both LandingHeader (line 30) and LandingFooter (line 21). Consistent with TopBar wordmark sizing.

**PASS — System-UI font stack** `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` is declared on every component that sets typography. Consistent.

**PASS — Ghost button pattern** for secondary actions: LandingHeader "Sign a document" button uses `background: none; border: none` with accent text color. This matches the Phase 1–4 ghost button approach.

**PASS — onMouseEnter/onMouseLeave/onFocus/onBlur imperative style mutation** for interaction states is the established Phase 1–4 pattern. No CSS-in-JS, no Tailwind state variants — consistent.

**PASS — TopBar wordmark now navigates to landing** (goToLanding() call at TopBar.tsx:69), field-leak guard applied (resetFields() called before navigation at TopBar.tsx:69). Consistent with WR-01 field-leak fix applied in Phase 2.

---

### Pillar 6: Responsiveness (3/4)

**WARNING — Hero section uses a single padding value, not the desktop/mobile split declared in the spec:**

HeroSection.tsx:13 — `padding: '64px 16px'` (always 64px vertical). The spec declares `padding: 64px 16px` desktop and `padding: 48px 16px` mobile. No CSS media queries or responsive breakpoints are used anywhere in the landing components. The single 64px value is the desktop value; on mobile the hero is taller than it should be.

The same applies to HowItWorksSection (always `48px 16px`) and PrivacySection (always `48px 16px`). The spec declares `32px 16px` mobile for both sections.

There are no CSS media queries in any landing component. Because the app uses inline styles (not Tailwind responsive utilities), responsive adaptation requires either `window.matchMedia` listeners, CSS custom properties set conditionally, or a CSS stylesheet with media queries.

**PASS — 720px container:** All sections constrain content to `maxWidth: 720px; margin: '0 auto'`. On screens narrower than 720px, `padding: 0 16px` provides horizontal margins.

**PASS — Touch targets meet minimums** (see Accessibility pillar).

**PASS — Vertical stacking of how-it-works steps** (`flexDirection: 'column'`) — works correctly on all viewport widths with no breakpoint needed. Consistent with spec's "single-column is readable on mobile and desktop without breakpoint complexity" decision.

**PASS — No horizontal overflow risk.** Step cards and the privacy card use `border-radius: 8px` and responsive widths via `flex: 1` and `maxWidth` on the container. No fixed widths that would cause overflow.

**WARNING — No `prefers-reduced-motion` guard on CTA button background transitions:**

The spec allows the `background: 0.15s` transition without a reduced-motion guard (it is a color change, not motion). This is correctly not implemented — no CSS `transition` property is set on the buttons (all state changes are via imperative `onMouseEnter`/`onMouseLeave` handlers that set `backgroundColor` immediately). No motion concern.

---

## Registry Safety

Registry audit: shadcn not initialized (`components.json` not present). No third-party registries used. Registry audit not applicable.

---

## Post-Review Verification of Prior Code-Review Fixes

The scope note states the prior code review fixed: field-leak on navigation, missing type="button" on CTAs, redundant role=main, privacy-guard soundness.

| Fix | Status | Evidence |
|-----|--------|----------|
| Field-leak on navigation (goToLanding) | CONFIRMED SOUND — TopBar.tsx:68 calls `useFieldStore.getState().resetFields()` before `goToLanding()`. LandingHeader does not show the tool view so no field state exists to leak. | TopBar.tsx:67–71 |
| `type="button"` on CTAs | PARTIALLY REGRESSED — Hero CTA, Privacy CTA, LandingHeader button: all have `type="button"`. TopBar wordmark button: missing `type="button"`. | TopBar.tsx:65 (no type attr) |
| Redundant `role="main"` | REMOVED — `<main>` in LandingPage.tsx:17 has no role attribute. The implicit landmark role is correctly exposed by the element itself. | LandingPage.tsx:17 |
| Privacy-guard soundness | CONFIRMED SOUND — `privacyGuard.test.ts` scans source tree for 6 asset-loading patterns, excludes test/ and node_modules/, vercel.json integrity tested (outputDirectory, catch-all rewrite, no analytics/speedInsights keys). | src/test/privacyGuard.test.ts |

---

## Files Audited

- `src/components/LandingPage.tsx`
- `src/components/LandingHeader.tsx`
- `src/components/HeroSection.tsx`
- `src/components/HowItWorksSection.tsx`
- `src/components/PrivacySection.tsx`
- `src/components/LandingFooter.tsx`
- `src/components/TopBar.tsx`
- `src/config.ts`
- `src/App.tsx`
- `index.html`
- `src/test/privacyGuard.test.ts`
- `src/test/landingPage.test.tsx`
- `src/store/documentStore.ts` (grep for ViewState, startSigning, goToLanding)
- `.planning/phases/05-landing-page-launch/05-UI-SPEC.md`
