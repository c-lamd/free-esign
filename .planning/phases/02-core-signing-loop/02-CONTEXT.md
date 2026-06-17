# Phase 2: Core Signing Loop - Context

**Gathered:** 2026-06-16
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers the product's core value end-to-end: a user can **draw a signature**, **place it on the document**, **drag/resize/delete** the placed field, and **download a signed PDF whose original content bytes are provably unaltered** (overlay-only, never re-encoded). Image-sourced documents (the wrapped PDF from Phase 1) export as a PDF containing the image plus the placed signature.

In scope: signature draw pad (signature_pad), placing a drawn signature as an overlay widget, drag/resize/delete of placed fields (react-rnd), the export pipeline (pdf-lib overlay onto original bytes), and the zero-alteration proof (first-512-byte hex match of input vs output content bytes).

Out of scope (later phases): typed signatures and saving/reusing signatures across sessions (Phase 4 — this phase keeps the drawn signature only in session), initials/date/free-text/checkbox field types (Phase 3), zoom controls + multi-page field placement nuances + undo/redo (Phase 3), Word-file prompt (Phase 3), landing page (Phase 5).

Builds directly on Phase 1: the continuous-scroll react-pdf viewer, the Zustand document store, and the tested Coordinate Mapper (cssPixel ↔ pdfSpace) are the foundation the overlay widgets and export math sit on.
</domain>

<decisions>
## Implementation Decisions

### Signature Draw Pad
- The draw pad appears as a **centered modal overlay** (focused drawing).
- **Single black pen** for v1 — pen color choice is deferred (v2 / ENH-04).
- Pad controls: **Clear + Done/Confirm**, with a live preview of the stroke.
- Canvas is a **wide signature box (~3:1)** and exports a **transparent-background PNG** (via signature_pad's PNG data URL) suitable for `embedPng` overlay.

### Placing the Signature
- Placement gesture: **click/tap on the page to drop** the signature where clicked.
- Default placed size: **~180px wide**, signature **aspect ratio preserved**, then user-resizable.
- The same confirmed signature can be **placed multiple times** in a session.
- After a drop, the new field becomes **selected**, and the placement tool **disarms** (user re-arms to place again).

### Placed Field Widget (drag / resize / delete) — react-rnd
- **Click to select** a field → shows resize handles + a delete control. (Click-away deselects.)
- Delete via a small **"×" control on the selected widget AND** the **Delete/Backspace** key.
- Resize via **corner handles, aspect-ratio LOCKED** for signatures (keeps the signature undistorted).
- Drag is **constrained within the page** the field belongs to (`bounds` = its page); a field does not cross pages.
- Field position is stored in **PDF-space** (via the Coordinate Mapper) so it stays locked to the correct page location across re-renders; the widget overlay is positioned by converting PDF-space → CSS pixels at the current render scale.

### Export / Download
- Output filename: **`{original-name}-signed.pdf`**.
- Download is triggered by a **"Download" button in the top bar**.
- **Zero-alteration is a hard rule (EXP-02):** overlay signature image objects onto the **original PDF bytes**; never re-encode, reflow, rasterize, or flatten the original content. Success is proven by a **first-512-byte hex comparison** of input vs output content bytes being identical.
- **LOCKED MECHANISM (user decision, 2026-06-16):** use the **`pdf-lib-incremental-save@1.17.4`** fork (drop-in for pdf-lib + a `saveIncremental()` method). Export pattern: `concat([originalPdfBytes, await pdfDoc.saveIncremental(snapshot)])` — the original bytes are prepended **verbatim**, the new revision (signature XObject + updated xref/trailer) is appended. This **replaces** the canonical `pdf-lib` dependency (uninstall `pdf-lib`, install the fork, update imports in `imageWrapper.ts`); pin the EXACT version and rely on the lockfile to mitigate the low-usage-fork supply-chain risk. Chosen because true byte-identical export is the product's core differentiator and pdf-lib 1.17.1 has no incremental-save capability. (Standard `pdf-lib.save()` rewrites the whole file and FAILS the first-512-byte test.)
- After download, the app **stays on the document** with placed fields still editable (no reset/confirmation screen).
- Image-sourced docs: export the Phase-1 wrapped PDF (image + placed signature) as `{name}-signed.pdf` (satisfies EXP-03).

### Claude's Discretion
- signature_pad configuration (smoothing, devicePixelRatio handling), exact modal layout/animation.
- react-rnd wiring details (controlled position/size state shape, handle styling), selection state in Zustand.
- Coordinate update loop specifics for keeping widgets locked during scroll/resize.
- Export module structure, exact pdf-lib save options (subject to the EXP-02 proof).
- Default field size constant, minimum field size, z-ordering of multiple fields.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Coordinate Mapper** (`src/lib/coordinateMapper.ts`) — pure cssPixel↔pdfSpace conversion with scale + rotation; this is the Phase 1 hand-off and is the basis for storing field positions in PDF-space and rendering widgets at the right screen location.
- **Zustand document store** (`src/store/documentStore.ts`) — current document, view state machine; extend with placed-fields list, selected field, active tool.
- **DocumentViewer / LazyPage** (`src/components/`) — continuous-scroll react-pdf viewer; the overlay layer for widgets attaches per page. `renderAnnotationLayer={false}` is set (keep it).
- **TopBar** (`src/components/TopBar.tsx`) — add the "Download" action here (alongside "Open another").
- **imageWrapper** (`src/lib/imageWrapper.ts`) — images already become a PDF on load, so export is uniform.

### Established Patterns
- Pure, unit-tested lib modules (`src/lib/*`) + Vitest; components in inline-style + Tailwind v4 tokens (`src/index.css`); state in Zustand. Client-only, no network.
- Self-hosted assets and zero-third-party-request guarantee (PRV-02) must be preserved — adding signature_pad/react-rnd must not introduce CDN/network calls.

### Integration Points
- Placed-field data model should reserve a **recipient/role seam** (v2 multi-party, MP-01) without building it — keep field records extensible.
- The export module is the EXP-02 contract surface and the place the hex-diff test targets.

</code_context>

<specifics>
## Specific Ideas

- **EXP-02 zero-alteration proof is a phase success criterion and must have an automated test**: load a known input PDF, run the export with one placed signature, and assert the first 512 bytes (and ideally the original content streams) of input and output are byte-identical. This is the make-or-break guarantee of the product.
- **Research flag (from STATE.md / roadmap):** validate `pdf-lib` incremental/append-save viability and compatibility with pdf-lib 1.17.1 BEFORE writing the export code. pdf-lib's default `save()` rewrites the file; confirm the approach that preserves original content bytes (e.g. incremental save / appending an updated xref, or the documented option set) so the hex-diff passes. Resolve in Phase 2 research.
- signature_pad outputs a PNG data URL directly → `pdfDoc.embedPng` → `page.drawImage` at the placed field's PDF-space rect.
- Field positions stored in PDF user-space (points, bottom-left origin) per page, converted to/from screen coordinates via the Coordinate Mapper so res/zoom changes don't drift placement.

</specifics>

<deferred>
## Deferred Ideas

- Typed signatures (script fonts) and saved/persisted signatures across sessions → Phase 4 (SIG-02, SIG-03, SIG-04, SIG-05).
- Initials, date, free-text, checkbox field types → Phase 3 (FLD-02/03/04).
- Zoom controls with field scaling, multi-page placement polish, undo/redo → Phase 3 (DOC-04, FLD-08, FLD-09).
- Pen color / ink options → v2 (ENH-04).
- Multi-party recipient routing → v2 (MP-01); only the data-model seam is reserved here.

</deferred>
