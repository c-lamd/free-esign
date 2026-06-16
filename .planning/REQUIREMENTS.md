# Requirements: FreeESign

**Defined:** 2026-06-16
**Core Value:** Sign a PDF in your browser, for free, without your document ever leaving your device or being altered.

## v1 Requirements

Requirements for the initial release. Each maps to a roadmap phase (see Traceability).

### Document Handling

- [x] **DOC-01**: User can open a PDF by drag-and-drop or file picker
- [x] **DOC-02**: User can open an image (JPG/PNG) to sign
- [x] **DOC-03**: User can view and navigate all pages of a multi-page PDF
- [ ] **DOC-04**: User can zoom the document in and out, with placed fields scaling correctly with the page
- [ ] **DOC-05**: When a user selects a Word document (.doc/.docx), the app clearly instructs them to export it to PDF first — no silent conversion that could change formatting

### Signatures & Initials

- [ ] **SIG-01**: User can create a signature by drawing it with mouse, trackpad, or touch
- [ ] **SIG-02**: User can create a signature by typing it and choosing among several script fonts
- [ ] **SIG-03**: User can create reusable initials (drawn or typed)
- [ ] **SIG-04**: Saved signatures and initials persist in the browser across sessions (IndexedDB)
- [ ] **SIG-05**: User can view and delete their saved signatures and initials

### Field Placement

- [ ] **FLD-01**: User can place a saved signature anywhere on the document
- [ ] **FLD-02**: User can place initials, a date, free text, and a checkbox/X mark on the document
- [ ] **FLD-03**: User can set the date field value (defaults to today, editable)
- [ ] **FLD-04**: User can type the content of a free-text field
- [ ] **FLD-05**: User can drag any placed field to reposition it on the page
- [ ] **FLD-06**: User can resize a placed field using handles
- [ ] **FLD-07**: User can delete a placed field
- [ ] **FLD-08**: User can place fields on any page of a multi-page document
- [ ] **FLD-09**: User can undo and redo placement actions

### Export

- [ ] **EXP-01**: User can download the signed document as a PDF
- [ ] **EXP-02**: The exported PDF preserves the original content unaltered — overlays are appended to the original document bytes; the original is never re-encoded, reflowed, or rasterized
- [ ] **EXP-03**: A signed image is exported as a PDF containing that image plus the placed fields

### Privacy & Trust

- [x] **PRV-01**: All document processing happens entirely in the browser; the document is never uploaded to any server
- [x] **PRV-02**: All assets (script fonts, the PDF.js worker, CMaps) are self-hosted — no third-party CDN or network requests occur while signing
- [ ] **PRV-03**: The app includes no third-party analytics, tracking, or error reporting that could transmit document contents

### Landing & Launch

- [ ] **LND-01**: A landing page presents FreeESign with a personal, candid hero about how hard it is to find a truly free, private PDF signer
- [ ] **LND-02**: The landing page explains how it works and prominently states that files never leave the browser
- [ ] **LND-03**: The site includes an optional "Buy Me a Coffee" support link
- [ ] **LND-04**: The app is deployed publicly on Vercel and served at free-esign.com

## v2 Requirements

Deferred to a future release. Tracked but not in the current roadmap.

### Multi-party Signing

- **MP-01**: User can send a document to another person to sign (the v1 field data model reserves a recipient/role seam so this needs no rewrite)

### Enhancements

- **ENH-01**: User can upload an image of an existing signature as a third creation method
- **ENH-02**: Page thumbnail sidebar for quick navigation of long documents
- **ENH-03**: Snap-to-alignment guides when positioning fields
- **ENH-04**: Additional script-font choices and signature color/ink options

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Multi-party routing / audit trails (v1) | Far larger build (email routing, signing order, tracking); deferred to a future milestone. v1 architecture reserves the recipient/role seam. |
| User accounts / cloud sync | Conflicts with the privacy-first, browser-only model. Signatures persist locally instead. |
| Native .docx upload + conversion | Faithful Word→PDF conversion either shifts formatting (the exact problem we solve) or requires a server. Users export to PDF first. |
| Cryptographic / PKI digital signatures | Visual electronic signatures cover what virtually everyone needs; certificate-based signing is a different, heavier product. |
| Server-side document storage or processing | Documents must never leave the browser — a core privacy promise. |

## Traceability

Which phases cover which requirements. Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DOC-01 | Phase 1 | Complete |
| DOC-02 | Phase 1 | Complete |
| DOC-03 | Phase 1 | Complete |
| PRV-01 | Phase 1 | Complete |
| PRV-02 | Phase 1 | Complete |
| SIG-01 | Phase 2 | Pending |
| FLD-01 | Phase 2 | Pending |
| FLD-05 | Phase 2 | Pending |
| FLD-06 | Phase 2 | Pending |
| FLD-07 | Phase 2 | Pending |
| EXP-01 | Phase 2 | Pending |
| EXP-02 | Phase 2 | Pending |
| EXP-03 | Phase 2 | Pending |
| DOC-04 | Phase 3 | Pending |
| DOC-05 | Phase 3 | Pending |
| FLD-02 | Phase 3 | Pending |
| FLD-03 | Phase 3 | Pending |
| FLD-04 | Phase 3 | Pending |
| FLD-08 | Phase 3 | Pending |
| FLD-09 | Phase 3 | Pending |
| SIG-02 | Phase 4 | Pending |
| SIG-03 | Phase 4 | Pending |
| SIG-04 | Phase 4 | Pending |
| SIG-05 | Phase 4 | Pending |
| LND-01 | Phase 5 | Pending |
| LND-02 | Phase 5 | Pending |
| LND-03 | Phase 5 | Pending |
| LND-04 | Phase 5 | Pending |
| PRV-03 | Phase 5 | Pending |

**Coverage:**

- v1 requirements: 29 total
- Mapped to phases: 29 ✓
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-16*
*Last updated: 2026-06-16 after roadmap creation (traceability populated)*
