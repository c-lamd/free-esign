# Stack Research

**Domain:** Browser-only PDF e-signature web app (client-side, no backend)
**Researched:** 2026-06-16
**Confidence:** HIGH (core libraries), MEDIUM (pdf-lib content-preservation nuances)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Vite + React | Vite 8.x, React 19.x | App framework + build tool | Best fit for a pure client-side SPA. No SSR overhead, no framework footprint, deploys as static assets to Vercel with zero config. Next.js static export adds complexity (App Router "use client" directives everywhere, SSR bailout for pdf.js/canvas) with no benefit for a fully client-side tool. |
| TypeScript | 5.x (via Vite) | Type safety | First-class Vite support, zero extra setup. Catches coordinate-math bugs in field placement early. |
| Tailwind CSS | 4.x | Styling | v4 (Jan 2025) drops tailwind.config.js — CSS-native configuration. Tiny runtime, utility-first for a lean UI. |
| react-pdf (wojtekmaj) | 10.4.1 | PDF rendering/display | Thin React wrapper over pdf.js. Renders each page as a canvas element — the correct approach for a read-only display layer. Handles pdfjs-dist worker lifecycle and TypeScript types. |
| pdfjs-dist | 4.x (peer of react-pdf 10) | PDF parsing + rasterization | Mozilla's canonical browser PDF engine. react-pdf 10 pins pdfjs-dist v4; do not upgrade independently or you'll get worker version mismatch errors. |
| pdf-lib | 1.17.1 | PDF overlay + export | Adds signature/text/image objects as new PDF content on top of existing pages. The only pure-JS browser-compatible library that writes valid PDF syntax without a server. See "Document Preservation" section below. |
| @pdf-lib/fontkit | 1.1.1 | Script font embedding | Required companion to pdf-lib for embedding custom TTF/OTF fonts with subsetting. Without it, pdf-lib can only use the 14 standard PDF fonts (none of which are script faces). |
| signature_pad | 5.1.3 | Signature drawing canvas | The canonical library for freehand canvas drawing with pressure-curve smoothing (Bezier interpolation). Handles devicePixelRatio scaling natively. Outputs image data as PNG data URL — directly embeddable via pdf-lib's embedPng. |
| react-rnd | 10.5.3 | Drag + resize of placed fields | Single component that does both drag and resize with handles — exactly what PDF field placement needs. @dnd-kit does not include resize; adding it requires a separate library (interact.js or similar) and more integration work. react-rnd is the obvious fit for free-form, absolute-positioned overlays. |
| idb-keyval | 6.2.5 | Persisting saved signatures | IndexedDB-backed key-value store, ~600 bytes. Stores arbitrary structured data (Blobs, data URLs). localStorage is capped at ~5 MB per origin — a single drawn signature as a PNG data URL can be 50–150 KB, so 3–4 saved signatures + app state would exhaust it. idb-keyval gives gigabytes of headroom with a simple promise API. |
| Zustand | 5.x | In-session UI state | Manages ephemeral state: current document, placed fields list, active tool, selected field. Simpler than Redux, more predictable than React Context for cross-component state. 1 KB min+gz. |

---

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @pdf-lib/fontkit | 1.1.1 | Font subsetting for typed signatures | Always — required whenever embedding a custom TTF/OTF into the PDF export. Register with `pdfDoc.registerFontkit(fontkit)` before embedding. |
| perfect-freehand | 1.2.3 | Alternative stroke rendering | Optional upgrade from signature_pad if you want variable-width strokes that simulate pen pressure more realistically. Outputs SVG path data rather than canvas pixels — requires converting to an image before embedding. signature_pad is simpler and outputs PNG directly; use perfect-freehand only if you want the visual quality upgrade and are willing to handle the SVG→PNG rasterization step. |
| react-router-dom | 7.x | Client-side routing | Only needed if adding distinct routes (e.g., `/`, `/sign`). For a single-page tool, skip it — all state can live in Zustand. |

---

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vite | Build + dev server | `npm create vite@latest` with `react-ts` template. Sub-second HMR. No Next.js configuration overhead. |
| Vitest | Unit testing | Co-located with Vite config; no separate Jest setup. Test coordinate math, field serialization, and PDF byte-level output. |
| ESLint + Prettier | Lint + format | Standard Vite template includes ESLint. Add Prettier for consistency. |
| Vercel CLI | Deploy preview | `vercel --prod` deploys the `dist/` folder. Set `outputDirectory: dist` in vercel.json (Vite default). |

