# FreeESign

## What This Is

FreeESign is a free, privacy-first web app for signing your own documents. You upload a PDF (or image), place your signature and other fields anywhere on it — dragging and resizing to position them — and download the signed file with the original content preserved exactly. Signatures can be drawn or typed (rendered in script fonts) and are saved in your browser for reuse. Nothing is ever uploaded to a server, there are no accounts, and it's free for everyone.

It's built for anyone who just needs to sign a document and is tired of "free" PDF signers that paywall the download, upload your documents to who-knows-where, or quietly mangle the formatting.

## Core Value

**Sign a PDF in your browser, for free, without your document ever leaving your device or being altered.** If everything else fails, this one flow — upload → place signature → download an unaltered signed file — must work flawlessly.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

### Active

<!-- Current scope (v1). Building toward these. All are hypotheses until shipped. -->

- [ ] Upload a PDF or image and view it in the browser
- [ ] Create a signature by drawing it (mouse/touch/trackpad)
- [ ] Create a signature by typing it, rendered in a choice of script fonts
- [ ] Save signatures (and initials) in the browser for reuse — no login
- [ ] Place signature, initials, date, free text, and checkbox/X fields on a document
- [ ] Drag and resize placed fields to position them anywhere on any page
- [ ] Download the signed document with the original content unaltered (overlay-only, never regenerated)
- [ ] Word docs prompt the user to "Save as PDF first" rather than converting (avoids formatting shifts)
- [ ] Landing page with a personal, ranty hero + free/privacy positioning
- [ ] Optional "Buy Me a Coffee" tip link

### Out of Scope

<!-- Explicit boundaries with reasoning to prevent re-adding. -->

- **Multi-party / send-to-others signing (DocuSign-style routing)** — Deferred to a future milestone. Far larger build (email routing, signing order, tracking, audit trails). v1 is self-signing only, but the architecture should leave room to add this later.
- **User accounts / cloud sync** — Conflicts with the privacy-first, browser-only model. Signatures persist locally instead.
- **Native .docx upload + conversion** — Faithful Word→PDF conversion either shifts formatting (the exact problem we're solving) or requires a server. We ask the user to export to PDF first instead.
- **Cryptographic / PKI digital signatures** — Visual electronic signatures cover what virtually everyone actually needs; certificate-based signing is a different, heavier product.
- **Server-side document storage or processing** — Documents must never leave the browser. This is a core privacy promise, not an optimization.

## Context

- **Origin story / why it exists:** Truly free, private PDF signing tools are hard to find. Existing tools paywall the export, upload documents to remote servers, or alter text/formatting during processing. This is the frustration the landing page hero will lean into.
- **Audience:** The author first, then the general public. Free forever.
- **Privacy as a selling point:** "Your documents never leave your browser" is a headline feature, not a footnote.
- **Domain:** `free-esign.com` (purchased 2026-06-16). Name doubles as SEO for "free PDF signing tool." To be linked to the Vercel deployment once the app is deployable (a later deployment phase).
- **Monetization intent:** Stay free; an optional, non-intrusive "Buy Me a Coffee" tip is the only money model for now. Ads were considered but clash with the clean/private feel.
- **Deployment:** Intended for Vercel, which favors a static / client-side-first app with minimal or no backend.

## Constraints

- **Document integrity**: Zero alteration of the uploaded document — overlay signatures onto the original file bytes, never re-encode or regenerate the original content. This is a hard guarantee for PDFs and images.
- **Privacy / Architecture**: Client-side only — no document upload, no accounts, no tracking. All processing happens in the browser.
- **Persistence**: Saved signatures live in browser storage (localStorage), not a server.
- **Cost / Hosting**: Vercel-hostable and cheap-to-free to run — implies a static/client-side app, no heavy backend.
- **Business**: Free for the general public; any monetization must be optional and unobtrusive.

## Key Decisions

<!-- Decisions that constrain future work. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Self-signing only for v1; architect for multi-party later | Matches "documents I need to sign"; multi-party is a far larger build | — Pending |
| Browser-only, no accounts, nothing uploaded | Privacy is the core selling point + enables free/cheap hosting | — Pending |
| Overlay onto original file bytes, never regenerate | Preserves formatting exactly — the thing competing tools get wrong | — Pending |
| PDFs + images in v1; Word → "export to PDF" prompt | Faithful Word conversion needs a server or shifts formatting | — Pending |
| Saved signatures persist in localStorage | No login needed, stays private and client-side | — Pending |
| Monetize via optional "Buy Me a Coffee" only | On-brand with free + privacy; ads would undercut the clean feel | — Pending |
| Name "FreeESign" / domain `free-esign` | Clear pitch + strong SEO for "free PDF signing tool" | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-16 after initialization*
