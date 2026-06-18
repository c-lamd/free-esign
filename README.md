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

FreeESign is a fully static app — `npm run build` produces a self-contained `dist/`
folder you can deploy to any static host (Vercel, Netlify, Cloudflare Pages, GitHub
Pages, …). No server or backend is required.

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
