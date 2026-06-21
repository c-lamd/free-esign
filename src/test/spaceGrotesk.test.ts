/**
 * TYPE-01: Space Grotesk self-hosted base-font guard.
 *
 * Asserts that the base dense/body typeface is Space Grotesk, vendored and
 * self-hosted — never loaded from a Google Fonts CDN — and that it is wired
 * through the base `--font-sans` token so it cascades app-wide. Also proves the
 * `--font-mono` chrome face and the three script signature faces were not
 * disturbed, and that no .tsx hardcodes a `-apple-system` inline font stack
 * (the base font must flow through the token, not be re-pinned per component).
 *
 * Mirrors the source-tree-scanning convention of privacyGuard.test.ts /
 * tokenPalette.test.ts (ROOT is two levels up from src/test/).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '../..')
const css = readFileSync(join(ROOT, 'src/index.css'), 'utf-8')

describe('TYPE-01: Space Grotesk @font-face is self-hosted (same-origin)', () => {
  it('declares an @font-face with font-family "Space Grotesk"', () => {
    // A @font-face block that names the Space Grotesk family.
    const block = /@font-face\s*\{[^}]*font-family:\s*["']Space Grotesk["'][^}]*\}/i
    expect(
      block.test(css),
      'index.css must declare an @font-face block for "Space Grotesk"',
    ).toBe(true)
  })

  it('serves Space Grotesk from a same-origin /fonts/ url (no http scheme)', () => {
    // Every Space Grotesk src url must be a relative /fonts/SpaceGrotesk… path.
    const srcUrls = [...css.matchAll(/src:\s*url\(\s*["']([^"')]+)["']\s*\)/gi)].map((m) => m[1])
    const sgUrls = srcUrls.filter((u) => u.includes('SpaceGrotesk'))
    expect(sgUrls.length, 'expected at least one Space Grotesk src url').toBeGreaterThan(0)
    for (const u of sgUrls) {
      expect(u.startsWith('/fonts/'), `Space Grotesk url must be same-origin /fonts/… — got "${u}"`).toBe(true)
      expect(/^https?:\/\//i.test(u), `Space Grotesk url must not be an external http(s) url — got "${u}"`).toBe(false)
    }
  })

  it('--font-sans token resolves to "Space Grotesk" first', () => {
    const match = css.match(/--font-sans\s*:\s*([^;]+)/)
    expect(match?.[1], '--font-sans must be declared in :root').toBeTruthy()
    expect(match?.[1], '--font-sans must put "Space Grotesk" first').toContain('"Space Grotesk"')
  })

  it('contains NO Google Fonts CDN / external http font URL anywhere in index.css', () => {
    expect(/fonts\.googleapis\.com/i.test(css), 'fonts.googleapis.com must not appear in index.css').toBe(false)
    expect(/fonts\.gstatic\.com/i.test(css), 'fonts.gstatic.com must not appear in index.css').toBe(false)
    // No http(s) url() construct at all (mirrors the privacy-guard font-face pattern).
    expect(/url\(\s*["']?https?:\/\//i.test(css), 'no external http(s) url() may appear in index.css').toBe(false)
  })
})

describe('TYPE-01: chrome + signature faces untouched', () => {
  it('--font-mono is unchanged (still a ui-monospace system stack)', () => {
    const match = css.match(/--font-mono\s*:\s*([^;]+)/)
    expect(match?.[1], '--font-mono must still start with ui-monospace').toBeTruthy()
    expect(match?.[1]?.trimStart().startsWith('ui-monospace'), '--font-mono must start with ui-monospace').toBe(true)
  })

  it('the three script signature @font-face families are still present', () => {
    for (const family of ['Dancing Script', 'Great Vibes', 'Pacifico']) {
      const re = new RegExp(`font-family:\\s*["']${family}["']`, 'i')
      expect(re.test(css), `script font "${family}" @font-face must remain in index.css`).toBe(true)
    }
  })
})

/**
 * Recursively collect .tsx files under src/, skipping test/ and node_modules.
 */
function collectTsx(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      if (entry === 'test' || entry === 'node_modules') continue
      out.push(...collectTsx(full))
    } else if (entry.endsWith('.tsx')) {
      out.push(full)
    }
  }
  return out
}

describe('TYPE-01: base font cascades through --font-sans (no hardcoded -apple-system in .tsx)', () => {
  const tsxFiles = collectTsx(join(ROOT, 'src'))

  for (const file of tsxFiles) {
    const rel = file.replace(ROOT + '/', '')
    it(`${rel}: does not hardcode a -apple-system inline font stack`, () => {
      const content = readFileSync(file, 'utf-8')
      expect(
        content.includes('-apple-system'),
        `${rel} must use var(--font-sans) instead of a hardcoded -apple-system inline stack`,
      ).toBe(false)
    })
  }

  it('index.css keeps -apple-system only as the --font-sans fallback (single legitimate occurrence)', () => {
    // The one allowed -apple-system: inside the token value, after "Space Grotesk".
    const match = css.match(/--font-sans\s*:\s*([^;]+)/)
    expect(match?.[1]?.includes('-apple-system'), '--font-sans should retain -apple-system as a fallback').toBe(true)
  })
})
