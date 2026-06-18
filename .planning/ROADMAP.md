# Roadmap: FreeESign

## Shipped Milestones

- **v1.0 — Private In-Browser PDF Signing (MVP)** ✅ Shipped 2026-06-18 — 5 phases, 18 plans, 36 tasks. Open a PDF or image, place drawn or typed signatures plus initials/date/text/checkbox fields, zoom 50–200%, place on any page, undo/redo, and download a byte-identical signed PDF — entirely in the browser with zero third-party requests. Includes a personal landing page and saved-signature persistence.
  Full detail: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) · Requirements: [milestones/v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md) · Audit: [milestones/v1.0-MILESTONE-AUDIT.md](milestones/v1.0-MILESTONE-AUDIT.md)

  **Post-launch human task (carried forward):** run `vercel --prod` + attach free-esign.com DNS, set the real Buy Me a Coffee handle in `src/config.ts`, and run the live DevTools zero-third-party network audit. The build is fully deploy-ready — see `README.md` §Deploy. (LND-04)

## Next Milestone

Not yet defined. Run `/gsd-new-milestone` to scope the next version. Candidate themes:
- Launch hardening (post-deploy verification, OG/social meta, favicon polish)
- v2 enhancements: image-of-signature upload (ENH-01), page-thumbnail sidebar (ENH-02), snap-to-align guides (ENH-03), more fonts / ink color (ENH-04)
- Multi-party signing (MP-01 — the field model already reserves the recipient/role seam)

## Backlog

(none captured yet)
