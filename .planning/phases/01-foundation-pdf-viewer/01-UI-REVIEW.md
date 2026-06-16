# Phase 1 — UI Review

**Audited:** 2026-06-16
**Baseline:** 01-UI-SPEC.md (approved design contract)
**Screenshots:** Not captured (no dev server running — code-only audit)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | All spec strings match exactly; error variants, CTAs, aria-labels all correct |
| 2. Visuals | 3/4 | Drag-over tint is background-swap not overlay; minor visual deviation from spec |
| 3. Color | 4/4 | All 8 tokens declared correctly; accent used on exactly 4 reserved elements only |
| 4. Typography | 4/4 | Exactly 4 sizes and 2 weights used; all line heights match spec |
| 5. Spacing | 3/4 | One off-scale value: 12px margin on "or" paragraph (spec scale has no 12px step) |
| 6. Experience Design | 3/4 | All 4 states covered; a11y nearly complete; LoadingSpinner mixes Tailwind + inline styles inconsistently |

**Overall: 21/24**

---

## Top 3 Priority Fixes

1. **Off-scale 12px spacing on "or" paragraph** (`src/components/UploadZone.tsx:238`) — Breaks spacing contract; sets a precedent for arbitrary values. Change `margin: '0 0 12px'` to `margin: '0 0 8px'` (sm token) or `margin: '0 0 16px'` (md token). Either reads correctly visually; 8px is closer to the current compact treatment.

2. **Drag-over background replaces surface color instead of overlaying it** (`src/components/UploadZone.tsx:131-133`) — The spec states "slight white overlay tint (background rgba(255,255,255,0.4))" on top of the existing `--color-surface` backdrop. The implementation replaces `--color-surface` with the rgba value directly, changing the visible color from a tinted gray-50 to near-white, which is a stronger visual change than intended. Fix by keeping `backgroundColor: 'var(--color-surface)'` and adding a CSS pseudo-element or wrapping the overlay in an absolutely-positioned `<div>` with `rgba(255,255,255,0.4)` background, or by computing the composited value (`#f8f9fa`-ish blended result) as a fallback fixed color.

3. **LoadingSpinner mixing Tailwind utility classes with inline styles** (`src/components/LoadingSpinner.tsx:4,17`) — All other components use pure inline styles; `LoadingSpinner` uses `className="flex items-center justify-center"` and `className="animate-spin"`. This is not a visual defect but creates a maintenance inconsistency — if Tailwind v4 config changes or the class is purged, the spinner layout and animation break silently while all other components remain unaffected. Migrate to `style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}` and a CSS `@keyframes` spin animation in `index.css` for consistency.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)

Every string in the copywriting contract matches the implementation exactly:

| Contract string | Location | Match |
|---|---|---|
| "Browse files" | UploadZone.tsx:267 | PASS |
| "Drop your document here" | UploadZone.tsx:228 | PASS |
| "or" | UploadZone.tsx:239 | PASS |
| "Your files never leave your browser." | UploadZone.tsx:298 | PASS |
| "Could not open file" | ErrorBanner.tsx:93 | PASS |
| "Try another file" | ErrorBanner.tsx:143 | PASS |
| Corrupt file error body | ErrorBanner.tsx:107 + DocumentViewer.tsx:149 | PASS |
| Wrong type error body | UploadZone.tsx:39 | PASS |
| Too large error body | UploadZone.tsx:45 | PASS |
| "Open another" | TopBar.tsx:72 | PASS |
| "Previous page" aria-label | PageNavigation.tsx:76 | PASS |
| "Next page" aria-label | PageNavigation.tsx:149 | PASS |
| Page indicator "1 / N" format | PageNavigation.tsx:145 | PASS — renders `{currentPage} / {numPages}` |

No generic labels ("Submit", "OK", "Cancel") found anywhere. Voice is calm and non-alarmist. Privacy line has no exclamation mark. Errors name the problem and give the user a next step.

### Pillar 2: Visuals (3/4)

