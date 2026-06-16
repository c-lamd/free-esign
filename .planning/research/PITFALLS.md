# Pitfalls Research

**Domain:** Browser-only client-side PDF e-signature (self-signing, privacy-first)
**Researched:** 2026-06-16
**Confidence:** HIGH

---

## Critical Pitfalls

### Pitfall 1: pdf-lib `save()` Rewrites the Entire Document — The Core Promise Breaks

**What goes wrong:**
`PDFDocument.load()` followed by `PDFDocument.save()` serializes the entire PDF structure from scratch. The output bytes are NOT the original file with something appended — they are a freshly generated PDF that happens to represent the same content. This silently violates the product's headline promise ("original content unaltered"). Lossy or structural changes that existing tools get wrong (losing compression, altering object IDs, dropping PDF features) can occur in this round-trip.

**Why it happens:**
pdf-lib is primarily a PDF generation library. Its load/save cycle parses the PDF object graph into memory and re-serializes it. Developers assume "load then save" is lossless because the visible content looks correct on screen.

**How to avoid:**
Use the `pdf-lib-incremental-save` package (or a manual incremental-update approach) which appends a new cross-reference section and new objects to the original bytes without touching the original body. The original file bytes from `ArrayBuffer` are kept verbatim; only the overlay additions (signature images, text) go into the appended section. Verify by diffing the first N bytes of input and output — they must be identical.

**Warning signs:**
- Output file size is significantly different from input (not just larger by the overlay data).
- Opening the output in a hex editor shows no resemblance to the first 1024 bytes of the input.
- Embedded form fields, hyperlinks, or annotations from the original are gone in the signed output.
- JavaScript console shows `PDFDocument.save()` is called without `saveIncremental()` anywhere in the codebase.

**Phase to address:**
PDF overlay phase (the phase that first adds signatures to PDFs). Establish the incremental-save pattern from day one; retrofitting is painful.

---

### Pitfall 2: Coordinate System Inversion — Signatures Land in the Wrong Place

**What goes wrong:**
The browser DOM and canvas use a top-left origin (y increases downward). pdf-lib uses the PDF user-space coordinate system with a bottom-left origin (y increases upward). A signature placed by the user at DOM position `(x=100, y=200)` on a 792-point-tall page must be mapped to pdf-lib coordinates `(x=100, y=792−200−sigHeight)`. Missing this inversion places every signature mirrored vertically — near the bottom when the user placed it near the top, and vice versa.

**Why it happens:**
The DOM and canvas feel "correct" to web developers. The PDF coordinate system is invisible until you actually render the signed output and see the misplaced overlay.

**How to avoid:**
Establish a single coordinate-conversion function early and use it everywhere:
```
pdfY = page.getHeight() - domY - overlayHeight
```
Use `page.getHeight()` not a hardcoded `792` — pages vary. Write a unit test with known values (place a mark at DOM top-left; verify it appears at PDF top-left in the output).

**Warning signs:**
- Signatures appear at the bottom of the page when placed near the top, or vice versa.
- Placement looks correct for landscape pages but wrong for portrait (or vice versa) — suggests width/height were swapped.
- Multi-page documents have correct placement on page 1 but wrong on subsequent pages that have different heights.

**Phase to address:**
PDF overlay phase. Requires a coordinate test fixture before any real-user testing.

---

### Pitfall 3: devicePixelRatio / Retina Doubling — Signatures Are Off by 2x

**What goes wrong:**
pdf.js renders the PDF page to a canvas scaled by `devicePixelRatio` (typically 2 on Retina / HiDPI displays). The canvas DOM element's CSS width is the "logical" size, but its pixel buffer is 2x that in each dimension. If you record the user's signature drop position in canvas pixel coordinates rather than logical CSS coordinates, every position is off by a factor of `devicePixelRatio` when converting to pdf-lib points.

**Why it happens:**
`canvas.width` and `canvas.height` return physical pixels; `canvas.getBoundingClientRect()` returns CSS (logical) pixels. Developers mix the two. Mouse/touch events give logical coordinates; naive division by the pdf.js viewport scale (e.g. `1.5`) misses the additional `devicePixelRatio` factor.

**How to avoid:**
The safe formula for converting an overlay element's DOM position to PDF user-space points:
```
const rect = canvasEl.getBoundingClientRect()
const scaleX = viewport.width / rect.width      // includes dpr and zoom
const scaleY = viewport.height / rect.height
const pdfX = (domX - rect.left) * scaleX
const pdfY_fromBottom = page.getHeight() - (domY - rect.top) * scaleY - overlayHeight
```
Never use `canvas.width / viewport.width` — that introduces the dpr error.

