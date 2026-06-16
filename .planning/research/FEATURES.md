# Feature Research

**Domain:** Browser-only, privacy-first PDF e-signature (self-signing)
**Researched:** 2026-06-16
**Confidence:** HIGH

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that every PDF signing tool has. Missing any of these causes users to immediately look elsewhere or feel the product is broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Drag-and-drop file upload | Standard for any file-based web app since ~2015; absence feels archaic | LOW | Also needs a fallback file-picker click. Accept PDF + common image types (PNG, JPG, WEBP). |
| File picker (click to browse) | Fallback for users who don't know drag-and-drop; mobile browsers often can't drag files | LOW | Native `<input type="file">` — trivial, must exist alongside drag-drop. |
| Multi-page PDF rendering | Almost every real document is multi-page; single-page-only feels like a toy | MEDIUM | Use PDF.js for rendering. Render pages lazily (PDF.js warns: do not render more than 25 pages simultaneously). |
| Page-by-page navigation (prev/next, jump) | Without navigation, multi-page documents are unusable | LOW | Simple prev/next arrows + page number input. Thumbnail sidebar is table stakes-adjacent but adds real complexity. |
| Draw signature (canvas, mouse/touch/trackpad) | Users universally expect to draw their signature; this is the core UX metaphor | MEDIUM | Signature Pad library (canvas-based). Variable stroke width makes it feel handwritten. Export as PNG/data-URL. |
| Type signature (script/handwriting fonts) | Many users prefer typed names rendered in a script font; draw is difficult on a laptop trackpad | LOW | 3–5 curated script fonts (e.g. Dancing Script, Pacifico, Caveat). Font subset to keep bundle small. |
| Place signature on document | The primary action; without this the product does nothing | HIGH | Requires canvas overlay on PDF.js-rendered pages. Each annotation is a positioned, resizable layer. |
| Drag placed fields to reposition | Users never place a field correctly on the first click; repositioning is expected | MEDIUM | Mouse/touch drag on annotation handles. Must handle coordinate mapping between canvas display and PDF coordinate space. |
| Resize placed fields | Signatures need to fit the signature line; one-size doesn't fit all | MEDIUM | Corner/edge handles. Maintain aspect ratio for signature images; free-resize for text fields. |
| Delete placed fields | Mistakes happen; there must be a way to remove a field | LOW | Click to select, then delete key or a trash button. |
| Date field (auto-populated today) | "Date signed" is on almost every signable document | LOW | Auto-fill with today's date on placement. Allow user to edit the text if needed. Common formats: MM/DD/YYYY vs DD/MM/YYYY — default to locale or a simple picker. |
| Free-text field | Often needed for printed name, title, address fields in contracts | LOW | Plain text input, resizable text box placed on the PDF. |
| Download signed PDF | The entire reason the user came; a product that can't export is useless | HIGH | Flatten annotations onto original PDF bytes using pdf-lib. Output as `[originalname]-signed.pdf`. |
| Original content preserved exactly | Users have been burned by other tools mangling formatting; this is a stated fear | HIGH | Overlay-only approach: never re-encode or regenerate the PDF. Embed annotations as image/text overlays on top of existing bytes. |
| Works without an account | The majority of one-off signers won't create an account; a forced signup causes abandonment | LOW | No auth, no backend, no session. |
| Works for free (no paywall on download) | Tools like Smallpdf and ilovepdf paywall the download; that is the #1 complaint | LOW | No paywall. The download button must always work. |

---

### Differentiators (Competitive Advantage)

