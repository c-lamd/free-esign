---
phase: 4
slug: typed-signatures-signature-persistence
audited: 2026-06-17
baseline: 04-UI-SPEC.md (approved contract)
screenshots: not captured (no dev server)
---

# Phase 4 — UI Review

**Audited:** 2026-06-17
**Baseline:** 04-UI-SPEC.md (approved, checker-verified design contract)
**Screenshots:** Not captured — no dev server running at localhost:3000 or localhost:5173. Audit is code-only.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Design-token adherence | 91/100 | Spacing/color/type tokens matched precisely; one off-spec font-weight on accent CTA (400 vs expected 600 for primary action) |
| 2. Visual hierarchy & layout | 88/100 | Tab bar, font picker, saved grid all match spec; empty-state heading weight is correct (20px/600); minor: no sr-only duplicate label on SavedItemCard delete per spec pattern |
| 3. Copywriting | 79/100 | Contract copy matches on all labels, CTAs, and empty states; font-load failure inline note ("Preview font unavailable…") is absent from both modals |
| 4. Accessibility | 87/100 | ARIA tab widget, roving focus, radiogroups, aria-disabled, focus trap all implemented correctly after review-cycle fixes; one gap: PlacedFieldWidget outer wrapper missing role="img" for typed signature/initials fields |
| 5. Consistency with Phase 1–3 | 95/100 | Modal shell, scrim, ghost/accent button patterns, delete control styles, and focus ring convention match previous phases; Draw tab is unchanged from Phase 2 |
| 6. Responsiveness & touch targets | 82/100 | Tab buttons (min-height: 44px), font cards (min-height: 44px), checkbox row (min-height: 44px) all meet WCAG 2.5.5; SavedItemCard delete button hits 32px (20px + 12px padding via content-box) — matches the spec's SavedItemCard section (32px) but does NOT reach the 44px stated in the spacing-scale section; the spec itself is internally inconsistent on this point |

**Overall: 87/100**

---

## Top 3 Priority Fixes

1. **Missing font-load failure inline note** — Users who have a font blocked or a slow connection will see the live preview render in system-ui with no explanation; they may think the export is broken. The contract specifies a specific inline copy string: "Preview font unavailable — your signature will still embed correctly." Implement via `document.fonts.check()` or `FontFace.load()` detection in both `SignatureDrawModal.tsx` and `InitialsDrawModal.tsx`, show the note below the preview container when any of the three TTFs fails to load. This is the only copywriting gap blocking spec conformance.

2. **Accent CTA button font-weight is 400, not 600** — `getAccentButtonStyle()` in both modals sets `fontWeight: 400` on the primary "Use signature"/"Use initials" button (SignatureDrawModal.tsx line 405). The UI-SPEC's button pattern (inherited from Phase 2/3) uses weight 600 for primary buttons — weight 400 makes the primary action visually undifferentiated from ghost/secondary buttons. Fix: change `fontWeight: 400` to `fontWeight: 600` in `getAccentButtonStyle()` in both `SignatureDrawModal.tsx` and `InitialsDrawModal.tsx`.

3. **PlacedFieldWidget outer wrapper lacks role="img" for typed fields** — The spec at the PlacedFieldWidget section states `role="img"` on the widget wrapper for typed signature/initials with the aria-label "Placed typed signature — press Delete to remove". The code (`PlacedFieldWidget.tsx` line 331) only sets `role="img"` for `field.type === 'checkbox'`; signature and initials fields (both drawn and typed) have `role={undefined}`. While the aria-label is correctly computed via `getWrapperAriaLabel()`, the missing role means the element has no semantic landmark. Fix: set `role="img"` when `field.type === 'signature' || field.type === 'initials'`.

---

## Detailed Findings

### Pillar 1: Design-Token Adherence (91/100)

**Passing:**
- All 8 CSS custom properties declared in `src/index.css` exactly match the spec: `--color-surface: #F9FAFB`, `--color-surface-elevated: #FFFFFF`, `--color-canvas: #E5E7EB`, `--color-accent: #2563EB`, `--color-destructive: #DC2626`, `--color-text-primary: #111827`, `--color-text-secondary: #6B7280`, `--color-border: #D1D5DB`.
- `@font-face` declarations for all three fonts match spec exactly (`font-display: block`, `/fonts/` same-origin paths).
- Spacing usage: `4px` (xs), `8px` (sm), `16px` (md), `24px` (lg) tokens used correctly throughout. Accepted `12px` intra-component values (name input padding `8px 12px`, font picker `marginTop: 12px`, preview `marginTop: 12px`) are all present and match the spec's Phase 4 exception list.
- Typography: modal title is 20px/600 (Heading), tab labels are 14px/400 (Label), name input is 16px/400 (Body), empty-state heading is 20px/600, empty-state body is 16px/400 (`color: var(--color-text-secondary)`). All on-spec.
- Script fonts (Dancing Script, Great Vibes, Pacifico) are applied only to signature content (live preview, font picker sample text, saved-item typed thumbnail, PlacedFieldWidget text) — never to UI chrome. Spec boundary respected.

