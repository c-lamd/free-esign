/**
 * PRV-03: Zero third-party asset-loading requests guard.
 *
 * Scans the SOURCE tree (src/ + index.html) for external asset-loading URL
 * constructs. Does NOT scan dist/ — the bundled JS contains ~25 false-positive
 * https:// strings from bundled dependencies (React error URLs, xmlns
 * declarations, react-pdf GitHub strings, etc.).
 *
 * ASSET_LOADING_PATTERNS are scoped to constructs that cause the browser to
 * make a network request: <script src=>, <link href=>, <img src=>,
 * <iframe src=>, url( (CSS @font-face), and fetch(. They do NOT match:
 *   - xmlns="http://www.w3.org/2000/svg" (present in 6 components)
 *   - <a href="https://..."> (BMC navigation link — user-initiated, not an asset)
 *   - BUY_ME_A_COFFEE_URL = 'https://...' (bare string constant, no wrapper)
 *
 * Also asserts that vercel.json contains no analytics/speedInsights keys
 * and has the catch-all SPA rewrite (LND-04).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// ROOT is two levels up from src/test/ → project root
const ROOT = join(import.meta.dirname, '../..')

/**
 * Recursively collect files with the given extensions under `dir`.
 * Skips directories named 'test', 'node_modules', or 'dist':
 *   - 'test'         — test mocks contain blob:http://localhost/ mock URLs
 *   - 'node_modules' — third-party code; not our source
 *   - 'dist'         — bundled output; ~25 false-positive https:// strings
 */
function collectFiles(dir: string, exts: string[]): string[] {
  const result: string[] = []
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch (err) {
    throw new Error(`collectFiles: cannot read directory ${dir}: ${String(err)}`)
  }
  for (const entry of entries) {
    const full = join(dir, entry)
    let stat: ReturnType<typeof statSync>
    try {
      stat = statSync(full)
    } catch (err) {
      // Skip broken symlinks and permission-denied entries with a clear message
      throw new Error(`collectFiles: cannot stat ${full}: ${String(err)}`)
    }
    if (stat.isDirectory()) {
      if (entry === 'test' || entry === 'node_modules' || entry === 'dist') continue
      result.push(...collectFiles(full, exts))
    } else if (exts.some((e) => entry.endsWith(e))) {
      result.push(full)
    }
  }
  return result
}

/**
 * Asset-loading patterns — these constructs cause the browser to make a
 * network request. Each pattern MUST NOT appear in the source tree.
 *
 * Safe from false positives:
 *   - <script[^>]+src=  does NOT match xmlns=, <a href=
 *   - <link[^>]+href=   does NOT match <a href= (anchor links are permitted)
 *   - url(https://      does NOT match xmlns="http://..."
 *   - fetch("https://   does NOT match bare string constants
 */