Features that most tools do not get right, or that align directly with FreeESign's core value proposition.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| "Files never leave your browser" trust signal (prominent, early, repeated) | Privacy is the #1 unsatisfied need; most competitors upload documents to servers and retain them (Smallpdf: 1 hour; ilovepdf: similar). Users signing sensitive documents (employment, legal, financial) care intensely. | LOW | Engineering is already zero-upload; the differentiator is prominently communicating it. Add a persistent badge/banner in the editor and a dedicated section on the landing page. |
| Upload-image-of-signature method | Allows users to scan/photograph a wet ink signature and reuse it digitally | LOW | Third signature creation method alongside draw and type. Accept PNG, JPG; auto-remove background (white → transparent) is a nice addition but not required. |
| Saved signatures in localStorage (no login) | Reusing a saved signature is 10× faster than redrawing it every time; most browser-only tools don't persist this | LOW | Store up to ~5 signatures (drawn/typed/uploaded) in localStorage as data URLs. Name them (optional). |
| Initials field (separate from full signature) | Initials are a distinct, standard field in every document workflow; having them as a first-class field (not just a small text box) is user-friendly | LOW | Same creation flow as signature (draw/type/upload) but scoped to initials. Saved separately. |
| Checkbox / X field | Needed for agreements ("I agree to the terms"), yes/no selections, and form completion | LOW | Simple checked-box icon placed on the document. Toggle checked/unchecked on click. |
| Undo/redo for field operations | Accidental deletes or misplacements are frustrating; undo is the safety net | MEDIUM | Command stack for add/move/resize/delete operations. Ctrl+Z / Cmd+Z. Does not need to be deep (10 levels is plenty). |
| Zoom controls on the PDF viewer | Documents at default zoom are often too small to position fields precisely; competitors like Sejda explicitly warn users not to use browser zoom (it breaks the editor) | LOW | In-app zoom (50%–200%) that scales both the rendered PDF and the annotation overlay proportionally, avoiding the browser-zoom coordinate mismatch bug. |
| Page thumbnail sidebar | Makes multi-page navigation fast and visual; standard in desktop PDF tools but rare in free browser tools | MEDIUM | PDF.js can render small thumbnails. Clicking navigates; the active page is highlighted. Can be deferred but users of long documents will want this. |
| Word doc "save as PDF first" prompt | Rather than attempt a server-side or lossy conversion, honestly prompt the user | LOW | Detect `.doc`/`.docx` on upload. Show a friendly message explaining why, and link to Google Docs or Word "Export as PDF." |
| Personal, opinionated landing page hero | "Tired of free PDF signers that paywall the download or upload your documents to who-knows-where?" — authenticity and a clear villain story convert better than corporate copy | LOW | Content/copywriting work, not engineering. Lean into the origin story from PROJECT.md. |
| Optional "Buy Me a Coffee" tip (non-intrusive) | Honest monetization signal: the tool is genuinely free; supporting is optional; no ads | LOW | A small, tasteful link in the footer and maybe after a successful download. Never a modal or blocker. |
| Zero tracking / no analytics that phone home | Meaningful for privacy-conscious users; most competitors use Google Analytics or similar | LOW | Either use a privacy-respecting analytics tool (Plausible, Fathom) or no analytics. Never embed GA, Meta Pixel, etc. If any analytics, disclose it. |

---

### Anti-Features (Deliberately NOT Building for v1)

Features that seem valuable but are explicitly out of scope. Documenting the reasoning prevents scope creep.

| Anti-Feature | Why It Seems Appealing | Why It's Excluded | What to Do Instead |
|--------------|------------------------|-------------------|-------------------|
| User accounts / sign-up | "Save your documents and settings" sounds convenient | Conflicts with the privacy-first, browser-only model. Requires a backend, auth system, cloud storage — fundamentally changes the architecture and cost structure. Users signing sensitive docs do NOT want an account with their documents stored on someone else's server. | Persist signatures in localStorage. No document storage at all. |
| Cloud document storage / "recently signed docs" | Convenient for returning users | Requires uploading documents to a server. Violates the core "files never leave your browser" guarantee. | Do not store documents. If the user wants to keep the file, they download it. No cloud history. |
| Multi-party / send-to-others signing (DocuSign-style) | High-demand feature in the broader e-sign market | Requires email routing, signing order management, status tracking, audit trails, notification infrastructure, and a backend. 10× the build of v1. | Explicitly deferred. Architecture should not block it later, but do not build routing, recipient management, or email sending in v1. |
| Audit trail / certificate of completion | Adds legal credibility; enterprise tools generate PDF audit trail reports | Requires server-side event logging (who signed, when, from which IP). Not possible in a fully browser-side model. Also implies data retention — the opposite of privacy. | The downloaded signed PDF is the record. No separate audit document. |
| PKI / cryptographic digital signatures (X.509, eIDAS) | "Real" digital signatures; legally stronger in some jurisdictions | Requires certificate issuance, TSP integration, or user key management — a completely different product. Most individual signers simply do not need this; visual electronic signatures are legally sufficient for the vast majority of everyday documents (US ESIGN Act, EU eIDAS simple electronic signature tier). | Use visual electronic signature overlay. Optionally add a brief FAQ note: "Is this legally binding?" with an honest answer. |
| .docx / Word file conversion | Users do have Word files to sign | Faithful conversion requires either a server (LibreOffice, Word API) or a browser-based engine that shifts formatting (exactly the problem FreeESign exists to solve). A lossy conversion would undermine the "unaltered" promise. | Detect .docx on upload. Show a message: "Word files can shift formatting during conversion. Please export your document as PDF from Word or Google Docs first." |
| Native mobile app (iOS/Android) | Mobile signing is common | Out of scope for v1; Vercel deployment covers mobile browsers. Native apps require separate codebases, app store submissions, signing certificates, and maintenance overhead. | Ensure the web app is responsive and touch-friendly so mobile browser use works well. |
| PDF editing (merge, split, rotate, compress) | Power-user PDF tools; signaturepdf bundles these | Scope creep. FreeESign is a signing tool, not a PDF editor. Adding these features diffuses the value proposition. | Stay focused on signing. Link to Smallpdf/ilovepdf for those tasks. |
| Real-time collaboration / live co-signing | Two people placing fields simultaneously | Requires WebSockets, operational transforms, and a backend. Completely out of scope. | Not even a future roadmap item at this stage. |
| Embedded iframe / API for third-party integration | Developer use cases | Requires CORS setup, authentication tokens, and a documented API — a different product surface. | Not in scope for v1 or near-term. |
| Ads / sponsored content | Revenue diversification | Ads conflict with the clean, fast, privacy-respecting feel. They also add external JS that could compromise the "files never leave your browser" trust signal. | Optional Buy Me a Coffee only. |

