---
phase: 04-typed-signatures-signature-persistence
plan: "03"
subsystem: modal-ui/saved-items-panel
tags: [tabbed-modal, typed-signature, saved-items, savedItemCard, idb-hydration, aria, tdd]
dependency_graph:
  requires:
    - src/store/fieldStore.ts#SavedItem
    - src/store/fieldStore.ts#armedTypedPayload
    - src/store/fieldStore.ts#savedItems-slice
    - src/store/fieldStore.ts#loadSavedItems
    - src/store/fieldStore.ts#addSavedItem
    - src/store/fieldStore.ts#deleteSavedItem
    - src/lib/fonts.ts
  provides:
    - src/components/SavedItemCard.tsx
    - src/components/SignatureDrawModal.tsx#tabbed-Saved-Draw-Type
    - src/components/InitialsDrawModal.tsx#tabbed-Saved-Draw-Type
    - src/App.tsx#loadSavedItems-on-mount
  affects:
    - src/test/signatureDraw.test.ts (updated Draw-tab copy, added Type-tab + SavedItemCard tests)
tech_stack:
  added: []
  patterns:
    - "Tabbed modal pattern: role=tablist, roving tabindex, Left/Right arrow nav (ARIA tabs widget)"
    - "Font picker as role=radiogroup with 3 role=radio cards showing script font preview"
    - "aria-disabled (not HTML disabled) on Type/Saved CTAs until content is ready"
    - "Save-for-reuse: optimistic addSavedItem with non-blocking failure copy (T-04-11)"
    - "SavedItemCard: role=radio, stopPropagation delete, drawn-img vs typed-text-in-font branches"
    - "App.tsx useEffect hydration with stable Zustand selector as dep"
key_files:
  created:
    - src/components/SavedItemCard.tsx
  modified:
    - src/components/SignatureDrawModal.tsx
    - src/components/InitialsDrawModal.tsx
    - src/App.tsx
    - src/test/signatureDraw.test.ts
decisions:
  - "SignatureDrawModal defaults to Draw tab (preserves Phase 2/3 behavior as default path)"
  - "Tab panels use HTML hidden attribute to preserve canvas DOM while inactive"
  - "Font picker duplicate label approach: script-font span (visual) + system-ui span (label for AT)"
  - "saveError state: non-blocking per T-04-11; error copy shown inline, confirm still proceeds"
  - "vi.mock('idb-keyval') added at module-top in signatureDraw.test.ts (fieldStore transitively imports idb-keyval)"
  - "Existing Draw-tab regression test aria-labels updated from 'Add signature' to 'Use signature' per UI-SPEC copywriting contract"
metrics:
  duration: "~7 min"
  completed: "2026-06-17"
  tasks_completed: 3
  files_changed: 5
---

# Phase 4 Plan 03: Modal UI + Saved Items Panel Summary

**One-liner:** Tabbed Saved/Draw/Type modals for both signature and initials (role=tablist, roving focus, ARIA); SavedItemCard thumbnail component; App.tsx mount hydration; Type-tab and SavedItemCard isolated tests added.

## What Was Built

### Task 1: SavedItemCard component + App mount hydration

Created `src/components/SavedItemCard.tsx`:
- `role="radio"`, `aria-checked={isSelected}`, roving `tabIndex` (0 when selected, -1 otherwise)
- **Drawn item branch**: `<img>` thumbnail with `objectFit: contain`
- **Typed item branch**: centered `<div>` with `fontFamily: item.fontFamily` — text node, never `dangerouslySetInnerHTML` (T-04-09)
- Caption: "Drawn" or "Typed" at Label size in `--color-text-secondary`
- Absolute top-right delete button: 20px visual / extended touch via padding, `var(--color-destructive)` circle, hover `#B91C1C`, focus ring; `aria-label` + `<span class="sr-only">`
- `onClick` on card body calls `onSelect(item.id)`; delete button calls `e.stopPropagation()` then `onDelete(item.id)` so deleting does NOT also select

Modified `src/App.tsx`:
- Added `import { useEffect }` and `import { useFieldStore }`
- `const loadSavedItems = useFieldStore((s) => s.loadSavedItems)`
- `useEffect(() => { loadSavedItems() }, [loadSavedItems])` — fires once on mount; Zustand action selectors are stable so deps array is safe (SIG-04)

### Task 2: Rewrite SignatureDrawModal into tabbed Saved/Draw/Type modal

Extended `src/components/SignatureDrawModal.tsx` — kept the modal shell (scrim, dialog, focus trap, Escape, focus restore) completely unchanged.

