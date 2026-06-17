<!-- GSD:project-start source:PROJECT.md -->

## Project

**FreeESign**

FreeESign is a free, privacy-first web app for signing your own documents. You upload a PDF (or image), place your signature and other fields anywhere on it — dragging and resizing to position them — and download the signed file with the original content preserved exactly. Signatures can be drawn or typed (rendered in script fonts) and are saved in your browser for reuse. Nothing is ever uploaded to a server, there are no accounts, and it's free for everyone.

It's built for anyone who just needs to sign a document and is tired of "free" PDF signers that paywall the download, upload your documents to who-knows-where, or quietly mangle the formatting.

**Core Value:** **Sign a PDF in your browser, for free, without your document ever leaving your device or being altered.** If everything else fails, this one flow — upload → place signature → download an unaltered signed file — must work flawlessly.

### Constraints

- **Document integrity**: Zero alteration of the uploaded document — overlay signatures onto the original file bytes, never re-encode or regenerate the original content. This is a hard guarantee for PDFs and images.
- **Privacy / Architecture**: Client-side only — no document upload, no accounts, no tracking. All processing happens in the browser.
- **Persistence**: Saved signatures live in browser storage (localStorage), not a server.
- **Cost / Hosting**: Vercel-hostable and cheap-to-free to run — implies a static/client-side app, no heavy backend.
- **Business**: Free for the general public; any monetization must be optional and unobtrusive.

<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Vite + React | Vite 8.x, React 19.x | App framework + build tool | Best fit for a pure client-side SPA. No SSR overhead, no framework footprint, deploys as static assets to Vercel with zero config. Next.js static export adds complexity (App Router "use client" directives everywhere, SSR bailout for pdf.js/canvas) with no benefit for a fully client-side tool. |
| TypeScript | 5.x (via Vite) | Type safety | First-class Vite support, zero extra setup. Catches coordinate-math bugs in field placement early. |
| Tailwind CSS | 4.x | Styling | v4 (Jan 2025) drops tailwind.config.js — CSS-native configuration. Tiny runtime, utility-first for a lean UI. |
| react-pdf (wojtekmaj) | 10.4.1 | PDF rendering/display | Thin React wrapper over pdf.js. Renders each page as a canvas element — the correct approach for a read-only display layer. Handles pdfjs-dist worker lifecycle and TypeScript types. |
| pdfjs-dist | 4.x (peer of react-pdf 10) | PDF parsing + rasterization | Mozilla's canonical browser PDF engine. react-pdf 10 pins pdfjs-dist v4; do not upgrade independently or you'll get worker version mismatch errors. |
| pdf-lib-incremental-save | 1.17.4 | PDF overlay + **byte-identical** export | **Replaces canonical `pdf-lib` as of Phase 2 (decision 2026-06-16).** Drop-in fork of pdf-lib 1.17.x with an added `saveIncremental()` method. Canonical pdf-lib 1.17.1 has NO incremental save — its `save()` re-serializes the whole file and breaks EXP-02 (provably-unaltered original bytes, the core differentiator). Export pattern: `concat([originalBytes, await doc.saveIncremental(snapshot)])` keeps original bytes verbatim and appends a new revision. Same API as pdf-lib (`load`/`create`/`embedPng`/`embedJpg`/`drawImage`); import from `pdf-lib-incremental-save`. Pin the exact version. (Engineering notes below still say "pdf-lib" generically — they apply to this fork.) |
| @pdf-lib/fontkit | 1.1.1 | Script font embedding | Required companion to pdf-lib for embedding custom TTF/OTF fonts with subsetting. Without it, pdf-lib can only use the 14 standard PDF fonts (none of which are script faces). |
| signature_pad | 5.1.3 | Signature drawing canvas | The canonical library for freehand canvas drawing with pressure-curve smoothing (Bezier interpolation). Handles devicePixelRatio scaling natively. Outputs image data as PNG data URL — directly embeddable via pdf-lib's embedPng. |
| react-rnd | 10.5.3 | Drag + resize of placed fields | Single component that does both drag and resize with handles — exactly what PDF field placement needs. @dnd-kit does not include resize; adding it requires a separate library (interact.js or similar) and more integration work. react-rnd is the obvious fit for free-form, absolute-positioned overlays. |
| idb-keyval | 6.2.5 | Persisting saved signatures | IndexedDB-backed key-value store, ~600 bytes. Stores arbitrary structured data (Blobs, data URLs). localStorage is capped at ~5 MB per origin — a single drawn signature as a PNG data URL can be 50–150 KB, so 3–4 saved signatures + app state would exhaust it. idb-keyval gives gigabytes of headroom with a simple promise API. |
| Zustand | 5.x | In-session UI state | Manages ephemeral state: current document, placed fields list, active tool, selected field. Simpler than Redux, more predictable than React Context for cross-component state. 1 KB min+gz. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @pdf-lib/fontkit | 1.1.1 | Font subsetting for typed signatures | Always — required whenever embedding a custom TTF/OTF into the PDF export. Register with `pdfDoc.registerFontkit(fontkit)` before embedding. |
| perfect-freehand | 1.2.3 | Alternative stroke rendering | Optional upgrade from signature_pad if you want variable-width strokes that simulate pen pressure more realistically. Outputs SVG path data rather than canvas pixels — requires converting to an image before embedding. signature_pad is simpler and outputs PNG directly; use perfect-freehand only if you want the visual quality upgrade and are willing to handle the SVG→PNG rasterization step. |
| react-router-dom | 7.x | Client-side routing | Only needed if adding distinct routes (e.g., `/`, `/sign`). For a single-page tool, skip it — all state can live in Zustand. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vite | Build + dev server | `npm create vite@latest` with `react-ts` template. Sub-second HMR. No Next.js configuration overhead. |
| Vitest | Unit testing | Co-located with Vite config; no separate Jest setup. Test coordinate math, field serialization, and PDF byte-level output. |
| ESLint + Prettier | Lint + format | Standard Vite template includes ESLint. Add Prettier for consistency. |
| Vercel CLI | Deploy preview | `vercel --prod` deploys the `dist/` folder. Set `outputDirectory: dist` in vercel.json (Vite default). |

