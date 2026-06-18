# Phase 3 — UI Review

**Audited:** 2026-06-17
**Baseline:** 03-UI-SPEC.md (approved contract, 2026-06-17)
**Screenshots:** Not captured (no dev server detected — code-only audit)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Design-Token Adherence | 85/100 | Two off-system values: `13px` font size in ZoomControl Fit button; `#FFFFFF` hardcoded in several components instead of `var(--color-surface-elevated)` |
| 2. Visual Hierarchy & Layout | 90/100 | Hierarchy and layout match the spec; minor: FitWidth button hover shifts to accent (not text-primary as spec requires) |
| 3. Copywriting | 88/100 | All CTA strings and aria-labels match the contract with two deviations: zoom disabled labels use parentheses format instead of em-dash format; placeholder color rule missing from index.css |
| 4. Accessibility | 87/100 | `aria-pressed` passed as JS boolean instead of string; UndoRedoControls sr-only uses inline style not `.sr-only` class; "Stop placing" button missing explicit `aria-label` |
| 5. Consistency with Phase 1/2 | 92/100 | Strong consistency; "Open another" hover shifts to `--color-accent` (deviates from Phase 2 ghost-to-text-primary pattern) |
| 6. Responsiveness / Touch Targets | 93/100 | All new buttons meet 44×44px; delete button is still 24px visual (padded to 32px via padding, not 44px as WCAG 2.5.5 requires) |

**Overall: 89/100**

---

## Top 3 Priority Fixes

1. **`aria-pressed` type mismatch** — `FieldPalette.tsx:75` passes `{isArmed}` (JS boolean) not `"true"`/`"false"` (ARIA string). Some screen readers and automated axe audits reject non-string ARIA attribute values. Fix: `aria-pressed={isArmed ? 'true' : 'false'}`.

2. **Zoom disabled-state aria-labels diverge from copywriting contract** — `ZoomControl.tsx:86,147` uses `"Zoom out (already at minimum)"` and `"Zoom in (already at maximum)"` but the spec declares `"Zoom out — already at minimum zoom"` and `"Zoom in — already at maximum zoom"` (em-dash, "zoom" suffix). Inconsistent with the aria-label pattern used on every other disabled control in Phase 1/2/3. Fix: update both strings to match the contract exactly.

3. **`input::placeholder` color rule absent from `src/index.css`** — The spec (line 205) requires `input::placeholder { color: var(--color-text-secondary); }` to be added to `index.css` so the "Type here" placeholder in text fields renders at `--color-text-secondary`. Without it the placeholder inherits the browser default (gray-400 in Chrome, lighter than `--color-text-secondary`), degrading contrast consistency. Fix: add the one-line rule to `src/index.css`.

---

## Detailed Findings

### Pillar 1: Design-Token Adherence (85/100)

**Off-system font size — WARNING**
`ZoomControl.tsx:196` sets `fontSize: '13px'` on the Fit button. The type scale permits only 14px (label), 16px (body), 20px (heading), and 24px (display). 13px is off the declared scale.
Fix: change to `fontSize: '14px'` (label size, matching the rest of the zoom control readout).

**Hardcoded `#FFFFFF` instead of token — MINOR**
`InitialsDrawModal.tsx:197` uses `background: '#FFFFFF'` on the canvas container. The token is `var(--color-surface-elevated)`. Does not break anything visually today since both resolve to white, but it bypasses the token system and would break if the elevated surface token is ever changed.
Fix: replace with `backgroundColor: 'var(--color-surface-elevated)'`.

**All color tokens used correctly everywhere else.** No `--color-destructive` on the WordDocBanner (correct), no accent on zoom fill (correct), armed palette button uses accent (correct). The 8-token system is otherwise respected.

---

### Pillar 2: Visual Hierarchy & Layout (90/100)

**FitWidth button hover color deviates from spec — WARNING**
`ZoomControl.tsx:210` sets hover to `var(--color-accent)`. The spec (Interaction States table, FitWidthButton Hover) states `--color-text-primary`. Accent hover is reserved for the zoom +/- glyph icons (spec item 12), not the Fit label.
Fix: change `onMouseEnter` on the Fit button from `var(--color-accent)` to `var(--color-text-primary)`.

**Layout, spacing, and hierarchy are otherwise correct.** TopBar right-slot order matches the spec exactly: `[Undo][Redo] | [Sig][Init][Date][Txt][Chk] | [Download PDF][Open another]`. Separators use correct 1px/20px/4px-margin spec. ZoomControl pill positioned left of PageNav with fixed bottom:24px. Checkbox ✕ scales with widget via `Math.min(cssHeight * 0.7, cssWidth * 0.7)` per spec.

---

### Pillar 3: Copywriting (88/100)

**Zoom disabled aria-label strings diverge from contract — WARNING**
- Built: `"Zoom out (already at minimum)"` / `"Zoom in (already at maximum)"`
- Spec: `"Zoom out — already at minimum zoom"` / `"Zoom in — already at maximum zoom"`

The contract uses an em-dash separator and appends "zoom" for clarity, matching the pattern of every other disabled-state label in the codebase (`"Undo — nothing to undo"`, `"Download PDF — place at least one field first"`). The parenthetical form is a stylistic inconsistency.
Files: `ZoomControl.tsx:86, 147`.

**`input::placeholder` rule absent — WARNING**
The copywriting contract specifies placeholder text "Type here" in `--color-text-secondary`. The CSS rule to enforce this color (`input::placeholder { color: var(--color-text-secondary); }`) is missing from `src/index.css` (verified: only 22 lines present). The placeholder currently renders at the browser default color, which is inconsistent with the system palette.
File: `src/index.css` (rule to add).

