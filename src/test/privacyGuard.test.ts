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
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
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
  { name: 'fetch external', re: /fetch\s*\(\s*["']https?:\/\//i },
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