## Document Preservation: The Critical Technical Detail

### What pdf-lib actually does

- **Visual/semantic content**: Preserved. Text, images, and formatting render identically.
- **Raw byte identity**: Not preserved. The output is a new PDF with the same visual content plus your overlaid signature objects.
- **File size**: Will increase (decompression of streams) unless you pass `{ useObjectStreams: true }` to `save()`, which applies object-stream compression.

### What "overlay only, never regenerated" means in practice

- It does not re-render text to pixels.
- It does not re-compress images with lossy codecs.
- It does not change font metrics or reflow text.
- It appends new objects (your signature image, text strings) and adds references to the existing page's resource dictionary.

### Recommended save options

## Architecture for the Rendering + Export Pipeline

## Image Upload Path (JPG/PNG → Signable Document)

## Typed Signature Font Embedding Strategy

- Loses crispness at any zoom level.
- Inflates file size (a PNG of text is larger than the equivalent PDF text operator).
- Makes the output technically machine-readable but semantically an image.

## Drag/Resize Library Decision

- `position={{ x, y }}` and `size={{ width, height }}` for controlled state
- `onDragStop` and `onResizeStop` callbacks that give you the final coordinates
- `bounds="parent"` to constrain fields within the page canvas
- Resize handles at all eight directions

## Signature Drawing Library Decision

| Criterion | signature_pad 5.x | perfect-freehand 1.x |
|-----------|-------------------|----------------------|
| Output format | PNG data URL (direct) | SVG path data (needs rasterization) |
| devicePixelRatio | Built-in | Manual |
| Touch support | Built-in | Manual |
| Bezier smoothing | Yes | Yes (more sophisticated) |
| Integration with pdf-lib | Direct (embedPng) | Extra step (canvas rasterization) |
| Maintenance | Active (szimek) | Stable, less active |

## Framework Choice: Vite + React (not Next.js)

## Local Persistence Strategy

| What to persist | Storage | Reason |
|-----------------|---------|--------|
| Saved signature images (drawn) | IndexedDB (idb-keyval) | PNG data URLs are 50–200 KB each. localStorage 5 MB limit means 25–100 signatures max, which seems fine, but browser behavior varies — Chrome enforces 5 MB, Safari enforces 2.5 MB, Firefox 5 MB. IndexedDB gives gigabytes and stores Blob natively (no base64 overhead). |
| Saved initials | IndexedDB (idb-keyval) | Same reasoning |
| User preferences (last font, last pen color) | localStorage | Small strings, fine for localStorage. Keep simple. |

## Buy Me a Coffee Integration

## Installation

# Create project

# Tailwind v4

# PDF rendering

# PDF editing + export

# Signature drawing

