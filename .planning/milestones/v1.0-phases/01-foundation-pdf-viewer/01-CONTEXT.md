# Phase 1: Foundation + PDF Viewer - Context

**Gathered:** 2026-06-16
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers the project scaffold and a read-only document viewer. Users can open a PDF (drag-drop or file picker) or an image (JPG/PNG) and view every page rendered in the browser. The app is wired so that loading and rendering a document produces **zero third-party network requests** (pdf.js worker, CMaps, and any fonts self-hosted). A tested **Coordinate Mapper** utility — converting between CSS pixel space and PDF space across zoom and rotation — ships here as the foundation Phase 2 field placement depends on.

In scope: project setup (Vite + React + TS + Tailwind v4 per CLAUDE.md), upload/empty state, PDF + image viewing, multi-page navigation, self-hosted-assets enforcement, Coordinate Mapper with round-trip tests.

Out of scope (later phases): drawing/placing signatures or any fields (Phase 2), zoom controls as a user feature beyond an initial fit (Phase 3 owns DOC-04 zoom + field scaling), Word-file detection message (Phase 3, DOC-05), typed signatures/persistence (Phase 4), landing page (Phase 5).
</domain>

<decisions>
## Implementation Decisions

### Document Viewer Layout
- Multi-page documents display as a **continuous vertical scroll** of pages (no paged one-at-a-time mode).
- Documents open at **fit-to-width** zoom by default.
- Navigation aids: a **page indicator ("1 / N")** plus **prev/next buttons**, in addition to scroll.
- Pages are **centered** with a max-width, on a **neutral gray canvas backdrop**.

### Upload & Empty State
- Upload entry is a **full-screen drag-and-drop zone** with a **"browse" button**; the user can drop a file anywhere on the empty state.
- Empty state is **minimal** with a single privacy line (e.g. "Your files never leave your browser").
- Once a document is loaded, an **"open another"** control lets the user switch documents (no full page reload required).
- The file picker is **filtered to `.pdf,.jpg,.jpeg,.png`**; files are still validated after selection.

### Image Handling & Rendering Strategy
- Opened images (JPG/PNG) are **wrapped into a PDF immediately on load**, giving a single uniform viewer/coordinate pipeline (everything in the viewer is a PDF). This wrapped PDF is what later phases overlay and export (satisfies EXP-03's "image exported as a PDF").
- Pages are **lazy-rendered** as they scroll into view (avoid rendering all pages of a long PDF upfront).
- Bad/corrupt/unsupported files show a **friendly inline error with a retry path** — no crash, no raw browser error.
- A **simple centered spinner** is shown while a document is parsing/rendering.

### Visual Chrome & Architecture
- A **minimal top bar** shows the **"FreeESign" wordmark** and document actions (e.g. open another).
- **Clean light/neutral theme** with a single accent color; full brand treatment is deferred to Phase 5 (landing).
- **Single-page app, no router** (per CLAUDE.md) — all state lives in Zustand.
- **Coordinate Mapper API is at Claude's discretion**: a pure utility converting `cssPixel ↔ pdfSpace` accounting for zoom scale and page rotation, with a round-trip test proving a point maps out and back within floating-point tolerance at any zoom and rotation.

### Claude's Discretion
- All stack/scaffolding specifics (Vite config, Tailwind v4 `@tailwindcss/vite` setup, pdf.js worker wiring, Zustand store shape, file/folder structure, Vitest setup).
- Exact Coordinate Mapper function signatures and module layout.
- Spinner/error component visual details, exact accent color, top-bar layout specifics.
- Lazy-render mechanism (react-pdf per-page rendering, intersection-based, or react-pdf defaults).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Greenfield repository — no `src/` yet. CLAUDE.md fully specifies the stack and version pins.

### Established Patterns
- None yet; this phase establishes them. CLAUDE.md is the authority: Vite 8 + React 19 + TS, Tailwind v4 (`@tailwindcss/vite` plugin, no `tailwind.config.js`), react-pdf 10.4.1 (pins pdfjs-dist 4.x — do NOT upgrade independently), Zustand 5 for in-session state, Vitest for unit tests.

### Integration Points
- Coordinate Mapper is the explicit hand-off to Phase 2 (field placement). Keep it a standalone, well-tested module.
- The uniform "everything is a PDF" viewer pipeline is the hand-off to Phase 2's overlay/export.

</code_context>

<specifics>
## Specific Ideas

- Self-hosted-assets requirement (PRV-02) is a **success criterion**, not a nice-to-have: pdf.js worker, CMaps, and fonts must be served from the app's own origin. Verification includes confirming zero third-party origin requests after loading a document.
- The Coordinate Mapper round-trip test is a phase success criterion and must exist and pass.
- Image-wrap-on-load uses pdf-lib (already in the stack) to wrap JPG/PNG into a single-page PDF.

</specifics>

<deferred>
## Deferred Ideas

- User-facing zoom in/out controls with field-scaling → Phase 3 (DOC-04).
- Word-document "export to PDF first" prompt → Phase 3 (DOC-05).
- Page thumbnail sidebar → v2 (ENH-02), explicitly out of scope.

</deferred>
