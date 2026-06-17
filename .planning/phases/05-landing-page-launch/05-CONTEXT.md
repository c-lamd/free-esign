# Phase 5: Landing Page + Launch - Context

**Gathered:** 2026-06-17
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — grey-area answers auto-accepted with best judgement per user authorization

<domain>
## Phase Boundary

Phase 5 wraps the finished signing tool in a public landing page and prepares it for launch at free-esign.com. It adds: a personal, candid hero explaining why this exists; a "how it works" + privacy explainer; an optional Buy Me a Coffee link; a verified zero-third-party-request posture; and the Vercel deploy configuration.

**In scope:** the landing page (hero + how-it-works + privacy + footer), wiring the landing → signing-tool transition, an unobtrusive Buy Me a Coffee link, a privacy posture that passes a zero-third-party-request audit, and correct Vercel/Vite build + `vercel.json` config + a deploy/runbook doc.

**Out of scope / deferred to human (infra):** the actual `vercel --prod` deploy, attaching the free-esign.com domain + DNS, and the live DevTools network audit on the deployed site — these need the user's Vercel account and domain ownership (see Deferred). Everything buildable and verifiable locally is in scope.
</domain>

<decisions>
## Implementation Decisions

### Area 1: Landing Integration & Routing
- **No router.** Per CLAUDE.md ("for a single-page tool, skip react-router-dom — all state can live in Zustand"), add a new `'landing'` view to the existing `ViewState` machine in `documentStore.ts` and make it the **initial** view. A hero CTA ("Sign a document" / "Get started") transitions `view → 'empty'` (the UploadZone). The FreeESign wordmark in the TopBar returns to `'landing'`.
- The signing tool's internal flow (empty/loading/error/loaded) is unchanged; landing simply sits in front of it. `reset()` / "Open another" stay within the tool (→ 'empty'), not back to landing, so a signing session isn't lost.
- The landing is a new top-level component (`LandingPage.tsx`) rendered when `view === 'landing'`. The TopBar may render a minimal variant (just the wordmark) on the landing view, or the landing can include its own header.

### Area 2: Landing Content & Voice (LND-01, LND-02)
- **Hero (LND-01):** first-person, candid, personal. The story: it's genuinely hard to find a PDF signer that's actually free — most paywall the download, upload your document to a server, make you sign up, or quietly mangle the formatting. FreeESign was built to just sign a document, for free, privately. Keep it honest and human, not marketing-speak.
- **How it works (LND-02):** three steps — (1) Open your PDF or image, (2) Draw/type/place your signature and fields, (3) Download the signed file, unchanged. Each step one short line.
- **Privacy explainer (LND-02):** prominent, unambiguous: "Your document never leaves your browser. No uploads. No accounts. No tracking. It's all processed right here on your device." Tie it to the core value.
- A single primary CTA into the tool, repeated once near the bottom.

### Area 3: Buy Me a Coffee (LND-03)
- **Plain anchor link only — NO third-party widget/button script.** A `<a href="https://www.buymeacoffee.com/{handle}" target="_blank" rel="noopener noreferrer">` in the footer (and optionally a subtle header link). Embedding BMC's `<script>` button widget would load a third-party script and violate PRV-03 — explicitly forbidden. The link navigating away on click is fine; loading their JS on our page is not.
- The BMC handle is unknown — use a clearly-marked placeholder constant (e.g. `BUY_ME_A_COFFEE_URL`) the user fills in. Optional + unobtrusive (footer, not a popup).