# Drag + resize

# Local persistence

# State management

# Dev dependencies

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| Vite + React | Next.js (static export) | Every pdf/canvas library requires "use client"; SSR/RSC adds friction with zero benefit for a fully client-side tool |
| Vite + React | Astro | Unnecessary complexity for v1; revisit if landing page SEO becomes a priority |
| react-pdf | pdfjs-dist raw | react-pdf is just a thin wrapper that handles the React lifecycle correctly; no reason to use raw pdfjs-dist |
| react-rnd | @dnd-kit | @dnd-kit has no resize; would require a second drag/resize library |
| react-rnd | moveable | moveable is feature-rich but heavyweight (gesto, framework-agnostic); react-rnd is narrower and has better React integration |
| react-rnd | interact.js | Not React-native; requires imperative DOM refs and manual state sync |
| signature_pad | perfect-freehand | perfect-freehand outputs SVG paths not PNG; requires rasterization before pdf-lib embed |
| idb-keyval | localStorage | localStorage 5 MB cap is fragile for image data URLs; IndexedDB has gigabytes and stores Blob natively |
| pdf-lib | jsPDF | jsPDF generates PDFs from scratch; does not load + overlay an existing PDF. Wrong tool. |
| pdf-lib | PDFKit | PDFKit is Node.js-first; browser bundle is awkward and large |
| Zustand | Jotai | Both are fine; Zustand's centralized store is easier to reason about for the interconnected state (document + fields + selected field + tool mode) |
| Zustand | React Context | Context re-renders the entire tree on any state change; fine for small apps but fragile as the field list grows |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| jsPDF | Generates PDFs from scratch; cannot load and overlay an existing PDF without rasterizing it first (which destroys original content) | pdf-lib |
| PDFKit | Node.js-centric; browser bundle requires polyfills; does not have a well-maintained browser-native mode | pdf-lib |
| pdf.js annotation layer (for writing) | pdf.js has an annotation editor for in-browser markup, but annotations are stored as PDF annotations not embedded image/text objects — they are not reliably preserved by all PDF readers | pdf-lib overlay approach |
| Next.js (for this project) | App Router defaults to RSC; every interactive component needs "use client"; no SSR benefit exists for a client-only tool; worker setup for pdf.js is a known pain point with App Router | Vite + React |
| canvas library (canvg, fabric.js) for the overlay | Rasterizes the entire PDF page to canvas for editing — destroys original content and causes quality loss at non-100% zoom | react-rnd HTML overlay + pdf-lib for export |
| html2canvas / dom-to-image for export | Rasterizes the entire document to a bitmap PNG then wraps in PDF — catastrophic for text quality, file size, and accessibility | pdf-lib programmatic export |
| react-beautiful-dnd | Deprecated (React 18 concurrent mode issues); drag-only, no resize | react-rnd |
| Cloudinary / any server upload for image processing | Violates the core privacy promise; documents must never leave the browser | In-browser pdf-lib image wrapping |

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| react-pdf@10.4.1 | pdfjs-dist@4.x | react-pdf pins its own pdfjs-dist; install pdfjs-dist separately only if you need to configure the worker — must match the version react-pdf installs |
| pdf-lib@1.17.1 | @pdf-lib/fontkit@1.1.1 | fontkit is a named dependency of pdf-lib; versions in sync as of 2025 |
| signature_pad@5.x | React 19 | No React dependency; plain TypeScript. Attach to a `<canvas>` ref via `useRef`. |
| react-rnd@10.5.3 | React 18/19 | Works with both; no React 19 issues reported |
| Tailwind v4 | Vite 8 | Use `@tailwindcss/vite` plugin (not the PostCSS plugin) for Vite — it's the recommended Vite integration |
| Zustand@5.x | React 19 | Zustand 5 fully supports React 19 concurrent features |

## Sources

- pdf-lib GitHub issue #639 (stream decompression confirmed) — HIGH confidence
- npm registry versions verified 2026-06-16 — HIGH confidence
- react-pdf GitHub discussions #1520 (worker version sync) — HIGH confidence
- Web search: Vite vs Next.js for client-only apps 2025–2026 — HIGH confidence (multiple sources converge)
- idb-keyval npm page (storage rationale) — HIGH confidence
- pdf-lib.js.org official docs (embedFont, drawImage, fontkit registration) — HIGH confidence
- Google Fonts repository (Dancing Script, Great Vibes, Pacifico availability as TTF) — HIGH confidence

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
