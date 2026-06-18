# Walking Skeleton — FreeESign

**Phase:** 1
**Generated:** 2026-06-16

## Capability Proven End-to-End

> One sentence: the smallest user-visible capability that exercises the full stack.

A user can pick a PDF file and see page 1 render in the browser, with the pdf.js worker, CMaps, and standard fonts all served from the app's own origin — zero third-party network requests.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Vite 8 + React 19 + TypeScript, single-page app, **no router** | CLAUDE.md-pinned. Pure client-side SPA; no SSR/RSC friction with pdf.js/canvas. Deploys as static assets. All navigation state lives in Zustand (CONTEXT.md locked decision). |
| Styling | Tailwind v4 via `@tailwindcss/vite`, CSS-native config (no `tailwind.config.js`); design tokens in `:root` of `src/index.css` | CLAUDE.md-pinned. v4 drops the JS config; the eight UI-SPEC color tokens are CSS custom properties. |
| Data layer | **None server-side.** In-browser only: Blob URLs for documents + Zustand for ephemeral session state. IndexedDB (`idb-keyval`) reserved for signature persistence in Phase 4. | Core privacy promise: documents never leave the browser (PRV-01). No DB in Phase 1 by design. |
| Document pipeline | "Everything is a PDF": images (JPG/PNG) are wrapped to a single-page PDF via pdf-lib on load (Plan 03); the viewer renders only PDFs via react-pdf 10.4.1 (pdfjs-dist 5.4.296, pinned). | One uniform coordinate/render/export pipeline (CONTEXT.md locked). Simplifies Phase 2 overlay/export. |
| Self-hosted assets | pdf.js worker copied to `public/pdf.worker.min.mjs`; `cmaps/` + `standard_fonts/` copied via `vite-plugin-static-copy`; `GlobalWorkerOptions.workerSrc` + `<Document options={{cMapUrl,standardFontDataUrl}}>` point at local paths. | PRV-02 hard success criterion: zero third-party requests. public/ path is deterministic (avoids Vite content-hash 404s). |
| Auth | **None** — no accounts, no sessions, no server. | Privacy-first, browser-only product. |
| Test runner | Vitest 4.x, jsdom environment, config in `vite.config.ts` `test:` block; `@testing-library/react` + `@testing-library/jest-dom`. | Co-located with Vite, zero extra config. The Coordinate Mapper round-trip property test is a Phase 1 success criterion. |
| State | Zustand 5 — `view` state machine (`empty\|loading\|error\|loaded`) + `docUrl`, `numPages`, `currentPage`, `errorMessage`. | CLAUDE.md-pinned. Centralized store is the single source of truth the view-router and all components read. |
| Deployment target | Vercel static `dist/` (`vercel.json` → `outputDirectory: dist`). Documented local full-stack run: `npm run dev`. | CLAUDE.md Vercel/cheap-to-free constraint. Domain (free-esign.com) wired in Phase 5. |
| Directory layout | `src/{store,lib,components,test}` per RESEARCH "Recommended Project Structure". `lib/` = pure modules (coordinateMapper, imageWrapper, fileValidation, pdfWorker); `components/` = hand-crafted Tailwind components; `store/` = Zustand; `test/` = Vitest specs. | Clear seams; pure logic isolated from React for testability (Coordinate Mapper has no React import). |

## Stack Touched in Phase 1

- [x] Project scaffold (Vite + React 19 + TS, build, lint via Vite template ESLint, Vitest test runner)
- [x] Routing — single-page app, no router (one view, state-machine-driven); a real UI route is intentionally out of scope (CONTEXT.md + CLAUDE.md)
- [ ] Database — **deliberately none in Phase 1.** Session state is held in Zustand; persistence (IndexedDB) arrives in Phase 4. (No server DB will ever exist — privacy-first.)
- [x] UI — a real interactive element wired through the stack: file pick → `loadDocument(Blob URL)` → react-pdf renders page 1 from the self-hosted worker
- [x] Deployment — documented local full-stack run command (`npm run dev`); `vercel.json` configured for the eventual Vercel static deploy (live domain in Phase 5)

> Note: "Database" is intentionally unchecked. Per the privacy-first architecture there is no server database — documents and (later) signatures live only in the browser. The Phase 1 skeleton proves the full *client* stack: file ingestion → in-browser PDF render → self-hosted assets.

## Out of Scope (Deferred to Later Slices)

> Anything that is *not* in the skeleton. Be explicit — this list prevents future phases from re-litigating Phase 1's minimalism.

- Drawing, typing, or placing signatures and any field types (Phase 2 starts fields)
- Zero-alteration PDF export / download (Phase 2)
- User-facing zoom controls with field scaling (Phase 3, DOC-04)
- Word-document "export to PDF first" prompt (Phase 3, DOC-05)
- Undo/redo, multi-page field placement, additional field types (Phase 3)
- Typed signatures in script fonts; saved/reusable signatures + IndexedDB persistence (Phase 4)
- Landing page, "Buy Me a Coffee" link, public deploy to free-esign.com (Phase 5)
- Page thumbnail sidebar (v2, ENH-02)

The skeleton capability proven in Plan 01 is PDF-only (image wrapping is added in Plan 03 within Phase 1, but is not part of the minimal end-to-end skeleton slice).

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- **Phase 2 — Core Signing Loop:** draw a signature, place it on a page (drag/resize/delete), download a zero-alteration signed PDF (proven by a hex-diff of the first 512 bytes). Image inputs export as a PDF with the placed signature.
- **Phase 3 — Full Field Types + Workspace Controls:** initials, date, free text, checkbox fields; zoom (50–200%) with correct field scaling; multi-page field placement; undo/redo (≥10 levels); Word-file prompt.
- **Phase 4 — Typed Signatures + Persistence:** typed signatures in ≥3 script fonts (embedded in export); save/reuse signatures + initials across sessions via IndexedDB.
- **Phase 5 — Landing Page + Launch:** personal hero landing page, privacy explanation, optional tip link; zero-third-party-request audit of the full workflow; deploy to Vercel at free-esign.com.
