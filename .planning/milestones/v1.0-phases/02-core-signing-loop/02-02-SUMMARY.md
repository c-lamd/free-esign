---
phase: 02-core-signing-loop
plan: "02"
subsystem: ui
tags: [signature-pad, modal, canvas, focus-trap, react, zustand, accessibility]

dependency_graph:
  requires:
    - phase: 02-01
      provides: "useFieldStore with openModal/closeModal/setSignatureDataUrl/setPlacementMode"
    - phase: 01-foundation
      provides: "TopBar, App, component patterns, Tailwind v4 tokens, test setup"
  provides:
    - "SignatureDrawModal — signature_pad-backed centered modal with draw / clear / discard / add"
    - "TopBar Add signature trigger — ghost button calling openModal left of Open another"
    - "Canvas 2d context mock in test setup (idempotent, jsdom-safe)"
  affects: [02-03-placement, 02-04-export, Phase 3 field types]

tech-stack:
  added: []  # signature_pad@5.1.3 was installed in 02-01; this plan only consumes it
  patterns:
    - "signature_pad via useRef canvas; devicePixelRatio scaling before init (Pitfall 3)"
    - "hasStrokes state driven by beginStroke/endStroke events + pad.isEmpty()"
    - "Focus trap via Tab keydown handler; focus restore to triggerRef.current on close"
    - "aria-disabled (not disabled) on Add signature to keep focus reachable"
    - "pad.off() in useEffect cleanup (T-02-06 listener leak mitigation)"
    - "Canvas 2d mock in setup.ts: getContext('2d') + toDataURL stubs (idempotent guard)"

key-files:
  created:
    - src/components/SignatureDrawModal.tsx
    - src/test/signatureDraw.test.ts
  modified:
    - src/components/TopBar.tsx
    - src/App.tsx
    - src/test/setup.ts

key-decisions:
  - "aria-disabled on Add signature (not HTML disabled) keeps focus reachable while empty (WCAG 2.5.5)"
  - "Focus trap implemented in keydown handler on dialog div — cycles Clear canvas → Add signature → Discard → canvas"
  - "triggerRef captures document.activeElement on modalOpen=true so focus restores on close"
  - "Canvas mock installed in setup.ts as idempotent guard (_gsdCanvasMocked flag) so re-import is safe"
  - "Signature PNG exported with backgroundColor:rgba(0,0,0,0) for transparent overlay on PDF"

patterns-established:
  - "Signature modal pattern: signature_pad + useRef canvas + useEffect for devicePixelRatio scaling"
  - "Modal focus trap pattern: keydown on role=dialog div, Tab cycling among button + canvas focusable targets"
  - "canvas 2d jsdom mock: HTMLCanvasElement.prototype.getContext stub + toDataURL stub"

requirements-completed: [SIG-01]

duration: ~14min
completed: "2026-06-17"
---

# Phase 2 Plan 02: Signature Draw Modal Summary

**signature_pad canvas modal with transparent-PNG export, focus trap, aria-disabled Add signature button, and TopBar trigger — SIG-01 delivered.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-06-17T23:03:00Z
- **Completed:** 2026-06-17T23:14:00Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Centered, focus-trapped modal with `role="dialog" aria-modal="true" aria-labelledby="modal-title"` (UI-SPEC accessibility contract met exactly)
- signature_pad wired to canvas ref with devicePixelRatio scaling before init — black strokes on transparent background (rgba(0,0,0,0)) so exported PNG overlays cleanly on PDF without a white box
- `Add signature` button: `aria-disabled="true"` + 0.45 opacity when empty; becomes fully interactive after first stroke; on confirm calls `setSignatureDataUrl(pad.toDataURL('image/png'))` + `setPlacementMode(true)` + `closeModal()`
- `Discard` and `Escape` close the modal without saving; `Clear canvas` resets strokes and re-disables the button
- `pad.off()` called on useEffect cleanup (T-02-06 listener leak mitigation)
- TopBar `Add signature` ghost trigger in right slot left of `Open another`; `SignatureDrawModal` mounted unconditionally in App (self-gates on `modalOpen`)
- 12 unit tests green; full suite (154 tests / 8 files) green; `npx tsc --noEmit` clean

