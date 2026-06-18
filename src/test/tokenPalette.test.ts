/**
 * FND-01 + FND-02: Token palette static assertions.
 *
 * Reads src/index.css and asserts:
 *   FND-01 — No cold default-Tailwind palette values remain in :root.
 *             The warm bone / Signal Orange values are present.
 *   FND-02 — --font-mono is declared as a system stack (ui-monospace ...);
 *             no external @font-face src URL exists anywhere in the file.
 *
 * Source: 06-UI-SPEC.md § Token Contract / "What Must NOT Appear"
 *         06-RESEARCH.md § New Tests — Specifications
 *         06-VALIDATION.md § Validation Requirements (FND-01, FND-02 rows)
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ROOT is two levels up from src/test/ — same convention as privacyGuard.test.ts
const ROOT = join(import.meta.dirname, '../..')
const css = readFileSync(join(ROOT, 'src/index.css'), 'utf-8')

// ---------------------------------------------------------------------------
// FND-01: No cold token values survive the retheme
// ---------------------------------------------------------------------------

/** Exact cold hex values that must NOT appear after the warm-palette retheme.
 *  Source: 06-UI-SPEC.md § "What Must NOT Appear" and Existing Token Remap table.
 *  Note: #DC2626 (destructive) is intentionally kept — it is NOT in this list. */
const COLD_VALUES_REJECTED = [
  '#F9FAFB', // old --color-surface  (cold Tailwind surface)
  '#2563EB', // old --color-accent   (default Tailwind blue)
  '#E5E7EB', // old --color-canvas   (cold Tailwind canvas)
  '#111827', // old --color-text-primary  (cold near-black)
  '#6B7280', // old --color-text-secondary (cold grey)
  '#D1D5DB', // old --color-border   (cold grey rule)
] as const

/** Warm values that MUST be present after the retheme.
 *  Source: 06-UI-SPEC.md § Token Contract — locked hex values. */
const WARM_VALUES_REQUIRED = [
  '#FF4D00', // --color-accent  Signal Orange
  '#F5F2EA', // --color-surface warm bone
] as const

describe('FND-01: no cold default-Tailwind palette values remain in :root', () => {
  for (const hex of COLD_VALUES_REJECTED) {
    it(`does not contain cold value ${hex}`, () => {
      expect(css, `Cold value ${hex} must be removed from src/index.css`).not.toContain(hex)
    })
  }
})

describe('FND-01: warm bone / Signal Orange values are present', () => {
  for (const hex of WARM_VALUES_REQUIRED) {
    it(`contains warm value ${hex}`, () => {
      expect(css, `Warm value ${hex} must be present in src/index.css`).toContain(hex)
    })
  }
})

// ---------------------------------------------------------------------------
// FND-02: --font-mono is a system stack with no external URL
// ---------------------------------------------------------------------------

describe('FND-02: --font-mono is declared as a system stack', () => {
  it('--font-mono token is declared in src/index.css', () => {
    expect(css, '--font-mono must be declared in :root').toContain('--font-mono')
  })

  it('--font-mono value contains ui-monospace', () => {
    const match = css.match(/--font-mono\s*:\s*([^;]+)/)
    expect(
      match?.[1],
      '--font-mono value must contain ui-monospace (system stack, not a web font)',
    ).toContain('ui-monospace')
  })
})

describe('FND-02: no external @font-face src URL in src/index.css', () => {
  it('no url(https://) or url(http://) construct appears in the CSS (belt-check)', () => {
    // Mirrors the "font-face external url" pattern in privacyGuard.test.ts.
    // Allows optional quote/whitespace after the paren: url(  "https://  url('http://
    const externalFontUrl = /url\(\s*["']?https?:\/\//i
    expect(
      externalFontUrl.test(css),
      'An external asset-loading URL was found in src/index.css — this violates PAR-02',
    ).toBe(false)
  })
})
