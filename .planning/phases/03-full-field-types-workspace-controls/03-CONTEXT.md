# Phase 3: Full Field Types + Workspace Controls - Context

**Gathered:** 2026-06-16
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — grey-area answers auto-accepted with best judgement per user authorization

<domain>
## Phase Boundary

Phase 3 enriches the existing single-signature signing loop into a full annotation workspace. It adds four new placeable field types (initials, date, free text, checkbox/X), user-controlled document zoom (50–200%) with fields that scale and stay pixel-aligned, field placement on any page of a multi-page document, undo/redo of placement actions (≥10 levels), and a clear "export to PDF first" prompt when a Word file is selected.

**In scope:** new field types + their export rendering, zoom UI + scale propagation, multi-page placement correctness, an undo/redo history stack, Word-doc rejection messaging.

**Out of scope (do NOT build here):** typed signatures in script fonts (SIG-02, Phase 4), saving/reusing signatures or initials across sessions / IndexedDB persistence (SIG-03/04/05, Phase 4), landing page (Phase 5), rotated-page (90/180/270°) placement correctness (deferred to v2), multi-party recipient routing (v2).
</domain>

<decisions>
## Implementation Decisions

### Area 1: Field Types & Creation UX
- **Field palette:** Expose field types via a toolbar/palette of labeled buttons — Signature, Initials, Date, Text, Checkbox. Reuse the existing "click-to-arm → click-to-drop" placement flow already proven for signatures (arm a type, click the page to drop, auto-select, disarm). Keep it in/near the existing TopBar toolbar region; a compact grouped control is acceptable.
- **Initials (FLD-02):** In Phase 3, initials are created by drawing in the same focus-trapped draw modal used for signatures (relabeled "Draw your initials"), output as a transparent PNG image field with a smaller default footprint than a signature. Typed initials and saving/reuse are Phase 4 — do NOT build persistence here.
- **Date field (FLD-03):** Defaults to today's date (2026-06-16 at build time uses the real current date at runtime), rendered as text, editable by the user. Default display format `M/D/YYYY` (e.g., 6/16/2026); the user may edit the literal string. Stored as a `dateValue` string on the field.
- **Text field (FLD-04):** Click to place, then type into an inline editable box on the overlay. Single-line is sufficient for v1; wrap is a nice-to-have. Stored as `textValue`. Rendered/exported in a standard PDF font (Helvetica) — script fonts are Phase 4.
- **Checkbox/X (FLD-02):** Render a bold "X" mark (matching the requirement's "checkbox/X mark"). Placeable, resizable, deletable like other fields. No checked/unchecked toggle needed for v1 — placing it = marking it.
- **Field model extension:** Extend `PlacedField.type` union to `'signature' | 'initials' | 'date' | 'text' | 'checkbox'` and add optional `textValue?`, `dateValue?` (and any minimal styling field like `fontSize?`). Image-based types keep using `dataUrl`. Preserve the reserved `role?` seam.

### Area 2: Zoom Behavior (DOC-04)
- **Range & steps:** 50%–200%, discrete steps (50, 75, 100, 125, 150, 175, 200). Zoom-out / zoom-in buttons with a current-percentage readout, plus a "Fit width" reset (100% = fit-to-width baseline).
- **Scale model:** Add a `zoom` multiplier to `documentStore` (default 1.0 = fit-to-width). Effective render scale = `(containerWidth / originalWidth) * zoom`. Thread this effective scale into `makeSimpleViewport` and page render width so both the rendered page and the field overlays scale together.
- **Field alignment:** Fields are already stored in PDF-space, so they re-render at the correct position automatically when scale changes — no field data is mutated on zoom. This is the mechanism that satisfies "fields scale and stay pixel-perfectly aligned."
- **Control placement:** A floating zoom control near the existing bottom-center PageNavigation pill (consistent with current viewer chrome). Keep it unobtrusive.
- **Anchoring:** Keep it simple — preserve the current page in view across zoom changes; precise cursor-anchored zoom is not required for v1.

### Area 3: Undo/Redo (FLD-09)
- **Covered actions:** add field, delete field, move (drag), resize, and content edits (text/date value changes). ≥10 levels (cap ~50).
- **Mechanism:** History stack of field-array snapshots with a current index in `fieldStore` (undo decrements, redo increments, a new action truncates the redo tail). Snapshot the `fields` array on each committed action.
- **Granularity:** One history entry per discrete action. Text/date editing commits a single entry on blur/confirm (not per keystroke) to avoid history spam.
- **Controls:** Undo/Redo buttons in the toolbar plus keyboard shortcuts (Cmd/Ctrl+Z = undo, Cmd/Ctrl+Shift+Z and Ctrl+Y = redo). Guard shortcuts against firing while typing in a text/date field input.
- **Scope:** Session-only history; not persisted. Zoom level and selection changes are NOT undoable (only field-data changes).

### Area 4: Word-Doc Prompt (DOC-05)
- **Detection:** Reject `.doc`/`.docx` by extension AND MIME (`application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`), consistent with the existing defense-in-depth validation pattern.
- **Messaging:** Show a clear, friendly inline message (reuse the existing ErrorBanner/UploadZone error pattern) instructing the user to export the document to PDF first and re-open it. Absolutely no silent conversion attempt. Provide a path back to choose another file.

### Area 5: Export of New Field Types
- **Image types (signature, initials):** continue using `embedPng` + `drawImage` (unchanged path).
- **Text & date:** use `pdfDoc.embedFont(StandardFonts.Helvetica)` + `page.drawText(...)` at the field's PDF-space coords, sizing text to fit the field box height. No custom/script font embedding in Phase 3.
- **Checkbox/X:** draw a bold "X" — either `drawText('X', ...)` with Helvetica-Bold sized to the box, or vector lines via `drawLine`. Either is acceptable; pick the simpler that renders crisply.
- **EXP-02 invariant:** all new types must go through the same `saveIncremental` + concat path; the zero-alteration byte-identity test must continue to pass. Mark each touched page ref before drawing.

### Claude's Discretion
- Exact visual styling of the field palette, zoom control, and undo/redo buttons (follow existing Tailwind v4 tokens and TopBar conventions).
- Whether text fields support multi-line (single-line acceptable for v1).
- Checkbox rendering technique (drawText 'X' vs drawLine) — choose the crisper.
- History cap exact value (≥10, ~50 reasonable).
- Date default format locale handling (M/D/YYYY default is fine).
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/store/fieldStore.ts` — `PlacedField` interface (lines 17–27), `PageDimensions` (29–33), CRUD actions (`addField`/`updateField`/`deleteField`/`setSelectedFieldId`/`setPageDimensions`/`resetFields`). Extend the `type` union and add `textValue?`/`dateValue?` here; add `history`/`historyIndex` + `undo`/`redo` actions here.
- `src/lib/coordinateMapper.ts` — `cssPixelToPageSpace` / `pageSpaceToCssPixel` (pure, scale+rotation aware via viewport). No change needed; reuse as-is.
- `src/lib/pageViewport.ts` — `makeSimpleViewport(w, h, scale)` (rotation=0 only). Thread the new effective (zoom-adjusted) scale through this.
- `src/components/LazyPage.tsx` — click-to-drop handler (lines 88–155) and `onLoadSuccess` → `setPageDimensions` (76–86). Extend drop handler to create the armed field type; multi-page placement already keys by `pageNumber`.
- `src/components/PlacedFieldWidget.tsx` — react-rnd controlled widget; `handleDragStop`/`handleResizeStop` convert CSS→PDF (85–111). Extend to render text/date/checkbox content instead of only an `<img>`, and to host inline editing for text/date.
- `src/components/DocumentViewer.tsx` — ResizeObserver (containerWidth) + IntersectionObserver (current page); routes Delete/Backspace. Hook zoom scale + undo/redo shortcuts here.
- `src/components/TopBar.tsx` — toolbar with "Add signature"/"Download PDF"/"Open another". Field palette + undo/redo buttons go here.
- `src/components/UploadZone.tsx` + `src/lib/fileValidation.ts` — file type gating; add `.doc/.docx` rejection messaging here.
- `src/lib/exportPdf.ts` — `exportSignedPdf` draw loop (lines 34–94); extend per-type drawing (drawText / X) while preserving the incremental-save concat.

### Established Patterns
- **PDF-space coordinate storage** (bottom-left origin, points) — keep all new fields in PDF-space; this is what makes zoom + multi-page "just work."
- **Zustand stores, immutable updates** — replace arrays/Maps, never mutate in place.
- **click-to-arm → click-to-drop** placement; auto-select + disarm after drop.
- **Defense-in-depth file validation** (extension AND MIME).
- **EXP-02 zero-alteration** via `pdf-lib-incremental-save` (`takeSnapshot`/`markRefForSave`/`saveIncremental` + concat original bytes).
- **Accessibility:** prior phases used `aria-disabled` (not HTML `disabled`) to keep focus reachable; keyboard handlers guard against firing inside text inputs (WCAG 2.5.5).
- **Self-hosted assets only** — zero third-party network requests (PRV-01/02). Do not add CDN fonts or external deps.

### Integration Points
- New field-type buttons + undo/redo → `TopBar.tsx`.
- Zoom control → near `PageNavigation.tsx` (bottom-center chrome) with state in `documentStore.ts`.
- Inline text/date editing → `PlacedFieldWidget.tsx`.
- Word-doc rejection → `UploadZone.tsx` / `fileValidation.ts` / `ErrorBanner.tsx`.
- New export rendering → `exportPdf.ts` draw loop.
- Tests: Vitest + jsdom with canvas mock in `src/test/setup.ts`; add suites for undo/redo, zoom scaling, new-type export, and Word rejection alongside existing `src/test/*.test.ts`.

### Testing Setup
- Vitest (jsdom). Canvas 2d + `toDataURL` mocked in `src/test/setup.ts` (idempotent guard). Coordinate round-trip property tests already cover scale × rotation. Export tests assert first-512-byte identity (EXP-02). Extend these patterns; do not regress the byte-identity test.
</code_context>

<specifics>
## Specific Ideas

- The whole point of zoom is provability: at any zoom 50–200%, a placed field must download at the exact same PDF position. The round-trip/coordinate tests should assert this (place at zoom X → field PDF coords identical regardless of zoom).
- Keep the new-type export crisp and selectable where possible (text drawn as real PDF text via drawText, not rasterized) — consistent with the project's anti-rasterization stance.
- Word rejection must read as helpful, not an error wall — explain *why* (formatting integrity / privacy) and *what to do* (export to PDF, re-open).
</specifics>

<deferred>
## Deferred Ideas

- Typed signatures in script fonts → Phase 4 (SIG-02).
- Saving/reusing signatures & initials across sessions (IndexedDB) → Phase 4 (SIG-03/04/05).
- Rotated-page (90/180/270°) field placement correctness → v2 (requires full pdfjs PageViewport affine; `makeSimpleViewport` stays rotation=0).
- Cursor-anchored zoom, page-thumbnail sidebar, snap-to-alignment guides → v2 enhancements (ENH-02/03).
- Multi-line rich text fields → out of scope for v1.
</deferred>