**Warning signs:**
- Signatures land correctly at zoom 100% but are wrong at other zoom levels.
- Signatures are off by exactly 2x on a MacBook Pro / external Retina monitor but correct on a standard 1080p display.
- The overlay `<div>` looks right on screen, but the exported PDF places the signature in the wrong spot.

**Phase to address:**
PDF overlay phase. Test explicitly on a Retina display and at 150%/200% browser zoom before shipping.

---

### Pitfall 4: Page Rotation (90°/180°/270°) Flips or Misplaces Overlays

**What goes wrong:**
A PDF page can have a `/Rotate` entry (0, 90, 180, 270) that rotates the page for display but does not rotate the underlying coordinate system. pdf.js applies the rotation automatically when rendering to canvas, so the canvas looks "upright." But the PDF coordinate origin and axis directions are still relative to the unrotated page. An overlay placed at canvas position `(x, y)` on a 90°-rotated page must be transformed through the rotation matrix before writing to pdf-lib — otherwise the signature lands in the wrong corner entirely.

**Why it happens:**
Developers test only with normally-oriented PDFs. Rotated scanned documents are common real-world inputs (phone photos saved as PDFs, faxes, etc.).

**How to avoid:**
Use the pdf.js `viewport` transform matrix to map from canvas coordinates back to PDF user-space. The viewport already encodes scale + rotation:
```
const [pdfX, pdfY] = viewport.convertToPdfPoint(canvasX, canvasY)
```
Then adjust for the bottom-left origin as needed. Do not hand-roll a rotation transform.

**Warning signs:**
- Placement is perfect on normally-oriented PDFs but wildly wrong (wrong quadrant) on rotated pages.
- Landscape PDFs that are stored as rotated portrait pages exhibit misplacement.
- The test suite only uses portrait, unrotated PDFs.

**Phase to address:**
PDF overlay phase. Add at least one rotated-page test PDF (90° and 180°) to the test fixtures.

---

### Pitfall 5: Zoom Level Not Factored Into Coordinate Conversion

**What goes wrong:**
The user can zoom the PDF viewer (e.g. to 125% or 75% to fit wide pages). The canvas is re-rendered at the new viewport scale. If the overlay `<div>` positions are stored in canvas-relative pixels without accounting for the current zoom scale, a signature placed at zoom 150% will be written to the PDF at 1.5x the intended position.

**Why it happens:**
Developers build the coordinate conversion for a fixed zoom level (usually 1.0 or "fit to window") and forget to pass the current viewport scale through to the coordinate converter.

**How to avoid:**
Always derive coordinates relative to the rendered canvas `getBoundingClientRect()` at the moment of export, not at the moment of placement. The viewport scale is implicit in `rect.width / page.getWidth()`. Alternatively, store overlay positions in PDF user-space points at placement time (immediately converting via `viewport.convertToPdfPoint`) so zoom changes don't affect stored positions.

**Warning signs:**
- Signatures placed at non-100% zoom land in the wrong position in the PDF.
- Position error is proportional to zoom level (off by 1.5x at 150%, off by 0.75x at 75%).

**Phase to address:**
PDF overlay phase. Add zoom-level regression test.

---

### Pitfall 6: Typed-Signature Font Embedding Failure — WinAnsi vs. Unicode

**What goes wrong:**
pdf-lib's built-in fonts (Helvetica, Times-Roman, etc.) use WinAnsi encoding (Windows-1252), which covers only 218 Latin characters. Any typed character outside that set — accented characters beyond basic Latin, Cyrillic, CJK, or even the curly apostrophe — throws `Error: WinAnsi cannot encode "X"` at runtime, crashing the export. Even if the user only uses ASCII, script/cursive fonts for typed signatures must be custom-embedded; they are not available as PDF standard fonts.

**Why it happens:**
Developers test with ASCII-only typed names. The crash only surfaces when a user types a name with an accent or non-Latin character.

**How to avoid:**
Always embed script fonts using fontkit: `pdfDoc.registerFontkit(fontkit)` + `pdfDoc.embedFont(fontBytes, { subset: true })`. The `subset: true` flag tells fontkit to include only the glyphs actually used, keeping file size small. For the small number of glyphs in a typed signature, subsetting is safe. Add a fallback: if a glyph is not in the embedded font, warn the user rather than silently dropping it or crashing.