**Failing:**
- `getAccentButtonStyle()` in `SignatureDrawModal.tsx` line 405 and its counterpart in `InitialsDrawModal.tsx`: `fontWeight: 400`. Primary CTA buttons in Phase 2/3 used `fontWeight: 600`. The spec does not explicitly state the accent button weight in Phase 4, but the inherited system clearly uses 600. This creates a visual weight inconsistency between the primary action and ghost actions which share the same 400 weight at present.

---

### Pillar 2: Visual Hierarchy & Layout (88/100)

**Passing:**
- Tab bar layout: `display: flex; flexDirection: row; borderBottom: 1px solid var(--color-border); marginBottom: 16px` — exact spec match (`SignatureDrawModal.tsx` lines 370–376).
- Active tab: 2px solid accent bottom border, primary text color; inactive: 2px transparent border (reserves layout space to prevent shift), secondary text color. Matches spec.
- Font picker: 3 cards, `flex: 1; minWidth: 0; padding: 8px; borderRadius: 6px; gap: 4px` — matches. Each card shows font name in script font at 20px above a 14px system-ui label below. Selected card gets `2px solid var(--color-accent)`.
- Live preview: `background: var(--color-surface); borderRadius: 6px; minHeight: 72px; padding: 12px 16px` — exact spec. Placeholder "Your name" at 60% opacity when empty. Full opacity when text present.
- Saved panel: empty state centered column with heading/body; non-empty state grid `repeat(auto-fill, minmax(120px, 1fr)); gap: 8px` — matches.
- SavedItemCard: 56px thumbnail area (drawn img + typed text div), 14px caption, absolute-positioned delete button top-right.
- Controls row placement: Type panel has `Discard` + `Use signature` right-aligned; Draw panel has `Clear canvas` left-aligned + `Discard`/`Use signature` right — matches spec ASCII diagram.

**Failing:**
- `SavedItemCard.tsx` line 167: the delete button contains `<span className="sr-only">{deleteAriaLabel}</span>`. The spec says `<span class="sr-only">Delete saved signature</span>` (literal string). The implementation passes the prop value through, which is correct for reuse across signature/initials contexts — this is actually more correct than the spec example. However, the `sr-only` class is defined in `src/index.css` line 38 as a standard visually-hidden utility, and the text inside the button is `×` plus the sr-only span. Since the button already has `aria-label={deleteAriaLabel}`, the sr-only span will cause screen readers to announce the label twice ("Delete saved signature Delete saved signature"). The spec acknowledges this as the correct pattern ("dual-label pattern") but in practice the `aria-label` on the button already provides the accessible name — the sr-only span is redundant and causes double-announcement. This is a minor issue (not a blocker) but technically deviates from best practice.
- Minor: the scrim div has `aria-hidden="false"` explicitly set (`SignatureDrawModal.tsx` line 907). This is technically the default and does no harm, but the dialog's `aria-modal="true"` is sufficient to contain AT focus. The explicit `aria-hidden="false"` is harmless noise.

---

### Pillar 3: Copywriting (79/100)