---

## Feature Dependencies

```
[File Upload (drag-drop + picker)]
    └──required-by──> [PDF Rendering (PDF.js)]
                          └──required-by──> [Annotation Overlay System]
                                                ├──required-by──> [Signature Field Placement]
                                                ├──required-by──> [Initials Field Placement]
                                                ├──required-by──> [Date Field Placement]
                                                ├──required-by──> [Free Text Field Placement]
                                                └──required-by──> [Checkbox Field Placement]

[Signature Creation (Draw/Type/Upload)]
    └──required-by──> [Signature Field Placement]
    └──required-by──> [Initials Field Placement]

[Annotation Overlay System]
    └──required-by──> [Drag to Reposition]
    └──required-by──> [Resize Handles]
    └──required-by──> [Delete Field]
    └──required-by──> [Undo/Redo Stack]

[PDF Rendering]
    └──required-by──> [Page Navigation]
    └──required-by──> [Zoom Controls]
    └──optional──> [Page Thumbnail Sidebar]

[Annotation Overlay System] + [PDF.js pages]
    └──required-by──> [Flatten & Export (pdf-lib)]

[Saved Signatures (localStorage)]
    └──enhances──> [Signature Field Placement] (reuse without re-drawing)
    └──enhances──> [Initials Field Placement]

[Zoom Controls]
    └──conflicts-with──> [Browser native zoom] (must intercept Ctrl+scroll or warn user)
```

### Dependency Notes

- **PDF Rendering requires File Upload:** There is no document to render without upload. These are the foundation of everything else.
- **Annotation Overlay requires PDF Rendering:** The overlay canvas must be sized and positioned to match the rendered PDF page dimensions exactly. Coordinate systems must be kept in sync.
- **Flatten & Export requires both Overlay and PDF Rendering:** pdf-lib embeds annotations into the original PDF bytes. The annotation coordinates must be translated from display-space back to PDF coordinate space (PDF uses bottom-left origin; canvas uses top-left — a common source of bugs).
- **Undo/Redo requires Overlay system:** Undo operates on the annotation stack (add/move/resize/delete events). It does not undo PDF content changes (there are none).
- **Zoom and Annotation Overlay must scale together:** If zoom changes the rendered page size, all annotation positions and sizes must recalculate proportionally. This is a common source of off-by-one and drift bugs in competing tools (Sejda explicitly warns users not to use browser zoom for this reason).
- **Saved Signatures enhance but do not block:** Signing works without persistence; localStorage saves are a UX improvement.

---

## MVP Definition

### Launch With (v1)

The minimum set needed to fulfill the core value: "upload → place signature → download unaltered signed file."