### Area 4: Privacy Posture (PRV-03 + zero-third-party audit)
- **No analytics, no tracking, no error reporting, no third-party scripts, no third-party fonts/CDNs.** Everything self-hosted (already true through Phase 4). The landing adds no external requests.
- Add an automated guard where feasible: a test/script that scans the source (and/or built `dist/`) for external `http(s)://` origins in `<script src>`, `<link href>`, `fetch`, `@font-face src`, etc., and fails on any non-same-origin asset reference (allow the BMC anchor href, which is a navigation target, not a loaded asset). The full live DevTools audit on the deployed site is a human step (Deferred).
- Remove the default Vite `vite.svg` favicon reference if it implies anything external (it's local, but ensure the favicon is self-hosted); set a proper title/meta in index.html.

### Area 5: Deploy Config (LND-04)
- **vercel.json:** keep `outputDirectory: dist`; since the app is now a client-side view machine (no router), no SPA rewrite is strictly required, but add a catch-all rewrite to `index.html` so any path serves the app (defensive, and supports a future deep link). Ensure no Vercel analytics/speed-insights are enabled (PRV-03).
- **Build:** `npm run build` (tsc -b && vite build) must succeed; verify `dist/` is produced and self-contained.
- **Runbook:** add a short DEPLOY section (README or a docs note) covering `vercel --prod`, attaching free-esign.com + DNS, and the post-deploy network audit checklist. The actual deploy + domain + live audit are performed by the user (Deferred — needs their Vercel account + domain).

### Claude's Discretion
- Exact hero copy wording (keep it candid/personal, match the project voice), section ordering, and visual layout (reuse Phase 1–4 tokens — colors, type scale, spacing; this is the marketing surface so a bit more visual warmth is fine while staying on-system).
- Whether the TopBar shows a reduced variant on landing vs the landing carrying its own header.
- The precise automated privacy-guard mechanism (source grep test vs dist scan) — pick the one that's reliable in CI/Vitest.
- Favicon/OG-meta polish.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/store/documentStore.ts` — `ViewState = 'empty'|'loading'|'error'|'loaded'`; initial `view: 'empty'`; `setView`, `reset`. **Add** `'landing'` to ViewState, make it the initial view, add a `startSigning()` (or reuse setView('empty')) transition and a `goToLanding()`.
- `src/App.tsx` — renders by `view`; add `{view === 'landing' && <LandingPage />}` and gate TopBar/tool chrome appropriately.
- `src/components/TopBar.tsx` — wordmark + tool actions; make the wordmark navigate to landing; consider a reduced landing header.
- `src/index.css` — design tokens + @font-face; landing reuses tokens. Script fonts (Phase 4) are available if a tasteful signature flourish is wanted in the hero (optional).
- `index.html` — already has a good title; ensure favicon + meta are self-hosted and add description/OG meta.
- `vercel.json` — currently `{ "outputDirectory": "dist" }`; extend with a catch-all rewrite; keep analytics off.
- Tests: Vitest + jsdom; add a LandingPage render test (hero, CTA transitions view to 'empty', privacy text present, BMC link present + correct rel) and a privacy-guard test (no third-party asset URLs). New tests in `src/test/`.

### Established Patterns
- Zustand view state machine; immutable updates; aria-disabled over disabled; self-hosted assets only (zero third-party network — the defining privacy guarantee).
- Components are plain React + inline styles using CSS custom-property tokens; no CSS framework runtime beyond Tailwind v4 setup.

### New Dependencies
- None expected. No router, no analytics, no BMC script. (If a tiny icon is wanted, inline SVG — no icon-font/CDN.)
</code_context>

<specifics>
## Specific Ideas

- The hero must sound like a real person who got fed up with fake-free PDF signers — that authenticity IS the brand. Avoid generic SaaS copy.
- The privacy promise is the headline feature, not fine print — state it boldly and plainly.
- PRV-03 is non-negotiable: the landing page must not introduce a single third-party request. The Buy Me a Coffee integration is a link, never an embedded script.
- Deploy is the one place automation stops at the repo boundary: build + config + runbook here; the human runs `vercel --prod` and attaches the domain.
</specifics>

<deferred>
## Deferred Ideas (human / infra)

- **Actual production deploy** (`vercel --prod`) — needs the user's Vercel account.
- **Domain attachment + DNS** for free-esign.com — needs domain ownership + registrar access.
- **Live DevTools network audit** on the deployed site (success criterion 3 / PRV-03 final proof) — human verification on the real deployment; the local automated guard covers the source/build posture.
- **Real Buy Me a Coffee handle** — user supplies their BMC URL to replace the placeholder.
- OG/social preview image, custom analytics-free uptime monitoring — future polish.
</deferred>
