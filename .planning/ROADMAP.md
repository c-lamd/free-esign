# Roadmap: FreeESign

## Overview

FreeESign ships as five vertical slices, each delivering an observable end-to-end capability on top of the previous one. Phase 1 proves the core promise (open a document, see it rendered, no third-party requests). Phase 2 delivers the full signing loop with drawn signatures and zero-alteration download. Phase 3 enriches the workspace with all field types, zoom, multi-page controls, and undo/redo. Phase 4 adds typed signatures and saved/reusable signature persistence. Phase 5 wraps the tool in a public landing page and deploys it at free-esign.com.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation + PDF Viewer** - Scaffold the Vite/React/TS app, build and test the Coordinate Mapper, ingest PDFs and images, and render all pages — nothing leaves the browser
- [ ] **Phase 2: Core Signing Loop** - Place a drawn signature on any page, drag/resize/delete it, and download a zero-alteration signed PDF
- [ ] **Phase 3: Full Field Types + Workspace Controls** - Add initials, date, text, and checkbox fields; zoom with correct field scaling; multi-page placement; undo/redo; Word doc prompt
- [ ] **Phase 4: Typed Signatures + Signature Persistence** - Type a signature in script fonts; save and reuse signatures and initials across sessions via IndexedDB
- [ ] **Phase 5: Landing Page + Launch** - Publish the personal hero landing page, pass the privacy audit, deploy to Vercel at free-esign.com

## Phase Details

### Phase 1: Foundation + PDF Viewer
**Goal**: Users can open any PDF or image and view every page rendered in the browser, with the project wired for zero third-party network requests and a tested Coordinate Mapper ready for Phase 2.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: DOC-01, DOC-02, DOC-03, PRV-01, PRV-02
**Success Criteria** (what must be TRUE):
  1. User can drag-and-drop or browse to open a PDF and see the first page rendered on screen
  2. User can open a JPG or PNG and see it displayed as a document (image wrapped to PDF internally)
  3. User can navigate forward and backward through all pages of a multi-page PDF
  4. After loading any document, the DevTools Network tab shows zero requests to third-party origins (fonts, CMaps, and the pdf.js worker all served from the app's own origin)
  5. The Coordinate Mapper round-trip test passes: a point converted to PDF-space and back lands within floating-point tolerance of the original CSS pixel position at any zoom and rotation
**Plans**: TBD
**UI hint**: yes

### Phase 2: Core Signing Loop
**Goal**: Users can draw a signature, place it on a document, reposition and resize it, and download the signed file — with the original PDF bytes provably unaltered.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: SIG-01, FLD-01, FLD-05, FLD-06, FLD-07, EXP-01, EXP-02, EXP-03
**Success Criteria** (what must be TRUE):
  1. User can open the signature draw pad, draw a signature with mouse or touch, and confirm it
  2. User can tap or click to place the drawn signature on the document and see it appear as a draggable overlay widget
  3. User can drag the placed signature to reposition it and resize it with handles; it stays locked to the correct page position
  4. User can delete a placed signature field
  5. User can click "Download" and receive a signed PDF; a hex comparison of the first 512 bytes of input and output shows the original content bytes are identical (zero-alteration guarantee proven)
  6. User who uploaded an image receives a downloadable PDF containing that image plus the placed signature
**Plans**: TBD
**UI hint**: yes

### Phase 3: Full Field Types + Workspace Controls
**Goal**: Users can annotate documents with initials, dates, free text, and checkboxes; zoom in and out without fields drifting; place fields on any page of a multi-page document; undo and redo changes; and receive a helpful prompt when they attempt to open a Word file.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: DOC-04, DOC-05, FLD-02, FLD-03, FLD-04, FLD-08, FLD-09
**Success Criteria** (what must be TRUE):
  1. User can place initials, a date (defaulting to today, editable), free text (typed inline), and a checkbox/X mark on the document
  2. User can zoom the document to any level from 50% to 200%; all placed fields scale and stay pixel-perfectly aligned with the underlying page content
  3. User can place fields on any page of a multi-page PDF, and each field downloads at the correct position on its page
  4. User can undo and redo placement and deletion actions (at least 10 levels)
  5. When the user tries to open a .doc or .docx file, the app displays a clear instruction to export to PDF first — no silent conversion attempt
**Plans**: TBD
**UI hint**: yes

### Phase 4: Typed Signatures + Signature Persistence
**Goal**: Users can create signatures by typing their name in a script font, and can save any signature or initials to be reused across browser sessions without re-drawing.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: SIG-02, SIG-03, SIG-04, SIG-05
**Success Criteria** (what must be TRUE):
  1. User can type their name and choose from at least three script fonts; the rendered signature embeds correctly in the exported PDF
  2. User can save a drawn or typed signature (and separately, initials) and see it in a saved-signatures panel
  3. After closing and reopening the browser, saved signatures and initials are still present and placeable
  4. User can view all saved signatures and initials and delete any of them individually
**Plans**: TBD
**UI hint**: yes

### Phase 5: Landing Page + Launch
**Goal**: The app is publicly live at free-esign.com with a landing page that communicates the privacy-first value proposition, passes a zero third-party network request audit, and includes an optional tip link.
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: LND-01, LND-02, LND-03, LND-04, PRV-03
**Success Criteria** (what must be TRUE):
  1. Visiting free-esign.com shows a landing page with a personal, candid hero section and a clear explanation that files never leave the browser
  2. The landing page links to the signing app and includes an optional "Buy Me a Coffee" link
  3. A DevTools Network audit of the full signing workflow (open PDF, place fields, download) shows zero requests to analytics, tracking, or error-reporting third parties
  4. The app is live and accessible at free-esign.com served from the Vercel deployment
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation + PDF Viewer | 0/TBD | Not started | - |
| 2. Core Signing Loop | 0/TBD | Not started | - |
| 3. Full Field Types + Workspace Controls | 0/TBD | Not started | - |
| 4. Typed Signatures + Signature Persistence | 0/TBD | Not started | - |
| 5. Landing Page + Launch | 0/TBD | Not started | - |