**All other copywriting matches contract exactly.** FieldPalette labels (sentence-case, noun-only), all placement banner strings, initials modal strings ("Draw your initials", "Draw here", "Clear canvas", "Add initials", "Discard"), undo/redo labels including disabled variants, WordDocBanner heading and body and link text — all verified against the contract.

---

### Pillar 4: Accessibility (87/100)

**`aria-pressed` boolean type — WARNING**
`FieldPalette.tsx:75`: `aria-pressed={isArmed}` passes a JS boolean. ARIA attributes are HTML attributes and must be strings. The rendered HTML will be `aria-pressed="true"` or `aria-pressed="false"` in most React serializers (React converts booleans for known ARIA attributes), but this is implementation-dependent and will fail axe's `aria-allowed-attr` rule in some configurations, and is flagged by `eslint-plugin-jsx-a11y`. The spec explicitly calls for `aria-pressed="true"` / `aria-pressed="false"` as string literals.
Fix: `aria-pressed={isArmed ? 'true' : 'false'}` (consistent with other aria-disabled string patterns in the codebase).

**UndoRedoControls sr-only uses inline style, not `.sr-only` class — MINOR**
`UndoRedoControls.tsx:140–153, 172–185`: The sr-only `<span>` elements use an inline `style` object duplicating the `.sr-only` CSS class defined in `src/index.css:14–21`. All other sr-only spans in the codebase (ZoomControl, Phase 2 components) use `className="sr-only"`. This is an inconsistency. The inline style is functionally equivalent but drifts from the Phase 1/2 pattern and means sr-only style changes must be applied in two places.
Fix: replace the inline style object with `className="sr-only"` on both spans.

**"Stop placing" button missing `aria-label` — MINOR**
`PlacementModeOverlay.tsx:80–111`: The "Stop placing" button has visible text only. No `aria-label`. The visible text is descriptive enough for sighted users, but the spec's aria convention (every interactive element has `aria-label` for screen readers, established in Phase 1) is not applied here. The button text itself is meaningful ("Stop placing") so this is low severity, but it should carry `aria-label="Stop placing fields"` for parity with the pattern.

**All other accessibility requirements met.** `aria-disabled` (not HTML `disabled`) on all disabled controls, correct per-state labels on undo/redo/zoom, keyboard INPUT/TEXTAREA guards in DocumentViewer, InitialsDrawModal focus trap and `role="dialog"` / `aria-modal` / `aria-labelledby`, WordDocBanner `role="status"` / `aria-live="polite"`, checkbox `role="img"` with descriptive `aria-label`, all new interactive elements have 2px accent focus rings.

---

### Pillar 5: Consistency with Phase 1/2 (92/100)

**"Open another" hover deviates from ghost button pattern — MINOR**
`TopBar.tsx:182–185`: On hover, "Open another" shifts to `var(--color-accent)`. All other ghost buttons in Phase 2/3 shift to `var(--color-text-primary)` on hover (confirmed in FieldPalette, UndoRedoControls, PlacementModeOverlay, InitialsDrawModal). Accent hover is reserved for the zoom icon glyph (spec item 12) and "Choose a PDF instead" link (which intentionally uses accent as a link-style element). The ghost-button hover pattern should be text-primary.
Fix: `TopBar.tsx:183` change `'var(--color-accent)'` to `'var(--color-text-primary)'`.

**All other Phase 1/2 patterns followed correctly.** Inline-style-only approach (no Tailwind utility classes for color), inline SVG icons with `aria-hidden="true"` and `focusable="false"`, `var(--color-*)` tokens throughout, 6px border-radius on interactive buttons, 4px border-radius on ghost utility buttons, react-rnd integration pattern, `onFocus/onBlur` focus ring pattern — all consistent.

---

### Pillar 6: Responsiveness / Touch Targets (93/100)

**Delete button touch target is 32px, not 44px — WARNING**
`PlacedFieldWidget.tsx:324–343`: The delete button is `width: '24px', height: '24px'` with `padding: '4px'` giving a 32×32px clickable area. WCAG 2.5.5 (Level AAA) and the spec's established pattern require 44×44px touch targets. The spec notes "Touch target: 32px × 32px transparent padding" in the comment, but that is below the 44px floor required by the spec's own Phase 1/2 conventions and the WCAG guideline cited throughout. This was noted in Phase 2 and remains unresolved.
Fix: increase padding to `padding: '10px'` to bring the touch target to 44×44px, or use a transparent pseudo-element approach.

**All other new controls meet 44×44px.** FieldPalette buttons (`minHeight: '44px', minWidth: '44px'`), UndoRedoControls (`minHeight: '44px', minWidth: '44px'`), ZoomControl buttons (`minWidth: '44px', minHeight: '44px'`), Fit button (`minWidth: '44px'` inherits from buttonBase), InitialsDrawModal buttons (`minHeight: '44px', minWidth: '44px'`). The Fit button touch-target fix that was reported in the spec notes appears to have been correctly applied.

---

## Registry Safety

Registry audit: shadcn not initialized. No third-party component registries used in Phase 3. Audit not applicable.

---

## Files Audited

- `src/index.css`
- `src/components/FieldPalette.tsx`
- `src/components/ZoomControl.tsx`
- `src/components/UndoRedoControls.tsx`
- `src/components/InitialsDrawModal.tsx`
- `src/components/WordDocBanner.tsx`
- `src/components/PlacedFieldWidget.tsx`
- `src/components/TopBar.tsx`
- `src/components/PlacementModeOverlay.tsx`
- `src/components/DocumentViewer.tsx` (partial — keyboard handler section)
- `.planning/phases/03-full-field-types-workspace-controls/03-UI-SPEC.md`
