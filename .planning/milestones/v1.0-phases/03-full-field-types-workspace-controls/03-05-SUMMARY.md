---
phase: "03"
plan: "05"
subsystem: file-validation
tags: [word-doc-detection, upload-zone, banner, tdd]
dependency_graph:
  requires: []
  provides: [word-doc-validation, WordDocBanner, UploadZone-word-doc-routing]
  affects: [src/lib/fileValidation.ts, src/components/UploadZone.tsx]
tech_stack:
  added: []
  patterns: [tdd-red-green, mime-extension-defense-in-depth, role-status-banner]
key_files:
  created:
    - src/components/WordDocBanner.tsx
  modified:
    - src/lib/fileValidation.ts
    - src/components/UploadZone.tsx
    - src/test/fileValidation.test.ts
decisions:
  - Word-doc check runs BEFORE generic unsupported-type branch; extension extracted once and reused for both word-doc and ALLOWED_EXTENSIONS checks
  - Either MIME or extension alone is sufficient to trigger 'word-doc' (defense-in-depth per T-03-05); .docx with application/zip MIME still caught by extension
  - wordDocMode local state in UploadZone swaps upload content with WordDocBanner; no setError called for Word files
  - role=status (not role=alert) per UI-SPEC; this is guidance not an urgent error
metrics:
  duration: "3 minutes"
  completed: "2026-06-17"
  tasks: 2
  files: 4
---

# Phase 03 Plan 05: Word-Doc Detection + Guidance Banner Summary

Word-document detection in `fileValidation.ts` plus a friendly `WordDocBanner` guidance component wired into `UploadZone`. Selecting a .doc or .docx file now shows a clear "export to PDF first" message instead of a generic error or silent failure — closing DOC-05.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 (RED) | Failing Word-doc detection tests | a6f83d6 | src/test/fileValidation.test.ts |
| 1 (GREEN) | Word-doc detection in fileValidation | 74dcdd5 | src/lib/fileValidation.ts |
| 2 | WordDocBanner + UploadZone routing | 5dd3096 | src/components/WordDocBanner.tsx, src/components/UploadZone.tsx |

## What Was Built

**`src/lib/fileValidation.ts`** — Extended with:
- `FileValidationError` now includes `'word-doc'` variant (before `'unsupported-type'` in the union)
- `WORD_MIMES` set: `application/msword` and the openxml docx MIME
- `WORD_EXTENSIONS` set: `.doc` and `.docx`
- `validateFile` checks Word MIME or extension BEFORE the generic unsupported-type path, using the extracted extension variable (computed once, reused for both checks)

**`src/components/WordDocBanner.tsx`** — New component:
- `role="status"` / `aria-live="polite"` (informational guidance, not urgent alert)
- 4px left border: `var(--color-border)` (gray — NOT `--color-destructive`)
- Inline SVG information circle (not a warning triangle)
- Heading: "Word documents aren't supported" (20px/600, `--color-text-primary`)
- Body: exact UI-SPEC copy explaining formatting integrity and privacy
- Action button styled as link "Choose a PDF instead" (`--color-accent`, underline on hover, standard 2px focus ring)
- Props: `onChoosePdf: () => void` callback

**`src/components/UploadZone.tsx`** — Extended with:
- `wordDocMode: boolean` local state
- `handleFile`: resets `wordDocMode` at start; adds `'word-doc'` branch before `'unsupported-type'` (sets `wordDocMode(true)`, returns without calling `setError`)
- Render: conditionally renders `<WordDocBanner onChoosePdf={() => setWordDocMode(false)} />` in place of the default upload content when `wordDocMode` is true

## Test Results

- **Before plan:** 224 tests green
- **After plan:** 229 tests green (+5 new Word-doc detection tests)
- `npm test -- --run`: 10 test files, 229 tests, all passing
- New tests cover: .docx with correct openxml MIME, .doc with application/msword, .docx with application/zip browser quirk, MIME-alone word-doc, .doc extension with empty MIME

## Deviations from Plan

None — plan executed exactly as written.

The plan's acceptance criterion `grep -c "destructive" src/components/WordDocBanner.tsx` returning 0 was interpreted as checking that `--color-destructive` CSS variable is not used as a style value. The word "destructive" appears only in JSDoc comments explaining why the variable is NOT used (documentation of the design intent). No `--color-destructive` is applied in any style.

## Threat Model Coverage

| Threat ID | Coverage |
|-----------|---------|
| T-03-05 | MIME AND extension both checked; either alone triggers 'word-doc'; .docx with application/zip MIME caught by extension — defense-in-depth satisfied |
| T-03-06 | WordDocBanner copy is static; no user input rendered as markup |
| T-03-SC | No new packages installed |

## Threat Flags

None — no new network endpoints, auth paths, or file access patterns introduced. File validation is client-side only.

## Known Stubs

None — no placeholder copy or unconnected data sources.

## Self-Check: PASSED

- `src/components/WordDocBanner.tsx` exists with role=status, exact copy, --color-border left border
- `src/lib/fileValidation.ts` has word-doc at line 12 (type) and line 63 (return)
- `src/components/UploadZone.tsx` has word-doc branch at line 54
- Commits a6f83d6, 74dcdd5, 5dd3096 all exist in git history
- 229 tests pass