**Warning signs:**
- `WinAnsi cannot encode` errors in the console during export.
- Export succeeds for "John Smith" but fails for "François Müller."
- The typed signature renders correctly on screen (canvas/HTML) but the PDF shows boxes or missing characters.

**Phase to address:**
Typed-signature feature phase. Choose font files and embed them before shipping typed signatures.

---

### Pitfall 7: pdf.js Worker Not Loaded — Blank or Erroring PDF Viewer

**What goes wrong:**
pdf.js requires a Web Worker (`pdf.worker.mjs` or `pdf.worker.min.mjs`) to run PDF parsing off the main thread. Vite and Next.js bundlers do not automatically resolve the worker file path. Common symptoms: the PDF viewer loads but the canvas stays blank; the console shows "Setting up fake worker" (meaning the worker failed and pdf.js degraded to a slow synchronous mode); or a 404 for the worker file in production but not in development (because Vite's dev server resolves it differently than the production build).

**Why it happens:**
The worker is loaded via a URL (`GlobalWorkerOptions.workerSrc`), not a normal import. Bundlers do not follow URL string references for code splitting. The worker file path often includes a content hash in production that differs from the hardcoded path.

**How to avoid:**
Copy the worker file to the `public/` directory at build time and point to its static path:
```js
import { GlobalWorkerOptions } from 'pdfjs-dist'
GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
```
Add a build step that copies `node_modules/pdfjs-dist/build/pdf.worker.min.mjs` to `public/`. Pin the pdfjs-dist version and include the copy step in the CI pipeline so upgrades don't silently break it.

**Warning signs:**
- "Setting up fake worker" in the console.
- PDF rendering works in dev but not in the Vercel production build.
- Network tab shows 404 for the worker URL.
- Worker path contains `?url` or a hash that changes between builds.

**Phase to address:**
PDF viewing phase (first phase that renders PDFs). Establish the worker setup pattern before any rendering work.

---

### Pitfall 8: pdf.js CMaps Missing — Non-Latin Text Renders as Boxes

**What goes wrong:**
PDFs that use CJK (Chinese, Japanese, Korean), Arabic, or other non-Latin character encodings require CMap files for text extraction and correct rendering. Without CMap configuration, those characters render as boxes or are silently omitted. pdf.js will log "Error: Missing data [cmap]" or render blank text runs. This affects scanned PDFs with embedded OCR text and any document from a non-English locale.

**Why it happens:**
CMap files are not included in the default pdfjs-dist bundle. Developers never test with non-Latin PDFs.

**How to avoid:**
Configure cMapUrl to point to a bundled or CDN-hosted copy of the CMap files:
```js
pdfjsLib.getDocument({
  url: pdfUrl,
  cMapUrl: '/cmaps/',         // served from public/cmaps/
  cMapPacked: true,
})
```
Copy `node_modules/pdfjs-dist/cmaps/` to `public/cmaps/` at build time. Note: serving CMap files from a third-party CDN (e.g. jsDelivr) sends the PDF filename or structure to that CDN — avoid for privacy. Self-host them.

**Warning signs:**
- Console errors containing "cmap" or "MissingDataException."
- PDFs from Asian or Middle-Eastern users show blank or garbled text.
- Text renders correctly in Adobe Reader but is garbled in the in-app viewer.

**Phase to address:**
PDF viewing phase. Add a CJK test PDF to the fixture suite.

---

### Pitfall 9: Large PDF Memory Leaks — Tab Crashes on Multi-Page Documents

**What goes wrong:**
pdf.js renders each page to a canvas in memory. Without explicit cleanup, every rendered canvas (and its pixel buffer) stays alive. A 100-page PDF rendered at 150% zoom can consume 500 MB+ of RAM, causing the browser tab to crash or become unresponsive — especially on mobile. Additionally, uploading a 50 MB PDF as an `ArrayBuffer` and holding references to both the original bytes and the pdf.js document object doubles memory usage.

**Why it happens:**
Developers render all pages upfront for a multi-page viewer. Cleanup of `PDFPageProxy` and canvas contexts is not obvious.

**How to avoid:**
Render only the visible page (virtual rendering). Destroy pages that scroll out of view: `page.cleanup()`. Destroy the entire document when done: `pdfDoc.destroy()`. Release `ArrayBuffer` references when they are no longer needed (after embedding into pdf-lib). For very large files, warn the user and offer a file-size limit.

**Warning signs:**
- Chrome Task Manager shows the tab consuming >1 GB RAM on multi-page PDFs.
- "Aw, Snap" tab crashes on mobile with files >20 MB.
- Memory grows monotonically each time the user navigates between pages.

**Phase to address:**
PDF viewing phase. Add a 50+ page test PDF to performance testing.

---

### Pitfall 10: Drawn Signature Is Rasterized at Screen Resolution — Blurry in Print

**What goes wrong:**
The drawn signature is captured from a canvas as a PNG at the canvas's pixel resolution (e.g. 300×100 pixels at `devicePixelRatio=2`). When embedded in the PDF via `pdfDoc.embedPng()`, those pixels are placed into the PDF at 72 DPI (the PDF default coordinate unit). When the signed PDF is printed at 300 DPI, the rasterized signature appears blurry or pixelated — especially noticeable for thin cursive strokes.

**Why it happens:**
The connection between canvas pixel dimensions and the resulting print quality at arbitrary DPI is not obvious. The signature looks fine on screen.

**How to avoid:**
At export time, re-render the drawn signature to an offscreen canvas at a higher resolution (e.g. 4× the display size, or a fixed 600×200 px for a typical signature field). Export that high-resolution canvas as PNG and embed it. Alternatively, store the signature strokes as a vector path (using signature_pad's `toData()` method) and re-render at any target resolution before embedding.

**Warning signs:**
- The signature looks sharp on screen but pixelated/blurry when the signed PDF is printed.
- The embedded PNG is very small (e.g. 150×50 px) relative to the signature field size in the PDF.
- No upscaling step exists between canvas capture and `embedPng`.

**Phase to address:**
Signature drawing phase. Validate print quality before shipping.

---

### Pitfall 11: Signature Data in localStorage Blows the Quota — Silent Failure on iOS

**What goes wrong:**
A drawn signature stored as a base64 PNG in localStorage can be 30–100 KB per signature. After saving a few signatures and initials, the localStorage quota (5 MB per origin on most browsers, ~0 in iOS Safari private browsing) is exceeded. `localStorage.setItem()` throws `QuotaExceededError`. If this is not caught, the app silently fails to save the signature — the user loses it on page reload with no error message.

**Why it happens:**
localStorage is the simplest persistence API. The base64 overhead (~33%) and the per-origin quota combine to make it fragile for binary assets. Private browsing mode on iOS reduces the quota to near zero.

**How to avoid:**
Store signature image blobs in IndexedDB (via a wrapper like `idb` or `localforage`). IndexedDB supports much larger storage (hundreds of MB on most platforms). Wrap all storage writes in try/catch and surface a user-facing error when storage fails. Detect private browsing mode and warn that signatures will not persist after the session.

**Warning signs:**
- `QuotaExceededError` in the browser console.
- Signatures disappear on page reload without error message.
- App works in normal mode but saved signatures vanish in incognito/private mode.
- Multiple signatures + initials stored and the app is slower than expected (localStorage is synchronous).

**Phase to address:**
Signature persistence phase. Use IndexedDB from the start; retrofitting is non-trivial.

---

### Pitfall 12: Third-Party Code Leaks the Document — Privacy Promise Broken

**What goes wrong:**
Adding any of the following breaks the "never leaves the browser" guarantee:
- **Sentry / Bugsnag error reporters** — default configuration may serialize Error context including objects referenced in scope. If the PDF `ArrayBuffer` or filename is in scope when an error is caught, it can appear in the error report payload sent to Sentry's servers.
- **Google Fonts** — loading a script/cursive font from `fonts.googleapis.com` sends an HTTP request with Referer header exposing the app URL per user session.
- **Vercel Analytics / Speed Insights** — these are privacy-preserving (no cookies, anonymized) but still send page view events to Vercel's servers; they do not leak document content but must be disclosed.
- **CDN-hosted pdf.js / pdf-lib** — using a public CDN for these libraries means the CDN sees every page load. More critically, if CMap files are fetched from a third-party CDN at render time, the CDN request timing correlates with document rendering.

**Why it happens:**
Developers add monitoring and analytics out of habit. Google Fonts is used because it requires zero setup. The risk is non-obvious because no document bytes leave the browser in normal operation — but metadata and file presence information can.

**How to avoid:**
- Self-host all assets: script fonts (bundle in the app), pdf.js worker + CMaps (in `public/`), all libraries (via npm, not CDN).
- Use Vercel Analytics only if comfortable with the privacy policy and disclose it clearly on the landing page.
- Do not install Sentry or similar error-reporting SDKs. Use browser `console.error` or a privacy-safe local logger only.
- Audit the Network tab on first load with DevTools: zero third-party requests after the page loads is the target.
- Add a Content Security Policy that blocks any unexpected outbound connections.

**Warning signs:**
- DevTools Network tab shows requests to `fonts.googleapis.com`, `sentry.io`, `o*.ingest.sentry.io`, or `cdn.jsdelivr.net` after the user uploads a file.
- `connect-src` CSP header is absent or contains wildcard `*`.
- A Google Fonts `<link>` tag appears in `_document.tsx` or `index.html`.

**Phase to address:**
Infrastructure / deployment phase. Audit before the first public release. Do not add monitoring tools without privacy review.

---

### Pitfall 13: pdf-lib Hyperlinks and Annotations Lost From Original PDF

**What goes wrong:**
When a PDF with hyperlinks (URL annotations, internal page-jump links) is loaded with `PDFDocument.load()` and then saved with the standard `save()`, link annotations ARE preserved in the object graph — but if `drawPage` is used to copy pages to a new document, or if any page manipulation is done that moves page content to a new `PDFPage`, the link annotations are silently dropped. The user sees a signed document that has lost all clickable links from the original.

**Why it happens:**
pdf-lib's `copyPages` and `drawPage` APIs are commonly used to copy/merge pages but are not annotation-aware. Annotations have indirect references to the original page dictionary; copying only the content stream loses the annotation array.

**How to avoid:**
Never copy pages into a new PDFDocument to add signatures. Always add signature overlays to the existing loaded document in-place (add drawing operators / embedImage on the existing page). Use incremental save to avoid touching the page structure at all. Verify by comparing annotation count before and after signing a link-rich PDF.

**Warning signs:**
- Hyperlinks present in the original are gone in the signed output.
- The code path includes `PDFDocument.create()` followed by `copyPages`.
- Users report that table-of-contents links in signed contracts no longer work.

**Phase to address:**
PDF overlay phase. Use in-place overlay from the start.

---

### Pitfall 14: Scanned / Image-Only PDFs — No Coordinate Reference for Placement

**What goes wrong:**
A scanned document is a PDF containing one large image per page (no text, no vector content). pdf.js renders it correctly for display, but the "page" is just a raster image. There is no coordinate grid visible to the user. If the user places a signature field, the placement still works (it's just positioned over the image), but two subtle bugs appear: (1) the page dimensions in PDF units may not match the rendered canvas size if the scan was embedded at non-standard DPI, causing placement scaling to be off; (2) scanned pages are often portrait-stored but displayed rotated (see Pitfall 4), compounding coordinate errors.

**Why it happens:**
Most test PDFs are text PDFs generated by word processors. Scanned PDFs have different internal structure and often non-standard dimensions (e.g. a 300 DPI scan of a letter page is 2550×3300 pixels, stored as a PDF page of arbitrary size).

**How to avoid:**
Use `page.getWidth()` and `page.getHeight()` from pdf-lib at export time, never assume page dimensions. Test with actual scanned PDFs (from mobile scan apps, older scanners). Verify placement accuracy on scanned documents in the QA checklist.

**Warning signs:**
- Signatures on scanned PDFs are offset from where the user placed them.
- The page appears correct on screen but the signature overlay in the PDF is shifted.
- Test suite only uses programmatically generated PDFs.

**Phase to address:**
PDF overlay phase + QA checklist.

---

### Pitfall 15: iOS Safari Touch Events — Signature Drawing Broken or Scroll Hijacked

**What goes wrong:**
Two competing failure modes on iOS Safari:
1. **Scroll prevention**: The signature canvas must call `event.preventDefault()` on `touchmove` to prevent the page from scrolling while the user draws. Adding the listener as `{ passive: false }` achieves this but triggers a browser warning; omitting it means drawing causes the page to scroll instead of capturing the stroke.
2. **Multi-touch jumps**: If the user accidentally touches the canvas with two fingers (common on mobile), signature_pad can receive two touch points and draw a line between them, creating a spurious stroke that jumps across the canvas.

**Why it happens:**
`signature_pad` has had known issues with these on iOS. The default configuration doesn't handle multi-touch rejection. iOS's scroll behavior differs from Android.

**How to avoid:**
Add `touch-action: none` CSS to the signature canvas — this is the preferred modern approach and does not require `{ passive: false }` in many browsers. For iOS Safari specifically, also add `{ passive: false }` on the touchmove listener. Add a `pointerdown` check to reject events with more than one active pointer (multi-touch). Test on an actual iOS device, not just Safari on macOS.

**Warning signs:**
- Drawing works on desktop but the page scrolls instead of capturing strokes on iPhone.
- Drawn signatures have random diagonal lines across them (multi-touch artifact).
- The app has `overflow: scroll` on the page body without `touch-action: none` on the canvas.

**Phase to address:**
Signature drawing phase. Mobile testing is required before any user-facing release.

---

### Pitfall 16: Next.js SSR Breaks pdf.js and Canvas — "window is not defined"

**What goes wrong:**
pdf.js accesses `window`, `document`, and `Worker` during module initialization. Next.js server-side rendering does not have these globals. Importing `pdfjs-dist` at the top level of a Next.js page/component causes a build or runtime error: `ReferenceError: window is not defined` or `Worker is not defined`. Additionally, `<canvas>` elements rendered on the server produce a hydration mismatch because the server HTML contains no canvas content but the client renders into one.

**Why it happens:**
pdf.js is a browser-only library; Next.js's default behavior is to server-render all components.

**How to avoid:**
Use `next/dynamic` with `{ ssr: false }` for all components that use pdf.js or canvas:
```js
const PDFViewer = dynamic(() => import('../components/PDFViewer'), { ssr: false })
```
Never import `pdfjs-dist` at module scope in a Next.js file that is also server-rendered. Alternatively, structure the app as a fully static export (`output: 'export'`) with no server rendering at all.

**Warning signs:**
- `ReferenceError: window is not defined` in Next.js build output or server logs.
- Hydration error: "Text content does not match server-rendered HTML."
- PDF viewer works in `next dev` but crashes in `next build`.

**Phase to address:**
Project scaffolding / PDF viewing phase. Establish the `ssr: false` pattern in the very first PDF viewer component.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Use `localStorage` for signatures | Simpler API, no async code | Quota errors on iOS private browsing, synchronous blocking | Never — use IndexedDB from the start |
| Load Google Fonts for script typefaces | Zero setup | Breaks privacy promise; third-party CDN request on every page load | Never — bundle fonts as assets |
| Use `PDFDocument.save()` (full rewrite) instead of incremental save | Simpler code path | Violates "unaltered original" promise; loses nothing visually but breaks the core value prop | Never for the overlay save path |
| Hardcode page height as 792 | Simpler coordinate math | Breaks for A4, landscape, and non-letter pages | Never |
| Render all PDF pages upfront | Simpler page navigation | Memory exhaustion on large or multi-page documents | Only for single-page PDFs during prototyping |
| Skip CMap configuration | Faster initial setup | Non-Latin PDFs render blank text | Never ship without CMaps |
| Add Sentry for error monitoring | Faster debugging | Privacy promise compromised | Never — use console-only logging |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| pdfjs-dist + Vite | Relying on bundler to resolve `pdf.worker.mjs` | Copy worker to `public/`, set `GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'` |
| pdfjs-dist + Next.js | Top-level import of pdfjs-dist in SSR component | Wrap in `dynamic(() => import(...), { ssr: false })` |
| pdf-lib + fontkit | Forgetting `pdfDoc.registerFontkit(fontkit)` before `embedFont` | Always register fontkit before embedding custom fonts |
| pdf-lib + fontkit | Embedding full font file (400–800 KB) for a single name | Use `{ subset: true }` in `embedFont` to reduce to <10 KB |
| signature_pad + mobile | Default event binding scrolls the page during drawing | Add `touch-action: none` CSS and test on real iOS device |
| Vercel deployment | Vercel Analytics enabled by default on Pro plans | Explicitly opt out or disclose on the privacy/landing page |
| pdfjs-dist CMaps from CDN | Fetching from jsDelivr/unpkg at render time | Self-host in `public/cmaps/` — no third-party requests after page load |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Rendering all pages of a multi-page PDF simultaneously | Tab memory grows to 1+ GB; crash on mobile | Render only the visible page; destroy others on scroll | PDFs >10 pages |
| Holding `ArrayBuffer` for entire PDF lifetime | Memory doubles (original bytes + pdf-lib object graph) | Release the ArrayBuffer reference after the PDFDocument is constructed | Files >10 MB |
| Storing base64 signature images in localStorage | `QuotaExceededError`; silent failure | Use IndexedDB, store raw PNG blobs | After 3–5 signatures or on iOS private mode |
| Re-rendering PDF page on every overlay position change | Laggy drag experience | Separate the overlay layer (HTML/CSS) from the static PDF canvas; only re-render PDF on zoom changes | Immediately noticeable on any drag operation |
| Importing entire `pdfjs-dist` bundle into the main bundle | Large initial JS payload; slow first load | Dynamic import pdf.js only when a file is uploaded | Bundle >2 MB; always avoidable |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Adding error-monitoring SDKs (Sentry, Bugsnag) without scrubbing | PDF content, filename, or user data in error payloads sent to third-party servers | Do not add server-side error reporting; use browser console only |
| Loading assets from third-party CDNs at runtime | CDN logs correlate page loads with document handling; implicit Referer leakage | Self-host all assets; Content Security Policy with explicit allow-list |
| No Content Security Policy | XSS or injected scripts could upload document data | Add strict CSP: `default-src 'self'`, no inline scripts, no external connects |
| Caching the PDF file object in a global variable | Other scripts (if present) or browser extensions could read it | Keep the ArrayBuffer in component-local state; release it after use |
| Using `URL.createObjectURL` for PDFs without revoking | Memory leak; the object URL can be accessed by other tabs in some browsers | Call `URL.revokeObjectURL` immediately after use |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Download filename is "download" or UUID | Users can't identify which document they signed | Generate filename as `originalName-signed.pdf` |
| No progress indicator on large PDF export | Users think the app is frozen during pdf-lib serialization | Show a spinner/progress bar during export; run in a Web Worker if >1s |
| Signature pad has no "clear" button | Users who make a mistake cannot redo their signature | Always provide clear + undo |
| Placed signature fields can't be removed once placed | User is stuck with a misplaced field | Provide a delete affordance on each placed field |
| No warning for Word docs uploaded as .docx | App silently fails or renders garbage | Detect MIME type on upload; show "Save as PDF first" modal for .docx |
| Typed signature renders at very small size in the PDF | The typed name is illegible at standard signature field size | Use a minimum font size (e.g. 24pt) and preview the result before export |
| "Legal disclaimer" missing entirely | Users may misunderstand e-signature vs. notarization scope | Add a single sentence: "This creates an electronic signature. Not a notarized or certified digital signature." |

---

## "Looks Done But Isn't" Checklist

- [ ] **Coordinate conversion:** Test with a 90°-rotated PDF — does the signature land where the user placed it?
- [ ] **Retina display:** Test on a MacBook or 4K display at `devicePixelRatio=2` — does placement match?
- [ ] **Zoom levels:** Test placement at 75%, 100%, and 150% zoom — do all three produce correct PDF output?
- [ ] **Original bytes preserved:** Hex-diff the first 512 bytes of the input PDF against the signed output — they must be identical.
- [ ] **Links preserved:** Sign a PDF with hyperlinks — do the links still work in the output?
- [ ] **Large file:** Upload a 30 MB, 50-page PDF — does the app stay responsive and avoid crashing?
- [ ] **Non-Latin characters:** Type "François" in a typed signature field — does export succeed without errors?
- [ ] **Private browsing / incognito:** Open the app in a private window, save a signature, reload — is the failure graceful?
- [ ] **iOS touch drawing:** Draw a signature on an iPhone — does the page scroll instead of drawing?
- [ ] **No third-party requests:** Open DevTools Network tab, upload a PDF, sign it, export — zero requests to non-origin URLs.
- [ ] **Scanned PDF:** Upload a phone-photographed PDF — does placement land in the right spot?
- [ ] **Downloaded filename:** Is the output file named `[original]-signed.pdf` rather than `download`?
- [ ] **Worker in production build:** Deploy to Vercel staging, open a PDF — no "Setting up fake worker" in the console.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Coordinate inversion discovered after launch | MEDIUM | Add conversion unit tests, fix the formula, re-test all page orientations |
| `save()` instead of incremental save discovered after launch | HIGH | Introduce `pdf-lib-incremental-save`, re-test that original bytes are preserved, audit what was lost (links, compression) |
| localStorage quota errors in production | MEDIUM | Migrate to IndexedDB (wrapper like `localforage` makes this incremental); keep localStorage as read-only fallback for existing data |
| Google Fonts leaking requests — privacy complaint | HIGH | Remove Google Fonts, bundle replacement fonts as assets, update privacy page, re-deploy |
| pdf.js worker 404 in production | LOW | Add worker to `public/`, re-deploy; no data loss |
| Font encoding crash on export | LOW | Add fontkit embedding with subset; test with accented characters before re-deploy |
| iOS scroll-instead-of-draw bug reported | LOW | Add `touch-action: none` CSS, test on device, re-deploy |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| pdf-lib full rewrite vs. incremental save | PDF overlay (phase implementing signed download) | Hex-diff first 512 bytes of input vs. output |
| Coordinate inversion (Y-axis) | PDF overlay | Signature-at-top test: must appear at top of exported PDF |
| devicePixelRatio doubling | PDF overlay | Test on Retina display at 2x; placement must be pixel-accurate |
| Page rotation coordinate errors | PDF overlay | Test with 90° and 180° rotated test PDFs |
| Zoom level coordinate errors | PDF overlay | Test placement at 75% and 150% zoom |
| Font encoding / WinAnsi crash | Typed signature feature | Test with "François", "Müller", "José" as typed names |
| pdf.js worker setup | PDF viewer (first rendering phase) | Verify no "fake worker" in Vercel production console |
| pdf.js CMap configuration | PDF viewer | Test with a CJK PDF; text must render (not boxes) |
| Large PDF memory leaks | PDF viewer | Load 50-page PDF, navigate all pages, check Chrome Task Manager |
| Drawn signature print quality | Signature drawing feature | Print the signed PDF; signature must be sharp |
| localStorage quota | Signature persistence feature | Test in iOS private browsing; failure must be graceful with user message |
| Third-party data leakage | Infrastructure / pre-launch audit | DevTools Network tab shows zero non-origin requests during sign + export |
| Hyperlinks lost from original | PDF overlay | Sign a PDF with links; verify links in output |
| Scanned PDF placement | PDF overlay + QA | Test with a scan from a mobile scan app |
| iOS touch drawing | Signature drawing feature | Test on real iPhone; no scroll-instead-of-draw |
| Next.js SSR breaking pdf.js | Project scaffolding / PDF viewer | Build and deploy to Vercel; no "window is not defined" errors |

---

## Sources

- [pdf-lib GitHub — WinAnsi cannot encode issue #1759](https://github.com/Hopding/pdf-lib/issues/1759)
- [pdf-lib GitHub — WinAnsi encoding error with non-latin text #1152](https://github.com/Hopding/pdf-lib/issues/1152)
- [pdf-lib GitHub — Links lost after combining PDFs #341](https://github.com/Hopding/pdf-lib/issues/341)
- [pdf-lib GitHub — drawPage loses hyperlink annotations #606](https://github.com/Hopding/pdf-lib/issues/606)
- [pdf-lib GitHub — Flatten form fields discussion #1485](https://github.com/Hopding/pdf-lib/discussions/1485)
- [pdf-lib GitHub — Coordinate conversion pixels to 1/72 inches #1427](https://github.com/Hopding/pdf-lib/discussions/1427)
- [pdf-lib GitHub — Issues calculating viewer coordinates for rotated PDF #1725](https://github.com/Hopding/pdf-lib/discussions/1725)
- [pdf-lib-incremental-save npm package](https://www.npmjs.com/package/pdf-lib-incremental-save)
- [pdf-lib-incremental-save GitHub — incremental update PR #1741](https://github.com/Hopding/pdf-lib/pull/1741)
- [pdf.js Bugzilla — worker setup issues](https://github.com/mozilla/pdf.js/issues/19519)
- [pdf.js — Vite worker import fails #19519](https://github.com/mozilla/pdf.js/issues/19519)
- [react-pdf — pdf.worker in Vite issue #1148](https://github.com/wojtekmaj/react-pdf/issues/1148)
- [pdf.js — Large PDF memory issue #15359](https://github.com/mozilla/pdf.js/issues/15359)
- [pdf.js — Memory/performance problems discussion](https://pdfjs.community/t/memory-performence-problems-with-specyfic-pdf-files/2487)
- [signature_pad — touchmove passive event listener issue #308](https://github.com/szimek/signature_pad/issues/308)
- [signature_pad — multi-touch jumps issue #787](https://github.com/szimek/signature_pad/issues/787)
- [MDN — Storage quotas and eviction criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
- [Datalogics — PDF Coordinate Systems](https://www.datalogics.com/pdf-rendering-coordinate-systems)
- [PDF.js Express — Viewer Coordinates](https://pdfjs.express/documentation/viewer/coordinates)
- [Nutrient — React PDF viewer with pdfjs-dist and Next.js](https://www.nutrient.io/blog/how-to-build-a-reactjs-viewer-with-pdfjs/)
- [Vercel Analytics Privacy Policy](https://vercel.com/docs/analytics/privacy-policy)
- [Next.js hydration error docs](https://nextjs.org/docs/messages/react-hydration-error)

---
*Pitfalls research for: browser-only client-side PDF e-signature (FreeESign)*
*Researched: 2026-06-16*