**New additions:**
- Local state: `activeTab`, `typedText`, `selectedFont`, `saveForReuse` (default `true`), `selectedSavedId`, `saveError`
- `role="tablist"` (aria-label "Signature creation methods") with 3 `role="tab"` buttons; roving tabindex; Left/Right arrow `onKeyDown`
- Each panel is `role="tabpanel"` with `id="sig-panel-{tab}"`, `hidden={activeTab !== tab}`
- **Type panel**: full-width name `<input>` (`aria-label="Your name for signature"`, `maxLength={100}`, controlled); `role="radiogroup"` font picker of 3 `role="radio"` cards with script-font preview; live-preview box (`aria-live="polite"`); save-for-reuse checkbox; "Use signature" CTA `aria-disabled` until text present
- **Draw panel**: unchanged canvas flow + save-for-reuse row; CTA renamed to "Use signature"
- **Saved panel**: filters `savedItems` to `kind === 'signature'`; empty state with spec copy; grid of `SavedItemCard`s; "Use signature" CTA `aria-disabled` until a card is selected
- Focus trap updated: `'button, canvas[tabindex="0"], input, [role="radio"]'`

Confirm logic:
- **Type**: builds `SavedItem`, optionally `await addSavedItem(item)` (non-blocking failure → inline error copy); `setArmedTypedPayload + setArmedFieldType('signature') + handleClose()`
- **Draw**: existing PNG path + optional `addSavedItem` with `kind: 'signature'`
- **Saved**: reads selected item; routes to `setSignatureDataUrl` or `setArmedTypedPayload` based on item shape

Modal title: "Create signature" (was "Draw your signature").

### Task 3: InitialsDrawModal + signatureDraw.test.ts extensions

Extended `src/components/InitialsDrawModal.tsx` — 1-for-1 mirror of SignatureDrawModal with initials substitutions:
- Title: "Create initials"; input placeholder: "Your initials"; aria-label: "Your initials for signature"
- CTAs: "Use initials"; Saved panel empty heading: "No saved initials yet"
- Saved filter: `kind === 'initials'`; confirm arms `setArmedTypedPayload({ ..., kind: 'initials' }) + setArmedFieldType('initials')`
- Draw canvas 2:1 ratio preserved; `closeInitialsModal` gating preserved

Extended `src/test/signatureDraw.test.ts`:
- **`vi.mock('idb-keyval')`** added at module-top (fieldStore imports idb-keyval transitively — Pitfall 4 guard)
- **Draw-tab regression tests**: updated aria-label strings from "Add signature" → "Use signature" to match new copy; title assertion updated to "Create signature"; all assertions remain behaviorally equivalent
- **`describe('Type tab')`**: 4 tests — CTA aria-disabled when empty; CTA enabled when text present; font option aria-checked update; full Type confirm flow (armedTypedPayload + armedFieldType + modalOpen=false)
- **`describe('SavedItemCard')`**: 6 isolated render tests — drawn img branch; typed text-in-font branch; signature delete aria-label; initials delete aria-label; stopPropagation (delete calls onDelete, NOT onSelect); card body click calls onSelect; aria-checked on selected card

**Test results:** 295/295 passing (283 baseline + 12 new tests)

## Deviations from Plan

### Design Choices (within plan spec)

**1. `hidden` attribute on tab panels (not CSS `display: none`)**
- The plan did not specify the hide mechanism. Used HTML `hidden` attribute on panels.  
- This preserves the canvas element in the DOM while the Draw tab is inactive (important for `useRef`-based pad initialization to work when switching back to Draw).
- Drawback: the pad cleanup effect now guards on `activeTab !== 'draw'` in addition to `!modalOpen`. This is clean and correct.

**2. Modal defaults to `draw` tab (unchanged default behavior)**
- The plan said "default `draw` to preserve current behavior" — implemented as specified.

**3. Duplicate font label in font-picker cards**
- Font-option cards render the font name twice: once in the script font (visual preview) and once in system-ui below it (accessible label). This satisfies both the WYSIWYG preview requirement and the AT label requirement from the UI-SPEC.

**4. Draw-tab regression test copy updated**
- The existing tests used `"Add signature — draw a signature first"` and `"Add signature"` as aria-labels. Phase 4 renamed the CTA to "Use signature" per the copywriting contract. Tests updated to `"Use signature — draw a signature first"` / `"Use signature"` — this is not a test regression but a planned copy change.

## Known Stubs

None — all functionality is fully wired:
- Type flow: `setArmedTypedPayload + setArmedFieldType` → LazyPage typed drop (Plan 02) → export (Plan 02)
- Saved flow: arms via same paths as Type/Draw depending on item shape
- `loadSavedItems` on mount populates `savedItems` which flows through to the Saved panel

## Threat Flags

No new threat surfaces beyond the plan's threat model. All T-04-xx mitigations applied:
- T-04-08: `maxLength={100}` on both name inputs (SignatureDrawModal + InitialsDrawModal)
- T-04-09: all typed text rendered as JSX text nodes — confirmed in SavedItemCard and both modal preview boxes
- T-04-10: font picker is a fixed 3-option radiogroup; `selectedFont` is one of the 3 allowlisted names only
- T-04-11: `addSavedItem` failure is non-blocking; "Couldn't save this for reuse, but it's ready to place now." copy shown inline

## Self-Check: PASSED
