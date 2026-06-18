# Phase 4: Typed Signatures + Signature Persistence - Context

**Gathered:** 2026-06-17
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — grey-area answers auto-accepted with best judgement per user authorization

<domain>
## Phase Boundary

Phase 4 lets users create signatures by **typing** their name in a script font (in addition to drawing), create reusable **initials** (drawn or typed), and **save** any signature or initials to reuse across browser sessions — backed by IndexedDB. It adds a saved-items panel to view, place, and delete them.

**In scope:** typed-signature/typed-initials creation with ≥3 script fonts; self-hosted script font assets + @font-face (on-screen) + @pdf-lib/fontkit embedding (export); IndexedDB persistence of saved signatures + initials (idb-keyval); a saved-items panel (view / place / delete).

**Out of scope (do NOT build here):** landing page / deploy (Phase 5); uploading a photo of a handwritten signature (ENH-01, v2); additional fonts/ink-color options beyond the v1 set (ENH-04, v2); multi-party (v2). The Phase 3 features (other field types, zoom, undo/redo, Word prompt) are done — don't touch them except where typed signatures plug in.
</domain>

<decisions>
## Implementation Decisions

### Area 1: Typed Signature / Initials Creation UX
- **Unified modal with tabs.** Extend the existing signature creation flow into a tabbed modal: **Saved · Draw · Type**. The same pattern applies to the initials modal. (Draw tab = the existing signature_pad canvas, unchanged.)
- **Type tab:** a single text input ("Your name") + a font picker offering **3 script fonts: Dancing Script, Great Vibes, Pacifico**. Live preview renders the typed text in the selected font. Confirm arms placement carrying the text + chosen font.
- **At least 3 fonts** satisfies SIG-02. Fonts are SIL OFL (Google Fonts origin) and MUST be self-hosted (see Area 5) — no CDN.
- **Initials (SIG-03):** identical tabbed modal ("Draw your initials" / "Type"), so initials can be drawn OR typed and saved.

### Area 2: Typed Signature Representation & Export (anti-rasterization)
- **Reuse existing `FieldType` values `'signature'` and `'initials'` — do NOT add new field types.** A signature/initials field is **image-backed** (`dataUrl`, drawn) OR **font-backed** (`textValue` + new `fontFamily`, typed). The widget and export branch on which payload is present.
- **Export = real embedded font, NOT a rasterized PNG.** Per CLAUDE.md's Typed Signature Font Embedding Strategy: register `@pdf-lib/fontkit`, embed the chosen script TTF (`subset: true`), and `drawText` the typed text. This keeps the signature crisp at any zoom, small, and real text — consistent with the project's no-rasterization guarantee. Drawn signatures still go through `embedPng`/`drawImage` unchanged.
- **Font sizing on export:** size the script text to fit the field box (fit to height, and scale down to fit width) so a typed signature fills its placed/resized box — extend the existing `drawTextInBox` sizing logic; do not simply truncate (truncation is for plain text/date fields, not signatures).
- **On-screen:** the typed-signature widget renders the text in the matching CSS `@font-face` script font (WYSIWYG with the export). Field carries `textValue` + `fontFamily`.
- **EXP-02 invariant unchanged:** typed signatures go through the same `takeSnapshot → markRefForSave(page.ref) → saveIncremental → concat` path. The byte-identity test must still pass. Embed fonts once before the field loop (only when a font-backed field exists).

### Area 3: Persistence (IndexedDB via idb-keyval) — SIG-04 / SIG-05
- **Storage:** `idb-keyval` (IndexedDB) — generous capacity for PNG dataURLs; localStorage's ~5 MB cap is too fragile (per CLAUDE.md persistence strategy).
- **Saved item shape:** `{ id, kind: 'signature' | 'initials', source: 'drawn' | 'typed', dataUrl?, text?, fontFamily?, createdAt }`. Drawn items carry `dataUrl`; typed items carry `text` + `fontFamily`.
- **Save on create:** the create modal includes a **"Save for reuse" checkbox (checked by default)**. When checked, confirming a drawn/typed signature/initials persists it to IndexedDB so it appears in the Saved tab next session.
- **Load on app mount:** hydrate the saved-items list from IndexedDB once on startup (SIG-04 — persists across sessions).
- **Delete (SIG-05):** each saved item has a delete control in the Saved tab/panel; deleting removes it from IndexedDB and the list.

### Area 4: Saved Panel Entry Point & Placement
- **The Saved tab inside the signature/initials modal is the panel.** It lists saved items (small previews — image thumbnail or text rendered in its font), grouped/filtered to the relevant kind (signatures modal shows saved signatures; initials modal shows saved initials).
- **Place a saved item:** clicking a saved item arms placement carrying its payload (dataUrl, or text+fontFamily) and closes the modal — same click-to-arm → click-to-drop flow as drawn signatures.
- **No accounts / no server:** everything is local to the browser (privacy constraint).