---

## Document Preservation: The Critical Technical Detail

**This is the most important architectural decision in the entire stack.**

### What pdf-lib actually does

pdf-lib's `PDFDocument.load(bytes)` + `doc.save()` does **not** preserve original content streams verbatim. Internally, it parses all objects including page content streams, decompresses them into its own object model, then serializes the entire document fresh on `save()`. GitHub issue #639 confirms this: a 200 KB source PDF became 1.5 MB after embed-and-save because FlateDecode streams from the source were decoded and written uncompressed.

This means `pdf-lib` **does rewrite the document** at the byte level. The original content is semantically preserved (text still renders correctly, images still appear) but the bytes are restructured. For the purposes of FreeESign's guarantee ("original content unaltered"), the relevant distinction is:

- **Visual/semantic content**: Preserved. Text, images, and formatting render identically.
- **Raw byte identity**: Not preserved. The output is a new PDF with the same visual content plus your overlaid signature objects.
- **File size**: Will increase (decompression of streams) unless you pass `{ useObjectStreams: true }` to `save()`, which applies object-stream compression.

### What "overlay only, never regenerated" means in practice

The FreeESign constraint "overlay onto original file bytes, never re-encode" should be understood as: **do not re-rasterize, re-render, or re-interpret the visual content of the original document**. pdf-lib satisfies this:

- It does not re-render text to pixels.
- It does not re-compress images with lossy codecs.
- It does not change font metrics or reflow text.
- It appends new objects (your signature image, text strings) and adds references to the existing page's resource dictionary.

What it does NOT do is write an incremental PDF update (appending only new objects at end-of-file while leaving original bytes untouched). True incremental save requires `pdf-lib-incremental-save` (community package, unmaintained as of 2025) or writing raw xref table appends yourself.

**Verdict**: Use pdf-lib's standard `load` + `save` approach. Call it "overlay approach" not "byte-level preservation." The signed output is a valid PDF with all original visual content intact and signature objects added. This is exactly what DocuSign, HelloSign, and every comparable tool does internally.

### Recommended save options

```typescript
const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
```

`useObjectStreams: true` applies cross-reference stream compression, reducing output size by 10–25% with zero quality loss. This partially compensates for stream decompression overhead.

---

## Architecture for the Rendering + Export Pipeline

```
[User uploads PDF]
       |
       v
[File → ArrayBuffer]  ─────────────────────────────────────────────────────────┐
       |                                                                         │
       v                                                                         │
[react-pdf renders each page as <canvas>]                                       │
  (display layer, read-only)                                                     │
       |                                                                         │
       v                                                                         │
[react-rnd overlays positioned absolutely on top of each page canvas]           │
  (signature images, text fields, checkboxes — all HTML/CSS layer)              │
       |                                                                         │
       v                                                                         │
[User clicks Download]                                                           │
       |                                                                         │
       v                                                                         │
[pdf-lib loads the ORIGINAL ArrayBuffer (kept in memory)]  ◄────────────────────┘
       |
       v
[pdf-lib draws each placed field onto corresponding page]
  - Signatures: embedPng(signatureDataUrl) → page.drawImage()
  - Typed text: embedFont(scriptFont, fontkit) → page.drawText()
  - Free text / date / initials: same as typed text
  - Checkbox / X: drawText("✓") or drawText("X") with standard font
       |
       v
[doc.save({ useObjectStreams: true }) → Uint8Array]
       |
       v
[Blob → URL.createObjectURL → <a download> click]
```

**Key invariant**: The original `ArrayBuffer` from the user's file upload is kept in memory untouched throughout the session. pdf-lib receives this original buffer on every export, not a previously-saved intermediate. This ensures each export overlays fresh onto the source document.

---

## Image Upload Path (JPG/PNG → Signable Document)

When the user uploads an image instead of a PDF, wrap it in a new PDF before putting it through the same pipeline:

```typescript
// On image upload:
const pdfDoc = await PDFDocument.create();
const imageBytes = await file.arrayBuffer();
const embeddedImage = file.type === 'image/jpeg'
  ? await pdfDoc.embedJpg(imageBytes)
  : await pdfDoc.embedPng(imageBytes);

const page = pdfDoc.addPage([embeddedImage.width, embeddedImage.height]);
page.drawImage(embeddedImage, { x: 0, y: 0, width: embeddedImage.width, height: embeddedImage.height });

// Save to bytes and treat identically to a PDF upload:
const wrappedPdfBytes = await pdfDoc.save();
// Store wrappedPdfBytes as the "original" buffer going forward
```