const ASSET_LOADING_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: 'script src external', re: /<script[^>]+src=["']https?:\/\//i },
  { name: 'link href external (stylesheet/preload)', re: /<link[^>]+href=["']https?:\/\//i },
  { name: 'img src external', re: /<img[^>]+src=["']https?:\/\//i },
  { name: 'iframe src external', re: /<iframe[^>]+src=["']https?:\/\//i },
  { name: 'font-face external url', re: /url\(\s*["']?https?:\/\//i },
  // Matches fetch("https://..."), fetch('https://...'), and fetch(`https://...`).
  // Variable-based URLs (e.g. fetch(url)) require a separate manual review step
  // and cannot be caught reliably with a simple regex.
  { name: 'fetch external', re: /fetch\s*\(\s*["'`]https?:\/\//i },
]

describe('PRV-03: zero third-party asset-loading requests', () => {
  // Scan set: index.html + src/**/*.{ts,tsx,css} (excluding src/test/)
  const htmlFiles = [join(ROOT, 'index.html')]
  const srcFiles = collectFiles(join(ROOT, 'src'), ['.ts', '.tsx', '.css'])
  const allFiles = [...htmlFiles, ...srcFiles]

  for (const file of allFiles) {
    const content = readFileSync(file, 'utf-8')
    const relPath = file.replace(ROOT + '/', '')

    for (const { name, re } of ASSET_LOADING_PATTERNS) {
      it(`${relPath}: no "${name}"`, () => {
        expect(
          re.test(content),
          `Found external asset-loading URL matching "${name}" in ${relPath}`,
        ).toBe(false)
      })
    }
  }
})

describe('LND-04: vercel.json integrity', () => {
  const vercelConfigPath = join(ROOT, 'vercel.json')
  const vercelConfig = JSON.parse(readFileSync(vercelConfigPath, 'utf-8')) as Record<string, unknown>

  it('vercel.json has outputDirectory === "dist"', () => {
    expect(vercelConfig['outputDirectory']).toBe('dist')
  })

  it('vercel.json has catch-all SPA rewrite to /index.html', () => {
    const rewrites = vercelConfig['rewrites'] as Array<{ source: string; destination: string }>
    expect(Array.isArray(rewrites)).toBe(true)
    const catchAll = rewrites.find(
      (r) => r.source === '/(.*)'  && r.destination === '/index.html',
    )
    expect(
      catchAll,
      'Expected a catch-all rewrite { source: "/(.*)", destination: "/index.html" } in vercel.json',
    ).toBeDefined()
  })

  it('vercel.json has no "analytics" key (PRV-03)', () => {
    expect(
      Object.prototype.hasOwnProperty.call(vercelConfig, 'analytics'),
      'vercel.json must not have an "analytics" key — this would inject Vercel Analytics scripts (PRV-03)',
    ).toBe(false)
  })

  it('vercel.json has no "speedInsights" key (PRV-03)', () => {
    expect(
      Object.prototype.hasOwnProperty.call(vercelConfig, 'speedInsights'),
      'vercel.json must not have a "speedInsights" key — this would inject Speed Insights scripts (PRV-03)',
    ).toBe(false)
  })
})

/**
 * PAR-06: same-origin /api permitted — but ONLY as a relative path.
 *
 * Phase 13 introduces the app's first legitimate client fetches:
 * `/api/count` (GET on hub mount) and `/api/increment` (POST on each export).
 * These are RELATIVE same-origin paths — no protocol, no host — so they do NOT
 * match the `fetch external` ASSET_LOADING_PATTERN (`fetch("https?://...`) and
 * already pass the PRV-03 scan above unchanged.
 *
 * This block makes the allowance EXPLICIT and TIGHT (T-13-09):
 *   - The only newly-permitted construct is a leading-slash relative `/api/...`.
 *   - A protocol+host before `/api` (e.g. fetch("https://evil.com/api")) is STILL
 *     a violation — caught by the unchanged `fetch external` pattern, re-asserted
 *     here for PAR-06 traceability. No existing rule is weakened.
 *   - The expected relative endpoints must actually appear in client source, so
 *     the same-origin contract is real, not theoretical.
 */
describe('PAR-06: same-origin /api permitted (relative-only)', () => {
  const srcFiles = collectFiles(join(ROOT, 'src'), ['.ts', '.tsx'])

  // Absolute API URL: a protocol+host immediately preceding /api. This is the
  // construct the allow-rule must NEVER permit. It is a strict subset of the
  // existing `fetch external` pattern, named separately here for PAR-06.
  const ABSOLUTE_API_URL = /fetch\s*\(\s*["'`]https?:\/\/[^"'`]*\/api/i

  for (const file of srcFiles) {
    const content = readFileSync(file, 'utf-8')
    const relPath = file.replace(ROOT + '/', '')

    it(`${relPath}: any /api fetch is RELATIVE (no protocol+host before /api)`, () => {
      expect(
        ABSOLUTE_API_URL.test(content),
        `Found an ABSOLUTE /api fetch URL in ${relPath} — only relative "/api/..." is permitted (PAR-06)`,
      ).toBe(false)
    })
  }

  it('src/lib/counter.ts references the relative endpoints "/api/count" and "/api/increment"', () => {
    const counter = readFileSync(join(ROOT, 'src', 'lib', 'counter.ts'), 'utf-8')
    expect(
      counter.includes("'/api/count'") || counter.includes('"/api/count"') || counter.includes('`/api/count`'),
      "src/lib/counter.ts must reference the relative endpoint '/api/count' (PAR-06)",
    ).toBe(true)
    expect(
      counter.includes("'/api/increment'") ||
        counter.includes('"/api/increment"') ||
        counter.includes('`/api/increment`'),
      "src/lib/counter.ts must reference the relative endpoint '/api/increment' (PAR-06)",
    ).toBe(true)
  })
})

/**
 * PAR-06 (T-13-10): @upstash/redis is SERVER-SIDE ONLY.
 *
 * The store client (and its REST token/SDK) lives exclusively under api/*.ts. It
 * must NEVER be imported anywhere under src/ — if it were, the credentials/SDK
 * could be bundled into the browser, defeating the privacy guarantee. This block
 * scans every client source file and asserts none of them IMPORT the package.
 *
 * It matches the actual import/require constructs — `import ... from '@upstash/redis'`,
 * `require('@upstash/redis')`, and dynamic `import('@upstash/redis')` — rather than
 * a bare substring of the package name. That deliberately ignores the harmless
 * comment in src/lib/counter.ts that mentions "@upstash/redis" in prose ("This file
 * MUST NOT import @upstash/redis") — a comment is not an import and must not fail
 * the build. The needle below is the only legitimate occurrence of the literal
 * specifier under src/, and it is a test asserting absence in OTHER files.
 */
describe('PAR-06: @upstash/redis is server-side only', () => {
  const srcFiles = collectFiles(join(ROOT, 'src'), ['.ts', '.tsx'])

  // An IMPORT/REQUIRE of the package — not a bare mention. Covers:
  //   import x from '@upstash/redis'   /  import '@upstash/redis'
  //   from '@upstash/redis'  (named/default/namespace import tails)
  //   require('@upstash/redis')  /  import('@upstash/redis')  (dynamic)
  const UPSTASH_IMPORT =
    /(?:\bfrom\s*|\brequire\s*\(\s*|\bimport\s*\(\s*|\bimport\s+)["'`]@upstash\/redis["'`]/

  for (const file of srcFiles) {
    const content = readFileSync(file, 'utf-8')
    const relPath = file.replace(ROOT + '/', '')

    it(`${relPath}: does not import @upstash/redis`, () => {
      expect(
        UPSTASH_IMPORT.test(content),
        `${relPath} imports @upstash/redis — the store client is SERVER-ONLY and must live only under api/ (PAR-06, T-13-10). It must never be bundled to the browser.`,
      ).toBe(false)
    })
  }
})