- [x] Drag-and-drop + file picker upload (PDF and images) — without this, nothing works
- [x] Multi-page PDF rendering via PDF.js — real documents are multi-page
- [x] Page navigation (prev/next, page number jump) — required for multi-page usability
- [x] Draw signature (canvas, Signature Pad) — primary signing method
- [x] Type signature (3–5 script fonts) — essential for trackpad/laptop users
- [x] Place, drag, resize, delete signature field — the core interaction
- [x] Initials field (same creation flow as signature, stored separately) — standard in documents
- [x] Date field (auto-fills today, editable) — near-universal in signable documents
- [x] Free-text field (drag, resize) — required for name/title/address fields
- [x] Checkbox field — required for agreements and yes/no fields
- [x] Saved signatures in localStorage (draw/type/upload, reuse on next visit) — removes re-draw friction
- [x] Upload image of existing signature — third creation method, low effort
- [x] Flatten and download signed PDF (overlay-only, original bytes preserved) — the exit; without this the tool is useless
- [x] Zoom controls (in-app, not relying on browser zoom) — necessary for precise placement on dense documents
- [x] Undo/redo (Ctrl+Z / Cmd+Z, ~10 levels) — safety net for misplacement
- [x] Word doc prompt ("save as PDF first") — prevents a support problem
- [x] "Files never leave your browser" trust signal (prominent, in editor and on landing page) — core differentiator
- [x] Landing page: hero (honest, ranty), how-it-works, FAQ, Buy Me a Coffee link — needed for organic acquisition

### Add After Validation (v1.x)

Add these once the core signing flow is stable and getting real users.

- [ ] Page thumbnail sidebar — improves navigation on long documents; medium complexity; defer until multi-page UX is validated as a real pain point
- [ ] Snap-to-alignment guides — nice for precise placement; low-medium complexity; not a blocker
- [ ] Duplicate field — shortcut for placing the same field type multiple times; low complexity; add when users request it
- [ ] Date field format picker (MM/DD/YYYY vs DD/MM/YYYY vs ISO) — add when international users surface the request
- [ ] Signature color picker (black, blue, custom) — low complexity; some users prefer blue ink for "original copy" distinction
- [ ] "Place on all pages" toggle for fields like date — useful for multi-page documents with repeated fields

### Future Consideration (v2+)

Requires significant architecture investment or is explicitly out of scope for v1.

- [ ] Send to others for signature (multi-party routing) — the natural v2 milestone; requires email infrastructure, signing order, status tracking
- [ ] Audit trail / certificate of completion — only meaningful alongside multi-party signing
- [ ] PKI / cryptographic digital signatures — different product tier; add only if legal compliance requests emerge
- [ ] PDF editing features (merge, split, rotate) — separate tool surface; dilutes the signing focus

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| File upload (drag-drop + picker) | HIGH | LOW | P1 |
| Multi-page PDF rendering | HIGH | MEDIUM | P1 |
| Page navigation | HIGH | LOW | P1 |
| Draw signature | HIGH | MEDIUM | P1 |
| Type signature (script fonts) | HIGH | LOW | P1 |
| Signature field placement (drag, resize, delete) | HIGH | HIGH | P1 |
| Date field (auto-today) | HIGH | LOW | P1 |
| Free-text field | HIGH | LOW | P1 |
| Checkbox field | MEDIUM | LOW | P1 |
| Initials field | HIGH | LOW | P1 |
| Upload image of signature | MEDIUM | LOW | P1 |
| Saved signatures (localStorage) | HIGH | LOW | P1 |
| Flatten & download PDF | HIGH | HIGH | P1 |
| Zoom controls (in-app) | HIGH | MEDIUM | P1 |
| Undo/redo | HIGH | MEDIUM | P1 |
| "Files never leave browser" messaging | HIGH | LOW | P1 |
| Landing page (hero, how-it-works, FAQ) | HIGH | LOW | P1 |
| Buy Me a Coffee link | LOW | LOW | P1 |
| Word doc prompt | MEDIUM | LOW | P1 |
| Page thumbnail sidebar | MEDIUM | MEDIUM | P2 |
| Snap-to-alignment guides | MEDIUM | MEDIUM | P2 |
| Duplicate field shortcut | LOW | LOW | P2 |
| Signature color picker | LOW | LOW | P2 |
| Date format picker | LOW | LOW | P2 |
| "Place on all pages" toggle | MEDIUM | LOW | P2 |
| Multi-party signing routing | HIGH | HIGH | P3 |
| Audit trail | MEDIUM | HIGH | P3 |
| PKI digital signatures | LOW | HIGH | P3 |
| PDF merge/split/rotate | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for v1 launch
- P2: Should have; add in v1.x after validation
- P3: Future milestone (v2+); do not build now