## Task Commits

| Task | Name | Commit | Type |
|------|------|--------|------|
| 1 | Canvas 2d context mock in setup.ts | 2bc6401 | chore |
| 2 | SignatureDrawModal component + unit tests | 7c65b48 | feat |
| 3 | TopBar Add signature trigger + App modal mount | 1564443 | feat |

## Files Created/Modified

- `src/components/SignatureDrawModal.tsx` — centered modal with signature_pad canvas, focus trap, three-button controls, aria-disabled Add signature
- `src/test/signatureDraw.test.ts` — 12 tests covering role/aria contract, isEmpty state, confirm/discard/Escape/clear behaviors, pad.off() cleanup
- `src/components/TopBar.tsx` — Add signature ghost trigger added to the right slot; buttons wrapped in flex row
- `src/App.tsx` — SignatureDrawModal imported and mounted unconditionally after view switch
- `src/test/setup.ts` — idempotent canvas 2d context + toDataURL stub for jsdom

## Decisions Made

- `aria-disabled` (not HTML `disabled`) on the Add signature button: keeps the button focusable while empty, satisfying WCAG 2.5.5 and matching the Phase 1 prev/next pattern.
- Focus trap via `keydown` on the dialog `div`: cycles `Clear canvas → Discard → Add signature → canvas`. All buttons remain Tab-reachable regardless of disabled state.
- `triggerRef.current = document.activeElement` captured on `modalOpen` effect so focus restores on close without extra prop drilling.
- Canvas mock is guarded with `_gsdCanvasMocked` flag on `HTMLCanvasElement.prototype` so repeated setup.ts imports are safe in isolation.
- Transparent background (`rgba(0,0,0,0)`) is the correct config — white background would produce a white rectangle artifact when the PNG is embedded on a PDF page.

## Deviations from Plan

None — plan executed exactly as written. All copy strings match the UI-SPEC Copywriting Contract verbatim. All accessibility requirements from the UI-SPEC Accessibility section implemented.

## Known Stubs

None — `SignatureDrawModal` is fully implemented. Confirming a drawn signature stores a real PNG data URL via `pad.toDataURL('image/png')` and arms placement mode. No placeholder data flows to rendering.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes. All processing is in-browser:

- `pad.toDataURL('image/png')` — canvas-to-memory operation; stays in Zustand
- `SignatureDrawModal` — renders via React DOM; no fetch/XHR

Threat mitigations applied per plan threat model:

| ID | Status |
|----|--------|
| T-02-04 | Mitigated: canvas capped by fixed modal max-width 560px, 3:1 height (~187px at 560px); devicePixelRatio at most doubles each dimension |
| T-02-05 | Accepted: PNG stays in Zustand memory, never uploaded; bundled deps only (PRV-01/PRV-02) |
| T-02-06 | Mitigated: `pad.off()` called in useEffect cleanup to remove all signature_pad event listeners on modal close |

## Self-Check: PASSED

Files created/modified:
- `src/components/SignatureDrawModal.tsx` — FOUND
- `src/test/signatureDraw.test.ts` — FOUND
- `src/components/TopBar.tsx` — FOUND (modified)
- `src/App.tsx` — FOUND (modified)
- `src/test/setup.ts` — FOUND (modified)

Commits:
- `2bc6401` — FOUND
- `7c65b48` — FOUND
- `1564443` — FOUND

Test suite: 154 tests / 8 files — all passing
TypeScript: `npx tsc --noEmit` — clean (exit 0)

---
*Phase: 02-core-signing-loop*
*Completed: 2026-06-17*
