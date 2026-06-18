# FreeESign

**Sign PDFs and images in your browser. No uploads, no accounts, no tracking. Free for everyone.**

FreeESign is a privacy-first web app for signing your own documents. Upload a PDF (or image), place your signature and other fields anywhere on it — drag and resize to position them — and download the signed file with the original content preserved exactly. Signatures can be drawn or typed (rendered in script fonts) and are saved in your browser for reuse. Nothing is ever uploaded to a server.

## Features

- Upload a PDF or image and sign it entirely in the browser
- Draw or type your signature (Dancing Script, Great Vibes, Pacifico)
- Drag and resize placed fields anywhere on the document
- Save signatures and initials for reuse across sessions (stored in IndexedDB)
- Download a signed PDF with original bytes preserved — no re-encoding
- Zero third-party requests: no analytics, no tracking, no CDN fonts, no external scripts

## Development

### Prerequisites

- Node.js 18+
- npm 9+

### Install and run

```bash
npm install
npm run dev
```

### Test

```bash
npm test
```

Includes `src/test/privacyGuard.test.ts` which scans the source tree for external
asset-loading URLs (PRV-03 guard). The test fails if any `<script src="https://...">`,
`<link href="https://...">`, `url("https://...")`, or `fetch("https://...")` is introduced
into `src/` or `index.html`.

### Build

```bash
npm run build
```

Runs `tsc -b && vite build`. Produces a self-contained `dist/` directory:
- `dist/index.html` — app entry point
- `dist/assets/` — bundled JS and CSS
- `dist/fonts/` — self-hosted script fonts (Dancing Script, Great Vibes, Pacifico)
- `dist/pdf.worker.min.mjs` — pdf.js worker (same-origin, copied from pdfjs-dist)
- `dist/cmaps/` — pdf.js character maps for international PDFs

All assets are same-origin. No external resources are loaded at runtime.

---

## Deploy

> These steps require a Vercel account and a domain you own.

### Step-by-step checklist

- [ ] **1. Prerequisites**
  - A Vercel account (free tier is sufficient)
  - The `vercel` CLI installed globally: `npm i -g vercel`
  - Ownership of `free-esign.com` at a domain registrar

- [ ] **2. (Optional) Set your own support link**

  If you're forking FreeESign, point the footer "Buy me a coffee" link at your own handle in `src/config.ts`:

  ```typescript
  // src/config.ts
  export const BUY_ME_A_COFFEE_URL = 'https://www.buymeacoffee.com/your-handle'
  ```

  Then rebuild:
  ```bash
  npm run build
  ```

- [ ] **3. Verify the build is self-contained**

  ```bash
  ls dist/index.html dist/fonts/ dist/pdf.worker.min.mjs
  ```

  Confirm `dist/index.html` exists and references only same-origin asset paths (e.g., `/assets/`, `/fonts/`).

- [ ] **4. Deploy to Vercel**

  From the repo root:
  ```bash
  vercel --prod
  ```

  Vercel detects the Vite/static configuration via `vercel.json` (`outputDirectory: dist`).
  The catch-all rewrite in `vercel.json` ensures all paths serve `index.html` (SPA behavior):
  ```json
  { "source": "/(.*)", "destination": "/index.html" }
  ```

  Confirm the production URL serves the landing page, the CTA enters the signing tool,
  and the FreeESign wordmark returns to the landing page.

- [ ] **5. Attach free-esign.com**

  In the Vercel project's **Domains** settings, add `free-esign.com`.
  Copy the DNS records shown in the Vercel dashboard (usually an A record and/or CNAME)
  and configure them at your registrar. Wait for DNS propagation (typically 5–30 minutes).

  Confirm `https://free-esign.com` loads the landing page.

- [ ] **6. Post-deploy network audit (PRV-03 final proof)**

  On the live site at `https://free-esign.com`, open DevTools → Network tab. Run the
  full signing workflow:
  1. Open a PDF
  2. Place one or more fields (signature, text, date, checkbox, initials)
  3. Download the signed PDF

  Confirm **EVERY** network request is same-origin (`free-esign.com`) — zero requests
  to analytics services, tracking pixels, CDN fonts, error-reporting endpoints, or any
  third-party domain. The automated `privacyGuard.test.ts` covers the source/build
  posture; this live DevTools capture is the final human proof.

- [ ] **7. Verify the BMC link**

  Click the footer "Buy me a coffee" link and confirm it opens your real BMC page
  in a new tab.

### Privacy guardrails (do NOT add)

- Do NOT install `@vercel/analytics` or `@vercel/speed-insights`
- Do NOT enable Vercel Analytics in the Vercel project dashboard
- Both inject third-party scripts that send data to Vercel's analytics servers,
  violating PRV-03 (zero third-party asset-loading requests)
- The automated `privacyGuard.test.ts` will catch `<script src="https://...">` injections
  in source; the `vercel.json` assertions guard against `analytics`/`speedInsights` keys
  being added to that config file

---

## Privacy

FreeESign is designed with privacy as a hard constraint:

- **No server uploads** — your document never leaves your browser
- **No accounts** — no login, no registration, no email
- **No tracking** — no analytics, no telemetry, no error reporting
- **No CDN fonts** — script fonts are self-hosted in `public/fonts/`
- **No third-party scripts** — the BMC "buy me a coffee" link is a plain `<a>` anchor,
  not a widget script
- **Document integrity** — PDFs are signed using incremental save (pdf-lib-incremental-save),
  which appends a new revision to the original bytes rather than re-encoding the file

## License

FreeESign is released under the [MIT License](./LICENSE) — free to use, fork, and build on.