### Area 5: Fonts & Assets (self-hosted — PRV-02)
- Vendor the 3 script TTFs into the repo (e.g. `public/fonts/` or `src/assets/fonts/`) along with their SIL OFL `LICENSE` files. **Zero third-party network requests** — no Google Fonts CDN, no runtime fetch to any external origin. (Loading a same-origin `/fonts/*.ttf` is fine.)
- On-screen: `@font-face` declarations in `src/index.css` pointing at the self-hosted files.
- Export: load the same self-hosted TTF bytes (bundler import or same-origin fetch) and embed via fontkit. Confirm the chosen loading mechanism keeps the privacy audit clean (Phase 5 will audit zero third-party requests).

### Claude's Discretion
- Exact tab styling and modal layout (follow Phase 1–3 modal/token conventions; reuse SignatureDrawModal structure).
- Whether the font-backed widget uses a fixed font-size with autosized box or a fit-to-box scale (must visually match the export).
- The precise font-loading mechanism for embedding (Vite `?arrayBuffer`/`?url` import vs same-origin `fetch`) — pick the one that's simplest and keeps the privacy audit clean.
- Saved-item preview thumbnail rendering details and ordering (newest-first reasonable).
- idb-keyval key layout (single array key vs per-item keys).
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/SignatureDrawModal.tsx` / `src/components/InitialsDrawModal.tsx` — focus-trapped modals, signature_pad → transparent PNG, confirm calls `setSignatureDataUrl`/`setInitialsDataUrl` + `setArmedFieldType('signature'|'initials')`. Extend into tabbed (Saved/Draw/Type) modals; the Type tab is new.
- `src/store/fieldStore.ts` — `FieldType = 'signature'|'initials'|'date'|'text'|'checkbox'`; `PlacedField { id, type, pageNumber, pdf*, dataUrl?, textValue?, role? }`; state incl. `signatureDataUrl`, `initialsDataUrl`, `armedFieldType`, `modalOpen`, `initialsModalOpen`, `fields`, `history`/`historyIndex`. **Add** `fontFamily?` to PlacedField; **add** saved-items state + actions (`savedItems`, `loadSavedItems`, `addSavedItem`, `deleteSavedItem`) and a typed-arming seam (e.g. carry `{text, fontFamily}` when arming a typed signature/initials).
- `src/lib/exportPdf.ts` — per-type draw loop; fonts embedded once (StandardFonts.Helvetica/HelveticaBold) gated on `hasTextFields`; `drawTextInBox` (sizes to ~75% box height, truncates to width); `drawCheckboxX` (ASCII 'X'); EXP-02 incremental concat. **Add** `registerFontkit` + embed script TTF(s) once when a font-backed signature/initials field exists; **branch** signature/initials on `dataUrl` (drawImage) vs `textValue`+`fontFamily` (drawText with the matching embedded script font, sized to fit box — not truncated).
- `src/components/PlacedFieldWidget.tsx` — per-type render (img / input / ✕). **Add** font-backed branch: render `textValue` in `fontFamily` (CSS @font-face) for signature/initials fields lacking a dataUrl.
- `src/components/LazyPage.tsx` drop handler — creates field per `armedFieldType` with default sizes + dataUrl/textValue. **Extend** to populate `textValue`+`fontFamily` for typed signature/initials.
- `src/components/FieldPalette.tsx` — Signature→`openModal()`, Initials→`openInitialsModal()`. Unchanged entry points; the modals gain tabs.
- Tests: extend `signatureDraw.test.ts` (typed tab), `exportPdf.test.ts` (typed-signature font embedding + EXP-02 still passes), `fieldStore.test.ts` (saved-items actions). Add a saved-items/persistence test with a mocked idb-keyval. jsdom canvas mock already in `src/test/setup.ts`.

### Established Patterns
- PDF-space coordinate storage; immutable Zustand updates; click-to-arm → click-to-drop; aria-disabled over disabled; focus-trapped modals (Escape discards); transparent PNG for drawn signatures.
- EXP-02 zero-alteration via pdf-lib-incremental-save.
- **Self-hosted assets only — zero third-party network requests** (existing pdfjs worker + standard_fonts are already self-hosted in `public/`).

### New Dependencies (build-time; allowed)
- `@pdf-lib/fontkit@1.1.1` — register before embedding custom TTFs (`pdfDoc.registerFontkit(fontkit)`).
- `idb-keyval@6.2.5` — IndexedDB key-value for saved items.
- 3 self-hosted script TTFs (Dancing Script, Great Vibes, Pacifico) + their OFL license files.
</code_context>

<specifics>
## Specific Ideas

- WYSIWYG is the bar: the typed signature shown on screen must match the exported PDF glyphs — same TTF used for both the `@font-face` render and the fontkit embed.
- Honor the anti-rasterization stance: typed text is embedded as real vector font text, never a PNG of text.
- Persistence is local-only and private — no account, no server, no sync. IndexedDB on this origin only.
- Keep the saved panel inside the existing modal flow so there's one obvious place to create, reuse, and manage signatures.
</specifics>

<deferred>
## Deferred Ideas

- Upload a photo/scan of an existing handwritten signature → v2 (ENH-01).
- Additional fonts and signature ink-color options → v2 (ENH-04).
- Page-thumbnail sidebar, snap-to-align guides → v2 (ENH-02/03).
- Cross-device sync of saved signatures → out of scope (conflicts with privacy/browser-only model).
</deferred>