**WARNING — Drag-over tint implementation deviates from spec:**
- Spec: "slight white overlay tint (background rgba(255,255,255,0.4))" over the existing `--color-surface` (#F9FAFB) backdrop
- Actual: `backgroundColor` is replaced with `rgba(255, 255, 255, 0.4)` directly (`UploadZone.tsx:132`), which renders as near-white rather than a light tint over gray-50. The composited appearance is more dramatic than "slight."

**Passes:**
- Upload icon: 48x48 SVG, `color: var(--color-text-secondary)`, `aria-hidden="true"` — correct
- Upload icon margin-bottom: 16px (md) — correct
- Error icon: 16px SVG, `var(--color-destructive)` — correct
- LoadingSpinner: 32px SVG, `stroke="var(--color-accent)"` — correct
- Page shadow: `0 2px 8px rgba(0,0,0,0.12)` — matches spec exactly
- Error card: `borderLeft: '4px solid var(--color-destructive)'`, white bg, 6px radius, 16px padding — correct
- PageNavigation pill: white bg, 20px radius, `0 2px 8px rgba(0,0,0,0.15)` shadow, 8px/16px padding — matches spec exactly
- Visual hierarchy is clear: 24px wordmark > 20px headings > 16px body > 14px labels

### Pillar 3: Color (4/4)

All 8 CSS custom properties declared in `src/index.css:3-11` with correct values:

| Token | Spec | Actual | Match |
|---|---|---|---|
| `--color-surface` | #F9FAFB | #F9FAFB | PASS |
| `--color-surface-elevated` | #FFFFFF | #FFFFFF | PASS |
| `--color-canvas` | #E5E7EB | #E5E7EB | PASS |
| `--color-accent` | #2563EB | #2563EB | PASS |
| `--color-destructive` | #DC2626 | #DC2626 | PASS |
| `--color-text-primary` | #111827 | #111827 | PASS |
| `--color-text-secondary` | #6B7280 | #6B7280 | PASS |
| `--color-border` | #D1D5DB | #D1D5DB | PASS |

**Accent usage audit** — spec reserves accent for exactly 4 elements:
1. Browse button background — `UploadZone.tsx:162` — CORRECT
2. Drag-over border — `UploadZone.tsx:139` — CORRECT
3. Prev/next focus ring — `PageNavigation.tsx:97, 170` — CORRECT
4. Spinner stroke — `LoadingSpinner.tsx:22` — CORRECT

Accent also appears on `TopBar "Open another"` hover (`TopBar.tsx:57`) and `ErrorBanner "Try another file"` text (`ErrorBanner.tsx:134`) and `ErrorBanner` focus ring, and `UploadZone` browse button focus ring — these are interaction-state uses, not baseline color application. The spec allows accent on hover/focus for the retry action and the "Open another" hover; this is within the spirit of the spec's interaction states table.

**Hardcoded hex values:**
- `#FFFFFF` at `UploadZone.tsx:162` — white text on accent button; equivalent to `--color-surface-elevated`; acceptable as it's a standard invariant white
- `#1D4ED8` at `UploadZone.tsx:249` — blue-700 hover state on Browse button; spec explicitly requires this for BrowseButton:Hover state — CORRECT

No other hardcoded colors. No rgb() values. 60/30/10 distribution is achieved: gray-50 surface dominates, white elevated surfaces are secondary, accent appears only on CTAs and interaction states.

### Pillar 4: Typography (4/4)

Font sizes in use across all components:
- 24px / 600 — wordmark (`TopBar.tsx:29-30`) — matches Display role
- 20px / 600 — upload heading, error heading (`UploadZone.tsx:220`, `ErrorBanner.tsx:85`) — matches Heading role
- 16px / 400 — "or" prompt, privacy line, error body (`UploadZone.tsx:235,294`, `ErrorBanner.tsx:100`) — matches Body role
- 14px / 400 — browse button, "Open another", page indicator, retry link (`UploadZone.tsx:163`, `TopBar.tsx:47`, `PageNavigation.tsx:138`, `ErrorBanner.tsx:131`) — matches Label role

Exactly 4 sizes, exactly 2 weights — within the ≤4/≤2 contract. No 3rd weight found anywhere.

Line heights:
- Wordmark: 1.1 — matches spec
- Headings: 1.2 — matches spec
- Body: 1.5 — matches spec
- Labels: 1.4 — matches spec (PageNavigation indicator explicitly sets 1.4)

Font family applied inline in `App.tsx:31` for the root container and duplicated in `UploadZone.tsx:225` (heading only). `TopBar.tsx:33` also repeats it. This is redundant but not incorrect — the root container sets the family for all children and the per-element declarations are redundant overrides of the same value.

### Pillar 5: Spacing (3/4)

**WARNING — Off-scale 12px value:**
- `UploadZone.tsx:238`: `margin: '0 0 12px'` on the "or" paragraph. The spec spacing scale contains xs=4, sm=8, md=16, lg=24, xl=32, 2xl=48. There is no 12px step. This is the only off-scale value found.

All other spacing values observed:
- 4px: not found (xs not needed in Phase 1 — acceptable)
- 8px: `ErrorBanner.tsx:53` (card gap), `PageNavigation.tsx:69` (pill gap), `TopBar.tsx:48` (button padding), `UploadZone.tsx:164` (browse button v-padding) — correct (sm)
- 16px: TopBar h-padding, card padding, browse button h-padding, error container padding — correct (md)
- 24px: Document canvas top/bottom padding, page gap, privacy line margin-top, zone vertical padding — correct (lg)

No arbitrary `[Npx]` or `[Nrem]` Tailwind values found in source (only inline styles are used; Tailwind is used minimally in LoadingSpinner). The `maxWidth: '480px'` content column and `maxWidth: '900px'` document viewer are layout constraints, not spacing tokens — acceptable.

**Touch targets:**
- Browse button: `minHeight: '44px'` — PASS
- "Open another" button: `minHeight: '44px'` — PASS
- Prev/next buttons: `minWidth: '44px', minHeight: '44px'` — PASS
- "Try another file" button: `minHeight: '44px'` — PASS

### Pillar 6: Experience Design (3/4)

**State coverage — all 4 states implemented:**
- `empty` → UploadZone renders — PASS
- `loading` → LoadingSpinner renders — PASS
- `error` → ErrorBanner renders — PASS
- `loaded` → DocumentViewer renders — PASS

**Accessibility audit:**
- `role="region"` + `aria-label="Document upload area"` on UploadZone — PASS
- `role="alert"` on ErrorBanner card — PASS
- `role="status"` + `aria-label="Loading document"` on LoadingSpinner — PASS (bonus, not required by spec)
- `aria-live="polite"` on page indicator — PASS
- `aria-atomic="true"` on page indicator — PASS (bonus)
- `aria-disabled="true"` (not `disabled`) on prev/next at boundaries — PASS
- Both `aria-label` and `.sr-only` span on prev/next buttons — PASS
- `.sr-only` class defined in `index.css:14-21` with correct properties — PASS
- File input `aria-hidden="true"`, `tabIndex={-1}`, visually hidden — PASS
- Focus rings via `onFocus`/`onBlur` handlers throughout — PASS

**WARNING — LoadingSpinner uses Tailwind classes inconsistently:**
`LoadingSpinner.tsx:4` uses `className="flex items-center justify-center"` and `className="animate-spin"`. Every other component in the codebase uses inline styles exclusively. `animate-spin` is a Tailwind utility that applies a CSS keyframe animation. If the project ever tree-shakes or purges unused classes (Tailwind v4 does this), or if the component is used in isolation, the Tailwind dependency must be active. This is a consistency violation, not a correctness defect today — but it creates fragility.

**Minor concern — BrowseButton focus ring on accent background:**
The focus ring is `2px solid var(--color-accent)` applied via `onFocus` (`UploadZone.tsx:256-257`). Since the button background is also `--color-accent`, the ring blends into the button edge. However, `outlineOffset: '2px'` pushes the outline 2px outside the button boundary, where it appears against the white page background. This is visually acceptable per the spec's `2px offset` requirement, but the ring may not be perceptible if the user backgrounds change.

**Destructive actions:** None in Phase 1 — correct per spec.
**Confirmation dialogs:** None needed in Phase 1 — correct per spec.
**Error boundaries:** Not implemented at the React component tree level (no `<ErrorBoundary>`). In-flow errors are handled by the Zustand state machine through `setError()`. This is acceptable for Phase 1 given the contained scope, but a runtime React render error (unrelated to PDF parsing) would produce a blank screen. Low risk for Phase 1 surface.

---

## Registry Safety

Registry audit: shadcn not initialized (`components.json` absent). No third-party registries used. Audit skipped — not applicable.

---

## Files Audited

- `src/index.css`
- `src/App.tsx`
- `src/components/TopBar.tsx`
- `src/components/UploadZone.tsx`
- `src/components/ErrorBanner.tsx`
- `src/components/DocumentViewer.tsx`
- `src/components/LazyPage.tsx`
- `src/components/PageNavigation.tsx`
- `src/components/LoadingSpinner.tsx`
- `.planning/phases/01-foundation-pdf-viewer/01-UI-SPEC.md`
- `.planning/phases/01-foundation-pdf-viewer/01-CONTEXT.md`
- `.planning/phases/01-foundation-pdf-viewer/01-01-SUMMARY.md`
- `.planning/phases/01-foundation-pdf-viewer/01-03-SUMMARY.md`
- `.planning/phases/01-foundation-pdf-viewer/01-04-SUMMARY.md`