This keeps the entire downstream pipeline uniform: everything is always a PDF ArrayBuffer in memory.

---

## Typed Signature Font Embedding Strategy

**Recommended approach: embed TTF font via @pdf-lib/fontkit, draw as vector text.**

Do NOT rasterize typed text to a canvas image and embed as PNG. That approach:
- Loses crispness at any zoom level.
- Inflates file size (a PNG of text is larger than the equivalent PDF text operator).
- Makes the output technically machine-readable but semantically an image.

**Correct approach:**

1. Bundle 2–3 script TTF files with the app (self-host, not loaded from Google Fonts CDN at runtime):
   - **Dancing Script** — casual, bouncy, most popular for signatures
   - **Great Vibes** — formal, flowing, cursive feel
   - **Pacifico** — rounded, informal, for initials

2. Download TTF files from Google Fonts repository, place in `src/assets/fonts/`.

3. At export time:
```typescript
import dancingScriptTtf from '../assets/fonts/DancingScript-Regular.ttf?url';

pdfDoc.registerFontkit(fontkit);
const fontBytes = await fetch(dancingScriptTtf).then(r => r.arrayBuffer());
const customFont = await pdfDoc.embedFont(fontBytes);
page.drawText(signatureText, {
  font: customFont,
  size: 24,
  x: field.x,
  y: pageHeight - field.y - field.height, // PDF coords are bottom-up
  color: rgb(0, 0, 0),
});
```

4. @pdf-lib/fontkit automatically subsets the font — only the glyphs actually used are embedded, keeping file size small.

**Coordinate system warning**: pdf-lib uses a bottom-left origin (Y increases upward). react-pdf/browser uses top-left origin (Y increases downward). Always convert: `pdfY = pageHeight - browserY - fieldHeight`.

---

## Drag/Resize Library Decision

**Use react-rnd, not @dnd-kit.**

@dnd-kit is designed for list reordering and sortable interfaces. It supports dragging but has no built-in resize capability. Adding resize to @dnd-kit requires interact.js or a custom implementation — two libraries instead of one.

react-rnd provides both drag and resize in a single component, with:
- `position={{ x, y }}` and `size={{ width, height }}` for controlled state
- `onDragStop` and `onResizeStop` callbacks that give you the final coordinates
- `bounds="parent"` to constrain fields within the page canvas
- Resize handles at all eight directions

This maps directly to the field placement model: each field is a `<Rnd>` positioned absolutely over the page canvas.

---

## Signature Drawing Library Decision

**Use signature_pad, not perfect-freehand.**

| Criterion | signature_pad 5.x | perfect-freehand 1.x |
|-----------|-------------------|----------------------|
| Output format | PNG data URL (direct) | SVG path data (needs rasterization) |
| devicePixelRatio | Built-in | Manual |
| Touch support | Built-in | Manual |
| Bezier smoothing | Yes | Yes (more sophisticated) |
| Integration with pdf-lib | Direct (embedPng) | Extra step (canvas rasterization) |
| Maintenance | Active (szimek) | Stable, less active |

signature_pad outputs a PNG data URL from `.toDataURL()`. pdf-lib's `embedPng()` accepts that directly. No intermediate step needed. Use perfect-freehand only if you need the aesthetics of variable-width brush strokes and are willing to add a canvas render step.

---

## Framework Choice: Vite + React (not Next.js)

**Use Vite + React, not Next.js.**

Next.js App Router is designed around React Server Components. Every library that touches `window`, `document`, or `canvas` — which is every library in this stack (pdf.js, signature_pad, react-rnd, idb-keyval) — requires `"use client"` directives and SSR bailouts. You end up fighting the framework's defaults constantly.

Vite is a build tool that produces a static SPA. Every component is client-side by default. The `dist/` folder deploys to Vercel with zero configuration:

```json
// vercel.json (only needed for SPA routing)
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

Vercel's "Vite" preset detects and deploys automatically. No vendor lock-in.

**The one exception**: If FreeESign later needs server-side SEO (Open Graph meta tags, landing page search indexing) and you want proper SSR for the marketing page only, migrate to Astro with an "island" architecture — the Astro static shell with a React island for the actual signing tool. But this is unnecessary for v1.

---

## Local Persistence Strategy

**Use idb-keyval for all persistent data.**

| What to persist | Storage | Reason |
|-----------------|---------|--------|
| Saved signature images (drawn) | IndexedDB (idb-keyval) | PNG data URLs are 50–200 KB each. localStorage 5 MB limit means 25–100 signatures max, which seems fine, but browser behavior varies — Chrome enforces 5 MB, Safari enforces 2.5 MB, Firefox 5 MB. IndexedDB gives gigabytes and stores Blob natively (no base64 overhead). |
| Saved initials | IndexedDB (idb-keyval) | Same reasoning |
| User preferences (last font, last pen color) | localStorage | Small strings, fine for localStorage. Keep simple. |

**idb-keyval API is trivial:**

```typescript
import { set, get, del, keys } from 'idb-keyval';

await set('sig:default', { id: 'default', dataUrl: '...', createdAt: Date.now() });
const sig = await get('sig:default');
```

---

## Buy Me a Coffee Integration

Simplest approach — no library needed. The official widget is a script tag:

```typescript
// src/components/BuyMeCoffee.tsx
import { useEffect } from 'react';

export function BuyMeCoffee() {
  useEffect(() => {
    const script = document.createElement('script');
    script.setAttribute('data-name', 'BMC-Widget');
    script.setAttribute('data-cfasync', 'false');
    script.src = 'https://cdnjs.buymeacoffee.com/1.0.0/widget.prod.min.js';
    script.setAttribute('data-id', 'YOUR_BMC_SLUG');
    script.setAttribute('data-description', 'Support me on Buy me a coffee!');
    script.setAttribute('data-color', '#40DCA5');
    script.setAttribute('data-position', 'Right');
    script.setAttribute('data-x_margin', '18');
    script.setAttribute('data-y_margin', '18');
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, []);
  return null;
}
```

Alternatively, skip the widget entirely and link to `buymeacoffee.com/YOUR_SLUG` as a plain `<a>` in the footer — simpler, faster page load, no third-party script.

---

## Installation

```bash
# Create project
npm create vite@latest free-esign -- --template react-ts
cd free-esign

# Tailwind v4
npm install tailwindcss @tailwindcss/vite

# PDF rendering
npm install react-pdf pdfjs-dist

# PDF editing + export
npm install pdf-lib @pdf-lib/fontkit

# Signature drawing
npm install signature_pad

# Drag + resize
npm install react-rnd

# Local persistence
npm install idb-keyval

# State management
npm install zustand

# Dev dependencies
npm install -D vitest @vitest/ui @testing-library/react @types/node
```

---

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

---

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

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| react-pdf@10.4.1 | pdfjs-dist@4.x | react-pdf pins its own pdfjs-dist; install pdfjs-dist separately only if you need to configure the worker — must match the version react-pdf installs |
| pdf-lib@1.17.1 | @pdf-lib/fontkit@1.1.1 | fontkit is a named dependency of pdf-lib; versions in sync as of 2025 |
| signature_pad@5.x | React 19 | No React dependency; plain TypeScript. Attach to a `<canvas>` ref via `useRef`. |
| react-rnd@10.5.3 | React 18/19 | Works with both; no React 19 issues reported |
| Tailwind v4 | Vite 8 | Use `@tailwindcss/vite` plugin (not the PostCSS plugin) for Vite — it's the recommended Vite integration |
| Zustand@5.x | React 19 | Zustand 5 fully supports React 19 concurrent features |

---

## Sources

- pdf-lib GitHub issue #639 (stream decompression confirmed) — HIGH confidence
- npm registry versions verified 2026-06-16 — HIGH confidence
- react-pdf GitHub discussions #1520 (worker version sync) — HIGH confidence
- Web search: Vite vs Next.js for client-only apps 2025–2026 — HIGH confidence (multiple sources converge)
- idb-keyval npm page (storage rationale) — HIGH confidence
- pdf-lib.js.org official docs (embedFont, drawImage, fontkit registration) — HIGH confidence
- Google Fonts repository (Dancing Script, Great Vibes, Pacifico availability as TTF) — HIGH confidence

---

*Stack research for: FreeESign — browser-only PDF e-signature tool*
*Researched: 2026-06-16*
