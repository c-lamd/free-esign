// Copy self-hosted pdf.js assets from the installed pdfjs-dist into public/ so
// they are served from the app's OWN origin at runtime (PRV-02 — zero third-party
// network requests while signing). Vite serves public/ at the site root in both
// `dev` and `build`, so this keeps /pdf.worker.min.mjs, /cmaps/ and /standard_fonts/
// available without committing the (large, version-specific) assets to git.
//
// Runs from package.json `prepare` (post-install), `predev`, and `prebuild` so the
// copied assets always match the installed pdfjs-dist version. Re-runnable/idempotent.
import { createRequire } from 'node:module'
import { cpSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const pdfjsDist = dirname(require.resolve('pdfjs-dist/package.json'))

const publicDir = join(process.cwd(), 'public')
mkdirSync(publicDir, { recursive: true })

// 1. Worker (single file)
cpSync(
  join(pdfjsDist, 'build', 'pdf.worker.min.mjs'),
  join(publicDir, 'pdf.worker.min.mjs'),
)

// 2. CMaps + standard fonts (directories) — replace wholesale so stale files from a
//    prior pdfjs-dist version never linger.
for (const dir of ['cmaps', 'standard_fonts']) {
  const dest = join(publicDir, dir)
  rmSync(dest, { recursive: true, force: true })
  cpSync(join(pdfjsDist, dir), dest, { recursive: true })
}

console.log('[copy-pdf-assets] worker + cmaps + standard_fonts copied to public/')