---

## Competitor Feature Analysis

| Feature | Smallpdf | ilovepdf | Sejda | PDFGear | FreeESign (our approach) |
|---------|----------|---------|-------|---------|--------------------------|
| Draw signature | Yes | Yes | Yes | Yes | Yes |
| Type signature | Yes | Yes | Yes (10+ fonts) | Yes | Yes (3–5 curated fonts) |
| Upload signature image | Yes | Yes | Yes | Yes | Yes |
| Saved signatures | Account-based | Account-based | Yes (session) | No | localStorage, no account |
| Initials field | Yes | Yes | No | Partial | Yes, first-class |
| Date field | Yes | Yes | Yes | Yes | Yes (auto-today) |
| Free-text field | Yes | Yes | Yes | Yes | Yes |
| Checkbox | Yes | Yes | No | No | Yes |
| Drag to reposition | Yes | Yes | Yes | Yes | Yes |
| Resize | Yes | Yes | Yes | Yes | Yes |
| Undo/redo | No | No | No | No | Yes (differentiator) |
| Zoom (in-app) | Yes | Yes | Partial (warns about browser zoom) | Yes | Yes |
| Multi-page support | Yes | Yes | Yes | Yes | Yes |
| Page thumbnails | No | No | No | No | v1.x |
| Download free | No (paywall) | No (paywall) | Yes (3/hour limit) | Yes | Yes, always |
| No account required | No | No | Yes | Yes | Yes |
| Files browser-only | No (uploads) | No (uploads) | No (uploads) | Yes | Yes |
| Original bytes preserved | Unknown | Unknown | Unknown | Claimed | Hard guarantee |
| Privacy messaging prominent | No | No | No | Yes | Yes (core identity) |
| Word doc prompt | Converts (uploads) | Converts (uploads) | Converts (uploads) | Converts | Friendly prompt to export first |
| Open source | No | No | No | No | TBD |
| Multi-party signing | Yes (premium) | Yes (premium) | No | No | v2 future |

**Key takeaway:** No existing free, browser-only tool combines zero-upload privacy + no paywall + no account + undo/redo + original-bytes-preserved download. That combination is the FreeESign differentiation space.

---

## Sources

- [Jotform: 6 Best Free PDF Signing Tools in 2026](https://www.jotform.com/products/sign/best-free-pdf-signing-tools/)
- [Sejda Sign PDF](https://www.sejda.com/sign-pdf) — feature inventory
- [PDFGear Sign PDF Online](https://www.pdfgear.com/sign-pdf-online/) — privacy messaging patterns
- [Smallpdf Sign PDF](https://smallpdf.com/sign-pdf) — paywall model, upload-based
- [ilovepdf Sign PDF](https://www.ilovepdf.com/sign-pdf) — field types inventory
- [BoldSign: Why Browser-Based PDF Tools Are Safer](https://boldsign.com/blogs/why-browser-based-pdf-tools-are-safer/) — privacy messaging patterns
- [SwiftPDFLab: Best Private PDF Tools That Don't Upload Your Files](https://swiftpdflab.com/best-private-pdf-tools.html) — competitor landscape
- [signaturepdf (24eme, open source)](https://github.com/24eme/signaturepdf) — open source reference implementation (PHP + PDF.js + Fabric.js)
- [Nutrient: Save & Store Electronic Signatures in JavaScript](https://www.nutrient.io/guides/web/signatures/signature-storage/) — localStorage pattern, up to 10 signatures
- [Joyfill: Optimizing In-Browser PDF Rendering](https://joyfill.io/blog/optimizing-in-browser-pdf-rendering-viewing) — PDF.js performance limits (25 pages max simultaneous)
- [React PDF Discussions: Performance on Large PDFs](https://github.com/wojtekmaj/react-pdf/discussions/1691) — canvas rendering pitfalls
- [DocuSign Community: Auto-populate date field](https://community.docusign.com/esignature-111/am-i-able-to-auto-populate-the-date-field-2271) — date field UX expectations
- [Konva.js: Signature Pad Sandbox](https://konvajs.org/docs/sandbox/Signature_Pad.html) — canvas signature implementation reference

---

*Feature research for: browser-only PDF e-signature (self-signing)*
*Researched: 2026-06-16*