**Passing:**
- Modal titles: "Create signature" / "Create initials" — correct.
- Tab labels: "Saved", "Draw", "Type" — exact strings.
- Name input placeholder: "Your name" — correct.
- Name input `aria-label`: "Your name for signature" / "Your initials for signature" — correct.
- Font picker radiogroup `aria-label`: "Choose script font" — correct.
- Font labels: "Dancing Script", "Great Vibes", "Pacifico" — correct.
- Live preview `aria-label`: "Signature preview" — correct. `aria-live="polite"` present.
- Save-for-reuse label: "Save for reuse" — correct.
- Draw tab CTA: "Use signature" / "Use initials" — correct (replaces Phase 2's "Add signature").
- Type tab CTA: "Use signature" / "Use initials" — correct.
- Disabled aria-label (draw): "Use signature — draw a signature first" / "Use initials — draw initials first" — correct.
- Disabled aria-label (type): "Use signature — type your name first" / "Use initials — type your initials first" — correct.
- Disabled aria-label (saved): "Use signature — select a saved signature first" / "Use initials — select a saved initials first" — correct.
- Empty state heading: "No saved signatures yet" / "No saved initials yet" — correct.
- Empty state body: "Create a signature in the Draw or Type tab, check 'Save for reuse', and it will appear here." — exact spec match.
- Save failure copy: "Couldn't save this for reuse, but it's ready to place now." — present as a `role="alert"` div on save error (`SignatureDrawModal.tsx` line 730). Correct.
- SavedItemCard source labels: "Drawn" / "Typed" — correct.
- Delete button aria-label: "Delete saved signature" / "Delete saved initials" — correct (passed via prop).
- PlacedFieldWidget typed aria-label: "Placed typed signature — press Delete to remove" / "Placed typed initials — press Delete to remove" — present via `getWrapperAriaLabel()`.
- "Clear canvas" button text — correct.
- "Discard" button text — correct.

**Failing:**
- **Font-load failure inline note absent** — The spec's Copywriting Contract specifies: "If a script TTF fails to load, the preview falls back to the system font with a quiet inline note: 'Preview font unavailable — your signature will still embed correctly.'" Neither `SignatureDrawModal.tsx` nor `InitialsDrawModal.tsx` implement any font-load failure detection or show this copy. Since `font-display: block` prevents a jarring flash, this failure mode is silent — the user sees their name in system-ui with no indication. The copy contract requires the note. No implementation found anywhere in `src/`.

---

### Pillar 4: Accessibility (87/100)

**Passing:**
- Tab widget ARIA: `role="tablist"` on container, `role="tab"` on each button, `aria-selected` on each tab, `aria-controls` linking to panel ids, `role="tabpanel"` on each panel with `aria-labelledby`. All present — `SignatureDrawModal.tsx` lines 922–957.
- Roving tabIndex on tab bar: active tab has `tabIndex={0}`, inactive tabs have `tabIndex={-1}`. Arrow keys cycle tabs and move DOM focus (`handleTabKeyDown`, lines 122–138).
- Font picker radiogroup: `role="radiogroup"` with `aria-label="Choose script font"`, each card has `role="radio"` and `aria-checked`. Arrow keys navigate with roving tabIndex. Space/Enter activates. Lines 602–693.
- Hidden panels: `hidden` attribute on inactive tab panels (`hidden={activeTab !== 'draw'}`). Focus trap correctly filters out elements inside `[hidden]` subtrees (line 159).
- Focus trap: `handleKeyDown` traps Tab within the dialog, wrapping at first/last focusable. Excludes elements in `[hidden]` and `[aria-hidden="true"]` subtrees (lines 141–183). Escape closes and restores focus.
- Focus restore: `triggerRef.current` captures `document.activeElement` on open; restored on close (lines 60–70, 261–268).
- Save-for-reuse checkbox: properly associated `<input id>` + `<label htmlFor>` on per-panel unique ids (WR-02 fix). Lines 423–447.
- Disabled CTAs: `aria-disabled="true"` (not HTML `disabled`) used throughout, with descriptive `aria-label` in each disabled state — correct per spec and prior phases.
- SavedItemCard: `role="radio"`, `aria-checked`, roving tabIndex, Enter/Space activates, click stopPropagation on delete button.
- `aria-modal="true"` on dialog; `aria-labelledby="modal-title"`.
- `role="alert"` on save-error message — correct for live region announcing errors.
- `aria-live="polite"` on preview container — correct.

**Failing:**
- `PlacedFieldWidget.tsx` line 331: `role={field.type === 'checkbox' ? 'img' : undefined}`. For typed signature/initials fields, the outer wrapper has an `aria-label` (provided by `getWrapperAriaLabel()`) but no `role`. An `aria-label` on a `div` with `role={undefined}` is technically valid (role="generic") but the spec explicitly states `role="img"` on the wrapper for typed fields. Without the role, some screen readers will ignore or announce the label unpredictably. Fix: add `role="img"` when the field is a signature or initials type. The non-typed signature/initials (image-backed) should also carry `role="img"` — they do not currently.
- The sr-only span inside SavedItemCard delete button duplicates the `aria-label` — causes double announcement on NVDA/VoiceOver. The sr-only text should be removed since the `aria-label` on the button is the accessible name. Alternatively, keep sr-only and remove `aria-label` (aria-label takes precedence, making sr-only redundant). Low severity.

---

### Pillar 5: Consistency with Phase 1–3 (95/100)

**Passing:**
- Modal shell: scrim `rgba(0,0,0,0.45)`, dialog `max-width: 560px`, `borderRadius: 12px`, `padding: 24px`, `boxShadow: 0 8px 32px rgba(0,0,0,0.18)` — matches Phase 2 pattern.
- Ghost button style: `background: none; border: none; fontSize: 14px; fontWeight: 400; color: var(--color-text-secondary)` with hover changing to primary — same as Phase 2/3.
- Accent button shape: `backgroundColor: var(--color-accent); color: white; padding: 8px 16px; borderRadius: 6px; minHeight: 44px` — matches.
- Delete button on PlacedFieldWidget: 24px visual, red circle, white ×, absolute top-right, `borderRadius: 50%`, hover `#B91C1C`, focus `2px solid var(--color-accent)` — unchanged from Phase 2/3.
- Focus ring pattern: `2px solid var(--color-accent); outlineOffset: 2px` implemented via `onFocus`/`onBlur` handlers on all interactive elements — consistent.
- Draw tab content: signature_pad canvas with 3:1 aspect ratio, "Sign here" hint, "Clear canvas" + "Discard" + CTA controls — unchanged from Phase 2 as required.
- `font-display: block` on all three `@font-face` declarations — matches spec and prevents FOUT in signature content.

**Failing:**
- Phase 2/3 primary buttons (the "Add signature" button in Phase 2, "Use initials" in Phase 3) used `fontWeight: 600` consistent with the design system. Phase 4 accent buttons use `fontWeight: 400` — a regression in visual weight consistency.

---

### Pillar 6: Responsiveness & Touch Targets (82/100)

**Passing:**
- Tab buttons: `minHeight: 44px` — WCAG 2.5.5 pass (spec: 44px minimum). Lines 388.
- Font picker cards: `minHeight: 44px` — pass. Line 653.
- Save-for-reuse checkbox row: `minHeight: 44px` — pass. Line 366.
- Accent CTA buttons: `minHeight: 44px; minWidth: 44px` — pass. Line 414.
- Ghost buttons: `minHeight: 44px; minWidth: 44px` — pass. Line 354.
- Modal dialog: `width: calc(100vw - 32px); maxWidth: 560px` — responsive, safe margins on narrow viewports.
- Font picker uses `flexWrap: wrap` — cards will stack to 1-per-row on very narrow viewports rather than overflowing.

**Failing:**
- SavedItemCard delete button: `width: 20px; height: 20px; padding: 6px; boxSizing: content-box` — results in a 32px × 32px touch target. The spec's SavedItemCard section says "32px × 32px visual, wrapped to 44px × 44px touch target". The spacing-scale section also says 44px for delete buttons. The implementation achieves only 32px. The spec is internally inconsistent (both 32px and 44px are cited), but the higher WCAG 2.5.5 threshold (44px) is not met. Upgrading to `padding: 12px` would reach 44px total (20 + 24 = 44px) at the cost of encroaching on the card thumbnail area. This requires a layout judgment call; flagged as WARNING not BLOCKER given the spec ambiguity.
- No explicit mobile breakpoint handling for the saved-items grid — `repeat(auto-fill, minmax(120px, 1fr))` is responsive by nature and will adapt correctly, but on very narrow viewports (< 280px) cards could be cramped. Acceptable for target browsers.

---

## Registry Safety

No shadcn, no third-party component registries. `idb-keyval@6.2.5` and `@pdf-lib/fontkit@1.1.1` are npm packages bundled by Vite. Registry audit: not applicable.

---

## Files Audited

- `src/index.css` — CSS custom properties, `@font-face` declarations, `.sr-only`
- `src/components/SignatureDrawModal.tsx` — tabbed modal, all three panels, tab keyboard nav, focus trap, save flow
- `src/components/InitialsDrawModal.tsx` — initials variant (spot-checked for parity)
- `src/components/SavedItemCard.tsx` — thumbnail card, delete button, radiogroup role
- `src/components/PlacedFieldWidget.tsx` — typed and drawn field branches, role/aria-label, delete control
- `src/lib/fonts.ts` — same-origin TTF loader, allowlist, caching
- `.planning/phases/04-typed-signatures-signature-persistence/04-UI-SPEC.md` — design contract
